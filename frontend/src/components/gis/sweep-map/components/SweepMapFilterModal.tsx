import React from 'react';
import { Filter, X, Layers, EyeOff, Check } from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import type { AppliedFiltersState } from '../hooks/useSweepMapState';

interface SweepMapFilterModalProps {
  showFilterModal: boolean;
  setShowFilterModal: (show: boolean) => void;
  parcels: GisParcel[];
  draftFilters: AppliedFiltersState;
  setDraftFilters: React.Dispatch<React.SetStateAction<AppliedFiltersState>>;
  setAppliedFilters: (filters: AppliedFiltersState) => void;
  setAllFilters: (enable: boolean) => void;
  setPhase1Only: () => void;
  setPhase2Only: () => void;
  isNonBuildingParcel: (parcel: GisParcel) => boolean;
}

export const SweepMapFilterModal: React.FC<SweepMapFilterModalProps> = ({
  showFilterModal,
  setShowFilterModal,
  parcels,
  draftFilters,
  setDraftFilters,
  setAppliedFilters,
  setAllFilters,
  setPhase1Only,
  setPhase2Only,
  isNonBuildingParcel,
}) => {
  if (!showFilterModal) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2000,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={() => setShowFilterModal(false)}
    >
      <div
        className="card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          padding: '1.25rem',
          maxWidth: '360px',
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Filter size={18} color="#0284c7" />
            <h4 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 800, color: '#0f172a' }}>
              Bộ Lọc Hiển Thị Thửa Đất
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowFilterModal(false)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Preset Buttons */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setAllFilters(true)}
            style={{
              flex: 1,
              fontSize: '0.725rem',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            Tất cả ({parcels.length})
          </button>
          <button
            type="button"
            onClick={setPhase1Only}
            style={{
              flex: 1,
              fontSize: '0.725rem',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              border: '1px solid #cbd5e1',
              background: '#fffbeb',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#b45309',
            }}
          >
            Chỉ Phase 1
          </button>
          <button
            type="button"
            onClick={setPhase2Only}
            style={{
              flex: 1,
              fontSize: '0.725rem',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              border: '1px solid #cbd5e1',
              background: '#f0fdf4',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#15803d',
            }}
          >
            Chỉ Phase 2
          </button>
        </div>

        {/* Checklist Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.APPROVED ? '#f0fdf4' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.APPROVED}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, APPROVED: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#15803d' }}>Đã duyệt Phase 1 (Chờ làm Phase 2)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.PHASE2_COMPLETED ? '#eff6ff' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.PHASE2_COMPLETED}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, PHASE2_COMPLETED: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Đã hoàn tất Phase 2 (Trước thi công)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.SUBMITTED ? '#f0f9ff' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.SUBMITTED}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, SUBMITTED: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0284c7', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#0369a1' }}>Đã nộp hồ sơ (Chờ duyệt)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.IN_PROGRESS ? '#fffbeb' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.IN_PROGRESS}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, IN_PROGRESS: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#b45309' }}>Đang làm dở (Chưa nộp / Lưu nháp)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.POSTPONED_ABSENT ? '#faf5ff' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.POSTPONED_ABSENT}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, POSTPONED_ABSENT: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#7e22ce' }}>Chủ nhà vắng mặt (Đã dán giấy hẹn)</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.825rem',
              cursor: 'pointer',
              padding: '0.35rem 0.45rem',
              borderRadius: '0.45rem',
              backgroundColor: draftFilters.NOT_SURVEYED ? '#f8fafc' : '#ffffff',
            }}
          >
            <input
              type="checkbox"
              checked={draftFilters.NOT_SURVEYED}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, NOT_SURVEYED: e.target.checked }))}
              style={{ width: '16px', height: '16px', accentColor: '#64748b', cursor: 'pointer' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#475569' }}>Chưa khảo sát Phase 1</span>
          </label>

          {/* Toggle to Hide Non-Building Parcels */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.825rem',
                cursor: 'pointer',
                padding: '0.5rem 0.6rem',
                borderRadius: '0.5rem',
                backgroundColor: draftFilters.hideNonBuildings ? '#fef2f2' : '#f8fafc',
                border: draftFilters.hideNonBuildings ? '1.5px solid #f87171' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={draftFilters.hideNonBuildings}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, hideNonBuildings: e.target.checked }))}
                style={{ width: '17px', height: '17px', accentColor: '#dc2626', cursor: 'pointer', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 700, color: draftFilters.hideNonBuildings ? '#b91c1c' : '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <EyeOff size={14} />
                  <span>Ẩn ô không có công trình ({(parcels || []).filter(isNonBuildingParcel).length} thửa)</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                  Bỏ qua đường đi, sông nước, kênh rạch, công viên, đất trống
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Confirm Filter Button */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setAppliedFilters(draftFilters);
            setShowFilterModal(false);
          }}
          style={{
            width: '100%',
            padding: '0.55rem',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
          }}
        >
          <Check size={16} />
          Xác Nhận Áp Dụng Bộ Lọc
        </button>

        {/* Bottom Color Legend Description */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.75rem',
            backgroundColor: '#f8fafc',
            padding: '0.6rem 0.75rem',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
            <Layers size={14} color="#0284c7" />
            <span>Chú thích màu sắc hiển thị trên bản đồ:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#15803d' }}>Xanh lá:</strong> Đã duyệt Phase 1 (Chờ Phase 2)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#1d4ed8' }}>Xanh dương:</strong> Đã hoàn tất Phase 2
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0284c7', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#0369a1' }}>Xanh lam:</strong> Đã nộp hồ sơ (Chờ duyệt)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#b45309' }}>Vàng cam:</strong> Đang làm dở (Chưa nộp)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#7e22ce' }}>Tím:</strong> Vắng mặt (Đã dán giấy hẹn)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#475569' }}>Xám tro:</strong> Chưa khảo sát Phase 1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
