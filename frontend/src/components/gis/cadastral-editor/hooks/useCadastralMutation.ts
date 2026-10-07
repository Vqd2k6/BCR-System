import { useState, useCallback } from 'react';
import {
  GisParcel,
  MutationPayloadData,
  CadastralParcelData,
  SplitChildData,
} from '../../shared/types';
import { useCadastralGeometry } from './useCadastralGeometry';
import { useCadastralSplit } from './useCadastralSplit';
import { useCadastralMerge } from './useCadastralMerge';

interface UseCadastralMutationProps {
  activeParcelId: string;
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

/**
 * Facade Coordinator Hook: Tích hợp 3 sub-domain chuyên biệt:
 * 1. useCadastralGeometry: Xử lý không gian, tọa độ PostGIS, tâm centroid, tải lân cận
 * 2. useCadastralSplit: Xử lý nghiệp vụ chia tách đa giác, kéo thả đỉnh, sinh mã mới
 * 3. useCadastralMerge: Xử lý nghiệp vụ gộp thửa, tìm kiếm liền kề, đa giác công trình một phần
 */
export const useCadastralMutation = ({
  activeParcelId,
  parcelData,
  parcel,
  boundaryStatus,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}: UseCadastralMutationProps) => {
  const frontage = parcelData.frontageWidth || 4.2;
  const depth = parcelData.lotDepth || 18.5;
  const buildingHeight =
    parcelData.buildingHeight !== undefined && parcelData.buildingHeight !== null && (parcelData.buildingHeight as any) !== ''
      ? Number(parcelData.buildingHeight)
      : (parcel?.buildingHeightM || (parcel as any)?.building_height_m ? Number(parcel?.buildingHeightM || (parcel as any)?.building_height_m) : undefined);
  const totalLandArea =
    parcelData.constructionArea || parcelData.landArea || Math.round(frontage * depth * 10) / 10 || 68.5;

  const [isSubmittingMutation, setIsSubmittingMutation] = useState<boolean>(false);

  // Sub-hook 1: Không gian địa lý & mạng dữ liệu thửa
  const geom = useCadastralGeometry({
    activeParcelId,
    parcelData,
    parcel,
  });

  // Sub-hook 2: Nghiệp vụ Tách thửa & Thao tác đỉnh đa giác
  const split = useCadastralSplit({
    realActiveCoords: geom.realActiveCoords,
    parcelData,
    parcel,
    activeParcelId,
    totalLandArea,
    boundaryStatus,
    mutationData,
    onMutationDataChange,
  });

  // Sub-hook 3: Nghiệp vụ Gộp thửa & Đất liền kề
  const merge = useCadastralMerge({
    zoneParcels: geom.zoneParcels,
    nearby30mParcels: geom.nearby30mParcels,
    realActiveCoords: geom.realActiveCoords,
    activeCentroid: geom.activeCentroid,
    parcelData,
    parcel,
    activeParcelId,
    totalLandArea,
    mutationData,
    onMutationDataChange,
    calcDistanceMeters: geom.calcDistanceMeters,
    generateFallbackNeighbors: geom.generateFallbackNeighbors,
  });

  const getPolygonB = useCallback((): [number, number][] => {
    if (split.polyBVertices && split.polyBVertices.length >= 3) {
      return split.polyBVertices;
    }
    return split.computePolygonB(split.polyAVertices);
  }, [split]);

  const handleSaveMutationProposal = () => {
    if (boundaryStatus === 'SPLIT' && !mutationData.splitReason?.trim()) {
      alert('Vui lòng chọn hoặc nhập Lý do chia tách thửa đất thực tế trước khi xác nhận đề xuất!');
      const el = document.getElementById('input-splitReason');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmittingMutation(true);
    const nowStr = new Date().toLocaleTimeString('vi-VN');
    const polyB = getPolygonB();

    const isNewB = mutationData.residualKind === 'NEW_BUILDING';
    const currentChildren: SplitChildData[] = mutationData.splitChildren && mutationData.splitChildren.length > 0
      ? mutationData.splitChildren
      : [
          {
            label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
            houseNumber: parcelData.houseNumber,
            ownerName: parcelData.ownerName || '',
            suggestedCode: parcelData.projectParcelCode,
            areaM2: split.calculatedAreaA,
            functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
            isResidualSurplus: false,
          },
          {
            label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
            houseNumber: `${parcelData.houseNumber}B`,
            ownerName: isNewB ? 'Chủ hộ Căn B' : 'Chủ sở hữu phần đất dôi dư',
            suggestedCode: isNewB ? (split.dynamicCodes[0] || 'B-07001') : `${parcelData.projectParcelCode}-DU`,
            areaM2: split.calculatedAreaB,
            functionalType: split.customResidualType || (isNewB ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS'),
            residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
            isResidualSurplus: !isNewB,
            residualParentParcelCode: parcelData.projectParcelCode,
            residualParentCadastralCode: parcelData.officialCadastralCode,
            residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
            residualMetadataNote: isNewB
              ? `Nhà mới tách từ ${parcelData.projectParcelCode}`
              : `Đất thừa tách từ ${parcelData.projectParcelCode}`,
          },
        ];

    const updatedChildren: SplitChildData[] = currentChildren.map((c, idx) => {
      if (idx === 0) {
        return {
          ...c,
          suggestedCode: parcelData.projectParcelCode,
          areaM2: split.calculatedAreaA,
          coordinates: split.polyAVertices,
        };
      }
      if (idx === 1) {
        return {
          ...c,
          label: isNewB ? 'Căn B (Nhà mới độc lập)' : 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
          suggestedCode: isNewB
            ? (c.suggestedCode && c.suggestedCode !== `${parcelData.projectParcelCode}-DU` ? c.suggestedCode : (split.dynamicCodes[0] || 'B-07001'))
            : `${parcelData.projectParcelCode}-DU`,
          areaM2: split.calculatedAreaB,
          residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
          isResidualSurplus: !isNewB,
          coordinates: polyB,
          residualParentParcelCode: parcelData.projectParcelCode,
          residualParentCadastralCode: parcelData.officialCadastralCode,
          residualMetadataNote: isNewB
            ? `Nhà mới tách từ ${parcelData.projectParcelCode}`
            : `Đất thừa tách từ ${parcelData.projectParcelCode}`,
        };
      }
      return c;
    });

    const updatedMutation: MutationPayloadData = {
      ...mutationData,
      isSubmitted: true,
      activeProposalType: boundaryStatus,
      residualKind: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
      matchConfirmed: false,
      submittedAt: nowStr,
      splitShapeOption: split.splitShapeOption,
      splitCustomPointsA: split.polyAVertices,
      splitCustomPointsB: polyB,
      splitChildren: updatedChildren,
      primaryMergeCode: merge.mergeSummary.keptCode,
      mergeBuildingCustomPoints: merge.mergeBuildingVertices,
      mergeResidualParcelCode: mutationData.mergeResidualParcelCode || `${merge.mergeSummary.keptCode}-DU`,
      mergeBuildingAreaM2: merge.calculatedMergeBArea,
      mergeResidualAreaM2: merge.calculatedMergeRArea,
      mergeResidualCustomPoints: geom.realActiveCoords,
      // Flat legacy compatibility fields
      portionAAreaM2: split.calculatedAreaA,
      portionBAreaM2: split.calculatedAreaB,
      portionAPolygon: split.polyAVertices,
      portionBPolygon: polyB,
      splitType: isNewB ? 'NEW_BUILDING' : 'NON_BUILDING',
      mergeWithParcelCodes: merge.selectedMergeCodes,
      finalMergedLandAreaM2: merge.mergeSummary.totalMergedArea,
      mergeBuildingPolygon: merge.mergeBuildingVertices,
      mergeResidualPolygon: geom.realActiveCoords,
    };

    onMutationDataChange(updatedMutation);

    if (onToastMessage) {
      onToastMessage(
        `✓ Đã ghi nhận đề xuất ${boundaryStatus === 'SPLIT' ? 'Tách thửa' : 'Gộp thửa'} kèm tọa độ polygon các lô vào hồ sơ thửa ${parcelData.projectParcelCode}!`
      );
    }

    setTimeout(() => {
      setIsSubmittingMutation(false);
    }, 200);
  };

  return {
    frontage,
    depth,
    buildingHeight,
    totalLandArea,
    tileMode: geom.tileMode,
    setTileMode: geom.setTileMode,
    zoneParcels: geom.zoneParcels,
    realActiveCoords: geom.realActiveCoords,
    activeCentroid: geom.activeCentroid,
    nearby30mParcels: geom.nearby30mParcels,
    currentZoneMergeParcels: merge.currentZoneMergeParcels,
    filteredMergeParcels: merge.filteredMergeParcels,
    mergeSearchTerm: merge.mergeSearchTerm,
    setMergeSearchTerm: merge.setMergeSearchTerm,
    splitShapeOption: split.splitShapeOption,
    setSplitShapeOption: split.setSplitShapeOption,
    activeTarget: split.activeTarget,
    setActiveTarget: split.setActiveTarget,
    customResidualType: split.customResidualType,
    setCustomResidualType: split.setCustomResidualType,
    customSplitReason: split.customSplitReason,
    setCustomSplitReason: split.setCustomSplitReason,
    customMergeReason: merge.customMergeReason,
    setCustomMergeReason: merge.setCustomMergeReason,
    customMergeResidualType: merge.customMergeResidualType,
    setCustomMergeResidualType: merge.setCustomMergeResidualType,
    dynamicCodes: split.dynamicCodes,
    maxZoneInfo: split.maxZoneInfo,
    isSubmittingMutation,
    polyAVertices: split.polyAVertices,
    setPolyAVertices: split.setPolyAVertices,
    polyBVertices: split.polyBVertices,
    setPolyBVertices: split.setPolyBVertices,
    calculatedAreaA: split.calculatedAreaA,
    calculatedAreaB: split.calculatedAreaB,
    handleVertexDrag: split.handleVertexDrag,
    handleMapClickDraw: split.handleMapClickDraw,
    handleAddMidpoint: split.handleAddMidpoint,
    handleRemovePoint: split.handleRemovePoint,
    handleResetTarget: split.handleResetTarget,
    handleResetDefault: split.handleResetDefault,
    handleSplitHorizontal: split.handleSplitHorizontal,
    handleSplitVertical: split.handleSplitVertical,
    selectedMergeCodes: merge.selectedMergeCodes,
    mergeSummary: merge.mergeSummary,
    handleToggleMergeParcel: merge.handleToggleMergeParcel,
    handleSetPrimaryMergeCode: merge.handleSetPrimaryMergeCode,
    isSurveyedParcel: merge.isSurveyedParcel,
    getSurveyBadgeInfo: merge.getSurveyBadgeInfo,
    mergeBuildingVertices: merge.mergeBuildingVertices,
    setMergeBuildingVertices: merge.setMergeBuildingVertices,
    calculatedMergeBArea: merge.calculatedMergeBArea,
    calculatedMergeRArea: merge.calculatedMergeRArea,
    handleMergeMapClickDraw: merge.handleMergeMapClickDraw,
    handleMergeRemoveLastPoint: merge.handleMergeRemoveLastPoint,
    handleMergeClearDraw: merge.handleMergeClearDraw,
    mergeDynamicCodes: merge.dynamicCodes,
    mergeMaxZoneInfo: merge.maxZoneInfo,
    mergePartitionKind: merge.mergePartitionKind,
    mergeSecondaryOfficialCode: merge.mergeSecondaryOfficialCode,
    handleSetMergePartitionKind: merge.handleSetMergePartitionKind,
    handleUpdateMergeSecondaryField: merge.handleUpdateMergeSecondaryField,
    handleSaveMutationProposal,
  };
};
