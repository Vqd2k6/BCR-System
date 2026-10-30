import React from 'react';
import { Polygon } from 'react-leaflet';
import type { GisParcel } from '../../../shared/types';
import { EXCLUDED_PARCEL_FILL, EXCLUDED_PARCEL_STROKE } from '../../../shared/parcelExclusion';

interface ExcludedParcelsLayerProps {
  parcels: GisParcel[];
  onSelect: (parcel: GisParcel) => void;
}

export const ExcludedParcelsLayer: React.FC<ExcludedParcelsLayerProps> = ({ parcels, onSelect }) => {
  return (
    <>
      {parcels
        .filter((parcel) => parcel.coordinates.length >= 3)
        .map((parcel) => (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={{
              color: EXCLUDED_PARCEL_STROKE,
              fillColor: EXCLUDED_PARCEL_FILL,
              fillOpacity: 0.15,
              weight: 1.5,
              dashArray: '6, 6',
            }}
            eventHandlers={{ click: () => onSelect(parcel) }}
          />
        ))}
    </>
  );
};
