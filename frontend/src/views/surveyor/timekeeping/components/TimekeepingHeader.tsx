import React from 'react';
import { RefreshCw } from 'lucide-react';
import {
  getZoneCentroid,
  type MetroZoneCentroid,
  METRO_ZONE_CENTROIDS,
} from '../../../../core/utils/metroZoneUtils';

interface TimekeepingHeaderProps {
  selectedZoneId: string;
  setSelectedZoneId: (zoneId: string) => void;
  setTargetZone: (zone: MetroZoneCentroid) => void;
  getLiveGps: (zoneToUse?: MetroZoneCentroid) => void;
  hasCheckedIn: boolean;
  gpsLoading: boolean;
}

export const TimekeepingHeader: React.FC<TimekeepingHeaderProps> = ({
  selectedZoneId,
  setSelectedZoneId,
  setTargetZone,
  getLiveGps,
  hasCheckedIn,
  gpsLoading,
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          Điểm Danh GPS Hiện Trường
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Phân khu khảo sát:</span>
          <select
            value={selectedZoneId}
            onChange={(e) => {
              const newZId = e.target.value;
              setSelectedZoneId(newZId);
              const newCentroid = getZoneCentroid(newZId);
              setTargetZone(newCentroid);
              getLiveGps(newCentroid);
            }}
            className="form-control"
            style={{
              fontSize: '0.825rem',
              fontWeight: 700,
              color: '#0369a1',
              backgroundColor: '#f0f9ff',
              borderColor: '#bae6fd',
              borderRadius: '0.5rem',
              padding: '0.25rem 0.6rem',
              width: 'auto',
              cursor: 'pointer',
            }}
          >
            {Object.values(METRO_ZONE_CENTROIDS).map((z) => (
              <option key={z.zoneId} value={z.zoneId}>
                {z.zoneName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!hasCheckedIn && (
        <button
          type="button"
          onClick={() => getLiveGps()}
          style={{
            background: '#f8fafc',
            color: '#0284c7',
            border: '1px solid #cbd5e1',
            borderRadius: '9999px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            whiteSpace: 'nowrap',
          }}
        >
          <RefreshCw size={13} className={gpsLoading ? 'animate-spin' : ''} />
          <span>Lấy lại GPS</span>
        </button>
      )}
    </div>
  );
};
