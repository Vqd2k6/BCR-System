import { useState, useEffect, useRef } from 'react';
import type { GisParcel } from '../../shared/types';
import {
  METRO_22_ZONES,
  getZoneByCode,
} from '../../../../features/survey-phase1/constants/metroGisConstants';
import {
  isNonBuildingParcel,
  getParcelCenter,
  getEffectiveParcelStatus,
} from '../utils/sweepMapHelpers';

export interface AppliedFiltersState {
  APPROVED: boolean;
  PHASE2_COMPLETED: boolean;
  SUBMITTED: boolean;
  IN_PROGRESS: boolean;
  POSTPONED_ABSENT: boolean;
  NOT_SURVEYED: boolean;
  hideNonBuildings: boolean;
}

interface UseSweepMapStateProps {
  parcels: GisParcel[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onSelectParcel: (parcel: GisParcel) => void;
  onRecordAbsence?: (parcel: GisParcel) => void;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
}

export const useSweepMapState = ({
  parcels,
  selectedZone,
  onSelectZone: _onSelectZone,
  onSelectParcel,
  onRecordAbsence,
  userGps,
}: UseSweepMapStateProps) => {
  const currentZoneConfig = getZoneByCode(selectedZone) || METRO_22_ZONES[0];
  const currentStation = {
    code: currentZoneConfig.code,
    name: currentZoneConfig.name,
    center: currentZoneConfig.center,
  };
  const [activeParcel, setActiveParcel] = useState<GisParcel | null>(null);

  // GIS Layer Toggles
  const [showCenterline, setShowCenterline] = useState<boolean>(true);
  const [showZonesZoi, setShowZonesZoi] = useState<boolean>(true);
  const [showStationMarkers, setShowStationMarkers] = useState<boolean>(true);
  const [showStationOutlines, setShowStationOutlines] = useState<boolean>(true);

  // Search Parcel state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetFlyCoords, setTargetFlyCoords] = useState<[number, number] | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map Mode Switcher (Standard Esri Streets / Satellite / OSM)
  const [mapMode, setMapMode] = useState<'standard' | 'satellite' | 'osm'>('standard');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  // 3-Bar Filter & Legend Drawer/Modal state
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFiltersState>({
    APPROVED: true,
    PHASE2_COMPLETED: true,
    SUBMITTED: true,
    IN_PROGRESS: true,
    POSTPONED_ABSENT: true,
    NOT_SURVEYED: true,
    hideNonBuildings: false,
  });

  // Draft filters while modal is open
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  // Sync draft filters when modal opens
  useEffect(() => {
    if (showFilterModal) {
      setDraftFilters(appliedFilters);
    }
  }, [showFilterModal, appliedFilters]);

  // Absence log loaded from localStorage
  const [absenceRecordedToday, setAbsenceRecordedToday] = useState<{ [parcelId: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('metro2_absence_log');
      return saved ? JSON.parse(saved) : { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    } catch (_e) {
      return { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    }
  });

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Filtered parcels based on applied checklist
  const displayedParcels = (parcels || []).filter((parcel) => {
    if (appliedFilters.hideNonBuildings && isNonBuildingParcel(parcel)) {
      return false;
    }
    const status = getEffectiveParcelStatus(parcel);
    if (status === 'APPROVED') return appliedFilters.APPROVED;
    if (status === 'PHASE2_COMPLETED' || status === 'APPROVED_PHASE2') return appliedFilters.PHASE2_COMPLETED;
    if (status === 'SUBMITTED') return appliedFilters.SUBMITTED;
    if (status === 'IN_PROGRESS' || status === 'REJECTED') return appliedFilters.IN_PROGRESS;
    if (status === 'POSTPONED_ABSENT') return appliedFilters.POSTPONED_ABSENT;
    if (status === 'NOT_SURVEYED') return appliedFilters.NOT_SURVEYED;
    return true;
  });

  // Filter suggestions based on searchQuery & displayed parcels
  const searchSuggestions = (displayedParcels || []).filter((p) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase().trim();
    const code = String(p.projectParcelCode || p.project_parcel_code || '').toLowerCase();
    const cadastral = String(p.officialCadastralCode || p.official_cadastral_code || '').toLowerCase();
    const house = String(p.houseNumber || p.house_number || '').toLowerCase();
    const street = String(p.street || '').toLowerCase();
    const owner = String(p.ownerName || p.owner_name || '').toLowerCase();

    return (
      code.includes(query) ||
      cadastral.includes(query) ||
      house.includes(query) ||
      street.includes(query) ||
      owner.includes(query)
    );
  });

  const handleSelectSearchResult = (parcel: GisParcel) => {
    const center = getParcelCenter(parcel, currentStation.center);
    setTargetFlyCoords(center);
    setActiveParcel(parcel);
    onSelectParcel(parcel);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchSuggestions.length > 0) {
        handleSelectSearchResult(searchSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  // Open Google Maps directions from user GPS to parcel
  const handleOpenGoogleMapsDirections = (parcel: GisParcel) => {
    const destLat = parcel.coordinates[0]?.[0] || currentStation.center[0];
    const destLng = parcel.coordinates[0]?.[1] || currentStation.center[1];

    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`;
    if (userGps?.lat && userGps?.lng) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${userGps.lat},${userGps.lng}&destination=${destLat},${destLng}&travelmode=walking`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRecordAbsenceClick = (parcel: GisParcel) => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updated = { ...absenceRecordedToday, [parcel.id]: nowTime };
    setAbsenceRecordedToday(updated);
    try {
      localStorage.setItem('metro2_absence_log', JSON.stringify(updated));
    } catch (_e) {}
    if (onRecordAbsence) {
      onRecordAbsence(parcel);
    }
  };

  // Quick Preset Filters
  const setAllFilters = (enable: boolean) => {
    setDraftFilters({
      APPROVED: enable,
      PHASE2_COMPLETED: enable,
      SUBMITTED: enable,
      IN_PROGRESS: enable,
      POSTPONED_ABSENT: enable,
      NOT_SURVEYED: enable,
      hideNonBuildings: false,
    });
  };

  const setPhase1Only = () => {
    setDraftFilters({
      APPROVED: false,
      PHASE2_COMPLETED: false,
      SUBMITTED: true,
      IN_PROGRESS: true,
      POSTPONED_ABSENT: true,
      NOT_SURVEYED: true,
      hideNonBuildings: draftFilters.hideNonBuildings,
    });
  };

  const setPhase2Only = () => {
    setDraftFilters({
      APPROVED: true,
      PHASE2_COMPLETED: true,
      SUBMITTED: false,
      IN_PROGRESS: false,
      POSTPONED_ABSENT: false,
      NOT_SURVEYED: false,
      hideNonBuildings: draftFilters.hideNonBuildings,
    });
  };

  const isCustomFilterActive =
    !appliedFilters.APPROVED ||
    !appliedFilters.PHASE2_COMPLETED ||
    !appliedFilters.SUBMITTED ||
    !appliedFilters.IN_PROGRESS ||
    !appliedFilters.POSTPONED_ABSENT ||
    !appliedFilters.NOT_SURVEYED ||
    appliedFilters.hideNonBuildings;

  return {
    currentZoneConfig,
    currentStation,
    activeParcel,
    setActiveParcel,
    showCenterline,
    setShowCenterline,
    showZonesZoi,
    setShowZonesZoi,
    showStationMarkers,
    setShowStationMarkers,
    showStationOutlines,
    setShowStationOutlines,
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    targetFlyCoords,
    setTargetFlyCoords,
    searchInputRef,
    mapMode,
    setMapMode,
    showLayerMenu,
    setShowLayerMenu,
    showFilterModal,
    setShowFilterModal,
    appliedFilters,
    setAppliedFilters,
    draftFilters,
    setDraftFilters,
    displayedParcels,
    searchSuggestions,
    absenceRecordedToday,
    handleSelectSearchResult,
    handleSearchKeyDown,
    handleOpenGoogleMapsDirections,
    handleRecordAbsenceClick,
    setAllFilters,
    setPhase1Only,
    setPhase2Only,
    isCustomFilterActive,
  };
};
