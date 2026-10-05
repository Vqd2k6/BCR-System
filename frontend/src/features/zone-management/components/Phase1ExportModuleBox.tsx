import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Phase1ExportHeader } from './phase1-export/components/Phase1ExportHeader';
import { Phase1FilterToolbar } from './phase1-export/components/Phase1FilterToolbar';
import { BatchResultCard } from './phase1-export/components/BatchResultCard';
import { Phase1ParcelsTable } from './phase1-export/components/Phase1ParcelsTable';
import { Phase1PreviewModal } from './phase1-export/components/modals/Phase1PreviewModal';
import { usePhase1ExportData } from './phase1-export/hooks/usePhase1ExportData';
import { usePhase1ReportPreview } from './phase1-export/hooks/usePhase1ReportPreview';
import {
  Phase1ExportModuleBoxProps,
  EditFormDefectItem,
  EditFormData,
  ExportParcelItem,
  BatchResultData,
  ActionFeedbackMessage,
  ModalFeedbackMessage,
} from './phase1-export/types';

// Re-export all types so existing consumers don't break
export type {
  Phase1ExportModuleBoxProps,
  EditFormDefectItem,
  EditFormData,
  ExportParcelItem,
  BatchResultData,
  ActionFeedbackMessage,
  ModalFeedbackMessage,
};

export const Phase1ExportModuleBox: React.FC<Phase1ExportModuleBoxProps> = ({
  initialZoneId = 'ZONE_01',
  className = '',
}) => {
  const { user, token } = useAuth();

  // 1. Quản lý danh sách thửa đất, tìm kiếm, phân khu & export mẻ
  const {
    selectedZone,
    setSelectedZone,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    filteredParcels,
    selectedParcelIds,
    actionMessage,
    setActionMessage,
    isBatchExporting,
    batchResult,
    setBatchResult,
    fetchExportableParcels,
    toggleSelectAll,
    toggleSelectParcel,
    handleCreateBatchExport,
  } = usePhase1ExportData({
    initialZoneId,
    assignedZoneId: user?.assignedZoneId,
  });

  // 2. Quản lý xem trước HTML, chỉnh sửa live form & xuất báo cáo đơn lẻ
  const {
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
    handleSwitchVersion,
    handleOpenPreview,
    handleUpdateFormField,
    handleUpdateDefectField,
    handleAddDefect,
    handleDeleteDefect,
    handleApplyPreviewWithoutSaving,
    handleSwitchTab,
    handleOpenPreviewInNewTab,
    handleDirectPrint,
    handleExportSingleDocx,
    handleExportSinglePdf,
  } = usePhase1ReportPreview({
    setActionMessage,
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Module & User Auth Badge */}
      <Phase1ExportHeader
        user={user}
        token={token}
        actionMessage={actionMessage}
        onDismissActionMessage={() => setActionMessage(null)}
      />

      {/* 2. Thanh lọc phân khu, trạng thái & tìm kiếm */}
      <Phase1FilterToolbar
        selectedZone={selectedZone}
        setSelectedZone={setSelectedZone}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isLoading={isLoading}
        onRefresh={fetchExportableParcels}
        isBatchExporting={isBatchExporting}
        selectedCount={selectedParcelIds.length}
        totalFilteredCount={filteredParcels.length}
        onCreateBatchExport={handleCreateBatchExport}
      />

      {/* 3. Thẻ kết quả mẻ xuất tập hợp (nếu có) */}
      <BatchResultCard
        batchResult={batchResult}
        onClose={() => setBatchResult(null)}
      />

      {/* 4. Bảng danh sách công trình & các nút thao tác xuất báo cáo */}
      <Phase1ParcelsTable
        filteredParcels={filteredParcels}
        isLoading={isLoading}
        selectedParcelIds={selectedParcelIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectParcel={toggleSelectParcel}
        onOpenPreview={handleOpenPreview}
        onExportSinglePdf={handleExportSinglePdf}
        onExportSingleDocx={handleExportSingleDocx}
      />

      {/* 5. Modal xem trước bản in PDF, chỉnh sửa trực tiếp & JSON payload */}
      <Phase1PreviewModal
        previewParcel={previewParcel}
        setPreviewParcel={setPreviewParcel}
        previewHtmlContent={previewHtmlContent}
        previewBlobUrl={previewBlobUrl}
        previewReportData={previewReportData}
        previewTab={previewTab}
        setPreviewTab={setPreviewTab}
        isPreviewLoading={isPreviewLoading}
        previewZoom={previewZoom}
        setPreviewZoom={setPreviewZoom}
        previewRenderKey={previewRenderKey}
        isSavingEdits={isSavingEdits}
        hasUnsavedChanges={hasUnsavedChanges}
        editFormData={editFormData}
        defectFilterQuery={defectFilterQuery}
        setDefectFilterQuery={setDefectFilterQuery}
        modalFeedback={modalFeedback}
        setModalFeedback={setModalFeedback}
        reportVersion={reportVersion}
        handleSwitchVersion={handleSwitchVersion}
        handleOpenPreview={handleOpenPreview}
        handleUpdateFormField={handleUpdateFormField}
        handleUpdateDefectField={handleUpdateDefectField}
        handleAddDefect={handleAddDefect}
        handleDeleteDefect={handleDeleteDefect}
        handleApplyPreviewWithoutSaving={handleApplyPreviewWithoutSaving}
        handleSwitchTab={handleSwitchTab}
        handleOpenPreviewInNewTab={handleOpenPreviewInNewTab}
        handleDirectPrint={handleDirectPrint}
        handleExportSingleDocx={handleExportSingleDocx}
        handleExportSinglePdf={handleExportSinglePdf}
      />
    </div>
  );
};
