import { useState, useEffect } from 'react';
import { api } from '../../../../../services/api';
import {
  ExportParcelItem,
  EditFormData,
  EditFormDefectItem,
  ModalFeedbackMessage,
  ActionFeedbackMessage,
} from '../types';
import { initializeEditFormData, buildReportPayload } from '../utils/reportDataTransformers';

interface UsePhase1ReportPreviewProps {
  setActionMessage: (msg: ActionFeedbackMessage | null) => void;
}

export const usePhase1ReportPreview = ({
  setActionMessage,
}: UsePhase1ReportPreviewProps) => {
  const [previewParcel, setPreviewParcel] = useState<ExportParcelItem | null>(null);
  const [previewHtmlContent, setPreviewHtmlContent] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewReportData, setPreviewReportData] = useState<any | null>(null);
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

  const handleOpenPreview = async (parcel: ExportParcelItem, versionOverride?: 'v2' | 'v1') => {
    const ver = versionOverride || reportVersion;
    setPreviewParcel(parcel);
    setIsPreviewLoading(true);
    setPreviewTab('html');
    setPreviewHtmlContent(null);
    setPreviewReportData(null);

    const reportId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const previewEndpoint = ver === 'v2'
      ? `/v2/reports/${encodeURIComponent(reportId)}/preview/html`
      : `/reports/${encodeURIComponent(reportId)}/preview/html`;

    try {
      const [htmlResResult, dataResResult] = await Promise.allSettled([
        api.get(previewEndpoint, {
          responseType: 'text',
        }),
        api.get(`/reports/${encodeURIComponent(reportId)}`),
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
    } catch (err: any) {
      console.warn('Lỗi khi nạp HTML preview hoặc report data:', err);
      setEditFormData(initializeEditFormData(null, parcel));
      setActionMessage({
        type: 'error',
        text: `Không thể nạp HTML xem trước cho lô ${parcel.projectParcelCode}: ${err?.message || 'Lỗi kết nối'}`,
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
      const endpoint = targetVersion === 'v2'
        ? `/v2/reports/${encodeURIComponent(reportId)}/preview/html`
        : `/reports/${encodeURIComponent(reportId)}/preview/html`;
      
      let htmlRes;
      if (hasUnsavedChanges && editFormData) {
        const payload = buildReportPayload(editFormData, previewReportData);
        htmlRes = await api.post(endpoint, payload, { responseType: 'text' });
      } else {
        htmlRes = await api.get(endpoint, { responseType: 'text' });
      }

      const html = htmlRes.data;
      setPreviewHtmlContent(typeof html === 'string' ? html : JSON.stringify(html));
      setPreviewRenderKey((k) => k + 1);
      setModalFeedback({
        type: 'info',
        text: `Đã chuyển sang mẫu báo cáo: ${targetVersion === 'v2' ? 'Mẫu Mới 0410 Song Ngữ (V2)' : 'Mẫu Cũ (V1)'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: any) {
      console.warn(`[Preview] Lỗi khi đổi phiên bản ${targetVersion}:`, err);
      setModalFeedback({
        type: 'error',
        text: `Không thể tải phiên bản ${targetVersion}: ${err?.message || 'Lỗi server'}`,
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

  const handleUpdateDefectField = (defectId: string, field: keyof EditFormDefectItem, value: any) => {
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

  const handleSaveReportEdits = async (isNewRevision: boolean = false) => {
    if (!previewParcel || !editFormData) return;
    const reportId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;

    setIsSavingEdits(true);
    try {
      const payload = buildReportPayload(editFormData, previewReportData);
      await api.put(`/reports/${encodeURIComponent(reportId)}/survey-data`, {
        ...payload,
        isNewRevision,
      });

      const previewEndpoint = reportVersion === 'v2'
        ? `/v2/reports/${encodeURIComponent(reportId)}/preview/html`
        : `/reports/${encodeURIComponent(reportId)}/preview/html`;

      const htmlRes = await api.get(previewEndpoint, {
        responseType: 'text',
      });
      setPreviewHtmlContent(typeof htmlRes.data === 'string' ? htmlRes.data : JSON.stringify(htmlRes.data));
      setPreviewRenderKey((k) => k + 1);
      setHasUnsavedChanges(false);

      setActionMessage({
        type: 'success',
        text: `Đã lưu thành công dữ liệu vào Database cho lô ${previewParcel.projectParcelCode}!`,
      });
    } catch (err: any) {
      console.error('Lỗi khi lưu dữ liệu vào DB:', err);
      setActionMessage({
        type: 'error',
        text: `Không thể lưu vào Database: ${err?.response?.data?.detail || err?.message || 'Lỗi server'}`,
      });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleApplyPreviewWithoutSaving = async () => {
    if (!previewParcel || !editFormData) return;
    const reportId = previewParcel.activePhase1ReportId || parcelIdOrFallback(previewParcel) || previewParcel.projectParcelCode;

    setIsSavingEdits(true);
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    try {
      const payload = buildReportPayload(editFormData, previewReportData);
      const endpoint = reportVersion === 'v2'
        ? `/v2/reports/${encodeURIComponent(reportId)}/preview/html`
        : `/reports/${encodeURIComponent(reportId)}/preview/html`;

      const htmlRes = await api.post(endpoint, payload, {
        responseType: 'text',
      });

      const newHtml = typeof htmlRes.data === 'string' ? htmlRes.data : JSON.stringify(htmlRes.data);
      setPreviewHtmlContent(newHtml);
      setPreviewRenderKey((k) => k + 1);
      setPreviewTab('html');

      const successText = `⚡ Đã cập nhật bản in với thông số mới thành công (Lúc ${timeStr})! Bản in A4 đã được làm mới (${reportVersion === 'v2' ? 'Mẫu Mới 0410' : 'Mẫu Cũ V1'}). Dữ liệu trong Database được bảo vệ 100% không đổi.`;
      setModalFeedback({
        type: 'success',
        text: successText,
        timestamp: timeStr,
      });
      setActionMessage({
        type: 'success',
        text: successText,
      });
    } catch (err: any) {
      console.error('Lỗi khi xem trước tạm thời:', err);
      const errText = `Không thể tạo bản xem trước tạm thời: ${err?.response?.data?.detail || err?.message || 'Lỗi server'}`;
      setModalFeedback({
        type: 'error',
        text: errText,
        timestamp: timeStr,
      });
      setActionMessage({
        type: 'error',
        text: errText,
      });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleSwitchTab = async (targetTab: 'html' | 'edit' | 'json') => {
    if (targetTab === 'html' && previewTab === 'edit' && hasUnsavedChanges && editFormData) {
      await handleApplyPreviewWithoutSaving();
    } else {
      setPreviewTab(targetTab);
    }
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
      const prefix = reportVersion === 'v2' ? '/api/v1/v2/reports' : '/api/v1/reports';
      window.open(`${prefix}/${encodeURIComponent(activeReportId)}/preview/html`, '_blank');
    }
  };

  const handleDirectPrint = () => {
    if (!previewHtmlContent) {
      setModalFeedback({
        type: 'error',
        text: 'Chưa nạp được bản in để thực hiện in!',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(previewHtmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleExportSingleDocx = async (parcel: ExportParcelItem, overrides?: any) => {
    const rawId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);
    setActionMessage({ type: 'info', text: `Đang tạo tập tin Word (DOCX) cho lô ${parcel.projectParcelCode}...` });

    try {
      const response = overrides
        ? await api.post(`/reports/${reportId}/export/docx`, overrides, { responseType: 'blob' })
        : await api.get(`/reports/${reportId}/export/docx`, { responseType: 'blob' });

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
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Không thể xuất DOCX cho lô ${parcel.projectParcelCode}: ${err?.message || 'Lỗi không xác định'}`,
      });
    }
  };

  const handleExportSinglePdf = async (parcel: ExportParcelItem, overrides?: any, versionOverride?: 'v2' | 'v1') => {
    const ver = versionOverride || reportVersion;
    const rawId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);
    const isV2 = ver === 'v2';

    setActionMessage({
      type: 'info',
      text: isV2
        ? `Đang kết nối backend và tạo PDF Song Ngữ chuẩn 0410 (V2) cho lô ${parcel.projectParcelCode}...`
        : `Đang kết nối backend và tạo tập tin PDF A4 cho lô ${parcel.projectParcelCode}...`,
    });

    try {
      const endpoint = isV2
        ? `/v2/reports/${reportId}/export/pdf`
        : `/reports/${reportId}/export/pdf`;

      const response = overrides
        ? await api.post(endpoint, overrides, { responseType: 'blob' })
        : await api.get(endpoint, { responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = isV2
        ? `BaoCao_SongNgu_Phase1_V2_${parcel.projectParcelCode}.pdf`
        : `BaoCao_KhaoSat_Phase1_${parcel.projectParcelCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setActionMessage({
        type: 'success',
        text: `Tải xuống thành công Báo cáo PDF ${isV2 ? 'Song Ngữ (Mẫu 0410 V2)' : 'A4 (Mẫu V1)'} cho lô ${parcel.projectParcelCode}!`,
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Không thể xuất PDF cho lô ${parcel.projectParcelCode}: ${err?.message || 'Lỗi không xác định'}`,
      });
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
    reportVersion,
    setReportVersion,
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
