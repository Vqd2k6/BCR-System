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
  const [reportVersion, setReportVersion] = useState<'v2' | 'v1'>('v2');
  const [enableWatermark, setEnableWatermark] = useState<boolean>(true);
  const [selectedRevision, setSelectedRevision] = useState<number | undefined>(undefined);

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

  const handleOpenPreview = async (parcel: ExportParcelItem, versionOverride?: 'v2' | 'v1', revOverride?: number) => {
    const ver = versionOverride || reportVersion;
    setPreviewParcel(parcel);
    setSelectedRevision(revOverride);
    setIsPreviewLoading(true);
    setPreviewTab('html');
    setPreviewHtmlContent(null);
    setPreviewReportData(null);

    const reportId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const previewEndpoint = `/v3/reports/${encodeURIComponent(reportId)}/preview/html`;

    try {
      const [htmlResResult, dataResResult] = await Promise.allSettled([
        api.get(previewEndpoint, {
          params: {
            watermark: String(enableWatermark),
            ...(revOverride !== undefined ? { rev: revOverride } : {}),
          },
          responseType: 'text',
        }),
        api.get(`/reports/${encodeURIComponent(reportId)}`, {
          params: revOverride !== undefined ? { rev: revOverride } : {},
        }),
      ]);

      if (htmlResResult.status === 'fulfilled') {
        const html = htmlResResult.value.data;
        setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
        setPreviewRenderKey((k) => k + 1);
      } else {
        console.warn(`[Preview] Lỗi khi nạp HTML template (${ver}):`, htmlResResult.reason);
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
      console.warn('Lỗi khi nạp HTML preview hoặc report data:', err);
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
      const [htmlRes, dataRes] = await Promise.all([
        api.get(`/v3/reports/${encodeURIComponent(reportId)}/preview/html`, {
          params: {
            watermark: String(enableWatermark),
            ...(rev !== undefined ? { rev } : {}),
          },
          responseType: 'text',
        }),
        api.get(`/reports/${encodeURIComponent(reportId)}`, {
          params: rev !== undefined ? { rev } : {},
        }),
      ]);
      const html = htmlRes.data;
      setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
      setPreviewRenderKey((k) => k + 1);
      const repData = dataRes.data?.data || dataRes.data;
      setPreviewReportData(repData);
      setEditFormData(initializeEditFormData(repData, previewParcel));

      setModalFeedback({
        type: 'info',
        text:
          rev !== undefined
            ? `Đang hiển thị bản phát hành đã lưu trữ: Rev.${String(rev).padStart(2, '0')}`
            : 'Đang hiển thị bản phê duyệt hiện hành mới nhất.',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: unknown) {
      console.warn('[Preview] Lỗi khi chuyển đổi phiên bản Rev:', err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tải phiên bản Rev: ${getErrorMessage(err, 'Lỗi server')}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSwitchVersion = async (targetVersion: 'v2' | 'v1') => {
    setReportVersion(targetVersion);
    if (!previewParcel) return;
    const reportId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;
    setIsPreviewLoading(true);
    try {
      const endpoint = `/v3/reports/${encodeURIComponent(reportId)}/preview/html`;
      const htmlRes = await api.get(endpoint, {
        params: {
          watermark: String(enableWatermark),
          ...(selectedRevision !== undefined ? { rev: selectedRevision } : {}),
        },
        responseType: 'text',
      });

      const html = htmlRes.data;
      setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
      setPreviewRenderKey((k) => k + 1);
      setModalFeedback({
        type: 'info',
        text: 'Đã làm mới bản xem trước theo chuẩn Báo cáo Song Ngữ 0410 (V3).',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: unknown) {
      console.warn(`[Preview] Lỗi khi đổi phiên bản ${targetVersion}:`, err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tải phiên bản ${targetVersion}: ${getErrorMessage(err, 'Lỗi server')}`,
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
    if (previewBlobUrl) {
      window.open(previewBlobUrl, '_blank');
    } else if (previewHtmlContent) {
      const blob = new Blob([previewHtmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      const activeReportId = previewParcel?.activePhase1ReportId || (previewParcel ? parcelIdOrFallback(previewParcel) : '') || (previewParcel?.projectParcelCode || '');
      const baseApi = (api.defaults.baseURL || '/api/v1').replace(/\/+$/, '');
      const revQuery = selectedRevision !== undefined ? `&rev=${selectedRevision}` : '';
      window.open(`${baseApi}/v3/reports/${encodeURIComponent(activeReportId)}/preview/html?watermark=${enableWatermark}${revQuery}`, '_blank');
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
      const endpoint = `/v3/reports/${reportId}/export/pdf`;
      const response = await api.get(endpoint, {
        params: {
          watermark: String(enableWatermark),
          ...(selectedRevision !== undefined ? { rev: selectedRevision } : {}),
        },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(blob);
      const printWindow = window.open(pdfUrl, '_blank');

      const revSuffix = selectedRevision !== undefined ? `_Rev${String(selectedRevision).padStart(2, '0')}` : '';
      const filename = `BaoCao_SongNgu_Phase1_V2_${previewParcel.projectParcelCode}${revSuffix}.pdf`;

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
      console.error('Lỗi khi mở bản in PDF:', err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tạo PDF để in: ${getErrorMessage(err, 'Lỗi kết nối máy chủ')}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    }
  };

  const handleToggleWatermark = async (enabled: boolean) => {
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
      const endpoint = `/v3/reports/${encodeURIComponent(reportId)}/preview/html`;
      const htmlRes = await api.get(endpoint, {
        params: {
          watermark: String(enabled),
          ...(selectedRevision !== undefined ? { rev: selectedRevision } : {}),
        },
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
      console.warn('Lỗi khi đổi trạng thái watermark:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExportSingleDocx = async (parcel: ExportParcelItem, _overrides?: Record<string, unknown>) => {
    const rawId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);
    setActionMessage({ type: 'info', text: `Đang tạo tập tin Word (DOCX) cho lô ${parcel.projectParcelCode}...` });

    try {
      const response = await api.get(`/reports/${reportId}/export/docx`, { responseType: 'blob' });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `BaoCao_KhaoSat_Phase1_${parcel.projectParcelCode}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setActionMessage({
        type: 'success',
        text: `Tải xuống thành công Báo cáo DOCX cho lô ${parcel.projectParcelCode}!`,
      });
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Không thể xuất DOCX cho lô ${parcel.projectParcelCode}: ${getErrorMessage(err, 'Lỗi không xác định')}`,
      });
    }
  };

  const handleExportSinglePdf = async (
    parcel: ExportParcelItem,
    _overrides?: Record<string, unknown>,
    _versionOverride?: 'v2' | 'v1',
    revOverride?: number
  ) => {
    const rawId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);
    const activeRev = revOverride !== undefined ? revOverride : selectedRevision;
    const revSuffix = activeRev !== undefined ? `_Rev${String(activeRev).padStart(2, '0')}` : '';

    setActionMessage({
      type: 'info',
      text: `Đang kết nối backend và tạo PDF Song Ngữ chuẩn 0410 (V3) cho lô ${parcel.projectParcelCode}${revSuffix}...`,
    });

    try {
      const endpoint = `/v3/reports/${reportId}/export/pdf`;
      const response = await api.get(endpoint, {
        params: {
          watermark: String(enableWatermark),
          ...(activeRev !== undefined ? { rev: activeRev } : {}),
        },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `BaoCao_SongNgu_Phase1_V2_${parcel.projectParcelCode}${revSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setActionMessage({
        type: 'success',
        text: `Tải xuống thành công Báo cáo PDF Song Ngữ (Mẫu 0410) cho lô ${parcel.projectParcelCode}${revSuffix}!`,
      });
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Không thể xuất PDF cho lô ${parcel.projectParcelCode}: ${getErrorMessage(err, 'Lỗi không xác định')}`,
      });
    }
  };

  const handleExportRevisionPdf = async (rev: number) => {
    if (!previewParcel) return;
    await handleExportSinglePdf(previewParcel, undefined, undefined, rev);
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
    reportVersion,
    setReportVersion,
    enableWatermark,
    setEnableWatermark,
    selectedRevision,
    setSelectedRevision,
    handleSelectRevision,
    handleExportRevisionPdf,
    handleToggleWatermark,
    handleSwitchVersion,
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
    handleExportSingleDocx,
    handleExportSinglePdf,
  };
};
