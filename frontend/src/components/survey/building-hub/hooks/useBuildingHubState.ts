import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../../../services/api';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit, MasterReportData } from '../types';

interface UseBuildingHubStateProps {
  parcel: GisParcel;
  onUnitsUpdated?: () => void;
}

export const useBuildingHubState = ({ parcel, onUnitsUpdated }: UseBuildingHubStateProps) => {
  const masterUpdateKey = `metro2_master_update_pending_${parcel.id}`;

  // Kiểm tra xem đã hoàn thành khảo sát toà mẹ chưa
  const [isMasterSurveyDone, setIsMasterSurveyDone] = useState<boolean>(() => {
    try {
      const savedSubmitted = localStorage.getItem(`metro2_condo_master_submitted_${parcel.id}`);
      if (savedSubmitted === 'true') return true;
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        if (
          overrides[parcel.id]?.isMasterSurveyDone ||
          overrides[parcel.id]?.status === 'APPROVED' ||
          overrides[parcel.id]?.status === 'SUBMITTED'
        ) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  });

  const [masterReportData, setMasterReportData] = useState<MasterReportData | null>(null);

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

  // Load units from API
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parcels/${parcel.id}/units`);
      if (res.data?.data?.units && Array.isArray(res.data.data.units)) {
        setUnits(res.data.data.units);
      } else {
        setUnits([]);
      }
    } catch (err) {
      console.warn('[BuildingHub] Không thể nạp danh sách căn hộ hoặc chưa có dữ liệu:', err);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();

    // Kiểm tra hồ sơ khảo sát toà mẹ thực tế từ backend
    api.get<{ data?: { report?: MasterReportData }; report?: MasterReportData }>(`/parcels/${parcel.id}/phase1-report`)
      .then((res) => {
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
        // Fallback nạp lại danh sách từ server
        await fetchUnits();
      }
      setShowAddModal(false);
      setNewUnitCode('');
      setNewFloorNumber(1);
      if (onUnitsUpdated) onUnitsUpdated();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Có lỗi xảy ra khi tạo căn hộ');
      alert(`Không thể thêm căn hộ: ${msg}`);
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

  const availableFloors = Array.from(new Set(units.map((u) => u.floor_number ?? u.floorNumber ?? 1))).sort((a, b) => a - b);

  const filteredUnits = units.filter((u) => {
    const code = u.unit_code || u.unitCode || '';
    const owner = u.owner_name || u.ownerName || '';
    const matchesSearch =
      !searchTerm.trim() ||
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      owner.toLowerCase().includes(searchTerm.toLowerCase());

    const floor = u.floor_number ?? u.floorNumber ?? 1;
    const matchesFloor = selectedFloor === 'ALL' || floor === selectedFloor;
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

  return {
    isMasterSurveyDone,
    setIsMasterSurveyDone,
    masterReportData,
    isUpdatePending,
    units,
    loading,
    searchTerm,
    setSearchTerm,
    isSearchFocused,
    setIsSearchFocused,
    selectedFloor,
    setSelectedFloor,
    selectedStatus,
    setSelectedStatus,
    visibleCount,
    setVisibleCount,
    isHeaderVisible,
    handleScroll,
    showAddModal,
    setShowAddModal,
    showFloorProgressPopover,
    setShowFloorProgressPopover,
    showMasterViewModal,
    setShowMasterViewModal,
    updateNotes,
    setUpdateNotes,
    newUnitCode,
    setNewUnitCode,
    newFloorNumber,
    setNewFloorNumber,
    isSubmittingUnit,
    handleAddUnit,
    handleSendMasterUpdate,
    availableFloors,
    filteredUnits,
    displayedUnits,
    kpi: {
      completedCount,
      pendingApprovalCount,
      inProgressCount,
      absentCount,
      totalUnits: units.length,
    },
  };
};
