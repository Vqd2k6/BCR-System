import React from 'react';
import { Polygon } from 'react-leaflet';
import type { GisParcel } from '../../../shared/types';
import { getEffectiveParcelStatus, getStatusColor } from '../../utils/sweepMapHelpers';
import { getParcelBraRiskLevel, getBraColor } from '../../../../../features/guest-portal/utils/guestPortalHelpers';

interface ParcelsLayerProps {
  displayedParcels: GisParcel[];
  activeParcel: GisParcel | null;
  setActiveParcel: (parcel: GisParcel) => void;
  onSelectParcel: (parcel: GisParcel) => void;
  thematicMode?: 'WORKFLOW' | 'BRA_RISK';
}

export const ParcelsLayer: React.FC<ParcelsLayerProps> = ({
  displayedParcels,
  activeParcel,
  setActiveParcel,
  onSelectParcel,
  thematicMode = 'WORKFLOW',
}) => {
  return (
    <>
      {displayedParcels.map((parcel) => {
        const isSelected = activeParcel?.id === parcel.id;
        const isCondo = parcel.buildingType === 'CONDOMINIUM';
        const effectiveStatus = getEffectiveParcelStatus(parcel);

        let baseColor = getStatusColor(effectiveStatus);
        if (thematicMode === 'BRA_RISK') {
          const braLevel = getParcelBraRiskLevel(parcel);
          baseColor = getBraColor(braLevel);
        }

        const color = isSelected ? '#0284c7' : isCondo && thematicMode !== 'BRA_RISK' ? '#7c3aed' : baseColor;

        return (
          <Polygon
            key={parcel.id}
            positions={parcel.coordinates}
            pathOptions={{
              color: color,
              fillColor: isCondo && effectiveStatus === 'NOT_SURVEYED' && thematicMode !== 'BRA_RISK' ? '#8b5cf6' : color,
              fillOpacity: isSelected ? 0.8 : thematicMode === 'BRA_RISK' ? 0.65 : isCondo ? 0.6 : 0.45,
              weight: isSelected ? 3.5 : isCondo ? 2.5 : 1.5,
              dashArray: isCondo && effectiveStatus === 'NOT_SURVEYED' && thematicMode !== 'BRA_RISK' ? '4, 4' : undefined,
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
