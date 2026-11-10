import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { useState, useEffect } from 'react';
import { api } from '../../../../../services/api';
import type { ExportParcelItem, EditFormData, EditFormDefectItem, ModalFeedbackMessage, ActionFeedbackMessage } from '../types';
import { initializeEditFormData, buildReportPayload, type ServerReportData } from '../utils/reportDataTransformers';

interface UsePhase1ReportPreviewProps {
  setActionMessage: (msg: ActionFeedbackMessage | null) => void;
}

export const usePhase1ReportPreview = ({
  setActionMessage,
}: UsePhase1ReportPreviewProps) => {
  const [previewParcel, setPreviewParcel] = useState<ExportParcelItem | null>(null);
  const [previewHtmlContent, setPreviewHtmlContent] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewReportData, setPreviewReportData] = useState<ServerReportData | Record<string, unknown> | null>(null);
  const [previewTab, setPreviewTab] = useState<'html' | 'edit' | 'json'>('html');
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | '100' | '75' | '125'>('100');
  const [previewRenderKey, setPreviewRenderKey] = useState<number>(0);
  const [isSavingEdits, setIsSavingEdits] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [defectFilterQuery, setDefectFilterQuery] = useState<string>('');
  const [modalFeedback, setModalFeedback] = useState<ModalFeedbackMessage | null>(null);
  const [enableWatermark, setEnableWatermark] = useState<boolean>(true);
  const [selectedRevision, setSelectedRevision] = useState<number | undefined>(undefined);
  // File PDF Rev đã lưu đang xem (blob URL) và mã băm máy chủ trả về: xem Rev = đúng bytes tải về.
  const [storedPdfBlobUrl, setStoredPdfBlobUrl] = useState<string | null>(null);
  const [storedPdfSha256, setStoredPdfSha256] = useState<string | null>(null);

  useEffect(() => {
    if (!storedPdfBlobUrl) return;
    return () => {
      URL.revokeObjectURL(storedPdfBlobUrl);
    };
  }, [storedPdfBlobUrl]);

  // Manage Blob URL for HTML preview
  useEffect(() => {
    if (!previewHtmlContent) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }
    const blob = new Blob([previewHtmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewHtmlContent, previewRenderKey]);

  const parcelIdOrFallback = (p: ExportParcelItem) => p.activePhase1ReportId || p.id;
  const reportIdOf = (p: ExportParcelItem): string => p.activePhase1ReportId || p.id || p.projectParcelCode;
  const revLabel = (rev: number): string => String(rev).padStart(2, '0');

  const readHeader = (headers: unknown, name: string): string | null => {
    if (!headers || typeof headers !== 'object') return null;
    const value = (headers as Record<string, unknown>)[name.toLowerCase()];
    return typeof value === 'string' && value ? value : null;
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  };

  /** Lấy đúng file PDF Rev đã lưu trên máy chủ (không render lại). */
  const fetchStoredReleasePdf = async (reportId: string, rev: number): Promise<{ blob: Blob; sha256: string | null }> => {
    const response = await api.get(`/reports/${encodeURIComponent(reportId)}/releases/${rev}/pdf`, {
      responseType: 'blob',
    });
    return {
      blob: new Blob([response.data], { type: 'application/pdf' }),
      sha256: readHeader(response.headers, 'x-content-sha256'),
    };
  };

  /** Xem một Rev: nạp file PDF đã lưu vào iframe và JSON chi tiết của Rev đó. */
  const loadStoredRevision = async (parcel: ExportParcelItem, rev: number): Promise<void> => {
    const reportId = reportIdOf(parcel);
    const [pdf, dataRes] = await Promise.all([
      fetchStoredReleasePdf(reportId, rev),
      api.get(`/reports/${encodeURIComponent(reportId)}`, { params: { rev } }),
    ]);
    setStoredPdfBlobUrl(URL.createObjectURL(pdf.blob));
    setStoredPdfSha256(pdf.sha256);
    const repData = dataRes.data?.data || dataRes.data;
    setPreviewReportData(repData);
    setEditFormData(initializeEditFormData(repData, parcel));
    setModalFeedback({
      type: 'info',
      text: `Đang hiển thị file PDF Rev.${revLabel(rev)} đã lưu trữ${pdf.sha256 ? ` (SHA-256: ${pdf.sha256.substring(0, 12)}…)` : ''}. Đây chính là file tải về.`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    });
  };

  const handleOpenPreview = async (parcel: ExportParcelItem, revOverride?: number) => {
    setPreviewParcel(parcel);
    setSelectedRevision(revOverride);
    setStoredPdfBlobUrl(null);
    setStoredPdfSha256(null);
    setIsPreviewLoading(true);
    setPreviewTab('html');
    setPreviewHtmlContent(null);
    setPreviewReportData(null);

    const reportId = reportIdOf(parcel);
    const previewEndpoint = `/reports/${encodeURIComponent(reportId)}/preview/html`;

    try {
      if (revOverride !== undefined) {
        await loadStoredRevision(parcel, revOverride);
        return;
      }
      const [htmlResResult, dataResResult] = await Promise.allSettled([
        api.get(previewEndpoint, {
          params: { watermark: String(enableWatermark) },
          responseType: 'text',
        }),
        api.get(`/reports/${encodeURIComponent(reportId)}`),
      ]);

      if (htmlResResult.status === 'fulfilled') {
        const html = htmlResResult.value.data;
        setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
        setPreviewRenderKey((k) => k + 1);
      } else {
        console.warn('[Preview] Lỗi khi nạp HTML template:', htmlResResult.reason);
      }

      let repData = null;
      if (dataResResult.status === 'fulfilled') {
        repData = dataResResult.value.data?.data || dataResResult.value.data;
        setPreviewReportData(repData);
      } else {
        console.warn('[Preview] Không thể tải chi tiết report JSON, dùng fallback parcel data:', dataResResult.reason);
      }

      setEditFormData(initializeEditFormData(repData, parcel));

      if (htmlResResult.status === 'rejected' && dataResResult.status === 'rejected') {
        setActionMessage({
          type: 'error',
          text: `Không thể kết nối và nạp báo cáo cho lô ${parcel.projectParcelCode}. Vui lòng thử lại.`,
        });
      }
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleOpenPreview] Lỗi khi nạp xem trước:', err);
      setEditFormData(initializeEditFormData(null, parcel));
      setActionMessage({
        type: 'error',
        text: `Không thể nạp HTML xem trước cho lô ${parcel.projectParcelCode}: ${getErrorMessage(err, 'Lỗi kết nối')}`,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSelectRevision = async (rev?: number) => {
    setSelectedRevision(rev);
    if (!previewParcel) return;
    const reportId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;
    setIsPreviewLoading(true);
    try {
      if (rev !== undefined) {
        await loadStoredRevision(previewParcel, rev);
        return;
      }
      setStoredPdfBlobUrl(null);
      setStoredPdfSha256(null);
      const [htmlRes, dataRes] = await Promise.all([
        api.get(`/reports/${encodeURIComponent(reportId)}/preview/html`, {
          params: { watermark: String(enableWatermark) },
          responseType: 'text',
        }),
        api.get(`/reports/${encodeURIComponent(reportId)}`),
      ]);
      const html = htmlRes.data;
      setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
      setPreviewRenderKey((k) => k + 1);
      const repData = dataRes.data?.data || dataRes.data;
      setPreviewReportData(repData);
      setEditFormData(initializeEditFormData(repData, previewParcel));

      setModalFeedback({
        type: 'info',
        text: 'Đang hiển thị bản hiện hành (render từ dữ liệu mới nhất).',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleSelectRevision] Lỗi khi chuyển phiên bản Rev:', err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tải phiên bản Rev: ${getErrorMessage(err, 'Lỗi server')}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleUpdateFormField = <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => {
    setEditFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
    setHasUnsavedChanges(true);
  };

  const handleUpdateDefectField = <K extends keyof EditFormDefectItem>(defectId: string, field: K, value: EditFormDefectItem[K]) => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defects: prev.defects.map((d) => (d.id === defectId ? { ...d, [field]: value } : d)),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleAddDefect = () => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      const nextIdx = prev.defects.length + 1;
      const newDefect: EditFormDefectItem = {
        id: `custom-defect-${Date.now()}`,
        floorIndex: 0,
        floorName: 'Tầng 1',
        zoneIndex: 0,
        zoneCode: 'Z-01',
        defectIndex: nextIdx,
        defectCode: `D-${String(nextIdx).padStart(2, '0')}`,
        defectType: 'Nứt tường gạch / vách ngăn',
        crackDirection: 'Xiên / Ngẫu nhiên',
        widthMaxMm: 0.2,
        lengthMm: 150,
        activityState: 'U',
        notes: '',
        zoneNotes: '',
        burlandGrade: 1,
      };
      return {
        ...prev,
        defects: [...prev.defects, newDefect],
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleDeleteDefect = (defectId: string) => {
    setEditFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defects: prev.defects.filter((d) => d.id !== defectId),
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveReportEdits = async (_isNewRevision: boolean = false) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    const msg = 'Chức năng sửa dữ liệu trực tiếp đã ngừng hỗ trợ. Mọi chỉnh sửa bắt buộc thực hiện tại phân hệ Thẩm định (Audit Studio).';
    setModalFeedback({ type: 'error', text: msg, timestamp: timeStr });
    setActionMessage({ type: 'error', text: msg });
  };

  const handleApplyPreviewWithoutSaving = async () => {
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    const msg = 'Chức năng sửa dữ liệu trực tiếp đã ngừng hỗ trợ. Vui lòng sử dụng nút "Chuyển sang màn hình Thẩm định" để chỉnh sửa hồ sơ.';
    setModalFeedback({ type: 'info', text: msg, timestamp: timeStr });
    setActionMessage({ type: 'info', text: msg });
  };

  const handleSwitchTab = async (targetTab: 'html' | 'edit' | 'json') => {
    if (targetTab === 'edit') {
      await handleApplyPreviewWithoutSaving();
      return;
    }
    setPreviewTab(targetTab);
  };

  const handleOpenPreviewInNewTab = () => {
    if (selectedRevision !== undefined && storedPdfBlobUrl) {
      window.open(storedPdfBlobUrl, '_blank');
      return;
    }
    if (previewBlobUrl) {
      window.open(previewBlobUrl, '_blank');
    } else if (previewHtmlContent) {
      const blob = new Blob([previewHtmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      const activeReportId = previewParcel?.activePhase1ReportId || (previewParcel ? parcelIdOrFallback(previewParcel) : '') || (previewParcel?.projectParcelCode || '');
      const baseApi = (api.defaults.baseURL || '/api/v1').replace(/\/+$/, '');
      window.open(`${baseApi}/reports/${encodeURIComponent(activeReportId)}/preview/html?watermark=${enableWatermark}`, '_blank');
    }
  };

  const handleDirectPrint = async () => {
    if (!previewParcel) {
      setModalFeedback({
        type: 'error',
        text: 'Chưa chọn thửa đất để thực hiện in!',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
      return;
    }
    const rawId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);

    setModalFeedback({
      type: 'info',
      text: 'Đang tạo PDF máy chủ chuẩn để mở bản in...',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    });

    try {
      // Đang xem một Rev: in đúng file đã lưu. Còn lại: render bản hiện hành.
      let blob: Blob;
      if (selectedRevision !== undefined) {
        blob = (await fetchStoredReleasePdf(rawId, selectedRevision)).blob;
      } else {
        const response = await api.get(`/reports/${reportId}/export/pdf`, {
          params: { watermark: String(enableWatermark) },
          responseType: 'blob',
        });
        blob = new Blob([response.data], { type: 'application/pdf' });
      }

      const pdfUrl = URL.createObjectURL(blob);
      const printWindow = window.open(pdfUrl, '_blank');

      const revSuffix = selectedRevision !== undefined ? `_Rev${revLabel(selectedRevision)}` : '';
      const filename = `BaoCao_SongNgu_Phase1_${previewParcel.projectParcelCode}${revSuffix}.pdf`;

      if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setModalFeedback({
          type: 'info',
          text: 'Trình duyệt chặn mở tab mới. Đã tự động tải tệp PDF về máy của bạn để mở và in trực tiếp.',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        });
      } else {
        printWindow.focus();
        setModalFeedback({
          type: 'success',
          text: 'Đã mở bản in PDF máy chủ trong tab mới. Hãy nhấn biểu tượng Máy in hoặc Ctrl+P / Cmd+P trong trình xem PDF để in.',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        });
      }
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleDirectPrint] Lỗi khi mở bản in PDF:', err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tạo PDF để in: ${getErrorMessage(err, 'Lỗi kết nối máy chủ')}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    }
  };

  const handleToggleWatermark = async (enabled: boolean) => {
    // File Rev đã phát hành luôn có watermark và không đổi được: chỉ bản hiện hành mới bật/tắt.
    if (selectedRevision !== undefined) return;
    setEnableWatermark(enabled);
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({ type: 'SET_WATERMARK', enableWatermark: enabled }, '*');
      });
    } catch (err: unknown) {
      console.warn('Không thể gửi postMessage watermark tới iframe:', err);
    }
    if (!previewParcel) return;
    const reportId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;
    setIsPreviewLoading(true);
    try {
      const endpoint = `/reports/${encodeURIComponent(reportId)}/preview/html`;
      const htmlRes = await api.get(endpoint, {
        params: { watermark: String(enabled) },
        responseType: 'text',
      });

      const html = htmlRes.data;
      setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
      setPreviewRenderKey((k) => k + 1);
      setModalFeedback({
        type: 'info',
        text: enabled
          ? 'Đã BẬT tính năng dập con dấu bản quyền THACO/CREC và ngày giờ lên ảnh.'
          : 'Đã TẮT tính năng nhúng watermark (giữ ảnh nguyên bản, chống trùng lặp con dấu).',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleToggleWatermark] Lỗi khi đổi trạng thái watermark:', err);
      setModalFeedback({
        type: 'error',
        text: `Không thể nạp lại bản xem trước: ${getErrorMessage(err, 'Lỗi server')}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  /** "Tải PDF": luôn render bản hiện hành từ dữ liệu mới nhất, không bao giờ trả hay tạo Rev. */
  const handleExportSinglePdf = async (parcel: ExportParcelItem, _overrides?: Record<string, unknown>) => {
    const reportId = encodeURIComponent(reportIdOf(parcel));
    const wmSuffix = enableWatermark ? '' : '_NoWM';

    setActionMessage({
      type: 'info',
      text: `Đang tạo PDF bản hiện hành cho lô ${parcel.projectParcelCode}...`,
    });

    try {
      const response = await api.get(`/reports/${reportId}/export/pdf`, {
        params: { watermark: String(enableWatermark) },
        responseType: 'blob',
      });
      const status = readHeader(response.headers, 'x-report-status') === 'FINAL' ? 'HienHanh' : 'Draft';
      triggerBlobDownload(
        new Blob([response.data], { type: 'application/pdf' }),
        `BaoCao_SongNgu_Phase1_${parcel.projectParcelCode}_${status}${wmSuffix}.pdf`
      );
      setActionMessage({
        type: 'success',
        text: `Đã tải PDF bản hiện hành cho lô ${parcel.projectParcelCode}.`,
      });
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleExportSinglePdf] Lỗi khi xuất PDF bản hiện hành:', err);
      setActionMessage({
        type: 'error',
        text: `Không thể xuất PDF cho lô ${parcel.projectParcelCode}: ${getErrorMessage(err, 'Lỗi không xác định')}`,
      });
    }
  };

  /** Tải đúng file Rev đã phát hành (bytes đã lưu, kiểm SHA-256 ở máy chủ). */
  const handleExportRevisionPdf = async (rev: number) => {
    if (!previewParcel) return;
    const code = previewParcel.projectParcelCode;
    setActionMessage({ type: 'info', text: `Đang tải file Rev.${revLabel(rev)} đã lưu của lô ${code}...` });
    try {
      const { blob, sha256 } = await fetchStoredReleasePdf(reportIdOf(previewParcel), rev);
      triggerBlobDownload(blob, `BaoCao_SongNgu_Phase1_${code}_Rev${revLabel(rev)}.pdf`);
      const text = `Đã tải file Rev.${revLabel(rev)} của lô ${code}${sha256 ? ` (SHA-256: ${sha256.substring(0, 12)}…)` : ''}.`;
      setActionMessage({ type: 'success', text });
      setModalFeedback({ type: 'success', text, timestamp: new Date().toLocaleTimeString('vi-VN') });
    } catch (err: unknown) {
      console.error('[usePhase1ReportPreview:handleExportRevisionPdf] Lỗi khi tải file Rev:', err);
      const text = `Không thể tải Rev.${revLabel(rev)}: ${getErrorMessage(err, 'Lỗi không xác định')}`;
      setActionMessage({ type: 'error', text });
      setModalFeedback({ type: 'error', text, timestamp: new Date().toLocaleTimeString('vi-VN') });
    }
  };

  return {
    previewParcel,
    setPreviewParcel,
    previewHtmlContent,
    previewBlobUrl,
    previewReportData,
    previewTab,
    setPreviewTab,
    isPreviewLoading,
    previewZoom,
    setPreviewZoom,
    previewRenderKey,
    isSavingEdits,
    hasUnsavedChanges,
    editFormData,
    defectFilterQuery,
    setDefectFilterQuery,
    modalFeedback,
    setModalFeedback,
    enableWatermark,
    setEnableWatermark,
    selectedRevision,
    setSelectedRevision,
    storedPdfBlobUrl,
    storedPdfSha256,
    handleSelectRevision,
    handleExportRevisionPdf,
    handleToggleWatermark,
    handleOpenPreview,
    handleUpdateFormField,
    handleUpdateDefectField,
    handleAddDefect,
    handleDeleteDefect,
    handleSaveReportEdits,
    handleApplyPreviewWithoutSaving,
    handleSwitchTab,
    handleOpenPreviewInNewTab,
    handleDirectPrint,
    handleExportSinglePdf,
  };
};
