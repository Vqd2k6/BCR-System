import React from 'react';
import { Polygon } from 'react-leaflet';
import { GisParcel } from '../../../shared/types';
import { getEffectiveParcelStatus, getStatusColor } from '../../utils/sweepMapHelpers';

interface ParcelsLayerProps {
  displayedParcels: GisParcel[];
  activeParcel: GisParcel | null;
  setActiveParcel: (parcel: GisParcel) => void;
  onSelectParcel: (parcel: GisParcel) => void;
}

export const ParcelsLayer: React.FC<ParcelsLayerProps> = ({
  displayedParcels,
  activeParcel,
  setActiveParcel,
  onSelectParcel,
}) => {
  return (
    <>
      {displayedParcels.map((parcel) => {
        const isSelected = activeParcel?.id === parcel.id;
        const isCondo = parcel.buildingType === 'CONDOMINIUM';
        const effectiveStatus = getEffectiveParcelStatus(parcel);
        const baseColor = getStatusColor(effectiveStatus);
        const color = isSelected ? '#0284c7' : isCondo ? '#7c3aed' : baseColor;

        return (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={{
              color: color,
              fillColor: isCondo && effectiveStatus === 'NOT_SURVEYED' ? '#8b5cf6' : color,
              fillOpacity: isSelected ? 0.8 : isCondo ? 0.6 : 0.45,
              weight: isSelected ? 3.5 : isCondo ? 2.5 : 1.5,
              dashArray: isCondo && effectiveStatus === 'NOT_SURVEYED' ? '4, 4' : undefined,
            }}
            eventHandlers={{
              click: () => {
                setActiveParcel(parcel);
                onSelectParcel(parcel);
              },
            }}
          />
        );
      })}
    </>
  );
};
