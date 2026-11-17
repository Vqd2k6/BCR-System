import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { GisParcel, ThematicFilterMatch, ThematicMapBinding } from '../../../shared/types';
import { getEffectiveParcelStatus, getStatusColor } from '../../utils/sweepMapHelpers';

interface ParcelsLayerProps {
  displayedParcels: GisParcel[];
  activeParcel: GisParcel | null;
  setActiveParcel: (parcel: GisParcel) => void;
  onSelectParcel: (parcel: GisParcel) => void;
  /** Bản đồ chuyên đề (features/gis-visualization); null ⇒ tô theo trạng thái khảo sát (WORKFLOW). */
  thematic?: ThematicMapBinding | null;
  /** Bộ lọc chỉ định: ở WORKFLOW làm mờ thửa không khớp (ở chuyên đề binding đã tự xử lý). */
  filterMatch?: ThematicFilterMatch | null;
  /** Chế độ chọn nhiều thửa: click chỉ chọn/bỏ chọn, không mở bảng chi tiết */
  isBatchMode?: boolean;
  selectedParcelIds?: ReadonlySet<string>;
  onToggleSelect?: (parcel: GisParcel) => void;
}

/** Màu viền thửa đang được chọn hàng loạt: fuchsia, khác màu tím của thửa chung cư */
export const BATCH_SELECTED_STROKE = '#d946ef';
const SELECTED_STROKE = '#0284c7';

/** Kiểu tác nghiệp WORKFLOW — giữ nguyên từng giá trị như trước khi có bản đồ chuyên đề. */
function workflowPathOptions(
  parcel: GisParcel,
  isSelected: boolean,
  isBatchSelected: boolean,
  isFilteredOut = false
): PathOptions {
  const isCondo = parcel.buildingType === 'CONDOMINIUM';
  const effectiveStatus = getEffectiveParcelStatus(parcel);
  const baseColor = getStatusColor(effectiveStatus);
  const color = isBatchSelected ? BATCH_SELECTED_STROKE : isSelected ? SELECTED_STROKE : isCondo ? '#7c3aed' : baseColor;
  // Thửa ngoài bộ lọc chỉ định: giữ màu trạng thái nhưng gần như trong suốt, viền mảnh
  if (isFilteredOut && !isSelected && !isBatchSelected) {
    return { color: baseColor, fillColor: baseColor, fillOpacity: 0.06, weight: 0.6, opacity: 0.35 };
  }
  return {
    color,
    fillColor: isCondo && effectiveStatus === 'NOT_SURVEYED' ? '#8b5cf6' : color,
    fillOpacity: isBatchSelected ? 0.55 : isSelected ? 0.8 : isCondo ? 0.6 : 0.45,
    weight: isBatchSelected || isSelected ? 3.5 : isCondo ? 2.5 : 1.5,
    dashArray: isBatchSelected ? '6 3' : isCondo && effectiveStatus === 'NOT_SURVEYED' ? '4, 4' : undefined,
  };
}

/** Kiểu chuyên đề: màu dữ liệu giữ nguyên, chỉ viền đổi khi thửa đang được chọn. */
function thematicPathOptions(
  parcel: GisParcel,
  thematic: ThematicMapBinding,
  isSelected: boolean,
  isBatchSelected: boolean
): PathOptions {
  const s = thematic.resolveStyle(parcel);
  return {
    color: isBatchSelected ? BATCH_SELECTED_STROKE : isSelected ? SELECTED_STROKE : s.strokeHex,
    fillColor: s.fillHex,
    fillOpacity: isSelected ? Math.max(s.fillOpacity, 0.8) : s.fillOpacity,
    weight: isBatchSelected || isSelected ? 3.5 : s.weight,
    dashArray: isBatchSelected ? '6 3' : s.dashArray,
  };
}

export const ParcelsLayer: React.FC<ParcelsLayerProps> = ({
  displayedParcels,
  activeParcel,
  setActiveParcel,
  onSelectParcel,
  thematic = null,
  filterMatch = null,
  isBatchMode = false,
  selectedParcelIds,
  onToggleSelect,
}) => {
  return (
    <>
      {displayedParcels.map((parcel) => {
        const isBatchSelected = isBatchMode && Boolean(selectedParcelIds?.has(parcel.id));
        const isSelected = !isBatchMode && activeParcel?.id === parcel.id;
        const pathOptions = thematic
          ? thematicPathOptions(parcel, thematic, isSelected, isBatchSelected)
          : workflowPathOptions(parcel, isSelected, isBatchSelected, filterMatch ? !filterMatch.matchedIds.has(parcel.id) : false);
        const tooltipLines = thematic ? thematic.tooltipLines(parcel) : [];

        return (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={pathOptions}
            eventHandlers={{
              click: () => {
                if (isBatchMode) {
                  onToggleSelect?.(parcel);
                  return;
                }
                setActiveParcel(parcel);
                onSelectParcel(parcel);
              },
            }}
          >
            {tooltipLines.length > 0 && (
              <Tooltip sticky direction="top" opacity={0.95}>
                <div className="text-[11px] leading-snug">
                  {tooltipLines.map((line, idx) => (
                    <div key={idx} className={idx === 0 ? 'font-bold font-mono' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </Tooltip>
            )}
          </Polygon>
        );
      })}
    </>
  );
};
