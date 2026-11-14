import React, { useState } from 'react';
import { FileCode } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Phase1ExportHeader } from './phase1-export/components/Phase1ExportHeader';
import { Phase1FilterToolbar } from './phase1-export/components/Phase1FilterToolbar';
import { Phase1ParcelsTable } from './phase1-export/components/Phase1ParcelsTable';
import { Phase1PreviewModal } from './phase1-export/components/modals/Phase1PreviewModal';
import { AuditStudioModal } from './review-queue/AuditStudioModal';
import { usePhase1ExportData } from './phase1-export/hooks/usePhase1ExportData';
import { usePhase1ReportPreview } from './phase1-export/hooks/usePhase1ReportPreview';
import { ProgressReportExportButton } from '../../progress-report';
import { ZoneSvgPreviewModal } from './modals/ZoneSvgPreviewModal';
import { ZoneMinutesTab } from './phase1-export/components/ZoneMinutesTab';
import { CondoReportsTab } from './phase1-export/components/CondoReportsTab';
import { getSvgExportDisabledReason } from '../utils/zoneSvgTechnicalExporter';
import type { Phase1ExportModuleBoxProps, EditFormDefectItem, EditFormData, ExportParcelItem, BatchResultData, ActionFeedbackMessage, ModalFeedbackMessage } from './phase1-export/types';

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

type ModuleTab = 'REPORTS' | 'CONDO' | 'MINUTES';

/** Thửa chung cư (Tòa mẹ + khu vực chung + căn hộ) chỉ xem / xuất ở tab "Báo Cáo Chung Cư". */
const isCondoParcel = (buildingType: string | undefined): boolean =>
  ['CONDOMINIUM', 'CONDO'].includes(String(buildingType || '').toUpperCase());

const MODULE_TABS: { value: ModuleTab; label: string }[] = [
  { value: 'REPORTS', label: 'Báo Cáo Kỹ Thuật (Phase 1)' },
  { value: 'CONDO', label: 'Báo Cáo Chung Cư' },
  { value: 'MINUTES', label: 'Biên Bản Hiện Trường' },
];

export const Phase1ExportModuleBox: React.FC<Phase1ExportModuleBoxProps> = ({
  initialZoneId = 'ZONE_01',
  className = '',
  hideZoneSelect = false,
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
    parcels,
    filteredParcels,
    selectedParcelIds,
    actionMessage,
    setActionMessage,
    fetchExportableParcels,
    toggleSelectAll,
    toggleSelectParcel,
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
    handleOpenPreview,
    handleUpdateFormField,
    handleUpdateDefectField,
    handleAddDefect,
    handleDeleteDefect,
    handleApplyPreviewWithoutSaving,
    handleSwitchTab,
    handleOpenPreviewInNewTab,
    handleDirectPrint,
    handleExportSinglePdf,
    enableWatermark,
    handleToggleWatermark,
    selectedRevision,
    handleSelectRevision,
    handleExportRevisionPdf,
    storedPdfBlobUrl,
    storedPdfSha256,
    currentPdfBlobUrl,
    isCurrentPdfLoading,
    handleViewCurrentPdf,
    handleCloseCurrentPdf,
    templateControl,
  } = usePhase1ReportPreview({
    setActionMessage,
    canChooseTemplate: user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN',
  });

  const [auditStudioReportId, setAuditStudioReportId] = useState<string | null>(null);
  const [showSvgExportModal, setShowSvgExportModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModuleTab>('REPORTS');

  const canExportSvg = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const svgExportDisabledReason = getSvgExportDisabledReason(selectedZone, parcels.length);
  // Có tab chung cư (Zone Admin / Super Admin) thì bảng nhà dân không lặp lại dòng Tòa mẹ chung cư.
  const residentialParcels = canExportSvg ? filteredParcels.filter((p) => !isCondoParcel(p.buildingType)) : filteredParcels;
  const hiddenCondoCount = filteredParcels.length - residentialParcels.length;

  const handleOpenAuditStudio = (parcel: ExportParcelItem) => {
    const reportId = parcel.activePhase1ReportId || parcel.id || parcel.projectParcelCode;
    if (!reportId) return;
    setAuditStudioReportId(reportId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Module & User Auth Badge */}
      <Phase1ExportHeader
        user={user}
        token={token}
        actionMessage={actionMessage}
        onDismissActionMessage={() => setActionMessage(null)}
      />

      {canExportSvg && (
        <div className="flex gap-1 border-b border-slate-200">
          {MODULE_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`-mb-px border-b-2 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === value
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'MINUTES' && canExportSvg && (
        <ZoneMinutesTab zoneId={selectedZone} onZoneChange={setSelectedZone} hideZoneSelect={hideZoneSelect} />
      )}

      {activeTab === 'CONDO' && canExportSvg && (
        <CondoReportsTab
          zoneId={selectedZone}
          onZoneChange={setSelectedZone}
          hideZoneSelect={hideZoneSelect}
          onOpenPreview={handleOpenPreview}
          onExportPdf={handleExportSinglePdf}
        />
      )}

      {activeTab === 'REPORTS' && (
        <>
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
        hideZoneSelect={hideZoneSelect}
        extraActions={
          <>
            <ProgressReportExportButton zoneId={selectedZone} lockZone={hideZoneSelect} />
            {canExportSvg && (
              <button
                type="button"
                onClick={() => setShowSvgExportModal(true)}
                disabled={svgExportDisabledReason !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={svgExportDisabledReason ?? 'Xuất bình đồ kỹ thuật vector (.SVG) của phân khu'}
              >
                <FileCode size={14} className="text-slate-500" />
                <span>Xuất Bình Đồ (SVG)</span>
              </button>
            )}
          </>
        }
      />

      {hiddenCondoCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800">
          <span>{hiddenCondoCount} tòa chung cư được xem / xuất ở tab riêng (Tòa mẹ, khu vực chung, căn hộ).</span>
          <button
            type="button"
            onClick={() => setActiveTab('CONDO')}
            className="rounded-lg border border-sky-300 bg-white px-3 py-1 font-bold text-sky-700 hover:bg-sky-100 cursor-pointer"
          >
            Mở tab Báo Cáo Chung Cư
          </button>
        </div>
      )}

      {/* 4. Bảng danh sách công trình & các nút thao tác xuất báo cáo */}
      <Phase1ParcelsTable
        filteredParcels={residentialParcels}
        isLoading={isLoading}
        selectedParcelIds={selectedParcelIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectParcel={toggleSelectParcel}
        onOpenPreview={handleOpenPreview}
        onExportSinglePdf={handleExportSinglePdf}
      />
        </>
      )}

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
        handleOpenPreview={handleOpenPreview}
        handleUpdateFormField={handleUpdateFormField}
        handleUpdateDefectField={handleUpdateDefectField}
        handleAddDefect={handleAddDefect}
        handleDeleteDefect={handleDeleteDefect}
        handleApplyPreviewWithoutSaving={handleApplyPreviewWithoutSaving}
        handleSwitchTab={handleSwitchTab}
        handleOpenPreviewInNewTab={handleOpenPreviewInNewTab}
        handleDirectPrint={handleDirectPrint}
        handleExportSinglePdf={handleExportSinglePdf}
        enableWatermark={enableWatermark}
        handleToggleWatermark={handleToggleWatermark}
        onOpenAuditStudio={handleOpenAuditStudio}
        selectedRevision={selectedRevision}
        handleSelectRevision={handleSelectRevision}
        handleExportRevisionPdf={handleExportRevisionPdf}
        storedPdfBlobUrl={storedPdfBlobUrl}
        storedPdfSha256={storedPdfSha256}
        currentPdfBlobUrl={currentPdfBlobUrl}
        isCurrentPdfLoading={isCurrentPdfLoading}
        handleViewCurrentPdf={handleViewCurrentPdf}
        handleCloseCurrentPdf={handleCloseCurrentPdf}
        templateControl={templateControl}
      />

      {showSvgExportModal && (
        <ZoneSvgPreviewModal zoneId={selectedZone} onClose={() => setShowSvgExportModal(false)} />
      )}

      {auditStudioReportId && (
        <AuditStudioModal
          isOpen={Boolean(auditStudioReportId)}
          reportId={auditStudioReportId}
          onClose={() => {
            setAuditStudioReportId(null);
            if (previewParcel) {
              handleOpenPreview(previewParcel);
            }
          }}
          onRefreshList={() => {
            fetchExportableParcels();
            if (previewParcel) {
              handleOpenPreview(previewParcel);
            }
          }}
        />
      )}
    </div>
  );
};
