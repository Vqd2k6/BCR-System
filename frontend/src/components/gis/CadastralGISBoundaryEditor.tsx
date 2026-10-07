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
    activeTarget,
    setActiveTarget,
    customResidualType,
    setCustomResidualType,
    customSplitReason,
    setCustomSplitReason,
    customMergeReason,
    setCustomMergeReason,
    customMergeResidualType,
    setCustomMergeResidualType,
    dynamicCodes,
    maxZoneInfo,
    isSubmittingMutation,
    polyAVertices,
    setPolyAVertices,
    polyBVertices,
    setPolyBVertices,
    calculatedAreaA,
    calculatedAreaB,
    handleVertexDrag,
    handleMapClickDraw,
    handleAddMidpoint,
    handleRemovePoint,
    handleResetTarget,
    handleResetDefault,
    handleSplitHorizontal,
    handleSplitVertical,
    selectedMergeCodes,
    mergeSummary,
    handleToggleMergeParcel,
    handleSetPrimaryMergeCode,
    isSurveyedParcel,
    getSurveyBadgeInfo,
    mergeBuildingVertices,
    calculatedMergeBArea,
    calculatedMergeRArea,
    handleMergeMapClickDraw,
    handleMergeRemoveLastPoint,
    handleMergeClearDraw,
    handleSaveMutationProposal,
    zoneParcels,
    mergeDynamicCodes,
    mergeMaxZoneInfo,
    mergePartitionKind,
    mergeSecondaryOfficialCode,
    handleSetMergePartitionKind,
    handleUpdateMergeSecondaryField,
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

      {/* 3. SPLIT Panel (Tách thửa trực quan - Render cả 2 Lô A/B & Max Zone + 1) */}
      {boundaryStatus === 'SPLIT' && (
        <SplitPanel
          parcelData={parcelData}
          realActiveCoords={realActiveCoords}
          activeCentroid={activeCentroid}
          tileMode={tileMode}
          setTileMode={setTileMode}
          splitShapeOption={splitShapeOption}
          setSplitShapeOption={setSplitShapeOption}
          activeTarget={activeTarget}
          setActiveTarget={setActiveTarget}
          polyAVertices={polyAVertices}
          setPolyAVertices={setPolyAVertices}
          polyBVertices={polyBVertices}
          setPolyBVertices={setPolyBVertices}
          calculatedAreaA={calculatedAreaA}
          calculatedAreaB={calculatedAreaB}
          dynamicCodes={dynamicCodes}
          maxZoneInfo={maxZoneInfo}
          handleVertexDrag={handleVertexDrag}
          handleMapClickDraw={handleMapClickDraw}
          handleAddMidpoint={handleAddMidpoint}
          handleRemovePoint={handleRemovePoint}
          handleResetTarget={handleResetTarget}
          handleResetDefault={handleResetDefault}
          handleSplitHorizontal={handleSplitHorizontal}
          handleSplitVertical={handleSplitVertical}
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

      {/* 4. MERGE Panel (Gộp thửa & Bản đồ toàn Zone tương tác Click-to-Merge) */}
      {boundaryStatus === 'MERGE' && (
        <MergePanel
          parcelData={parcelData}
          totalLandArea={totalLandArea}
          realActiveCoords={realActiveCoords}
          activeCentroid={activeCentroid}
          tileMode={tileMode}
          setTileMode={setTileMode}
          zoneParcels={zoneParcels}
          currentZoneMergeParcels={currentZoneMergeParcels}
          filteredMergeParcels={filteredMergeParcels}
          selectedMergeCodes={selectedMergeCodes}
          mergeSearchTerm={mergeSearchTerm}
          setMergeSearchTerm={setMergeSearchTerm}
          handleToggleMergeParcel={handleToggleMergeParcel}
          handleSetPrimaryMergeCode={handleSetPrimaryMergeCode}
          isSurveyedParcel={isSurveyedParcel}
          getSurveyBadgeInfo={getSurveyBadgeInfo}
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
          dynamicCodes={mergeDynamicCodes}
          maxZoneInfo={mergeMaxZoneInfo}
          mergePartitionKind={mergePartitionKind}
          mergeSecondaryOfficialCode={mergeSecondaryOfficialCode}
          handleSetMergePartitionKind={handleSetMergePartitionKind}
          handleUpdateMergeSecondaryField={handleUpdateMergeSecondaryField}
        />
      )}
    </div>
  );
};
