import React from 'react';
import { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import { ParcelCardItem } from './ParcelCardItem';

interface ParcelListContainerProps {
  filteredParcels: GisParcel[];
  displayLimit: number;
  onLoadMore: () => void;
  onLoadAll: () => void;
  canApproveOrReject: boolean;
  onStartPhase1: (parcel: GisParcel, readOnly?: boolean) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onOpenHub: (parcel: GisParcel) => void;
  onOpenDirections: (parcel: GisParcel) => void;
  onAdminApprove: (parcel: GisParcel) => void;
  onAdminReject: (parcel: GisParcel) => void;
}

export const ParcelListContainer: React.FC<ParcelListContainerProps> = ({
  filteredParcels,
  displayLimit,
  onLoadMore,
  onLoadAll,
  canApproveOrReject,
  onStartPhase1,
  onStartPhase2,
  onOpenHub,
  onOpenDirections,
  onAdminApprove,
  onAdminReject,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '4.5rem' }}>
      {filteredParcels.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          Không có thửa đất nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <>
          {filteredParcels.slice(0, displayLimit).map((p) => (
            <ParcelCardItem
              key={p.id}
              parcel={p}
              canApproveOrReject={canApproveOrReject}
              onStartPhase1={onStartPhase1}
              onStartPhase2={onStartPhase2}
              onOpenHub={onOpenHub}
              onOpenDirections={onOpenDirections}
              onAdminApprove={onAdminApprove}
              onAdminReject={onAdminReject}
            />
          ))}

          {/* Pagination Load More Controller */}
          {filteredParcels.length > displayLimit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onLoadMore}
                className="btn btn-primary"
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderRadius: '0.5rem',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                }}
              >
                <span>+ Xem thêm 10 thửa đất tiếp theo</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  (Đang hiện {Math.min(displayLimit, filteredParcels.length)}/{filteredParcels.length})
                </span>
              </button>

              {filteredParcels.length > displayLimit + 10 && (
                <button
                  type="button"
                  onClick={onLoadAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Tải toàn bộ {filteredParcels.length} thửa đất của khu vực
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
