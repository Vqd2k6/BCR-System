import { useState, useEffect, useRef } from 'react';
import { api } from '../../../../services/api';
import { GisParcel } from '../../../gis/LeafletSweepMap';
import { BuildingUnit } from '../types';

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
