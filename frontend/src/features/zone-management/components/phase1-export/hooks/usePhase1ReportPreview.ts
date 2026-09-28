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

  const handleOpenPreview = async (parcel: ExportParcelItem) => {
    setPreviewParcel(parcel);
    setIsPreviewLoading(true);
    setPreviewTab('html');
    setPreviewHtmlContent(null);
    setPreviewReportData(null);

    const reportId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    try {
      const [htmlResResult, dataResResult] = await Promise.allSettled([
        api.get(`/reports/${encodeURIComponent(reportId)}/preview/html`, {
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

      const htmlRes = await api.get(`/reports/${encodeURIComponent(reportId)}/preview/html`, {
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
      const htmlRes = await api.post(`/reports/${encodeURIComponent(reportId)}/preview/html`, payload, {
        responseType: 'text',
      });

      const newHtml = typeof htmlRes.data === 'string' ? htmlRes.data : JSON.stringify(htmlRes.data);
      setPreviewHtmlContent(newHtml);
      setPreviewRenderKey((k) => k + 1);
      setPreviewTab('html');

      const successText = `⚡ Đã cập nhật bản in với thông số mới thành công (Lúc ${timeStr})! Bản in A4 đã được làm mới. Dữ liệu trong Database được bảo vệ 100% không đổi.`;
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
      window.open(`/api/v1/reports/${encodeURIComponent(activeReportId)}/preview/html`, '_blank');
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

  const handleExportSinglePdf = async (parcel: ExportParcelItem, overrides?: any) => {
    const rawId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    const reportId = encodeURIComponent(rawId);
    setActionMessage({ type: 'info', text: `Đang kết nối backend và tạo tập tin PDF A4 cho lô ${parcel.projectParcelCode}...` });

    try {
      const response = overrides
        ? await api.post(`/reports/${reportId}/export/pdf`, overrides, { responseType: 'blob' })
        : await api.get(`/reports/${reportId}/export/pdf`, { responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `BaoCao_KhaoSat_Phase1_${parcel.projectParcelCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setActionMessage({
        type: 'success',
        text: `Tải xuống thành công Báo cáo PDF A4 cho lô ${parcel.projectParcelCode}!`,
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
