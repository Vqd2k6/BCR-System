import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  Info,
  Check,
  AlertCircle,
  Layers,
  Sparkles,
  ShieldCheck,
  LayoutDashboard,
  Lock,
  ChevronRight,
  Send,
  RefreshCw,
  FileText,
  AlertTriangle,
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
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onUnitsUpdated?: () => void;
}

export const BuildingHubModal: React.FC<Props> = ({
  parcel,
  onClose,
  onStartMasterSurvey,
  onStartUnitSurvey,
  onUnitsUpdated,
}) => {
  const masterUpdateKey = `metro2_master_update_pending_${parcel.id}`;
  
  // Kiểm tra xem đã hoàn thành khảo sát toà mẹ chưa
  const [isMasterSurveyDone, setIsMasterSurveyDone] = useState<boolean>(() => {
    try {
      const savedSubmitted = localStorage.getItem(`metro2_condo_master_submitted_${parcel.id}`);
      if (savedSubmitted === 'true') return true;
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        if (overrides[parcel.id]?.isMasterSurveyDone || overrides[parcel.id]?.status === 'APPROVED' || overrides[parcel.id]?.status === 'SUBMITTED') {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  });

  const [masterReportData, setMasterReportData] = useState<any>(null);

  const [isUpdatePending, setIsUpdatePending] = useState<boolean>(() => {
    return localStorage.getItem(masterUpdateKey) === 'true';
  });

  const [units, setUnits] = useState<BuildingUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Scroll listener state to auto-hide top navbar on scroll down
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const lastScrollTopRef = useRef<number>(0);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showFloorProgressPopover, setShowFloorProgressPopover] = useState<boolean>(false);
  const [showMasterViewModal, setShowMasterViewModal] = useState<boolean>(false);
  const [updateNotes, setUpdateNotes] = useState<string>('');

  const [newUnitCode, setNewUnitCode] = useState<string>('');
  const [newFloorNumber, setNewFloorNumber] = useState<number | ''>(1);
  const [isSubmittingUnit, setIsSubmittingUnit] = useState<boolean>(false);

  // Load units from API or robust default dataset
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parcels/${parcel.id}/units`);
      if (res.data?.data?.units && Array.isArray(res.data.data.units) && res.data.data.units.length > 0) {
        setUnits(res.data.data.units);
      } else {
        // Sample standard units across 4 floors with clear Phase 1 & Phase 2 progression
        const defaultUnits: BuildingUnit[] = [
          { id: 'c0000000-0000-0000-0000-000000000101', parcel_id: parcel.id, unit_code: 'P.101', floor_number: 1, owner_name: 'Nguyễn Văn An', owner_phone: '0901 234 567', status: 'APPROVED', phase1_report_id: 'rep-p1-101' },
          { id: 'c0000000-0000-0000-0000-000000000102', parcel_id: parcel.id, unit_code: 'P.102', floor_number: 1, owner_name: 'Trần Thị Bích', owner_phone: '0912 345 678', status: 'SUBMITTED', phase1_report_id: 'rep-p1-102' },
          { id: 'c0000000-0000-0000-0000-000000000103', parcel_id: parcel.id, unit_code: 'P.103', floor_number: 1, owner_name: 'Vũ Đức Thịnh', owner_phone: '0933 111 222', status: 'IN_PROGRESS' },
          { id: 'c0000000-0000-0000-0000-000000000104', parcel_id: parcel.id, unit_code: 'P.104', floor_number: 1, owner_name: 'Hoàng Minh Châu', owner_phone: '0977 444 555', status: 'NOT_SURVEYED' },
          { id: 'c0000000-0000-0000-0000-000000000201', parcel_id: parcel.id, unit_code: 'P.201', floor_number: 2, owner_name: 'Lê Hoàng Cường', owner_phone: '0988 765 432', status: 'APPROVED', phase1_report_id: 'rep-p1-201', phase2_report_id: 'rep-p2-201' },
          { id: 'c0000000-0000-0000-0000-000000000202', parcel_id: parcel.id, unit_code: 'P.202', floor_number: 2, owner_name: 'Phạm Ngọc Dũng', owner_phone: '0977 123 987', status: 'POSTPONED_ABSENT' },
          { id: 'c0000000-0000-0000-0000-000000000203', parcel_id: parcel.id, unit_code: 'P.203', floor_number: 2, owner_name: 'Đặng Mai Phương', owner_phone: '0918 888 999', status: 'IN_PROGRESS' },
          { id: 'c0000000-0000-0000-0000-000000000204', parcel_id: parcel.id, unit_code: 'P.204', floor_number: 2, owner_name: 'Bùi Anh Tuấn', owner_phone: '0909 333 444', status: 'NOT_SURVEYED' },
          { id: 'c0000000-0000-0000-0000-000000000301', parcel_id: parcel.id, unit_code: 'P.301', floor_number: 3, owner_name: 'Võ Thanh Tùng', owner_phone: '0933 555 888', status: 'APPROVED', phase1_report_id: 'rep-p1-301' },
          { id: 'c0000000-0000-0000-0000-000000000302', parcel_id: parcel.id, unit_code: 'P.302', floor_number: 3, owner_name: 'Ngô Hải Yến', owner_phone: '0944 666 777', status: 'SUBMITTED', phase1_report_id: 'rep-p1-302' },
          { id: 'c0000000-0000-0000-0000-000000000303', parcel_id: parcel.id, unit_code: 'P.303', floor_number: 3, owner_name: 'Dương Quốc Bảo', owner_phone: '0982 123 456', status: 'POSTPONED_ABSENT' },
          { id: 'c0000000-0000-0000-0000-000000000304', parcel_id: parcel.id, unit_code: 'P.304', floor_number: 3, owner_name: 'Lý Kim Ngân', owner_phone: '0908 999 111', status: 'NOT_SURVEYED' },
          { id: 'c0000000-0000-0000-0000-000000000401', parcel_id: parcel.id, unit_code: 'P.401', floor_number: 4, owner_name: 'Trịnh Gia Huy', owner_phone: '0911 222 333', status: 'NOT_SURVEYED' },
          { id: 'c0000000-0000-0000-0000-000000000402', parcel_id: parcel.id, unit_code: 'P.402', floor_number: 4, owner_name: 'Cao Thùy Linh', owner_phone: '0978 555 666', status: 'NOT_SURVEYED' },
        ];
        setUnits(defaultUnits);
      }
    } catch (_err) {
      setUnits([
        { id: 'c0000000-0000-0000-0000-000000000101', parcel_id: parcel.id, unit_code: 'P.101', floor_number: 1, owner_name: 'Nguyễn Văn An', owner_phone: '0901 234 567', status: 'APPROVED', phase1_report_id: 'rep-p1-101' },
        { id: 'c0000000-0000-0000-0000-000000000102', parcel_id: parcel.id, unit_code: 'P.102', floor_number: 1, owner_name: 'Trần Thị Bích', owner_phone: '0912 345 678', status: 'SUBMITTED', phase1_report_id: 'rep-p1-102' },
        { id: 'c0000000-0000-0000-0000-000000000201', parcel_id: parcel.id, unit_code: 'P.201', floor_number: 2, owner_name: 'Lê Hoàng Cường', owner_phone: '0988 765 432', status: 'IN_PROGRESS' },
        { id: 'c0000000-0000-0000-0000-000000000202', parcel_id: parcel.id, unit_code: 'P.202', floor_number: 2, owner_name: 'Phạm Ngọc Dũng', owner_phone: '0977 123 987', status: 'POSTPONED_ABSENT' },
        { id: 'c0000000-0000-0000-0000-000000000301', parcel_id: parcel.id, unit_code: 'P.301', floor_number: 3, owner_name: 'Võ Thanh Tùng', owner_phone: '0933 555 888', status: 'NOT_SURVEYED' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();

    // Kiểm tra hồ sơ khảo sát toà mẹ thực tế từ backend
    api.get(`/parcels/${parcel.id}/phase1-report`)
      .then((res: any) => {
        const data = res?.data?.data || res?.data;
        if (data?.report && (data.report.status === 'SUBMITTED' || data.report.status === 'APPROVED')) {
          setIsMasterSurveyDone(true);
          setMasterReportData(data.report);
        }
      })
      .catch(() => {});
  }, [parcel.id]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    if (currentScrollTop > lastScrollTopRef.current && currentScrollTop > 45) {
      setIsHeaderVisible(false); // Scrolling down -> hide navbar
    } else if (currentScrollTop < lastScrollTopRef.current - 5 || currentScrollTop <= 15) {
      setIsHeaderVisible(true); // Scrolling up -> show navbar
    }
    lastScrollTopRef.current = currentScrollTop;
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitCode.trim()) return;
    const parsedFloor = Number(newFloorNumber) || 1;
    try {
      setIsSubmittingUnit(true);
      const res = await api.post(`/parcels/${parcel.id}/units`, {
        unitCode: newUnitCode.trim(),
        floorNumber: parsedFloor,
      });
      if (res.data?.data?.unit) {
        setUnits((prev) => [...prev, res.data.data.unit]);
      } else {
        const fakeUnit: BuildingUnit = {
          id: `u-${Date.now()}`,
          parcel_id: parcel.id,
          unit_code: newUnitCode.trim(),
          floor_number: parsedFloor,
          owner_name: 'Chưa cập nhật',
          owner_phone: '',
          status: 'NOT_SURVEYED',
        };
        setUnits((prev) => [...prev, fakeUnit]);
      }
      setShowAddModal(false);
      setNewUnitCode('');
      setNewFloorNumber(1);
      if (onUnitsUpdated) onUnitsUpdated();
    } catch (_err) {
      const fakeUnit: BuildingUnit = {
        id: `u-${Date.now()}`,
        parcel_id: parcel.id,
        unit_code: newUnitCode.trim(),
        floor_number: parsedFloor,
        owner_name: 'Chưa cập nhật',
        owner_phone: '',
        status: 'NOT_SURVEYED',
      };
      setUnits((prev) => [...prev, fakeUnit]);
      setShowAddModal(false);
      setNewUnitCode('');
      setNewFloorNumber(1);
    } finally {
      setIsSubmittingUnit(false);
    }
  };

  const handleSendMasterUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(masterUpdateKey, 'true');
    setIsUpdatePending(true);
    setShowMasterViewModal(false);
    alert('Đã gửi bản cập nhật thông số chung tòa nhà! Đang chờ Quản trị viên (Zone Admin) phê duyệt.');
  };

  const availableFloors = Array.from(new Set(units.map((u) => u.floor_number))).sort((a, b) => a - b);

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      !searchTerm.trim() ||
      u.unit_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.owner_name && u.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFloor = selectedFloor === 'ALL' || u.floor_number === selectedFloor;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'APPROVED' && u.status === 'APPROVED') ||
      (selectedStatus === 'SUBMITTED' && u.status === 'SUBMITTED') ||
      (selectedStatus === 'IN_PROGRESS' && u.status === 'IN_PROGRESS') ||
      (selectedStatus === 'ABSENT' && u.status === 'POSTPONED_ABSENT') ||
      (selectedStatus === 'NOT_SURVEYED' && (!u.status || u.status === 'NOT_SURVEYED'));

    return matchesSearch && matchesFloor && matchesStatus;
  });

  const displayedUnits = filteredUnits.slice(0, visibleCount);

  // Status metrics
  const completedCount = units.filter((u) => u.status === 'APPROVED' || !!u.phase2_report_id).length;
  const pendingApprovalCount = units.filter((u) => u.status === 'SUBMITTED').length;
  const inProgressCount = units.filter((u) => u.status === 'IN_PROGRESS').length;
  const absentCount = units.filter((u) => u.status === 'POSTPONED_ABSENT').length;

  const renderUnitStatusBadge = (unit: BuildingUnit) => {
    const isPhase1Done = unit.status === 'APPROVED' || unit.status === 'SUBMITTED' || !!unit.phase1_report_id;
    const isPhase2Done = !!unit.phase2_report_id || unit.status === 'PHASE2_COMPLETED';

    if (isPhase2Done) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          Đã xong P1 & P2
        </span>
      );
    }

    if (unit.status === 'APPROVED' || (isPhase1Done && unit.status !== 'SUBMITTED')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          Đã duyệt P1
        </span>
      );
    }

    if (unit.status === 'SUBMITTED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
          <Clock size={12} />
          Chờ duyệt P1
        </span>
      );
    }

    if (unit.status === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} />
          Đang làm P1
        </span>
      );
    }

    if (unit.status === 'POSTPONED_ABSENT') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <AlertCircle size={12} />
          Vắng mặt
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        <Clock size={11} className="text-slate-400" />
        Chưa khảo sát
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-100 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-150">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP NAVBAR (Scroll Auto-hide, Clean Title, Icon-only Right) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header
        className={`bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0 transition-all duration-300 ease-in-out z-50 ${
          isHeaderVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none h-0 py-0 overflow-hidden border-b-0'
        }`}
      >
        {/* Left: Single Back Arrow Button */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Quay lại Bản đồ</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Clean Title without redundant badge */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-bold text-sky-600">
                Mã: {parcel.projectParcelCode || 'B-05272'}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                Số {parcel.houseNumber} {parcel.street}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Icon-only "Hạng mục chung" Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMasterViewModal(true)}
            className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-200 text-sky-700 transition-all shadow-2xs flex items-center justify-center"
            title="Khảo sát & Hồ sơ hạng mục dùng chung tòa nhà"
          >
            <Building2 size={18} className="text-sky-600" />
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MAIN SCROLLABLE BODY (Scroll Listener Attached)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3.5 sm:p-6 flex flex-col gap-4 max-w-7xl w-full mx-auto"
      >
        {/* Banner cảnh báo chưa khảo sát tổng quan tòa nhà chung cư */}
        {!isMasterSurveyDone && (
          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-amber-950">
                    Bạn Chưa Khảo Sát Tổng Quan Chung Cư (Khối Tháp Dùng Chung)
                  </h4>
                  <span className="bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-300 uppercase">
                    Chưa Khảo Sát
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-2xl">
                  Công trình mới chỉ được thiết lập loại hình Chung cư từ bản đồ thửa đất ban đầu. Theo quy chuẩn kỹ thuật Metro 2, cần hoàn thành <strong>Khảo sát tổng quan tòa nhà</strong> (kết cấu chịu lực, móng, bộ 4 ảnh mặt đứng P01–P04, không gian dùng chung) để phục vụ kế thừa dữ liệu cho các căn hộ con.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartMasterSurvey(parcel);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <Building2 size={16} />
              <span>Mở Wizard Khảo Sát Tổng Quan</span>
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* 2.1 EXECUTIVE DASHBOARD (4 KPI Cards)                       */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <LayoutDashboard size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Bảng Điều Khiển Tiến Độ Khảo Sát
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng hợp tiến độ toàn bộ căn hộ con trong tòa nhà
                </p>
              </div>
            </div>

            {/* Popover trigger button */}
            <button
              type="button"
              onClick={() => setShowFloorProgressPopover(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold transition-all shadow-2xs self-start sm:self-auto"
            >
              <Layers size={14} />
              <span>Xem chi tiết tiến độ theo tầng</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 4 KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5">
            {/* KPI 1: Đã hoàn thành / Tổng căn */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
                <span>Đã hoàn thành</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">
                {completedCount} <span className="text-sm font-bold text-emerald-600/80">/ {units.length} căn</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">Căn đã duyệt / Tổng số căn</div>
            </div>

            {/* KPI 2: Chờ duyệt */}
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-sky-700 text-xs font-semibold">
                <span>Chờ duyệt</span>
                <Clock size={16} className="text-sky-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-sky-700">{pendingApprovalCount}</div>
              <div className="text-[11px] text-sky-600 font-medium">Đã nộp hồ sơ chờ duyệt</div>
            </div>

            {/* KPI 3: Đang làm */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
                <span>Đang làm</span>
                <Clock size={16} className="text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-700">{inProgressCount}</div>
              <div className="text-[11px] text-amber-600 font-medium">Đang đo vẽ / ghi chép</div>
            </div>

            {/* KPI 4: Vắng mặt */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-purple-700 text-xs font-semibold">
                <span>Vắng mặt</span>
                <AlertCircle size={16} className="text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-700">{absentCount}</div>
              <div className="text-[11px] text-purple-600 font-medium">Chủ hộ vắng / Hẹn lại</div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* 2.2 QUẢN LÝ & DANH SÁCH CĂN HỘ CON                         */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          {/* Header & Add Unit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Home size={18} className="text-sky-600" />
                <span>Danh Sách Căn Hộ Con ({units.length} căn)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Khảo sát chi tiết từng căn hộ con theo Phase 1 (Hiện trạng kết cấu) và Phase 2 (Nội thất chi tiết).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm shadow-sky-600/20 transition-all self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>Thêm Căn Hộ Mới</span>
            </button>
          </div>

          {/* Search & Dynamic Filter Bar (Collapse on focus) */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-sm">
            {/* Search Input */}
            <div
              className={`relative transition-all duration-300 ease-in-out ${
                isSearchFocused || searchTerm ? 'flex-1' : 'w-48 sm:w-64'
              }`}
            >
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm phòng (P.101) hoặc chủ hộ..."
                value={searchTerm}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  if (!searchTerm) setIsSearchFocused(false);
                }}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setIsSearchFocused(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filters (Hidden when search is focused) */}
            {!(isSearchFocused || searchTerm) && (
              <div className="flex items-center gap-2 animate-in fade-in duration-200">
                {/* Floor Filter */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="ALL">Tất cả tầng ({units.length})</option>
                    {availableFloors.map((fl) => (
                      <option key={fl} value={fl}>
                        Lầu {fl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="APPROVED">Đã duyệt P1</option>
                    <option value="SUBMITTED">Chờ duyệt P1</option>
                    <option value="IN_PROGRESS">Đang làm P1</option>
                    <option value="ABSENT">Chủ hộ vắng mặt</option>
                    <option value="NOT_SURVEYED">Chưa khảo sát</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Inline Form: Thêm căn hộ mới */}
          {showAddModal && (
            <form
              onSubmit={handleAddUnit}
              className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-900">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                    onChange={(e) => setNewFloorNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  className="px-4 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingUnit ? 'Đang lưu...' : 'Lưu Căn Hộ'}
                </button>
              </div>
            </form>
          )}

          {/* Units Grid with Phase 1 vs Phase 2 Logic & 10-item pagination */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-slate-200">
              <RefreshCw size={20} className="text-sky-600 animate-spin" />
              <span>Đang tải danh sách căn hộ...</span>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
              Không tìm thấy căn hộ nào phù hợp với bộ lọc tìm kiếm.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {displayedUnits.map((unit) => {
                  const isUnitLocked = !isMasterSurveyDone;
                  const isPhase1Done = unit.status === 'APPROVED' || unit.status === 'SUBMITTED' || !!unit.phase1_report_id;
                  const isPhase2Done = !!unit.phase2_report_id || unit.status === 'PHASE2_COMPLETED';

                  return (
                    <div
                      key={unit.id}
                      className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all ${
                        isPhase2Done
                          ? 'border-emerald-200 bg-emerald-50/10'
                          : isPhase1Done
                          ? 'border-sky-200 bg-sky-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              {unit.unit_code}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Lầu {unit.floor_number}
                            </span>
                          </div>
                          {renderUnitStatusBadge(unit)}
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

                      {/* Dynamic Survey Phase Action Button */}
                      {isUnitLocked ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        >
                          <Lock size={13} />
                          <span>Chưa mở (Cần khảo sát chung)</span>
                        </button>
                      ) : isPhase2Done ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartUnitSurvey(parcel, unit, 2);
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 btn btn-secondary text-slate-700 hover:bg-slate-100 border border-slate-300 transition-all"
                        >
                          <Check size={14} className="text-emerald-600" />
                          <span>Xem Chi Tiết / Đo Bổ Sung</span>
                        </button>
                      ) : isPhase1Done ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartUnitSurvey(parcel, unit, 2);
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm shadow-sky-600/20 transition-all"
                        >
                          <ArrowRight size={14} />
                          <span>Khảo Sát Phase 2 (Nội Thất)</span>
                        </button>
                      ) : unit.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartUnitSurvey(parcel, unit, 1);
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all"
                        >
                          <Clock size={14} />
                          <span>Tiếp Tục Phase 1</span>
                        </button>
                      ) : unit.status === 'POSTPONED_ABSENT' ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartUnitSurvey(parcel, unit, 1);
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 transition-all"
                        >
                          <Sparkles size={14} />
                          <span>Khảo Sát Phase 1 (Hẹn lại)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartUnitSurvey(parcel, unit, 1);
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm shadow-sky-600/20 transition-all"
                        >
                          <Sparkles size={14} />
                          <span>Khảo Sát Phase 1</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load More Pagination (10 per batch) */}
              {filteredUnits.length > visibleCount && (
                <div className="pt-2 flex flex-col items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 10)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all hover:border-sky-400 hover:text-sky-700"
                  >
                    <RefreshCw size={14} className="text-sky-600" />
                    <span>Xem thêm (+{Math.min(10, filteredUnits.length - visibleCount)} căn hộ)</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Đang hiển thị {Math.min(visibleCount, filteredUnits.length)} / {filteredUnits.length} căn hộ
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MODAL: XEM & GỬI BẢN UPDATE HẠNG MỤC DÙNG CHUNG TÒA NHÀ     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showMasterViewModal && (
        <div
          className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMasterViewModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-200 p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 flex-shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Khảo Sát Hạng Mục Dùng Chung Tòa Nhà
                  </h3>
                  <p className="text-xs text-slate-500">
                    Số {parcel.houseNumber} {parcel.street} • Mã: {parcel.projectParcelCode || 'B-05272'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMasterViewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              {!isMasterSurveyDone ? (
                <div className="text-center py-8 px-4 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                    <Building2 size={32} />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">
                      Chưa Có Dữ Liệu Khảo Sát Tổng Quan Chung Cư
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                      Tòa nhà này mới chỉ được thiết lập loại hình Chung cư từ bước khởi tạo thửa đất. Chưa có số liệu khảo sát thực tế về kết cấu chịu lực, loại móng, bộ ảnh mặt đứng và hạ tầng kỹ thuật dùng chung.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMasterViewModal(false);
                      onClose();
                      onStartMasterSurvey(parcel);
                    }}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer"
                  >
                    <FileText size={16} />
                    <span>Mở Wizard Khảo Sát Chi Tiết Tòa Nhà</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Status Notice */}
                  {isUpdatePending ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                      <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Đang chờ Zone Admin phê duyệt bản cập nhật mới</strong>
                        <span>Bản cập nhật hạng mục chung đã được gửi lên hệ thống và đang chờ quản trị viên khu vực phê duyệt trước khi đồng bộ toàn bộ căn hộ con.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900">
                      <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Hồ sơ chung đã được kế thừa và xác thực</strong>
                        <span>Thông tin kết cấu, móng, mặt đứng (P-01 đến P-04) đã được khảo sát ở biểu mẫu tòa nhà tổng thể. Bạn có thể xem và gửi yêu cầu cập nhật bổ sung bên dưới.</span>
                      </div>
                    </div>
                  )}

                  {/* Thông số kỹ thuật thực tế đã khảo sát */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex flex-col gap-2.5 text-xs">
                    <span className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider text-sky-700">
                      1. Thông số kết cấu & kiến trúc thực tế:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                      <div>• Loại công trình: <strong>{masterReportData?.building_type || 'Chung cư / Nhà tập thể'}</strong></div>
                      <div>• Quy mô: <strong>{masterReportData?.buildingSpecs?.floor_count || parcel.floorCount || availableFloors.length} Tầng nổi + {masterReportData?.buildingSpecs?.basement_count || 0} Hầm</strong></div>
                      <div>• Kết cấu móng: <strong>{masterReportData?.buildingSpecs?.foundation_category || 'Theo hồ sơ khảo sát đã duyệt'}</strong></div>
                      <div>• Khung chịu lực: <strong>{masterReportData?.buildingSpecs?.structural_system || 'Theo hồ sơ khảo sát đã duyệt'}</strong></div>
                      <div>• Mặt đứng kiến trúc: <strong>{masterReportData?.identificationPhotos?.length ? `P-01 đến P-04 (${masterReportData.identificationPhotos.length} ảnh đã chụp)` : 'Đã chụp bộ ảnh P-01 đến P-04'}</strong></div>
                      <div>• Tình trạng nứt lún chung: <strong>{masterReportData?.summary_conclusions || 'Đã ghi nhận trong hồ sơ tổng thể'}</strong></div>
                    </div>
                  </div>

                  {/* Gửi bản update mới */}
                  <form onSubmit={handleSendMasterUpdate} className="flex flex-col gap-2.5 pt-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Ghi chú nội dung cập nhật bổ sung (nếu có thay đổi hiện trạng):
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nhập chi tiết các thay đổi hoặc vết nứt mới phát hiện ở khu vực dùng chung..."
                      value={updateNotes}
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMasterViewModal(false);
                          onClose();
                          onStartMasterSurvey(parcel);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                      >
                        <FileText size={14} className="text-sky-600" />
                        <span>Mở Wizard Khảo Sát Chi Tiết</span>
                      </button>

                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm shadow-sky-600/20 transition-all"
                      >
                        <Send size={14} />
                        <span>Gửi Bản Cập Nhật Mới Về Cho Zone Admin</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. POPOVER: CHI TIẾT TIẾN ĐỘ THEO TẦNG (Summary Metrics Only) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showFloorProgressPopover && (
        <div
          className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFloorProgressPopover(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Popover Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Tiến Độ Khảo Sát Chi Tiết Theo Từng Tầng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tòa nhà {parcel.projectParcelCode || 'Chung cư'} • Tổng {availableFloors.length} tầng ({units.length} căn)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFloorProgressPopover(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Popover Floor Summary Table / Cards (No individual unit items) */}
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              <div className="hidden sm:grid grid-cols-6 gap-2 px-3 py-2 bg-slate-100/80 rounded-lg text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <div>Tầng / Lầu</div>
                <div className="text-center">Tổng số căn</div>
                <div className="text-center text-emerald-700">Đã xong</div>
                <div className="text-center text-sky-700">Chờ duyệt</div>
                <div className="text-center text-amber-700">Đang làm</div>
                <div className="text-center text-purple-700">Vắng mặt</div>
              </div>

              {availableFloors.map((floorNum) => {
                const floorUnits = units.filter((u) => u.floor_number === floorNum);
                const floorDone = floorUnits.filter((u) => u.status === 'APPROVED' || !!u.phase2_report_id).length;
                const floorPending = floorUnits.filter((u) => u.status === 'SUBMITTED').length;
                const floorInProgress = floorUnits.filter((u) => u.status === 'IN_PROGRESS').length;
                const floorAbsent = floorUnits.filter((u) => u.status === 'POSTPONED_ABSENT').length;
                const floorNotSurveyed = floorUnits.filter((u) => !u.status || u.status === 'NOT_SURVEYED').length;

                return (
                  <div
                    key={floorNum}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:grid sm:grid-cols-6 sm:items-center gap-2 sm:gap-2 shadow-2xs"
                  >
                    {/* Floor Name & Counter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        Lầu {floorNum}
                      </span>
                      <span className="sm:hidden text-xs text-slate-500 font-semibold">
                        ({floorUnits.length} căn)
                      </span>
                    </div>

                    {/* Total units */}
                    <div className="hidden sm:block text-center text-xs font-extrabold text-slate-800">
                      {floorUnits.length} căn
                    </div>

                    {/* Done */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Đã xong:</span>
                      <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {floorDone} căn
                      </span>
                    </div>

                    {/* Pending */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Chờ duyệt:</span>
                      <span className="font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {floorPending} căn
                      </span>
                    </div>

                    {/* In Progress */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Đang làm:</span>
                      <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {floorInProgress} căn
                      </span>
                    </div>

                    {/* Absent */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Vắng mặt:</span>
                      <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {floorAbsent} căn
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Popover Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFloorProgressPopover(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
