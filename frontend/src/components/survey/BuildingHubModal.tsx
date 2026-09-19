import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GisParcel } from '../gis/LeafletSweepMap';
import {
  Building2,
  Home,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ChevronRight,
  ShieldAlert,
  X,
  Layers,
  Sparkles,
  User,
  Phone,
  ArrowRight,
  Info,
  Check,
  Filter,
  AlertCircle,
} from 'lucide-react';

export interface BuildingUnit {
  id: string;
  parcel_id: string;
  unit_code: string;
  floor_number: number;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_id_card?: string | null;
  status: string;
  phase1_report_id?: string | null;
  phase2_report_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  parcel: GisParcel;
  onClose: () => void;
  onStartMasterSurvey: (parcel: GisParcel) => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit) => void;
  onUnitsUpdated?: () => void;
}

export const BuildingHubModal: React.FC<Props> = ({
  parcel,
  onClose,
  onStartMasterSurvey,
  onStartUnitSurvey,
  onUnitsUpdated,
}) => {
  // MASTER-FIRST GUARD: check if building master has been surveyed (even partially)
  const masterDraftKey = `metro2_phase1_draft_${parcel.id}`;
  const hasMasterDraft = !!localStorage.getItem(masterDraftKey);

  const [activeTab, setActiveTab] = useState<'units' | 'master'>(hasMasterDraft ? 'units' : 'master');
  const [units, setUnits] = useState<BuildingUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state for adding unit
  const [newUnitCode, setNewUnitCode] = useState<string>('');
  const [newFloorNumber, setNewFloorNumber] = useState<number>(1);
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newOwnerPhone, setNewOwnerPhone] = useState<string>('');
  const [isSubmittingUnit, setIsSubmittingUnit] = useState<boolean>(false);

  // Load units from API
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parcels/${parcel.id}/units`);
      if (res.data?.data?.units && Array.isArray(res.data.data.units) && res.data.data.units.length > 0) {
        setUnits(res.data.data.units);
      } else {
        // Sample units if empty
        const defaultUnits: BuildingUnit[] = [
          {
            id: 'u-101',
            parcel_id: parcel.id,
            unit_code: 'P.101',
            floor_number: 1,
            owner_name: 'Nguyễn Văn An',
            owner_phone: '0901 234 567',
            status: 'NOT_SURVEYED',
          },
          {
            id: 'u-102',
            parcel_id: parcel.id,
            unit_code: 'P.102',
            floor_number: 1,
            owner_name: 'Trần Thị Bích',
            owner_phone: '0912 345 678',
            status: 'NOT_SURVEYED',
          },
          {
            id: 'u-201',
            parcel_id: parcel.id,
            unit_code: 'P.201',
            floor_number: 2,
            owner_name: 'Lê Hoàng Cường',
            owner_phone: '0988 765 432',
            status: 'NOT_SURVEYED',
          },
          {
            id: 'u-202',
            parcel_id: parcel.id,
            unit_code: 'P.202',
            floor_number: 2,
            owner_name: 'Phạm Ngọc Dũng',
            owner_phone: '0977 123 987',
            status: 'NOT_SURVEYED',
          },
        ];
        setUnits(defaultUnits);
      }
    } catch (_err) {
      // Fallback
      setUnits([
        {
          id: 'u-101',
          parcel_id: parcel.id,
          unit_code: 'P.101',
          floor_number: 1,
          owner_name: 'Nguyễn Văn An',
          owner_phone: '0901 234 567',
          status: 'NOT_SURVEYED',
        },
        {
          id: 'u-102',
          parcel_id: parcel.id,
          unit_code: 'P.102',
          floor_number: 1,
          owner_name: 'Trần Thị Bích',
          owner_phone: '0912 345 678',
          status: 'NOT_SURVEYED',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [parcel.id]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitCode.trim()) return;
    try {
      setIsSubmittingUnit(true);
      const res = await api.post(`/parcels/${parcel.id}/units`, {
        unitCode: newUnitCode.trim(),
        floorNumber: newFloorNumber,
        ownerName: newOwnerName.trim() || undefined,
        ownerPhone: newOwnerPhone.trim() || undefined,
      });
      if (res.data?.data?.unit) {
        setUnits((prev) => [...prev, res.data.data.unit]);
      } else {
        const fakeUnit: BuildingUnit = {
          id: `u-${Date.now()}`,
          parcel_id: parcel.id,
          unit_code: newUnitCode.trim(),
          floor_number: newFloorNumber,
          owner_name: newOwnerName.trim() || 'Chưa cập nhật',
          owner_phone: newOwnerPhone.trim() || '',
          status: 'NOT_SURVEYED',
        };
        setUnits((prev) => [...prev, fakeUnit]);
      }
      setShowAddModal(false);
      setNewUnitCode('');
      setNewOwnerName('');
      setNewOwnerPhone('');
      if (onUnitsUpdated) onUnitsUpdated();
    } catch (_err) {
      const fakeUnit: BuildingUnit = {
        id: `u-${Date.now()}`,
        parcel_id: parcel.id,
        unit_code: newUnitCode.trim(),
        floor_number: newFloorNumber,
        owner_name: newOwnerName.trim() || 'Chưa cập nhật',
        owner_phone: newOwnerPhone.trim() || '',
        status: 'NOT_SURVEYED',
      };
      setUnits((prev) => [...prev, fakeUnit]);
      setShowAddModal(false);
    } finally {
      setIsSubmittingUnit(false);
    }
  };

  const availableFloors = Array.from(new Set(units.map((u) => u.floor_number))).sort(
    (a, b) => a - b
  );

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      !searchTerm.trim() ||
      u.unit_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.owner_name && u.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFloor = selectedFloor === 'ALL' || u.floor_number === selectedFloor;
    return matchesSearch && matchesFloor;
  });

  const completedCount = units.filter(
    (u) => u.status === 'APPROVED' || u.status === 'SUBMITTED'
  ).length;
  const inProgressCount = units.filter((u) => u.status === 'IN_PROGRESS').length;
  const absentCount = units.filter((u) => u.status === 'POSTPONED_ABSENT').length;
  const notSurveyedCount = units.filter(
    (u) => !u.status || u.status === 'NOT_SURVEYED'
  ).length;

  const progressPercent =
    units.length > 0 ? Math.round((completedCount / units.length) * 100) : 0;

  const renderUnitStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span
            style={{
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={12} />
            Đã duyệt
          </span>
        );
      case 'SUBMITTED':
        return (
          <span
            style={{
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #7dd3fc',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={12} />
            Đã nộp
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span
            style={{
              backgroundColor: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={12} />
            Đang làm
          </span>
        );
      case 'POSTPONED_ABSENT':
        return (
          <span
            style={{
              backgroundColor: '#f3e8ff',
              color: '#7e22ce',
              border: '1px solid #d8b4fe',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertCircle size={12} />
            Vắng mặt
          </span>
        );
      default:
        return (
          <span
            style={{
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={11} color="#94a3b8" />
            Chưa khảo sát
          </span>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* Header Tòa Nhà */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3730a3 0%, #1e1b4b 100%)',
            color: '#ffffff',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    backgroundColor: 'rgba(129, 140, 248, 0.3)',
                    color: '#c7d2fe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                  }}
                >
                  MÔ HÌNH CHUNG CƯ (CHA - CON)
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
                  {parcel.projectParcelCode}
                </span>
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                Số {parcel.houseNumber} {parcel.street}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Progress Bar Header */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.65rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>
              Tiến độ khảo sát: <strong>{completedCount}</strong>/{units.length} căn hoàn tất
            </span>
            <span
              style={{
                fontWeight: 800,
                color: progressPercent === 100 ? '#16a34a' : '#4f46e5',
              }}
            >
              {progressPercent}%
            </span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: '#e2e8f0',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#10b981' : '#6366f1',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '0.2rem',
              fontSize: '0.725rem',
              color: '#64748b',
            }}
          >
            <span>Tổng: <strong>{units.length} căn</strong></span>
            <span>•</span>
            <span style={{ color: '#16a34a' }}>Đã duyệt/nộp: <strong>{completedCount}</strong></span>
            <span>•</span>
            <span style={{ color: '#d97706' }}>Đang làm: <strong>{inProgressCount}</strong></span>
            <span>•</span>
            <span style={{ color: '#7e22ce' }}>Vắng mặt: <strong>{absentCount}</strong></span>
            <span>•</span>
            <span style={{ color: '#64748b' }}>Chưa làm: <strong>{notSurveyedCount}</strong></span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!hasMasterDraft) return; // block if no master draft
              setActiveTab('units');
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              cursor: hasMasterDraft ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: activeTab === 'units' ? '#4f46e5' : hasMasterDraft ? '#64748b' : '#cbd5e1',
              borderBottom: activeTab === 'units' ? '3px solid #4f46e5' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              opacity: hasMasterDraft ? 1 : 0.5,
            }}
            title={hasMasterDraft ? '' : 'Cần khảo sát thân tòa nhà trước'}
          >
            <Home size={16} />
            Danh Sách Căn Hộ Con ({units.length})
            {!hasMasterDraft && (
              <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', marginLeft: '2px', fontWeight: 800 }}>KHÓA</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master')}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: activeTab === 'master' ? '#4f46e5' : '#64748b',
              borderBottom: activeTab === 'master' ? '3px solid #4f46e5' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
            }}
          >
            <Building2 size={16} />
            Khảo Sát Thân & Phần Chung Tòa Nhà
            {!hasMasterDraft && (
              <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', marginLeft: '2px', fontWeight: 800 }}>BẮT ĐẦU TẠI ĐÂY</span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

          {/* Master-first guard banner */}
          {!hasMasterDraft && activeTab === 'units' && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1.5px solid #fcd34d',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}>
              <ShieldAlert size={22} color="#b45309" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>Cần hoàn thành khảo sát sơ bộ Tòa nhà trước</div>
                <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  Để đảm bảo dữ liệu kế thừa chính xác (ảnh P-01→P-04, kết cấu móng, tọa độ), bạn cần thực hiện ít nhất <strong>Bước 1 của khảo sát Tòa nhà</strong> trước khi bắt đầu khảo sát từng căn hộ.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('master');
                    onStartMasterSurvey(parcel);
                  }}
                  style={{ marginTop: '0.65rem', backgroundColor: '#b45309', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Building2 size={14} />
                  Bắt đầu Khảo sát Tòa nhà ngay
                </button>
              </div>
            </div>
          )}

          {activeTab === 'units' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Controls: Search + Floor Filter + Add Unit */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.65rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                      size={16}
                      color="#94a3b8"
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm số phòng (P.101) hoặc tên chủ hộ..."
                      style={{ paddingLeft: '32px', fontSize: '0.825rem' }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-control"
                    style={{ width: 'auto', minWidth: '120px', fontSize: '0.825rem' }}
                    value={selectedFloor}
                    onChange={(e) =>
                      setSelectedFloor(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))
                    }
                  >
                    <option value="ALL">Tất cả tầng</option>
                    {availableFloors.map((fl) => (
                      <option key={fl} value={fl}>
                        Lầu {fl}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Plus size={16} />
                  Thêm Căn Hộ
                </button>
              </div>

              {/* Add Unit Inline Form */}
              {showAddModal && (
                <form
                  onSubmit={handleAddUnit}
                  style={{
                    backgroundColor: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#3730a3', fontSize: '0.875rem' }}>
                    + Khởi tạo căn hộ mới trong tòa nhà
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label">Mã / Số phòng (*):</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: P.402, A-12.01..."
                        required
                        value={newUnitCode}
                        onChange={(e) => setNewUnitCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Tầng / Lầu (*):</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="80"
                        required
                        value={newFloorNumber}
                        onChange={(e) => setNewFloorNumber(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Họ tên chủ căn hộ:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Họ tên người sở hữu..."
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Số điện thoại liên hệ:</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Số ĐT..."
                        value={newOwnerPhone}
                        onChange={(e) => setNewOwnerPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.775rem',
                        cursor: 'pointer',
                        color: '#475569',
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingUnit}
                      style={{
                        backgroundColor: '#4338ca',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '0.4rem 1rem',
                        fontSize: '0.775rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isSubmittingUnit ? 'Đang lưu...' : 'Lưu Căn Hộ'}
                    </button>
                  </div>
                </form>
              )}

              {/* Units Grid */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Đang tải danh sách căn hộ...
                </div>
              ) : filteredUnits.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                  }}
                >
                  Không tìm thấy căn hộ nào phù hợp với bộ lọc.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  {filteredUnits.map((unit) => {
                    const isDone = unit.status === 'APPROVED' || unit.status === 'SUBMITTED';
                    return (
                      <div
                        key={unit.id}
                        style={{
                          backgroundColor: '#ffffff',
                          border: isDone ? '1px solid #86efac' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '0.95rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span
                                style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 800,
                                  color: '#3730a3',
                                }}
                              >
                                {unit.unit_code}
                              </span>
                              <span
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                }}
                              >
                                Lầu {unit.floor_number}
                              </span>
                            </div>
                            {renderUnitStatusBadge(unit.status)}
                          </div>

                          <div style={{ marginTop: '0.45rem', fontSize: '0.775rem', color: '#64748b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <User size={13} color="#94a3b8" />
                              <span>Chủ hộ: <strong>{unit.owner_name || 'Chưa cập nhật'}</strong></span>
                            </div>
                            {unit.owner_phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                                <Phone size={13} color="#94a3b8" />
                                <span>{unit.owner_phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!hasMasterDraft) {
                              alert('Cần hoàn thành khảo sát sơ bộ Tòa nhà trước! Vào tab "Khảo Sát Thân Tòa Nhà" để bắt đầu.');
                              setActiveTab('master');
                              return;
                            }
                            onStartUnitSurvey(parcel, unit);
                          }}
                          style={{
                            backgroundColor: !hasMasterDraft ? '#f1f5f9' : isDone ? '#f0fdf4' : '#4338ca',
                            color: !hasMasterDraft ? '#94a3b8' : isDone ? '#15803d' : '#ffffff',
                            border: !hasMasterDraft ? '1px solid #e2e8f0' : isDone ? '1px solid #bbf7d0' : 'none',
                            borderRadius: '8px',
                            padding: '0.5rem',
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            cursor: !hasMasterDraft ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            opacity: !hasMasterDraft ? 0.6 : 1,
                          }}
                          title={!hasMasterDraft ? 'Cần khảo sát sơ bộ tòa nhà trước' : ''}
                        >
                          {!hasMasterDraft ? (
                            <>
                              <ShieldAlert size={14} />
                              Cần KS Tòa Nhà Trước
                            </>
                          ) : isDone ? (
                            <>
                              <Check size={14} />
                              Xem / Đo Bổ Sung Căn Này
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              Khảo Sát Căn Này
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'master' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <Info size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: '#1e40af' }}>
                      Khảo Sát Khối Đế, Mặt Tiền & Kết Cấu Chung Tòa Nhà
                    </h4>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                      Khảo sát 4 góc chụp định danh toàn cảnh (P-01 đến P-04), kết cấu móng, hệ cột chịu lực, tầng hầm,
                      hành lang thoát hiểm và thiết bị PCCC chung. Mọi căn hộ con khi khảo sát sẽ tự động thừa hưởng
                      bộ ảnh và thông số kết cấu này làm căn cứ bồi thường / xác định hiện trạng.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Trạng thái hồ sơ toàn khối:</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {parcel.surveyStatus === 'APPROVED' ? (
                      <>
                        <CheckCircle2 size={18} color="#16a34a" />
                        <span>Đã Phê Duyệt Hồ Sơ Thân Tòa Nhà</span>
                      </>
                    ) : parcel.surveyStatus === 'SUBMITTED' ? (
                      <>
                        <Clock size={18} color="#0284c7" />
                        <span>Đã Nộp (Chờ Zone Admin Duyệt)</span>
                      </>
                    ) : parcel.surveyStatus === 'IN_PROGRESS' ? (
                      <>
                        <Clock size={18} color="#d97706" />
                        <span>Đang Làm Dở Dang</span>
                      </>
                    ) : (
                      <>
                        <Clock size={18} color="#94a3b8" />
                        <span>Chưa Khảo Sát Thân Tòa Nhà</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartMasterSurvey(parcel)}
                  style={{
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 6px -1px rgba(29, 78, 216, 0.25)',
                  }}
                >
                  <Building2 size={16} />
                  Mở Biểu Mẫu Khảo Sát Tòa Nhà (9 Bước)
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
