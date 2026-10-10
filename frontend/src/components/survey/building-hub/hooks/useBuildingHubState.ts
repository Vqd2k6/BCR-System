import { getErrorMessage } from '@/utils/errorUtils';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../../../services/api';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit, MasterReportData } from '../types';
import { deriveBuildingFloorNumbers, getDefaultFloorCode } from '../../../../core/utils/floorUtils';

export interface FloorPlanData {
  id: string;
  floor_number: number;
  floor_name: string;
  floor_code?: string;
  cad_photo_url: string;
  applicable_floors?: number[];
  scope?: string;
  area_type?: string;
}

export interface FloorGroupData {
  floorNumber: number;
  floorLabel: string;
  floorName: string;
  floorCode: string;
  cadUrl: string;
  isInherited: boolean;
  inheritedFromFloor?: number;
  units: BuildingUnit[];
  totalUnits: number;
  completedCount: number;
  unitCount: number;
  masterCount: number;
  scope?: string;
  areaType?: string;
}

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
  const [floorPlans, setFloorPlans] = useState<FloorPlanData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [inspectedUnit, setInspectedUnit] = useState<BuildingUnit | null>(null);

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
  const [activeHubTab, setActiveHubTab] = useState<'UNIT' | 'MASTER'>('UNIT');

  // Load units from API
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parcels/${parcel.id}/units`);
      if (res.data?.data?.units && Array.isArray(res.data.data.units)) {
        // Optimistic Status Inference từ localStorage để Hub phản hồi tức thì
        let inProgressUnits: string[] = [];
        let completedUnits: string[] = [];
        try {
          inProgressUnits = JSON.parse(
            localStorage.getItem(`metro2_condo_in_progress_units_${parcel.id}`) || '[]'
          );
          completedUnits = JSON.parse(
            localStorage.getItem(`metro2_condo_completed_units_${parcel.id}`) || '[]'
          );
        } catch (_e) {}

        const mappedUnits: BuildingUnit[] = res.data.data.units.map((u: BuildingUnit) => {
          let effStatus = u.status;
          if (!effStatus || effStatus === 'NOT_SURVEYED') {
            if (completedUnits.includes(u.id)) {
              effStatus = 'SUBMITTED';
            } else if (
              inProgressUnits.includes(u.id) ||
              Boolean(localStorage.getItem(`metro2_condo_unit_draft_${parcel.id}_${u.id}`))
            ) {
              effStatus = 'IN_PROGRESS';
            }
          }
          return {
            ...u,
            status: effStatus,
          };
        });

        setUnits(mappedUnits);
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

  const [deletedFloors, setDeletedFloors] = useState<number[]>(
    parcel.deletedFloors || parcel.deleted_floors || []
  );

  useEffect(() => {
    const rawDeleted = parcel.deletedFloors || parcel.deleted_floors;
    if (Array.isArray(rawDeleted)) {
      setDeletedFloors(rawDeleted);
    }
  }, [parcel.deletedFloors, parcel.deleted_floors]);

  // Load floor plans from API
  const fetchFloorPlans = async () => {
    try {
      const res = await api.get(`/parcels/${parcel.id}/floor-plans`);
      if (res.data?.data?.plans && Array.isArray(res.data.data.plans)) {
        setFloorPlans(res.data.data.plans);
      } else {
        setFloorPlans([]);
      }
      if (Array.isArray(res.data?.data?.deletedFloors)) {
        setDeletedFloors(res.data.data.deletedFloors);
      }
    } catch (err) {
      console.warn('[BuildingHub] Không thể nạp sơ đồ CAD các tầng:', err);
      setFloorPlans([]);
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchFloorPlans();

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
        unitType: activeHubTab,
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
      const msg = getErrorMessage(err, 'Có lỗi xảy ra khi tạo vị trí');
      alert(`Không thể thêm vị trí: ${msg}`);
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

  const availableFloors = useMemo(() => {
    return deriveBuildingFloorNumbers({
      floorPlans,
      units,
      deletedFloors,
    });
  }, [floorPlans, units, deletedFloors]);

  // Cấu trúc gom nhóm theo từng tầng (Floor-by-Floor Grouping)
  const allFloorsData = useMemo<FloorGroupData[]>(() => {
    return availableFloors.map((flNum) => {
      const directPlan = floorPlans.find((p) => p.floor_number === flNum);
      const sharedPlan = floorPlans.find(
        (p) => p.floor_number !== flNum && Array.isArray(p.applicable_floors) && p.applicable_floors.includes(flNum)
      );
      const effectivePlan = directPlan || sharedPlan;
      const isInherited = !directPlan && Boolean(sharedPlan);

      const floorUnits = units.filter((u) => {
        const fn = u.floor_number ?? u.floorNumber ?? 1;
        return fn === flNum;
      });

      let defaultLabel = `Tầng ${flNum}`;
      if (flNum === 0) defaultLabel = 'Tầng Trệt / Sảnh';
      else if (flNum < 0) defaultLabel = `Tầng Hầm B${Math.abs(flNum)}`;

      // QUAN TRỌNG: Tên mặt bằng ưu tiên tên riêng đặt trong CAD (directPlan?.floor_name).
      // Nếu là tầng kế thừa bản vẽ, giữ nguyên defaultLabel của chính tầng này.
      const floorDisplayName = directPlan?.floor_name || defaultLabel;

      const effectiveCode =
        directPlan?.floor_code ||
        getDefaultFloorCode(flNum, floorDisplayName);

      const unitCount = floorUnits.filter(
        (u) => (u.unit_type || u.unitType || 'UNIT') === 'UNIT'
      ).length;
      const masterCount = floorUnits.filter(
        (u) => (u.unit_type || u.unitType) === 'MASTER'
      ).length;
      const completedCount = floorUnits.filter(
        (u) => u.status === 'APPROVED' || Boolean(u.phase2_report_id)
      ).length;

      return {
        floorNumber: flNum,
        floorLabel: floorDisplayName,
        floorName: floorDisplayName,
        floorCode: effectiveCode,
        cadUrl: effectivePlan?.cad_photo_url || '',
        isInherited,
        inheritedFromFloor: sharedPlan?.floor_number,
        units: floorUnits,
        totalUnits: floorUnits.length,
        completedCount,
        unitCount,
        masterCount,
        scope: directPlan?.scope || effectivePlan?.scope,
        areaType: directPlan?.area_type || effectivePlan?.area_type,
      };
    });
  }, [availableFloors, floorPlans, units]);

  // Lọc tầng hiển thị theo selectedFloor, searchTerm, selectedStatus
  const displayedFloorsData = useMemo(() => {
    let result = allFloorsData;

    // Lọc theo tầng đã chọn
    if (selectedFloor !== 'ALL') {
      result = result.filter((f) => f.floorNumber === selectedFloor);
    }

    // Lọc theo từ khóa tìm kiếm (chỉ hiện các tầng có căn khớp tìm kiếm)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result
        .map((fl) => {
          const matchedUnits = fl.units.filter((u) => {
            const code = (u.unit_code || u.unitCode || '').toLowerCase();
            const owner = (u.owner_name || u.ownerName || '').toLowerCase();
            return code.includes(q) || owner.includes(q);
          });
          return {
            ...fl,
            units: matchedUnits,
          };
        })
        .filter((fl) => fl.units.length > 0);
    }

    // Lọc theo trạng thái khảo sát
    if (selectedStatus !== 'ALL') {
      result = result.map((fl) => {
        const matchedUnits = fl.units.filter((u) => {
          if (selectedStatus === 'APPROVED') return u.status === 'APPROVED' || Boolean(u.phase2_report_id);
          if (selectedStatus === 'SUBMITTED') return u.status === 'SUBMITTED';
          if (selectedStatus === 'IN_PROGRESS') return u.status === 'IN_PROGRESS';
          if (selectedStatus === 'ABSENT') return u.status === 'POSTPONED_ABSENT';
          if (selectedStatus === 'NOT_SURVEYED') return !u.status || u.status === 'NOT_SURVEYED';
          return true;
        });
        return {
          ...fl,
          units: matchedUnits,
        };
      });
    }

    return result;
  }, [allFloorsData, selectedFloor, searchTerm, selectedStatus]);

  // Đếm theo từng tab
  const unitItemsCount = units.filter((u) => (u.unit_type || u.unitType || 'UNIT') === 'UNIT').length;
  const masterItemsCount = units.filter((u) => (u.unit_type || u.unitType) === 'MASTER').length;

  const filteredUnits = units
    .filter((u) => {
      const isMaster = (u.unit_type || u.unitType) === 'MASTER';
      if (activeHubTab === 'MASTER' && !isMaster) return false;
      if (activeHubTab === 'UNIT' && isMaster) return false;

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
    })
    .sort((a, b) => {
      const floorA = a.floor_number ?? a.floorNumber ?? 1;
      const floorB = b.floor_number ?? b.floorNumber ?? 1;
      if (floorA !== floorB) return floorA - floorB;
      const codeA = a.unit_code || a.unitCode || '';
      const codeB = b.unit_code || b.unitCode || '';
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

  const displayedUnits = filteredUnits.slice(0, visibleCount);

  // Status metrics
  const completedCount = units.filter((u) => u.status === 'APPROVED' || Boolean(u.phase2_report_id)).length;
  const pendingApprovalCount = units.filter((u) => u.status === 'SUBMITTED').length;
  const inProgressCount = units.filter((u) => u.status === 'IN_PROGRESS').length;
  const absentCount = units.filter((u) => u.status === 'POSTPONED_ABSENT').length;

  return {
    isMasterSurveyDone,
    setIsMasterSurveyDone,
    masterReportData,
    isUpdatePending,
    units,
    floorPlans,
    floorsData: displayedFloorsData,
    allFloorsData,
    inspectedUnit,
    setInspectedUnit,
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
    activeHubTab,
    setActiveHubTab,
    unitItemsCount,
    masterItemsCount,
    filteredUnits,
    displayedUnits,
    refetchUnits: fetchUnits,
    refetchFloorPlans: fetchFloorPlans,
    kpi: {
      completedCount,
      pendingApprovalCount,
      inProgressCount,
      absentCount,
      totalUnits: units.length,
    },
  };
};
