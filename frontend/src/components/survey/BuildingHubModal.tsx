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
  X,
  User,
  Phone,
  ArrowRight,
  Info,
  Check,
  AlertCircle,
  Layers,
  Sparkles,
  ShieldCheck,
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
  const masterDraftKey = `metro2_phase1_draft_${parcel.id}`;
  const masterDraft = localStorage.getItem(masterDraftKey);
  const hasMasterSurvey = !!masterDraft || parcel.surveyStatus === 'APPROVED' || parcel.surveyStatus === 'SUBMITTED' || parcel.surveyStatus === 'IN_PROGRESS';

  const [activeTab, setActiveTab] = useState<'all' | 'master' | 'units'>('all');
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
        // Sample default units
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

  const availableFloors = Array.from(new Set(units.map((u) => u.floor_number))).sort((a, b) => a - b);

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      !searchTerm.trim() ||
      u.unit_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.owner_name && u.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFloor = selectedFloor === 'ALL' || u.floor_number === selectedFloor;
    return matchesSearch && matchesFloor;
  });

  const completedCount = units.filter((u) => u.status === 'APPROVED' || u.status === 'SUBMITTED').length;
  const inProgressCount = units.filter((u) => u.status === 'IN_PROGRESS').length;
  const absentCount = units.filter((u) => u.status === 'POSTPONED_ABSENT').length;
  const notSurveyedCount = units.filter((u) => !u.status || u.status === 'NOT_SURVEYED').length;
  const progressPercent = units.length > 0 ? Math.round((completedCount / units.length) * 100) : 0;

  const renderUnitStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            Đã duyệt
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            <Clock size={12} />
            Đã nộp
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            Đang làm
          </span>
        );
      case 'POSTPONED_ABSENT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle size={12} />
            Vắng mặt
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            <Clock size={11} className="text-slate-400" />
            Chưa khảo sát
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modern Clean Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Building2 className="w-6 h-6 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300/30">
                  Hub Chung Cư & Căn Hộ Con
                </span>
                <span className="text-xs font-bold text-sky-300">
                  {parcel.projectParcelCode}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                Số {parcel.houseNumber} {parcel.street}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Overview Stats Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Tổng căn:</span>
              <span className="font-bold text-slate-800 text-sm">{units.length}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-600 font-medium">Đã xong:</span>
              <span className="font-bold text-emerald-700">{completedCount}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-amber-600 font-medium">Đang làm:</span>
              <span className="font-bold text-amber-700">{inProgressCount}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-purple-600 font-medium">Vắng:</span>
              <span className="font-bold text-purple-700">{absentCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-[160px] flex-1 sm:flex-initial justify-end">
            <span className="text-xs font-bold text-indigo-700">{progressPercent}%</span>
            <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-5">
          {/* Card 1: Khảo Sát Hạng Mục Chung Của Tòa Nhà */}
          <div className="bg-white rounded-xl border-2 border-indigo-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600" />
            <div className="flex items-start gap-3.5 pl-1.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Building2 className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Khảo Sát Hạng Mục Dùng Chung Tòa Nhà
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    Bắt buộc
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                  Khảo sát mặt đứng (P-01 đến P-04), kết cấu móng, tầng hầm, sân thượng, hành lang, thang bộ và các khu vực dùng chung. Dữ liệu này làm nền tảng pháp lý và tự động kế thừa cho tất cả căn hộ con.
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Trạng thái:</span>
                  {hasMasterSurvey ? (
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      Đã có hồ sơ sơ bộ / đang khảo sát
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 flex items-center gap-1">
                      <AlertCircle size={13} />
                      Chưa khảo sát phần chung
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartMasterSurvey(parcel);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex-shrink-0"
            >
              <Sparkles size={16} />
              <span>Khảo Sát Phần Chung Tòa Nhà</span>
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Section 2: Quản Lý & Danh Sách Căn Hộ Con */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <Home className="w-4 h-4 text-indigo-600" />
                  Danh Sách Căn Hộ Con ({units.length} căn)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mỗi căn hộ con được khảo sát riêng biệt theo từng chủ hộ, kế thừa thông số từ tòa nhà.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm self-start sm:self-auto"
              >
                <Plus size={15} />
                <span>Thêm Căn Hộ Mới</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo số phòng (P.101) hoặc tên chủ căn hộ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">Tất cả tầng ({units.length})</option>
                {availableFloors.map((fl) => (
                  <option key={fl} value={fl}>
                    Lầu {fl}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Unit Modal Inline */}
            {showAddModal && (
              <form
                onSubmit={handleAddUnit}
                className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">
                    + Thêm căn hộ mới vào tòa nhà
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Mã / Số phòng (*):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: P.402, A-12..."
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tầng / Lầu (*):
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="80"
                      value={newFloorNumber}
                      onChange={(e) => setNewFloorNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Họ tên chủ căn hộ:
                    </label>
                    <input
                      type="text"
                      placeholder="Họ tên người ở..."
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Số điện thoại:
                    </label>
                    <input
                      type="text"
                      placeholder="Số ĐT liên hệ..."
                      value={newOwnerPhone}
                      onChange={(e) => setNewOwnerPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 font-medium hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUnit}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmittingUnit ? 'Đang lưu...' : 'Lưu Căn Hộ'}
                  </button>
                </div>
              </form>
            )}

            {/* Units Grid */}
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Đang tải danh sách căn hộ...
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                Không tìm thấy căn hộ nào phù hợp với bộ lọc tìm kiếm.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredUnits.map((unit) => {
                  const isDone = unit.status === 'APPROVED' || unit.status === 'SUBMITTED';
                  return (
                    <div
                      key={unit.id}
                      className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all ${
                        isDone ? 'border-emerald-200' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-indigo-950">
                              {unit.unit_code}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Lầu {unit.floor_number}
                            </span>
                          </div>
                          {renderUnitStatusBadge(unit.status)}
                        </div>

                        <div className="mt-2.5 flex flex-col gap-1 text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5 truncate">
                            <User size={13} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              Chủ hộ: <strong>{unit.owner_name || 'Chưa cập nhật'}</strong>
                            </span>
                          </div>
                          {unit.owner_phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={13} className="text-slate-400 flex-shrink-0" />
                              <span>{unit.owner_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onStartUnitSurvey(parcel, unit);
                        }}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <Check size={14} />
                            <span>Xem / Đo Bổ Sung Căn Này</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Khảo Sát Căn Này</span>
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
        </div>
      </div>
    </div>
  );
};
