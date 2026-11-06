import React from 'react';
import { Polygon } from 'react-leaflet';
import type { GisParcel } from '../../../shared/types';
import { EXCLUDED_PARCEL_FILL, EXCLUDED_PARCEL_STROKE } from '../../../shared/parcelExclusion';
import { BATCH_SELECTED_STROKE } from './ParcelsLayer';

interface ExcludedParcelsLayerProps {
  parcels: GisParcel[];
  onSelect: (parcel: GisParcel) => void;
  isBatchMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (parcel: GisParcel) => void;
}

export const ExcludedParcelsLayer: React.FC<ExcludedParcelsLayerProps> = ({ parcels, onSelect, isBatchMode = false, selectedIds, onToggleSelect }) => {
  return (
    <>
      {parcels
        .filter((parcel) => parcel.coordinates.length >= 3)
        .map((parcel) => {
          const isBatchSelected = isBatchMode && Boolean(selectedIds?.has(parcel.id));
          return (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={{
              color: isBatchSelected ? BATCH_SELECTED_STROKE : EXCLUDED_PARCEL_STROKE,
              fillColor: isBatchSelected ? BATCH_SELECTED_STROKE : EXCLUDED_PARCEL_FILL,
              fillOpacity: isBatchSelected ? 0.35 : 0.15,
              weight: isBatchSelected ? 3 : 1.5,
              dashArray: '6, 6',
            }}
            eventHandlers={{ click: () => (isBatchMode ? onToggleSelect?.(parcel) : onSelect(parcel)) }}
          />
          );
        })}
    </>
  );
};
