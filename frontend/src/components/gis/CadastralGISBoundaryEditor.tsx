import React from 'react';
import {
  GisParcel,
  SplitChildData,
  MutationPayloadData,
  CadastralParcelData,
  CadastralBoundaryEditorProps,
} from './shared/types';
import { useCadastralMutation } from './cadastral-editor/hooks/useCadastralMutation';
import { CadastralHeaderBar } from './cadastral-editor/components/CadastralHeaderBar';
import { MatchPanel } from './cadastral-editor/components/panels/MatchPanel';
import { SplitPanel } from './cadastral-editor/components/panels/SplitPanel';
import { MergePanel } from './cadastral-editor/components/panels/MergePanel';

export type { SplitChildData, MutationPayloadData, CadastralParcelData, CadastralBoundaryEditorProps };
export type Props = CadastralBoundaryEditorProps;

export const CadastralGISBoundaryEditor: React.FC<CadastralBoundaryEditorProps> = ({
  activeParcelId,
  parcelData,
  parcel,
  boundaryStatus,
  onStatusChange,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}) => {
  const {
    frontage,
    depth,
    buildingHeight,
    totalLandArea,
    tileMode,
    setTileMode,
    realActiveCoords,
    activeCentroid,
    currentZoneMergeParcels,
    filteredMergeParcels,
    mergeSearchTerm,
    setMergeSearchTerm,
    splitShapeOption,
    setSplitShapeOption,
    customResidualType,
    setCustomResidualType,
    customSplitReason,
    setCustomSplitReason,
    customMergeReason,
    setCustomMergeReason,
    customMergeResidualType,
    setCustomMergeResidualType,
    dynamicCodes,
    isSubmittingMutation,
    polyAVertices,
    setPolyAVertices,
    calculatedAreaA,
    calculatedAreaB,
    handleVertexDrag,
    handleMapClickDraw,
    handleAddMidpoint,
    handleRemovePoint,
    handleResetDefault,
    handleApplyLShape,
    selectedMergeCodes,
    mergeSummary,
    handleToggleMergeParcel,
    mergeBuildingVertices,
    calculatedMergeBArea,
    calculatedMergeRArea,
    handleMergeMapClickDraw,
    handleMergeRemoveLastPoint,
    handleMergeClearDraw,
    handleSaveMutationProposal,
  } = useCadastralMutation({
    activeParcelId,
    parcelData,
    parcel,
    boundaryStatus,
    mutationData,
    onMutationDataChange,
    onToastMessage,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* 1. Header Bar: Initial parcel dimensions & 3-state selector (MATCH / SPLIT / MERGE) */}
      <CadastralHeaderBar
        parcelData={parcelData}
        parcel={parcel}
        boundaryStatus={boundaryStatus}
        onStatusChange={onStatusChange}
        frontage={frontage}
        depth={depth}
        totalLandArea={totalLandArea}
        buildingHeight={buildingHeight}
      />

      {/* 2. MATCH Panel (100% Khớp ranh) */}
      {boundaryStatus === 'MATCH' && (
        <MatchPanel
          parcelData={parcelData}
          totalLandArea={totalLandArea}
          realActiveCoords={realActiveCoords}
          activeCentroid={activeCentroid}
          tileMode={tileMode}
          setTileMode={setTileMode}
          mutationData={mutationData}
          onMutationDataChange={onMutationDataChange}
          onToastMessage={onToastMessage}
        />
      )}

      {/* 3. SPLIT Panel (Tách thửa - Option 1 chấm điểm / Option 2 kéo nắn) */}
      {boundaryStatus === 'SPLIT' && (
        <SplitPanel
          parcelData={parcelData}
          realActiveCoords={realActiveCoords}
          activeCentroid={activeCentroid}
          tileMode={tileMode}
          setTileMode={setTileMode}
          splitShapeOption={splitShapeOption}
          setSplitShapeOption={setSplitShapeOption}
          polyAVertices={polyAVertices}
          setPolyAVertices={setPolyAVertices}
          calculatedAreaA={calculatedAreaA}
          calculatedAreaB={calculatedAreaB}
          dynamicCodes={dynamicCodes}
          handleVertexDrag={handleVertexDrag}
          handleMapClickDraw={handleMapClickDraw}
          handleAddMidpoint={handleAddMidpoint}
          handleRemovePoint={handleRemovePoint}
          handleResetDefault={handleResetDefault}
          handleApplyLShape={handleApplyLShape}
          mutationData={mutationData}
          onMutationDataChange={onMutationDataChange}
          customResidualType={customResidualType}
          setCustomResidualType={setCustomResidualType}
          customSplitReason={customSplitReason}
          setCustomSplitReason={setCustomSplitReason}
          handleSaveMutationProposal={handleSaveMutationProposal}
          isSubmittingMutation={isSubmittingMutation}
        />
      )}

      {/* 4. MERGE Panel (Gộp thửa & Khoanh vùng công trình) */}
      {boundaryStatus === 'MERGE' && (
        <MergePanel
          parcelData={parcelData}
          totalLandArea={totalLandArea}
          realActiveCoords={realActiveCoords}
          activeCentroid={activeCentroid}
          tileMode={tileMode}
          setTileMode={setTileMode}
          currentZoneMergeParcels={currentZoneMergeParcels}
          filteredMergeParcels={filteredMergeParcels}
          selectedMergeCodes={selectedMergeCodes}
          mergeSearchTerm={mergeSearchTerm}
          setMergeSearchTerm={setMergeSearchTerm}
          handleToggleMergeParcel={handleToggleMergeParcel}
          mergeSummary={mergeSummary}
          mutationData={mutationData}
          onMutationDataChange={onMutationDataChange}
          customMergeReason={customMergeReason}
          setCustomMergeReason={setCustomMergeReason}
          customMergeResidualType={customMergeResidualType}
          setCustomMergeResidualType={setCustomMergeResidualType}
          mergeBuildingVertices={mergeBuildingVertices}
          calculatedMergeBArea={calculatedMergeBArea}
          calculatedMergeRArea={calculatedMergeRArea}
          handleMergeMapClickDraw={handleMergeMapClickDraw}
          handleMergeRemoveLastPoint={handleMergeRemoveLastPoint}
          handleMergeClearDraw={handleMergeClearDraw}
          handleSaveMutationProposal={handleSaveMutationProposal}
          isSubmittingMutation={isSubmittingMutation}
        />
      )}
    </div>
  );
};
