import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Shield,
  FileText,
  Camera,
  Layers,
  Sparkles,
  GitBranch,
  ArrowRight,
  Lock,
  ChevronDown,
  Eye,
  Copy,
  Check,
  MapPin,
  Building,
  ChevronRight,
  FileCode,
  Maximize2,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

export interface SurveyReportVersionItem {
  id: string;
  versionNumber: number;
  versionTag:
    | 'ORIGINAL_SUBMISSION'
    | 'ADMIN_DIFF_SAVE'
    | 'CHIEF_ENGINEER_OVERRIDE'
    | 'PHOTO_REPLACEMENT'
    | 'ROLLBACK_RESTORE'
    | 'REVERT_TO_DRAFT';
  title: string;
  editReason?: string;
  createdAt: string;
  createdByName?: string;
  createdByRole?: string;
  diffSummary?: Record<string, unknown>[];
}

interface SnapshotPhotoNode {
  url?: string;
  rawUrl?: string;
  photoUrl?: string;
  title?: string;
  description?: string;
  additionalPhotos?: Array<string | SnapshotPhotoNode>;
}

interface SnapshotDefectNode {
  id?: string;
  defectCode?: string;
  defect_code?: string;
  defectType?: string;
  description?: string;
  severity?: string | number;
  widthMaxMm?: number;
  cuPhotoUrl?: string;
  cu_photo_url?: string;
  cuPhotos?: Array<string | SnapshotPhotoNode>;
}

interface SnapshotZoneNode {
  id?: string;
  zoneCode?: string;
  zone_code?: string;
  zoneName?: string;
  ctxPhotoUrl?: string;
  ctx_photo_url?: string;
  photoUrl?: string;
  cadPins?: { xPercent?: number; yPercent?: number; x?: number; y?: number };
  defects?: SnapshotDefectNode[];
  defectItems?: SnapshotDefectNode[];
}

interface SnapshotFloorNode {
  floorName?: string;
  floorNumber?: number;
  damageZones?: SnapshotZoneNode[];
  zones?: SnapshotZoneNode[];
}

interface SnapshotRiskCardNode {
  e1_burland_score?: string | number;
  e2_structure_score?: string | number;
  e3_deformation_score?: string | number;
  e4_material_score?: string | number;
  e5_history_score?: string | number;
  e6_overall_function_score?: string | number;
  total_ecs_score?: string | number;
  ecs_class?: string;
  avg_vi_score?: string | number;
  vi_class?: string;
  bra?: string;
  construction_impact_level_i?: string;
  is_engineering_judgement_applied?: boolean;
  engineering_judgement_action?: string;
  engineering_judgement_reason?: string;
}

interface SnapshotPaneNode {
  [key: string]: unknown;
  parcel?: Record<string, unknown>;
  specs?: Record<string, unknown> & { foundationCatScore?: string | number };
  identificationPhotos?: Record<string, SnapshotPhotoNode | undefined>;
  conclusions?: { recommendations?: string };
  riskCard?: SnapshotRiskCardNode;
  damageZones?: SnapshotZoneNode[];
  floors?: SnapshotFloorNode[];
}

interface SnapshotSurveyJsonNode {
  [key: string]: unknown;
  specs?: Record<string, unknown> & { foundationCatScore?: string | number };
  identificationPhotos?: Record<string, SnapshotPhotoNode | undefined>;
  photoP01?: SnapshotPhotoNode;
  photoP02?: SnapshotPhotoNode;
  photoP03?: SnapshotPhotoNode;
  photoP04?: SnapshotPhotoNode;
  riskCard?: SnapshotRiskCardNode;
  damageZones?: SnapshotZoneNode[];
  floors?: SnapshotFloorNode[];
  settlementTilt?: {
    beamSagging?: { photos?: Array<string | SnapshotPhotoNode> };
    differentialSettlement?: { photos?: Array<string | SnapshotPhotoNode> };
    tilt?: { photos?: Array<string | SnapshotPhotoNode> };
  };
  signatures?: {
    surveyorName?: string;
    surveyorSignatureUrl?: string;
    ownerSignatureUrl?: string;
    ownerFeedback?: string;
  };
  vacantLandPhotos?: Array<string | SnapshotPhotoNode>;
  constructionPhotos?: Array<string | SnapshotPhotoNode>;
}

interface SnapshotDataNode extends SnapshotSurveyJsonNode {
  leftPane?: SnapshotPaneNode;
  rightPane?: SnapshotPaneNode;
  frozenParcel?: Record<string, unknown>;
  parcel?: Record<string, unknown>;
  frozenSurveyDataJson?: SnapshotSurveyJsonNode;
  surveyJson?: SnapshotSurveyJsonNode;
  surveyorName?: string;
  surveyorSignatureUrl?: string;
  ownerSignatureUrl?: string;
  ownerRemarks?: string;
  engineeringRecommendations?: string;
  foundationCatScore?: string | number;
  asBuiltDrawings?: SnapshotPhotoNode[];
}

interface SelectedSnapshotResponse {
  snapshotData?: SnapshotDataNode;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode?: string;
  reportCode?: string;
  currentData: SnapshotDataNode | Record<string, unknown> | null | undefined; // Full AuditStepwiseData
  initialVersions?: SurveyReportVersionItem[];
  onClose: () => void;
  onRollbackSuccess: () => void;
}

export const VersionComparisonModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  reportCode,
  currentData: rawCurrentData,
  initialVersions = [],
  onClose,
  onRollbackSuccess,
}) => {
  const currentData = (rawCurrentData || {}) as SnapshotDataNode;
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<SurveyReportVersionItem[]>(initialVersions);
  const [selectedVerNumber, setSelectedVerNumber] = useState<number | null>(() => {
    if (initialVersions.length > 0) {
      return initialVersions.length > 1
        ? initialVersions[1].versionNumber
        : initialVersions[0].versionNumber;
    }
    return null;
  });

  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SelectedSnapshotResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Dual-mode state: Diff vs Full Snapshot
  const [viewMode, setViewMode] = useState<'DIFF' | 'FULL_SNAPSHOT'>('DIFF');
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Photo comparison tab state: 'DIFF_ONLY' | 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL' | 'ALL'
  const [photoDiffTab, setPhotoDiffTab] = useState<'DIFF_ONLY' | 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL' | 'ALL'>('DIFF_ONLY');
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string; rotation?: number } | null>(null);

  // Rollback prompt state
  const [showRollbackPrompt, setShowRollbackPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState('');

  // 1. Fetch version list
  const fetchVersions = async () => {
    setLoadingVersions(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/admin/reports/${reportId}/versions`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const list: SurveyReportVersionItem[] = res.data.data;
        setVersions(list);
        if (list.length > 0) {
          // Default select the oldest version (v0) or second latest version to immediately compare
          const defaultVer = list.length > 1 ? list[1].versionNumber : list[0].versionNumber;
          setSelectedVerNumber(defaultVer);
        }
      }
    } catch (err: unknown) {
      console.error('[VersionComparisonModal] Error fetching versions:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể tải danh sách phiên bản.'));
    } finally {
      setLoadingVersions(false);
    }
  };

  // 2. Fetch specific snapshot when selectedVerNumber changes
  const fetchSnapshot = async (verNum: number) => {
    setLoadingSnapshot(true);
    try {
      const res = await api.get(`/admin/reports/${reportId}/versions/${verNum}`);
      if (res.data?.success && res.data?.data) {
        setSelectedSnapshot(res.data.data);
      }
    } catch (err: unknown) {
      console.error('[VersionComparisonModal] Error fetching snapshot:', err);
      setErrorMsg(getErrorMessage(err, `Không thể tải bản chụp phiên bản v${verNum}`));
    } finally {
      setLoadingSnapshot(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      fetchVersions();
    } else {
      setVersions([]);
      setSelectedVerNumber(null);
      setSelectedSnapshot(null);
      setErrorMsg('');
      setViewMode('DIFF');
      setShowRawJson(false);
      setCopiedJson(false);
      setShowRollbackPrompt(false);
      setAdminPassword('');
      setRollbackReason('');
      setPhotoDiffTab('DIFF_ONLY');
      setZoomPhoto(null);
    }
  }, [isOpen, reportId]);

  useEffect(() => {
    if (selectedVerNumber !== null && isOpen) {
      fetchSnapshot(selectedVerNumber);
    }
  }, [selectedVerNumber]);

  if (!isOpen) return null;

  // Selected version item
  const selectedVerItem = versions.find((v) => v.versionNumber === selectedVerNumber);
  const latestVersionNumber = versions.length > 0 ? versions[0].versionNumber : 0;
  const isSelectedCurrent = selectedVerNumber === latestVersionNumber;

  // Helper badge for tag
  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'ORIGINAL_SUBMISSION':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-200">
            Nộp Gốc (KSV)
          </span>
        );
      case 'ADMIN_DIFF_SAVE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-200">
            Zone Admin Sửa
          </span>
        );
      case 'CHIEF_ENGINEER_OVERRIDE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-200">
            Phán Quyết KST
          </span>
        );
      case 'PHOTO_REPLACEMENT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-700 border border-blue-200">
            Thay Ảnh
          </span>
        );
      case 'ROLLBACK_RESTORE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-700 border border-rose-200">
            Khôi Phục (Rollback)
          </span>
        );
      case 'REVERT_TO_DRAFT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/10 text-orange-700 border border-orange-200">
            Chuyển Làm Dở
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {tag}
          </span>
        );
    }
  };

  // Extract comparable data from snapshot & currentData (Universal Adapter for V2 and V3 snapshots)
  const snapData = selectedSnapshot?.snapshotData || {};
  const snapLeft = snapData.leftPane || {
    parcel: snapData.frozenParcel || snapData.parcel || {},
    specs: snapData.frozenSurveyDataJson?.specs || snapData.specs || {},
    identificationPhotos: snapData.frozenSurveyDataJson?.identificationPhotos || snapData.identificationPhotos || {},
  };
  const snapRight = snapData.rightPane || {
    riskCard: snapData.frozenSurveyDataJson?.riskCard || snapData.riskCard || {},
    damageZones: snapData.damageZones || snapData.frozenSurveyDataJson?.damageZones || [],
  };
  const snapJson = snapData.surveyJson || snapData.frozenSurveyDataJson || {};

  const curLeft = currentData?.leftPane || {};
  const curRight = currentData?.rightPane || {};
  const curJson = currentData?.surveyJson || {};

  // Extraction helpers across V2/V3 snapshot structures and current active data
  const formatVal = (val: unknown): string => {
    if (val === undefined || val === null || val === '') return '---';
    if (typeof val === 'boolean') return val ? 'Có (True)' : 'Không (False)';
    if (typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      if ('lat' in rec || 'lng' in rec) {
        return `${rec.lat ?? '---'}, ${rec.lng ?? '---'}`;
      }
      if ('left' in rec || 'right' in rec || 'back' in rec) {
        const parts = [
          rec.left ? `Trái: ${rec.left}` : '',
          rec.right ? `Phải: ${rec.right}` : '',
          rec.back ? `Sau: ${rec.back}` : '',
          rec.notes ? `Ghi chú: ${rec.notes}` : '',
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' | ') : '---';
      }
      if ('status' in rec || 'detail' in rec || 'notes' in rec) {
        const st = rec.status ?? rec.hasIssue ?? rec.value;
        const dt = rec.detail ?? rec.notes ?? rec.description;
        return [st !== undefined ? String(st) : '', dt ? `(${dt})` : ''].filter(Boolean).join(' ') || JSON.stringify(val);
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  const getParcelVal = (
    pane: SnapshotPaneNode | undefined,
    field: string,
    rootData?: SnapshotDataNode,
    json?: SnapshotSurveyJsonNode
  ) =>
    formatVal(
      pane?.parcel?.[field] ??
        pane?.[field] ??
        rootData?.parcel?.[field] ??
        rootData?.frozenParcel?.[field] ??
        rootData?.[field] ??
        json?.[field]
    );

  const getSpecVal = (
    pane: SnapshotPaneNode | undefined,
    field: string,
    rootData?: SnapshotDataNode,
    json?: SnapshotSurveyJsonNode
  ) =>
    formatVal(
      pane?.specs?.[field] ??
        rootData?.specs?.[field] ??
        json?.specs?.[field] ??
        rootData?.[field] ??
        json?.[field]
    );

  const getNestedSectionVal = (
    sectionKey: string,
    field: string,
    rootData?: SnapshotDataNode,
    pane?: SnapshotPaneNode,
    json?: SnapshotSurveyJsonNode
  ) => {
    const s1 = (rootData?.[sectionKey] || {}) as Record<string, unknown>;
    const s2 = (pane?.[sectionKey] || {}) as Record<string, unknown>;
    const s3 = (json?.[sectionKey] || {}) as Record<string, unknown>;
    return formatVal(s1[field] ?? s2[field] ?? s3[field] ?? rootData?.[field] ?? json?.[field]);
  };

  interface PhotoDiffItem {
    id: string;
    category: 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL';
    categoryLabel: string;
    title: string;
    code?: string;
    oldUrl?: string | null;
    newUrl?: string | null;
    oldRotation?: number;
    newRotation?: number;
    status: 'UNCHANGED' | 'ADDED' | 'REPLACED' | 'REMOVED';
    note?: string;
  }

  // Calculate comprehensive visual photo diff between snapshot and current state
  const photoDiffItems = useMemo<PhotoDiffItem[]>(() => {
    const items: PhotoDiffItem[] = [];

    const snapRotMap = ((snapData as Record<string, unknown>)?.photoRotations ||
      (snapJson as Record<string, unknown>)?.photoRotations ||
      {}) as Record<string, number>;
    const curRotMap = ((currentData as Record<string, unknown>)?.photoRotations ||
      (curJson as Record<string, unknown>)?.photoRotations ||
      {}) as Record<string, number>;

    const resolveRot = (rotMap: Record<string, number>, ...keys: (string | null | undefined)[]): number => {
      for (const k of keys) {
        if (k && typeof rotMap[k] === 'number') {
          return rotMap[k];
        }
      }
      return 0;
    };

    const getUrl = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val.trim() || null;
      if (typeof val === 'object') {
        const rec = val as Record<string, unknown>;
        if (rec.url) return String(rec.url).trim() || null;
        if (rec.photoUrl) return String(rec.photoUrl).trim() || null;
        if (rec.rawUrl) return String(rec.rawUrl).trim() || null;
        if (rec.raw_photo_url) return String(rec.raw_photo_url).trim() || null;
      }
      return null;
    };

    const getStatus = (
      oldU: string | null,
      newU: string | null,
      oldRot = 0,
      newRot = 0
    ): 'UNCHANGED' | 'ADDED' | 'REPLACED' | 'REMOVED' => {
      if (!oldU && newU) return 'ADDED';
      if (oldU && !newU) return 'REMOVED';
      if (oldU && newU && (oldU !== newU || oldRot !== newRot)) return 'REPLACED';
      return 'UNCHANGED';
    };

    // 1. Identification Photos (P01..P04)
    const snapIdent = snapData?.identificationPhotos || snapLeft?.identificationPhotos || snapJson?.identificationPhotos || {};
    const curIdent = currentData?.identificationPhotos || curLeft?.identificationPhotos || curJson?.identificationPhotos || {};

    const identDefs: Array<{ key: string; code: string; title: string; snapKey: 'photoP01' | 'photoP02' | 'photoP03' | 'photoP04' }> = [
      { key: 'photoP01', code: 'P-01', title: 'P-01: Biển số nhà & Mặt tiền cận', snapKey: 'photoP01' },
      { key: 'photoP02', code: 'P-02', title: 'P-02: Toàn cảnh mặt tiền công trình', snapKey: 'photoP02' },
      { key: 'photoP03', code: 'P-03', title: 'P-03: Hiện trạng mặt bên / mặt sau', snapKey: 'photoP03' },
      { key: 'photoP04', code: 'P-04', title: 'P-04: Không gian & kết cấu lân cận', snapKey: 'photoP04' },
    ];

    identDefs.forEach((d) => {
      const oldU = getUrl(snapIdent[d.key]?.url || snapIdent[d.key]?.rawUrl || snapJson?.[d.snapKey]?.url);
      const newU = getUrl(curIdent[d.key]?.url || curIdent[d.key]?.rawUrl || curJson?.[d.snapKey]?.url);
      const oldRot = resolveRot(snapRotMap, d.key, d.code, oldU);
      const newRot = resolveRot(curRotMap, d.key, d.code, newU);

      if (oldU || newU) {
        items.push({
          id: `ident_${d.code}`,
          category: 'IDENT',
          categoryLabel: 'Ảnh định danh',
          title: d.title,
          code: d.code,
          oldUrl: oldU,
          newUrl: newU,
          oldRotation: oldRot,
          newRotation: newRot,
          status: getStatus(oldU, newU, oldRot, newRot),
          note: oldRot !== newRot ? `Góc xoay: ${oldRot}° → ${newRot}°` : undefined,
        });
      }
    });

    // P-03 Supplementary Photos
    const oldP03Add: Array<string | SnapshotPhotoNode> = Array.isArray(snapIdent?.photoP03?.additionalPhotos) ? snapIdent.photoP03.additionalPhotos : (Array.isArray(snapJson?.photoP03?.additionalPhotos) ? snapJson.photoP03.additionalPhotos : []);
    const newP03Add: Array<string | SnapshotPhotoNode> = Array.isArray(curIdent?.photoP03?.additionalPhotos) ? curIdent.photoP03.additionalPhotos : (Array.isArray(curJson?.photoP03?.additionalPhotos) ? curJson.photoP03.additionalPhotos : []);
    const maxP03Add = Math.max(oldP03Add.length, newP03Add.length);
    for (let i = 0; i < maxP03Add; i++) {
      const oldU = getUrl(oldP03Add[i]);
      const newU = getUrl(newP03Add[i]);
      const oldRot = resolveRot(snapRotMap, `photoP03_add_${i}`, `P-03-EXTRA-${i + 1}`, oldU);
      const newRot = resolveRot(curRotMap, `photoP03_add_${i}`, `P-03-EXTRA-${i + 1}`, newU);
      if (oldU || newU) {
        items.push({
          id: `ident_P03_add_${i + 1}`,
          category: 'IDENT',
          categoryLabel: 'Ảnh định danh P-03 bổ sung',
          title: `P-03 (Bổ sung ${i + 1}): Mặt bên / mặt sau góc phụ`,
          code: `P-03-EXTRA-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          oldRotation: oldRot,
          newRotation: newRot,
          status: getStatus(oldU, newU, oldRot, newRot),
        });
      }
    }

    // 2. Settlement & Tilt (Step 5)
    const snapST = snapJson?.settlementTilt || snapData?.settlementTilt || {};
    const curST = curJson?.settlementTilt || currentData?.settlementTilt || {};

    const stCategories = [
      { key: 'beamSagging', code: 'SAG', label: 'Võng dầm / sàn', photosOld: snapST?.beamSagging?.photos, photosNew: curST?.beamSagging?.photos },
      { key: 'differentialSettlement', code: 'SETTLE', label: 'Lún lệch / chênh cốt', photosOld: snapST?.differentialSettlement?.photos, photosNew: curST?.differentialSettlement?.photos },
      { key: 'tilt', code: 'TILT', label: 'Nghiêng lệch công trình', photosOld: snapST?.tilt?.photos, photosNew: curST?.tilt?.photos },
    ];

    stCategories.forEach((st) => {
      const pOld: Array<string | SnapshotPhotoNode> = Array.isArray(st.photosOld) ? st.photosOld : [];
      const pNew: Array<string | SnapshotPhotoNode> = Array.isArray(st.photosNew) ? st.photosNew : [];
      const maxLen = Math.max(pOld.length, pNew.length);
      for (let i = 0; i < maxLen; i++) {
        const oldU = getUrl(pOld[i]);
        const newU = getUrl(pNew[i]);
        const oldRot = resolveRot(snapRotMap, `${st.key}_${i}`, `${st.code}-${i + 1}`, oldU);
        const newRot = resolveRot(curRotMap, `${st.key}_${i}`, `${st.code}-${i + 1}`, newU);
        const itemNew = pNew[i];
        const itemOld = pOld[i];
        const noteText =
          (typeof itemNew === 'object' && itemNew?.description) ||
          (typeof itemOld === 'object' && itemOld?.description) ||
          undefined;
        if (oldU || newU) {
          items.push({
            id: `st_${st.code}_${i + 1}`,
            category: 'SETTLEMENT',
            categoryLabel: `Lún nghiêng - ${st.label}`,
            title: `${st.label} (Ảnh #${i + 1})`,
            code: `${st.code}-${i + 1}`,
            oldUrl: oldU,
            newUrl: newU,
            oldRotation: oldRot,
            newRotation: newRot,
            status: getStatus(oldU, newU, oldRot, newRot),
            note: noteText,
          });
        }
      }
    });

    // 3. Defects & Damage Zones (Step 4)
    const getZoneList = (data: SnapshotDataNode | undefined, json: SnapshotSurveyJsonNode | undefined): SnapshotZoneNode[] => {
      if (Array.isArray(data?.damageZones) && data.damageZones.length > 0) return data.damageZones;
      if (Array.isArray(data?.rightPane?.damageZones) && data.rightPane.damageZones.length > 0) return data.rightPane.damageZones;
      if (Array.isArray(data?.floors) && data.floors.length > 0) {
        const zArr: SnapshotZoneNode[] = [];
        data.floors.forEach((fl: SnapshotFloorNode) => {
          if (Array.isArray(fl.damageZones)) zArr.push(...fl.damageZones);
          else if (Array.isArray(fl.zones)) zArr.push(...fl.zones);
        });
        if (zArr.length > 0) return zArr;
      }
      if (Array.isArray(json?.damageZones)) return json.damageZones;
      return [];
    };

    const snapZones = getZoneList(snapData, snapJson);
    const curZones = getZoneList(currentData, curJson);

    const allZoneCodes = Array.from(new Set([
      ...snapZones.map((z: SnapshotZoneNode) => z.zoneCode || z.zone_code || z.id),
      ...curZones.map((z: SnapshotZoneNode) => z.zoneCode || z.zone_code || z.id)
    ])).filter(Boolean);

    allZoneCodes.forEach((zCode) => {
      const sZone = snapZones.find((z: SnapshotZoneNode) => (z.zoneCode || z.zone_code || z.id) === zCode);
      const cZone = curZones.find((z: SnapshotZoneNode) => (z.zoneCode || z.zone_code || z.id) === zCode);

      // CTX Overview Photo
      const oldCtx = getUrl(sZone?.ctxPhotoUrl || sZone?.ctx_photo_url || sZone?.photoUrl);
      const newCtx = getUrl(cZone?.ctxPhotoUrl || cZone?.ctx_photo_url || cZone?.photoUrl);
      const oldCtxRot = resolveRot(snapRotMap, `zoneCtx_${zCode}`, `${zCode}-CTX`, oldCtx);
      const newCtxRot = resolveRot(curRotMap, `zoneCtx_${zCode}`, `${zCode}-CTX`, newCtx);
      if (oldCtx || newCtx) {
        items.push({
          id: `zone_ctx_${zCode}`,
          category: 'DEFECTS',
          categoryLabel: `Vùng hư hại ${zCode}`,
          title: `Ảnh toàn cảnh (CTX) - ${sZone?.zoneName || cZone?.zoneName || zCode}`,
          code: `${zCode}-CTX`,
          oldUrl: oldCtx,
          newUrl: newCtx,
          oldRotation: oldCtxRot,
          newRotation: newCtxRot,
          status: getStatus(oldCtx, newCtx, oldCtxRot, newCtxRot),
        });
      }

      // Defects CU Photos
      const sDefects: SnapshotDefectNode[] = Array.isArray(sZone?.defects || sZone?.defectItems) ? (sZone?.defects || sZone?.defectItems || []) : [];
      const cDefects: SnapshotDefectNode[] = Array.isArray(cZone?.defects || cZone?.defectItems) ? (cZone?.defects || cZone?.defectItems || []) : [];

      const allDefCodes = Array.from(new Set([
        ...sDefects.map((d: SnapshotDefectNode) => d.defectCode || d.defect_code || d.id),
        ...cDefects.map((d: SnapshotDefectNode) => d.defectCode || d.defect_code || d.id)
      ])).filter(Boolean);

      allDefCodes.forEach((dCode) => {
        const sDef = sDefects.find((d: SnapshotDefectNode) => (d.defectCode || d.defect_code || d.id) === dCode);
        const cDef = cDefects.find((d: SnapshotDefectNode) => (d.defectCode || d.defect_code || d.id) === dCode);

        const oldCu = getUrl(sDef?.cuPhotoUrl || sDef?.cu_photo_url || (Array.isArray(sDef?.cuPhotos) ? sDef?.cuPhotos[0] : null));
        const newCu = getUrl(cDef?.cuPhotoUrl || cDef?.cu_photo_url || (Array.isArray(cDef?.cuPhotos) ? cDef?.cuPhotos[0] : null));
        const oldCuRot = resolveRot(snapRotMap, `defectCu_${zCode}_${dCode}_0`, `defectCu_${zCode}_${dCode}`, `${dCode}-CU`, oldCu);
        const newCuRot = resolveRot(curRotMap, `defectCu_${zCode}_${dCode}_0`, `defectCu_${zCode}_${dCode}`, `${dCode}-CU`, newCu);

        if (oldCu || newCu) {
          items.push({
            id: `defect_cu_${zCode}_${dCode}`,
            category: 'DEFECTS',
            categoryLabel: `Khuyết tật ${zCode} / ${dCode}`,
            title: `Ảnh cận cảnh (CU) - ${cDef?.defectType || sDef?.defectType || dCode}`,
            code: `${dCode}-CU`,
            oldUrl: oldCu,
            newUrl: newCu,
            oldRotation: oldCuRot,
            newRotation: newCuRot,
            status: getStatus(oldCu, newCu, oldCuRot, newCuRot),
            note: cDef?.widthMaxMm ? `Bề rộng nứt: ${cDef.widthMaxMm}mm` : (sDef?.widthMaxMm ? `Bề rộng nứt: ${sDef.widthMaxMm}mm` : undefined),
          });
        }
      });
    });

    // 4. Special Photos (Working Minutes, As-Built Drawings, Absence Notices, Signatures, Vacant Land, Construction)
    const oldMinutesRaw =
      (snapData?.signatures as Record<string, unknown> | undefined)?.workingMinutesPhotos ||
      (snapJson?.signatures as Record<string, unknown> | undefined)?.workingMinutesPhotos ||
      (snapData as Record<string, unknown>)?.workingMinutesPhotos ||
      (snapJson as Record<string, unknown>)?.workingMinutesPhotos ||
      [];
    const newMinutesRaw =
      (currentData?.signatures as Record<string, unknown> | undefined)?.workingMinutesPhotos ||
      (curJson?.signatures as Record<string, unknown> | undefined)?.workingMinutesPhotos ||
      (currentData as Record<string, unknown>)?.workingMinutesPhotos ||
      (curJson as Record<string, unknown>)?.workingMinutesPhotos ||
      [];
    const oldMinutesArr = Array.isArray(oldMinutesRaw) ? oldMinutesRaw : [];
    const newMinutesArr = Array.isArray(newMinutesRaw) ? newMinutesRaw : [];
    const maxMinutes = Math.max(oldMinutesArr.length, newMinutesArr.length);
    for (let i = 0; i < maxMinutes; i++) {
      const oldU = getUrl(oldMinutesArr[i]);
      const newU = getUrl(newMinutesArr[i]);
      const oldRot = resolveRot(snapRotMap, `minutes_${i}`, `MINUTES-${i + 1}`, oldU);
      const newRot = resolveRot(curRotMap, `minutes_${i}`, `MINUTES-${i + 1}`, newU);
      if (oldU || newU) {
        items.push({
          id: `special_minutes_${i + 1}`,
          category: 'SPECIAL',
          categoryLabel: 'Ảnh biên bản hiện trường',
          title: `Biên bản khảo sát trang #${i + 1}`,
          code: `MINUTES-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          oldRotation: oldRot,
          newRotation: newRot,
          status: getStatus(oldU, newU, oldRot, newRot),
          note: oldRot !== newRot ? `Góc xoay: ${oldRot}° → ${newRot}°` : undefined,
        });
      }
    }

    const oldAsBuiltRaw =
      snapData?.asBuiltDrawings ||
      (snapJson as Record<string, unknown>)?.asBuiltDrawings ||
      (snapLeft?.specs as Record<string, unknown> | undefined)?.asBuiltDrawings ||
      [];
    const newAsBuiltRaw =
      currentData?.asBuiltDrawings ||
      (curJson as Record<string, unknown>)?.asBuiltDrawings ||
      (curLeft?.specs as Record<string, unknown> | undefined)?.asBuiltDrawings ||
      [];
    const oldAsBuiltArr = Array.isArray(oldAsBuiltRaw) ? oldAsBuiltRaw : [];
    const newAsBuiltArr = Array.isArray(newAsBuiltRaw) ? newAsBuiltRaw : [];
    const maxAsBuilt = Math.max(oldAsBuiltArr.length, newAsBuiltArr.length);
    for (let i = 0; i < maxAsBuilt; i++) {
      const oldU = getUrl(oldAsBuiltArr[i]);
      const newU = getUrl(newAsBuiltArr[i]);
      const oldRot = resolveRot(snapRotMap, `asBuilt_${i}`, oldU);
      const newRot = resolveRot(curRotMap, `asBuilt_${i}`, newU);
      if (oldU || newU) {
        items.push({
          id: `special_asbuilt_${i + 1}`,
          category: 'SPECIAL',
          categoryLabel: 'Bản vẽ hoàn công',
          title: `Bản vẽ hoàn công #${i + 1}`,
          code: `ASBUILT-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          oldRotation: oldRot,
          newRotation: newRot,
          status: getStatus(oldU, newU, oldRot, newRot),
        });
      }
    }

    const oldAbsLogsRaw =
      (snapData as Record<string, unknown>)?.absenceLogs ||
      (snapLeft as Record<string, unknown>)?.absenceLogs ||
      (snapJson as Record<string, unknown>)?.absenceLogs ||
      [];
    const newAbsLogsRaw =
      (currentData as Record<string, unknown>)?.absenceLogs ||
      (curLeft as Record<string, unknown>)?.absenceLogs ||
      (curJson as Record<string, unknown>)?.absenceLogs ||
      [];
    const oldAbsArr = Array.isArray(oldAbsLogsRaw) ? oldAbsLogsRaw : [];
    const newAbsArr = Array.isArray(newAbsLogsRaw) ? newAbsLogsRaw : [];
    const maxAbs = Math.max(oldAbsArr.length, newAbsArr.length);
    for (let i = 0; i < maxAbs; i++) {
      const oItem = oldAbsArr[i] as Record<string, unknown> | undefined;
      const nItem = newAbsArr[i] as Record<string, unknown> | undefined;
      const oldU = getUrl(oItem?.photoUrl || oItem?.photo_url || oItem?.evidence_photo_url || oItem);
      const newU = getUrl(nItem?.photoUrl || nItem?.photo_url || nItem?.evidence_photo_url || nItem);
      const oldRot = resolveRot(snapRotMap, `absenceNotice_${i}`, `ABSENCE_${i + 1}`, oldU);
      const newRot = resolveRot(curRotMap, `absenceNotice_${i}`, `ABSENCE_${i + 1}`, newU);
      if (oldU || newU) {
        items.push({
          id: `special_absence_${i + 1}`,
          category: 'SPECIAL',
          categoryLabel: 'Giấy báo vắng mặt',
          title: `Giấy thông báo vắng mặt lần #${i + 1}`,
          code: `ABSENCE-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          oldRotation: oldRot,
          newRotation: newRot,
          status: getStatus(oldU, newU, oldRot, newRot),
        });
      }
    }

    const oldSurvSig = getUrl(snapData?.surveyorSignatureUrl || snapData?.signatures?.surveyorSignatureUrl || snapJson?.signatures?.surveyorSignatureUrl);
    const newSurvSig = getUrl(currentData?.surveyorSignatureUrl || currentData?.signatures?.surveyorSignatureUrl || curJson?.signatures?.surveyorSignatureUrl);
    if (oldSurvSig || newSurvSig) {
      items.push({
        id: 'special_surveyor_signature',
        category: 'SPECIAL',
        categoryLabel: 'Chữ ký biên bản',
        title: 'Chữ ký Khảo sát viên (KSV)',
        code: 'SIG-KSV',
        oldUrl: oldSurvSig,
        newUrl: newSurvSig,
        status: getStatus(oldSurvSig, newSurvSig),
      });
    }

    const oldOwnerSig = getUrl(snapData?.ownerSignatureUrl || snapData?.signatures?.ownerSignatureUrl || snapJson?.signatures?.ownerSignatureUrl);
    const newOwnerSig = getUrl(currentData?.ownerSignatureUrl || currentData?.signatures?.ownerSignatureUrl || curJson?.signatures?.ownerSignatureUrl);
    if (oldOwnerSig || newOwnerSig) {
      items.push({
        id: 'special_owner_signature',
        category: 'SPECIAL',
        categoryLabel: 'Chữ ký biên bản',
        title: 'Chữ ký Chủ hộ / Đại diện',
        code: 'SIG-OWNER',
        oldUrl: oldOwnerSig,
        newUrl: newOwnerSig,
        status: getStatus(oldOwnerSig, newOwnerSig),
      });
    }

    const oldWitnessSig = getUrl(
      (snapData?.signatures as Record<string, unknown> | undefined)?.witnessSignatureUrl ||
        (snapData?.signatures as Record<string, unknown> | undefined)?.witnessSignature ||
        (snapJson?.signatures as Record<string, unknown> | undefined)?.witnessSignatureUrl
    );
    const newWitnessSig = getUrl(
      (currentData?.signatures as Record<string, unknown> | undefined)?.witnessSignatureUrl ||
        (currentData?.signatures as Record<string, unknown> | undefined)?.witnessSignature ||
        (curJson?.signatures as Record<string, unknown> | undefined)?.witnessSignatureUrl
    );
    if (oldWitnessSig || newWitnessSig) {
      items.push({
        id: 'special_witness_signature',
        category: 'SPECIAL',
        categoryLabel: 'Chữ ký biên bản',
        title: 'Chữ ký Người làm chứng / Địa phương',
        code: 'SIG-WITNESS',
        oldUrl: oldWitnessSig,
        newUrl: newWitnessSig,
        status: getStatus(oldWitnessSig, newWitnessSig),
      });
    }

    const oldVacant: Array<string | SnapshotPhotoNode> = Array.isArray(snapJson?.vacantLandPhotos) ? snapJson.vacantLandPhotos : (Array.isArray(snapData?.vacantLandPhotos) ? snapData.vacantLandPhotos : []);
    const newVacant: Array<string | SnapshotPhotoNode> = Array.isArray(curJson?.vacantLandPhotos) ? curJson.vacantLandPhotos : (Array.isArray(currentData?.vacantLandPhotos) ? currentData.vacantLandPhotos : []);
    const maxVacant = Math.max(oldVacant.length, newVacant.length);
    for (let i = 0; i < maxVacant; i++) {
      const oldU = getUrl(oldVacant[i]);
      const newU = getUrl(newVacant[i]);
      if (oldU || newU) {
        items.push({
          id: `special_vacant_${i + 1}`,
          category: 'SPECIAL',
          categoryLabel: 'Ảnh đất trống',
          title: `Đất trống hiện trạng (Ảnh #${i + 1})`,
          code: `VACANT-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          status: getStatus(oldU, newU),
        });
      }
    }

    const oldConst: Array<string | SnapshotPhotoNode> = Array.isArray(snapJson?.constructionPhotos) ? snapJson.constructionPhotos : (Array.isArray(snapData?.constructionPhotos) ? snapData.constructionPhotos : []);
    const newConst: Array<string | SnapshotPhotoNode> = Array.isArray(curJson?.constructionPhotos) ? curJson.constructionPhotos : (Array.isArray(currentData?.constructionPhotos) ? currentData.constructionPhotos : []);
    const maxConst = Math.max(oldConst.length, newConst.length);
    for (let i = 0; i < maxConst; i++) {
      const oldU = getUrl(oldConst[i]);
      const newU = getUrl(newConst[i]);
      if (oldU || newU) {
        items.push({
          id: `special_const_${i + 1}`,
          category: 'SPECIAL',
          categoryLabel: 'Ảnh công trình đang XD',
          title: `Công trình đang thi công (Ảnh #${i + 1})`,
          code: `CONST-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          status: getStatus(oldU, newU),
        });
      }
    }

    return items;
  }, [snapData, snapLeft, snapJson, currentData, curLeft, curJson]);

  const diffOnlyCount = useMemo(() => {
    return photoDiffItems.filter((item) => item.status !== 'UNCHANGED').length;
  }, [photoDiffItems]);

  const filteredPhotoDiffItems = useMemo(() => {
    if (photoDiffTab === 'DIFF_ONLY') {
      return photoDiffItems.filter((item) => item.status !== 'UNCHANGED');
    }
    if (photoDiffTab === 'ALL') {
      return photoDiffItems;
    }
    return photoDiffItems.filter((item) => item.category === photoDiffTab);
  }, [photoDiffItems, photoDiffTab]);

  const handleExecuteRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword || !adminPassword.trim()) {
      setRollbackError('Vui lòng nhập mật khẩu tài khoản quản trị để xác thực.');
      return;
    }
    if (!rollbackReason || rollbackReason.trim().length < 5) {
      setRollbackError('Lý do hoàn nguyên bắt buộc phải từ 5 ký tự trở lên.');
      return;
    }

    setIsRollingBack(true);
    setRollbackError('');
    try {
      const submitRollback = (confirmZoneWipe: boolean) =>
        api.post(`/admin/reports/${reportId}/versions/${selectedVerNumber}/rollback`, {
          adminPassword: adminPassword.trim(),
          rollbackReason: rollbackReason.trim(),
          ...(confirmZoneWipe ? { confirmZoneWipe: true } : {}),
        });

      let res = await submitRollback(false);
      const zoneWipeNotice = res.data?.data?.requiresZoneWipeConfirmation ? String(res.data.data.message) : '';
      if (zoneWipeNotice) {
        if (!window.confirm(`${zoneWipeNotice} Bạn có chắc muốn tiếp tục?`)) return;
        res = await submitRollback(true);
      }

      if (res.data?.success) {
        if (res.data?.data?.isJsonOnly) {
          window.alert(String(res.data.data.message));
        }
        setShowRollbackPrompt(false);
        onRollbackSuccess();
        onClose();
      } else {
        setRollbackError(res.data?.message || 'Không thể thực hiện khôi phục phiên bản.');
      }
    } catch (err: unknown) {
      console.error('[handleExecuteRollback] Error:', err);
      setRollbackError(getErrorMessage(err, 'Lỗi kết nối khi hoàn nguyên phiên bản.'));
    } finally {
      setIsRollingBack(false);
    }
  };

  // Helper row renderer with diff comparison
  const renderCompareRow = (label: string, oldVal: unknown, newVal: unknown) => {
    const isDifferent = String(oldVal ?? '').trim() !== String(newVal ?? '').trim();
    return (
      <div
        className={`py-2 px-3 rounded-lg border text-xs grid grid-cols-2 gap-4 transition-colors ${
          isDifferent
            ? 'bg-amber-50/80 border-amber-300 text-slate-900 font-medium shadow-2xs'
            : 'bg-slate-50/60 border-slate-200/70 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start justify-between pr-2 border-r border-slate-200/80">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className="font-semibold text-right break-words text-slate-800">{String(oldVal ?? '---')}</span>
        </div>
        <div className="flex items-start justify-between pl-2">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className={`font-semibold text-right break-words ${isDifferent ? 'text-amber-900' : 'text-slate-800'}`}>
            {String(newVal ?? '---')}
            {isDifferent && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 text-[10px] font-bold">
                Khác biệt
              </span>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Helper row renderer for full snapshot inspection
  const renderSnapshotField = (label: string, val: unknown, badge?: string) => (
    <div className="py-2 px-3 rounded-lg border border-slate-200/80 bg-slate-50/70 text-xs flex items-start justify-between gap-2">
      <span className="text-slate-500 font-normal shrink-0">{label}:</span>
      <div className="flex items-center gap-1.5 text-right font-semibold text-slate-800">
        <span className="break-words">{String(val ?? '---')}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl h-[92vh] overflow-hidden text-slate-800">
        {/* Top Header (Light Theme synchronized with Audit Studio) */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  So Sánh Phiên Bản & Hoàn Nguyên Thời Gian
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Time-Travel Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Thửa đất: <strong className="font-mono text-indigo-700">{parcelCode || '---'}</strong>
                {reportCode ? (
                  <>
                    {' '}• Mã báo cáo: <strong className="font-mono text-slate-700">{reportCode}</strong>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Rollback Trigger Button */}
            {!isSelectedCurrent && selectedVerNumber !== null && (
              <button
                type="button"
                onClick={() => {
                  setRollbackError('');
                  setShowRollbackPrompt(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi Phục Về v{selectedVerNumber}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Version Picker Carousel & Dual-Mode Tabs */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <span className="text-xs font-bold text-slate-600 shrink-0 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              Phiên bản:
            </span>

            <div className="flex items-center gap-2">
              {loadingVersions && versions.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Đang tải danh sách phiên bản...</span>
              ) : versions.length === 0 ? (
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  v0 • Bản gốc hiện trường
                </span>
              ) : (
                versions.map((v) => {
                  const isSelected = v.versionNumber === selectedVerNumber;
                  const isCurrent = v.versionNumber === latestVersionNumber;
                  return (
                    <button
                      key={v.id || v.versionNumber}
                      type="button"
                      onClick={() => setSelectedVerNumber(v.versionNumber)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="font-mono font-bold">v{v.versionNumber}</span>
                      {isCurrent && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          Hiện tại
                        </span>
                      )}
                      <span className="text-[11px] opacity-85 truncate max-w-[130px]">{v.title}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Dual-Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('DIFF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'DIFF'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Đối Soát Sai Khác (Diff)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FULL_SNAPSHOT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'FULL_SNAPSHOT'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Bản Xem Đầy Đủ (Full Snapshot)</span>
            </button>
          </div>
        </div>

        {/* Version Metadata Banner */}
        {selectedVerItem && (
          <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-indigo-100 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-indigo-900">
                Phiên bản v{selectedVerItem.versionNumber}: {selectedVerItem.title}
              </span>
              {getTagBadge(selectedVerItem.versionTag)}
              {selectedVerItem.editReason && (
                <span className="text-slate-600 italic">Lý do: &ldquo;{selectedVerItem.editReason}&rdquo;</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-[11px]">
              <span className="flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {selectedVerItem.createdByName || 'Hệ thống'} ({selectedVerItem.createdByRole || 'ADMIN'})
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(selectedVerItem.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Comparison Workspace (Diff or Full Snapshot) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/70">
          {loadingSnapshot ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Đang tải dữ liệu bản chụp phiên bản v{selectedVerNumber ?? 0}...</span>
            </div>
          ) : viewMode === 'DIFF' ? (
            <>
              {/* Header titles for 2 columns */}
              <div className="grid grid-cols-2 border-b border-slate-200 bg-white text-xs font-bold text-slate-800 shrink-0 shadow-2xs">
                <div className="p-3 border-r border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span>Dữ Liệu Bản Chụp: Phiên Bản v{selectedVerNumber ?? 0}</span>
                  </div>
                  {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                </div>
                <div className="p-3 flex items-center justify-between bg-emerald-50/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>Dữ Liệu Hiện Tại: Phiên Bản v{latestVersionNumber} (Active)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Đang áp dụng
                  </span>
                </div>
              </div>

              {/* Scrollable comparison lists */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Section 1: Thửa đất & Chủ hộ (Mục 01) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>1. Thông Tin Định Danh & Thửa Đất (Mục 01)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Tên công trình / Tòa nhà', getParcelVal(snapLeft, 'buildingName', snapData, snapJson), getParcelVal(curLeft, 'buildingName', currentData, curJson))}
                    {renderCompareRow('Loại hình công trình', getParcelVal(snapLeft, 'buildingType', snapData, snapJson), getParcelVal(curLeft, 'buildingType', currentData, curJson))}
                    {renderCompareRow('Phân nhóm đối tượng (Object Group)', getParcelVal(snapLeft, 'objectGroup', snapData, snapJson), getParcelVal(curLeft, 'objectGroup', currentData, curJson))}
                    {renderCompareRow('Mã căn hộ / Unit', getParcelVal(snapLeft, 'unitCode', snapData, snapJson), getParcelVal(curLeft, 'unitCode', currentData, curJson))}
                    {renderCompareRow('Tầng căn hộ', getParcelVal(snapLeft, 'unitFloorNumber', snapData, snapJson), getParcelVal(curLeft, 'unitFloorNumber', currentData, curJson))}
                    {renderCompareRow('Số nhà', getParcelVal(snapLeft, 'houseNumber', snapData, snapJson), getParcelVal(curLeft, 'houseNumber', currentData, curJson))}
                    {renderCompareRow('Đường / Phố', getParcelVal(snapLeft, 'street', snapData, snapJson), getParcelVal(curLeft, 'street', currentData, curJson))}
                    {renderCompareRow('Phường / Xã', getParcelVal(snapLeft, 'ward', snapData, snapJson), getParcelVal(curLeft, 'ward', currentData, curJson))}
                    {renderCompareRow('Quận / Huyện', getParcelVal(snapLeft, 'district', snapData, snapJson), getParcelVal(curLeft, 'district', currentData, curJson))}
                    {renderCompareRow('Chủ hộ', getParcelVal(snapLeft, 'ownerName', snapData, snapJson), getParcelVal(curLeft, 'ownerName', currentData, curJson))}
                    {renderCompareRow('SĐT chủ hộ', getParcelVal(snapLeft, 'ownerPhone', snapData, snapJson), getParcelVal(curLeft, 'ownerPhone', currentData, curJson))}
                    {renderCompareRow('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode', snapData, snapJson), getParcelVal(curLeft, 'officialCadastralCode', currentData, curJson))}
                    {renderCompareRow('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2', snapData, snapJson), getParcelVal(curLeft, 'landAreaM2', currentData, curJson))}
                    {renderCompareRow('Diện tích xây dựng (m²)', getParcelVal(snapLeft, 'constructionAreaM2', snapData, snapJson), getParcelVal(curLeft, 'constructionAreaM2', currentData, curJson))}
                    {renderCompareRow('Tổng diện tích sàn (m²)', getParcelVal(snapLeft, 'totalFloorAreaM2', snapData, snapJson), getParcelVal(curLeft, 'totalFloorAreaM2', currentData, curJson))}
                    {renderCompareRow('Chiều rộng mặt tiền (m)', getParcelVal(snapLeft, 'frontageWidth', snapData, snapJson), getParcelVal(curLeft, 'frontageWidth', currentData, curJson))}
                    {renderCompareRow('Chiều sâu thửa đất (m)', getParcelVal(snapLeft, 'lotDepth', snapData, snapJson), getParcelVal(curLeft, 'lotDepth', currentData, curJson))}
                    {renderCompareRow('Tọa độ GPS', getParcelVal(snapLeft, 'gpsCoords', snapData, snapJson), getParcelVal(curLeft, 'gpsCoords', currentData, curJson))}
                    {renderCompareRow('Khoảng cách tới tim Metro (m)', getParcelVal(snapLeft, 'metroOffsetDistance', snapData, snapJson), getParcelVal(curLeft, 'metroOffsetDistance', currentData, curJson))}
                    {renderCompareRow('Khoảng cách tới mép ga / hố đào (m)', getParcelVal(snapLeft, 'clearanceOffsetDistance', snapData, snapJson), getParcelVal(curLeft, 'clearanceOffsetDistance', currentData, curJson))}
                    {renderCompareRow('Lý trình tuyến (Chainage)', getParcelVal(snapLeft, 'chainage', snapData, snapJson), getParcelVal(curLeft, 'chainage', currentData, curJson))}
                    {renderCompareRow('Trường hợp khảo sát', getParcelVal(snapLeft, 'surveyCaseType', snapData, snapJson), getParcelVal(curLeft, 'surveyCaseType', currentData, curJson))}
                    {renderCompareRow('Ghi chú đất trống', getParcelVal(snapLeft, 'vacantLandNotes', snapData, snapJson), getParcelVal(curLeft, 'vacantLandNotes', currentData, curJson))}
                    {renderCompareRow('Ghi chú giai đoạn thi công', getParcelVal(snapLeft, 'constructionStageNotes', snapData, snapJson), getParcelVal(curLeft, 'constructionStageNotes', currentData, curJson))}
                  </div>
                </div>

                {/* Section 1B: Đặc thù Phân hệ Chung cư (Khối tháp / Khu vực chung / Căn hộ con) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span>1B. Thông Số Đặc Thù Chung Cư (BQL / Khu Vực Chung / Căn Hộ Con)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Tên Ban Quản Lý (BQL)',
                      getParcelVal(snapLeft, 'managementBoardName', snapData, snapJson),
                      getParcelVal(curLeft, 'managementBoardName', currentData, curJson)
                    )}
                    {renderCompareRow(
                      'Đại diện BQL / Liên hệ',
                      `${getParcelVal(snapLeft, 'managementContactName', snapData, snapJson)} (${getParcelVal(snapLeft, 'managementContactPhone', snapData, snapJson)})`,
                      `${getParcelVal(curLeft, 'managementContactName', currentData, curJson)} (${getParcelVal(curLeft, 'managementContactPhone', currentData, curJson)})`
                    )}
                    {renderCompareRow(
                      'Tên Khu vực dùng chung (MASTER_AREA)',
                      getNestedSectionVal('areaInfo', 'areaName', snapData, snapLeft, snapJson),
                      getNestedSectionVal('areaInfo', 'areaName', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'Phân loại Khu vực chung & Tiếp cận',
                      `${getNestedSectionVal('areaInfo', 'areaCategory', snapData, snapLeft, snapJson)} | ${getNestedSectionVal('areaInfo', 'accessStatus', snapData, snapLeft, snapJson)}`,
                      `${getNestedSectionVal('areaInfo', 'areaCategory', currentData, curLeft, curJson)} | ${getNestedSectionVal('areaInfo', 'accessStatus', currentData, curLeft, curJson)}`
                    )}
                    {renderCompareRow(
                      'Tọa độ khoanh vùng CAD (BBox)',
                      getNestedSectionVal('areaInfo', 'boundingBox', snapData, snapLeft, snapJson),
                      getNestedSectionVal('areaInfo', 'boundingBox', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'Số cấu kiện chịu lực (E-01..E-n)',
                      Array.isArray((snapJson as Record<string, unknown>)?.structuralElements)
                        ? `${((snapJson as Record<string, unknown>).structuralElements as unknown[]).length} cấu kiện`
                        : '---',
                      Array.isArray((curJson as Record<string, unknown>)?.structuralElements)
                        ? `${((curJson as Record<string, unknown>).structuralElements as unknown[]).length} cấu kiện`
                        : '---'
                    )}
                    {renderCompareRow(
                      'Trạng thái cư trú căn hộ & Vai trò',
                      `${getParcelVal(snapLeft, 'occupancyStatus', snapData, snapJson)} | ${getParcelVal(snapLeft, 'residentRole', snapData, snapJson)}`,
                      `${getParcelVal(curLeft, 'occupancyStatus', currentData, curJson)} | ${getParcelVal(curLeft, 'residentRole', currentData, curJson)}`
                    )}
                    {renderCompareRow(
                      'Hiện tượng kẹt cửa căn hộ (Door Jamming)',
                      formatVal((snapJson as Record<string, unknown>)?.doorJamming),
                      formatVal((curJson as Record<string, unknown>)?.doorJamming)
                    )}
                    {renderCompareRow(
                      'Thấm nước từ sàn tầng trên (Water Leakage)',
                      formatVal((snapJson as Record<string, unknown>)?.waterLeakageFromUpperFloor),
                      formatVal((curJson as Record<string, unknown>)?.waterLeakageFromUpperFloor)
                    )}
                    {renderCompareRow(
                      'Độ võng dầm/sàn nội bộ căn hộ (Beam Sagging)',
                      formatVal((snapJson as Record<string, unknown>)?.beamSagging),
                      formatVal((curJson as Record<string, unknown>)?.beamSagging)
                    )}
                  </div>
                </div>

                {/* Section 2: Thông số kỹ thuật & Kết cấu (Mục 02) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>2. Thông Số Kỹ Thuật & Kết Cấu Công Trình (Mục 02)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Hệ kết cấu chính', getSpecVal(snapLeft, 'structureSystem', snapData, snapJson), getSpecVal(curLeft, 'structureSystem', currentData, curJson))}
                    {renderCompareRow('Số tầng nổi', getSpecVal(snapLeft, 'floorCount', snapData, snapJson), getSpecVal(curLeft, 'floorCount', currentData, curJson))}
                    {renderCompareRow('Số tầng ngầm/hầm', getSpecVal(snapLeft, 'basementCount', snapData, snapJson), getSpecVal(curLeft, 'basementCount', currentData, curJson))}
                    {renderCompareRow('Chiều cao công trình (m)', getSpecVal(snapLeft, 'buildingHeightM', snapData, snapJson), getSpecVal(curLeft, 'buildingHeightM', currentData, curJson))}
                    {renderCompareRow('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction', snapData, snapJson), getSpecVal(curLeft, 'yearOfConstruction', currentData, curJson))}
                    {renderCompareRow('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated', snapData, snapJson)), String(getSpecVal(curLeft, 'isYearEstimated', currentData, curJson)))}
                    {renderCompareRow('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction', snapData, snapJson), getSpecVal(curLeft, 'landUseFunction', currentData, curJson))}
                    {renderCompareRow('Loại móng chi tiết', getSpecVal(snapLeft, 'foundationType', snapData, snapJson), getSpecVal(curLeft, 'foundationType', currentData, curJson))}
                    {renderCompareRow('Phân loại cấp móng (CAT)', snapLeft?.specs?.foundationCatScore ?? snapData?.foundationCatScore ?? '---', curLeft?.specs?.foundationCatScore ?? currentData?.foundationCatScore ?? '---')}
                    {renderCompareRow('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM', snapData, snapJson), getSpecVal(curLeft, 'foundationDepthM', currentData, curJson))}
                    {renderCompareRow('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM', snapData, snapJson), getSpecVal(curLeft, 'foundationSpacingM', currentData, curJson))}
                    {renderCompareRow('Kích thước cọc / đài móng (mm)', getSpecVal(snapLeft, 'pileDimensionMm', snapData, snapJson), getSpecVal(curLeft, 'pileDimensionMm', currentData, curJson))}
                    {renderCompareRow('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes', snapData, snapJson), getSpecVal(curLeft, 'foundationNotes', currentData, curJson))}
                    {renderCompareRow('Công trình liền kề', getSpecVal(snapLeft, 'adjacentBuildings', snapData, snapJson), getSpecVal(curLeft, 'adjacentBuildings', currentData, curJson))}
                  </div>
                </div>

                {/* Section 2B: Phỏng vấn lịch sử công trình & Tải trọng (Mục 03) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>3. Phỏng Vấn Lịch Sử Công Trình & Tải Trọng (Mục 03)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Cải tạo / Nâng tầng gia tăng tải trọng', getNestedSectionVal('historyInterview', 'renovationLoad', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'renovationLoad', currentData, curLeft, curJson))}
                    {renderCompareRow('Năm cải tạo', getNestedSectionVal('historyInterview', 'renovationYear', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'renovationYear', currentData, curLeft, curJson))}
                    {renderCompareRow('Sửa chữa lớn kết cấu', getNestedSectionVal('historyInterview', 'majorRepair', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'majorRepair', currentData, curLeft, curJson))}
                    {renderCompareRow('Lịch sử lún / nghiêng trước đây', getNestedSectionVal('historyInterview', 'pastSettlement', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'pastSettlement', currentData, curLeft, curJson))}
                    {renderCompareRow('Ảnh hưởng từ thi công nhà kế bên', getNestedSectionVal('historyInterview', 'neighborDamage', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'neighborDamage', currentData, curLeft, curJson))}
                    {renderCompareRow('Sự cố cháy nổ / ngập lụt', getNestedSectionVal('historyInterview', 'fireFloodIncident', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'fireFloodIncident', currentData, curLeft, curJson))}
                    {renderCompareRow('Thiết bị nhạy cảm rung động', getNestedSectionVal('historyInterview', 'sensitiveEquipment', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'sensitiveEquipment', currentData, curLeft, curJson))}
                    {renderCompareRow('Vận hành liên tục 24/7', getNestedSectionVal('historyInterview', 'continuousOperation247', snapData, snapLeft, snapJson), getNestedSectionVal('historyInterview', 'continuousOperation247', currentData, curLeft, curJson))}
                  </div>
                </div>

                {/* Section 2C: Tổng hợp Burland & Phạm vi tiếp cận / Biến động GIS (Mục 05 & Mục 06) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>4. Tổng Hợp Burland, Tiếp Cận & Biến Động Địa Chính GIS (Mục 05 & 06)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Cấp hư hại Burland cực đại cục bộ', getNestedSectionVal('burlandSummary', 'localMaxGrade', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'localMaxGrade', currentData, curRight, curJson))}
                    {renderCompareRow('Cấp hư hại Burland phổ biến (Predominant)', getNestedSectionVal('burlandSummary', 'predominantGrade', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'predominantGrade', currentData, curRight, curJson))}
                    {renderCompareRow('Cờ cảnh báo kết cấu (Structural Flag)', getNestedSectionVal('burlandSummary', 'structuralFlagLevel', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'structuralFlagLevel', currentData, curRight, curJson))}
                    {renderCompareRow('Vùng hư hại quyết định (Governing Zone)', getNestedSectionVal('burlandSummary', 'governingZoneCode', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'governingZoneCode', currentData, curRight, curJson))}
                    {renderCompareRow('Tính đại diện mẫu khảo sát', getNestedSectionVal('burlandSummary', 'representativeness', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'representativeness', currentData, curRight, curJson))}
                    {renderCompareRow('Yêu cầu Kỹ sư kết cấu thẩm định sâu', getNestedSectionVal('burlandSummary', 'needStructuralEngineerReview', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'needStructuralEngineerReview', currentData, curRight, curJson))}
                    {renderCompareRow('Nhận xét tổng hợp Burland', getNestedSectionVal('burlandSummary', 'evaluationNotes', snapData, snapRight, snapJson), getNestedSectionVal('burlandSummary', 'evaluationNotes', currentData, curRight, curJson))}
                    {renderCompareRow('Mức độ tiếp cận khảo sát', getNestedSectionVal('accessLimitation', 'type', snapData, snapLeft, snapJson), getNestedSectionVal('accessLimitation', 'type', currentData, curLeft, curJson))}
                    {renderCompareRow('Lý do hạn chế tiếp cận', getNestedSectionVal('accessLimitation', 'mainReason', snapData, snapLeft, snapJson), getNestedSectionVal('accessLimitation', 'mainReason', currentData, curLeft, curJson))}
                    {renderCompareRow('Khu vực hạn chế tiếp cận', getNestedSectionVal('accessLimitation', 'restrictedAreas', snapData, snapLeft, snapJson), getNestedSectionVal('accessLimitation', 'restrictedAreas', currentData, curLeft, curJson))}
                    {renderCompareRow('Ghi chú tiếp cận', getNestedSectionVal('accessLimitation', 'notes', snapData, snapLeft, snapJson), getNestedSectionVal('accessLimitation', 'notes', currentData, curLeft, curJson))}
                    {renderCompareRow('Loại biến động ranh GIS', getNestedSectionVal('gisMutationConfirmed', 'type', snapData, snapLeft, snapJson), getNestedSectionVal('gisMutationConfirmed', 'type', currentData, curLeft, curJson))}
                    {renderCompareRow('Ghi chú biến động KSV', getNestedSectionVal('gisMutationConfirmed', 'surveyorNotes', snapData, snapLeft, snapJson), getNestedSectionVal('gisMutationConfirmed', 'surveyorNotes', currentData, curLeft, curJson))}
                    {renderCompareRow('Ghi chú thẩm định GIS', getNestedSectionVal('gisMutationConfirmed', 'adminNotes', snapData, snapLeft, snapJson), getNestedSectionVal('gisMutationConfirmed', 'adminNotes', currentData, curLeft, curJson))}
                  </div>
                </div>

                {/* Section 3: Bảng điểm rủi ro & Phán quyết Kỹ sư trưởng (Mục 07 & 08) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>5. Bảng Điểm Rủi Ro (ECS / VI / BRA), Gate & Kết Luận (Mục 07 & 08)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Hạng nứt Burland (E1)',
                      snapRight?.riskCard?.e1_burland_score ?? getNestedSectionVal('ecs', 'e1', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e1_burland_score ?? getNestedSectionVal('ecs', 'e1', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Khuyết tật kết cấu (E2)',
                      snapRight?.riskCard?.e2_structure_score ?? getNestedSectionVal('ecs', 'e2', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e2_structure_score ?? getNestedSectionVal('ecs', 'e2', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Biến dạng lún nghiêng (E3)',
                      snapRight?.riskCard?.e3_deformation_score ?? getNestedSectionVal('ecs', 'e3', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e3_deformation_score ?? getNestedSectionVal('ecs', 'e3', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Hiện trạng vật liệu (E4)',
                      snapRight?.riskCard?.e4_material_score ?? getNestedSectionVal('ecs', 'e4', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e4_material_score ?? getNestedSectionVal('ecs', 'e4', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Lịch sử công trình (E5)',
                      snapRight?.riskCard?.e5_history_score ?? getNestedSectionVal('ecs', 'e5', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e5_history_score ?? getNestedSectionVal('ecs', 'e5', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Công năng & môi trường (E6)',
                      snapRight?.riskCard?.e6_overall_function_score ?? getNestedSectionVal('ecs', 'e6', snapData, snapRight, snapJson),
                      curRight?.riskCard?.e6_overall_function_score ?? getNestedSectionVal('ecs', 'e6', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Tổng điểm ECS',
                      snapRight?.riskCard?.total_ecs_score ?? getNestedSectionVal('ecs', 'totalEcs', snapData, snapRight, snapJson),
                      curRight?.riskCard?.total_ecs_score ?? getNestedSectionVal('ecs', 'totalEcs', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Xếp hạng ECS',
                      snapRight?.riskCard?.ecs_class ?? getNestedSectionVal('ecs', 'ecsClass', snapData, snapRight, snapJson),
                      curRight?.riskCard?.ecs_class ?? getNestedSectionVal('ecs', 'ecsClass', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Điểm thành phần VI (V1..V6)',
                      ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((k) => `${k.toUpperCase()}:${getNestedSectionVal('vi', k, snapData, snapRight, snapJson)}`).join(' | '),
                      ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((k) => `${k.toUpperCase()}:${getNestedSectionVal('vi', k, currentData, curRight, curJson)}`).join(' | ')
                    )}
                    {renderCompareRow(
                      'Điểm tổn thương VI trung bình',
                      snapRight?.riskCard?.avg_vi_score ?? getNestedSectionVal('vi', 'avgVi', snapData, snapRight, snapJson),
                      curRight?.riskCard?.avg_vi_score ?? getNestedSectionVal('vi', 'avgVi', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Xếp hạng VI',
                      snapRight?.riskCard?.vi_class ?? getNestedSectionVal('vi', 'viClass', snapData, snapRight, snapJson),
                      curRight?.riskCard?.vi_class ?? getNestedSectionVal('vi', 'viClass', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Quyết định cổng kiểm soát (Gate Decision)',
                      getParcelVal(snapRight, 'gateDecision', snapData, snapJson),
                      getParcelVal(curRight, 'gateDecision', currentData, curJson)
                    )}
                    {renderCompareRow(
                      'Ghi chú cổng kiểm soát (Gate Notes)',
                      getParcelVal(snapRight, 'gateNotes', snapData, snapJson),
                      getParcelVal(curRight, 'gateNotes', currentData, curJson)
                    )}
                    {renderCompareRow(
                      'Cấp độ tác động thi công Metro (I)',
                      snapRight?.riskCard?.construction_impact_level_i ?? getNestedSectionVal('executiveSummary', 'constructionImpactStatus', snapData, snapRight, snapJson),
                      curRight?.riskCard?.construction_impact_level_i ?? getNestedSectionVal('executiveSummary', 'constructionImpactStatus', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Lý do can thiệp cấp tác động Metro',
                      getNestedSectionVal('executiveSummary', 'impactOverrideReason', snapData, snapRight, snapJson),
                      getNestedSectionVal('executiveSummary', 'impactOverrideReason', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Đánh giá rủi ro chung (BRA)',
                      snapRight?.riskCard?.bra ?? getNestedSectionVal('executiveSummary', 'braStatus', snapData, snapRight, snapJson),
                      curRight?.riskCard?.bra ?? getNestedSectionVal('executiveSummary', 'braStatus', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Áp dụng phán quyết KST',
                      String(snapRight?.riskCard?.is_engineering_judgement_applied ?? false),
                      String(curRight?.riskCard?.is_engineering_judgement_applied ?? false)
                    )}
                    {renderCompareRow(
                      'Hành động phán quyết KST',
                      snapRight?.riskCard?.engineering_judgement_action ?? '---',
                      curRight?.riskCard?.engineering_judgement_action ?? '---'
                    )}
                    {renderCompareRow(
                      'Lý do phán quyết KST',
                      snapRight?.riskCard?.engineering_judgement_reason ?? '---',
                      curRight?.riskCard?.engineering_judgement_reason ?? '---'
                    )}
                    {renderCompareRow(
                      'Tổng hợp khuyết tật & nguy cơ chính',
                      getNestedSectionVal('executiveSummary', 'keyRisksDefectsText', snapData, snapRight, snapJson),
                      getNestedSectionVal('executiveSummary', 'keyRisksDefectsText', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Kết luận tóm tắt toàn diện',
                      getNestedSectionVal('executiveSummary', 'summaryConclusions', snapData, snapRight, snapJson),
                      getNestedSectionVal('executiveSummary', 'summaryConclusions', currentData, curRight, curJson)
                    )}
                    {renderCompareRow(
                      'Khuyến nghị kỹ thuật chi tiết',
                      getNestedSectionVal('executiveSummary', 'specificRecommendationsText', snapData, snapRight, snapJson),
                      getNestedSectionVal('executiveSummary', 'specificRecommendationsText', currentData, curRight, curJson)
                    )}
                  </div>
                </div>

                {/* Section 4: Chữ ký & Ý kiến hiện trường (Mục 09) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <span>6. Xác Nhận Chữ Ký, Biên Bản & Vắng Mặt (Mục 09)</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Họ tên Khảo sát viên',
                      snapJson?.signatures?.surveyorName || snapData?.surveyorName,
                      curJson?.signatures?.surveyorName || currentData?.surveyorName
                    )}
                    {renderCompareRow(
                      'SĐT Khảo sát viên',
                      getNestedSectionVal('signatures', 'surveyorPhone', snapData, snapLeft, snapJson),
                      getNestedSectionVal('signatures', 'surveyorPhone', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'Ngày khảo sát',
                      getParcelVal(snapLeft, 'surveyDate', snapData, snapJson),
                      getParcelVal(curLeft, 'surveyDate', currentData, curJson)
                    )}
                    {renderCompareRow(
                      'Chữ ký Khảo sát viên',
                      snapData?.surveyorSignatureUrl || snapJson?.signatures?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.surveyorSignatureUrl || curJson?.signatures?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có'
                    )}
                    {renderCompareRow(
                      'Chữ ký Chủ nhà / Đại diện',
                      snapData?.ownerSignatureUrl || snapJson?.signatures?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.ownerSignatureUrl || curJson?.signatures?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có'
                    )}
                    {renderCompareRow(
                      'Họ tên Người làm chứng / Địa phương',
                      getNestedSectionVal('signatures', 'witnessName', snapData, snapLeft, snapJson),
                      getNestedSectionVal('signatures', 'witnessName', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'Chức vụ / Đơn vị người làm chứng',
                      getNestedSectionVal('signatures', 'witnessRole', snapData, snapLeft, snapJson),
                      getNestedSectionVal('signatures', 'witnessRole', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'SĐT Người làm chứng',
                      getNestedSectionVal('signatures', 'witnessPhone', snapData, snapLeft, snapJson),
                      getNestedSectionVal('signatures', 'witnessPhone', currentData, curLeft, curJson)
                    )}
                    {renderCompareRow(
                      'Ý kiến của chủ hộ',
                      snapJson?.signatures?.ownerFeedback || snapData?.ownerRemarks,
                      curJson?.signatures?.ownerFeedback || currentData?.ownerRemarks
                    )}
                    {renderCompareRow(
                      'Khuyến nghị kỹ thuật',
                      snapData?.engineeringRecommendations || snapLeft?.conclusions?.recommendations,
                      currentData?.engineeringRecommendations || curLeft?.conclusions?.recommendations
                    )}
                  </div>
                </div>

                {/* Section 5: So Sánh Trực Quan Toàn Bộ Hồ Sơ Ảnh (Side-by-Side Visual Photo Diff) */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                          7. Đối Soát Trực Quan Hồ Sơ Ảnh (Side-by-Side Photo Diff)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Đối chiếu hình ảnh trực tiếp giữa Bản chụp v{selectedVerNumber} và Hiện tại v{latestVersionNumber}
                        </p>
                      </div>
                    </div>

                    {/* Category Filter Tab Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('DIFF_ONLY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          photoDiffTab === 'DIFF_ONLY'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>Chỉ xem ảnh có thay đổi</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          photoDiffTab === 'DIFF_ONLY' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
                        }`}>
                          {diffOnlyCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('IDENT')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'IDENT' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Định danh (P01..P04)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('SETTLEMENT')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'SETTLEMENT' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Lún nghiêng (Step 5)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('DEFECTS')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'DEFECTS' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Khuyết tật (Step 4)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('SPECIAL')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'SPECIAL' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Biên bản, Chữ ký & Khác
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('ALL')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'ALL' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tất cả ({photoDiffItems.length})
                      </button>
                    </div>
                  </div>

                  {/* Photo Diff Grid */}
                  {filteredPhotoDiffItems.length === 0 ? (
                    <div className="py-10 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 space-y-1">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-medium">
                        {photoDiffTab === 'DIFF_ONLY'
                          ? `Không có thay đổi hình ảnh nào giữa Phiên bản v${selectedVerNumber} và Hiện tại.`
                          : 'Không có ảnh nào trong chuyên mục này.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredPhotoDiffItems.map((item) => {
                        const isDiff = item.status !== 'UNCHANGED';
                        const oldRot = item.oldRotation || 0;
                        const newRot = item.newRotation || 0;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border transition-all overflow-hidden flex flex-col ${
                              isDiff
                                ? 'bg-amber-50/40 border-amber-300 shadow-sm'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="px-3.5 py-2.5 bg-white/90 border-b border-inherit flex items-center justify-between gap-2 shrink-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                  {item.categoryLabel}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 truncate" title={item.title}>
                                  {item.title}
                                </h4>
                              </div>

                              <div className="shrink-0">
                                {item.status === 'ADDED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    + Mới thêm ở Hiện tại
                                  </span>
                                )}
                                {item.status === 'REPLACED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3 text-amber-700" />
                                    Đã thay ảnh / Xoay góc
                                  </span>
                                )}
                                {item.status === 'REMOVED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                    - Đã xóa ở Hiện tại
                                  </span>
                                )}
                                {item.status === 'UNCHANGED' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    Không thay đổi
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Side-by-Side Comparison Body */}
                            <div className="grid grid-cols-2 gap-2 p-3 flex-1 bg-white/40">
                              {/* Left: Snapshot Version */}
                              <div className="flex flex-col space-y-1.5">
                                <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                                  <span>Bản chụp v{selectedVerNumber} {oldRot ? `(${oldRot}°)` : ''}</span>
                                  {item.oldUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber})`, rotation: oldRot })}
                                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                                      title="Phóng to ảnh"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                                {item.oldUrl ? (
                                  <div
                                    onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber})`, rotation: oldRot })}
                                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer flex items-center justify-center"
                                  >
                                    <img
                                      src={item.oldUrl}
                                      alt={`${item.title} (v${selectedVerNumber})`}
                                      style={{ transform: oldRot ? `rotate(${oldRot}deg)` : undefined }}
                                      className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                                      <Maximize2 className="w-3.5 h-3.5" />
                                      <span>Phóng to</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="aspect-video rounded-lg border border-dashed border-slate-300 bg-slate-100/70 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                    <Camera className="w-5 h-5 mb-1 opacity-50" />
                                    <span className="text-[10px] font-medium">Chưa có ảnh ở v{selectedVerNumber}</span>
                                  </div>
                                )}
                              </div>

                              {/* Right: Current State */}
                              <div className="flex flex-col space-y-1.5">
                                <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                                  <span>Hiện tại (v{latestVersionNumber}) {newRot ? `(${newRot}°)` : ''}</span>
                                  {item.newUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setZoomPhoto({ url: item.newUrl!, title: `${item.title} (Hiện tại)`, rotation: newRot })}
                                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                                      title="Phóng to ảnh"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                                {item.newUrl ? (
                                  <div
                                    onClick={() => setZoomPhoto({ url: item.newUrl!, title: `${item.title} (Hiện tại)`, rotation: newRot })}
                                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer flex items-center justify-center"
                                  >
                                    <img
                                      src={item.newUrl}
                                      alt={`${item.title} (Hiện tại)`}
                                      style={{ transform: newRot ? `rotate(${newRot}deg)` : undefined }}
                                      className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                                      <Maximize2 className="w-3.5 h-3.5" />
                                      <span>Phóng to</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="aspect-video rounded-lg border border-dashed border-rose-300 bg-rose-50/50 flex flex-col items-center justify-center text-rose-400 p-2 text-center">
                                    <Camera className="w-5 h-5 mb-1 opacity-50" />
                                    <span className="text-[10px] font-medium">Đã xóa / Không có ảnh</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {item.note && (
                              <div className="px-3.5 py-1.5 bg-slate-100/80 border-t border-inherit text-[11px] text-slate-600 italic">
                                {item.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Full Snapshot View */
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Full Snapshot Info Callout */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900">
                        Bản Chụp Toàn Diện Hiện Trạng: Phiên Bản v{selectedVerNumber ?? 0}
                      </h4>
                      {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Lưu vết bất biến lúc {selectedVerItem?.createdAt ? new Date(selectedVerItem.createdAt).toLocaleString('vi-VN') : '---'} bởi{' '}
                      <strong className="text-slate-900">{selectedVerItem?.createdByName || 'Hệ thống'}</strong>
                      {selectedVerItem?.editReason && (
                        <span> — Lý do: &ldquo;{selectedVerItem.editReason}&rdquo;</span>
                      )}
                    </p>
                  </div>
                </div>
                {!isSelectedCurrent && selectedVerNumber !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setRollbackError('');
                      setShowRollbackPrompt(true);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi Phục Theo Bản Chụp v{selectedVerNumber}</span>
                  </button>
                )}
              </div>

              {/* Section 1: Thông tin Thửa đất & Chủ sở hữu (Mục 01) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>1. Thông Tin Định Danh & Thửa Đất (Mục 01)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Tên công trình / Tòa nhà', getParcelVal(snapLeft, 'buildingName', snapData, snapJson))}
                  {renderSnapshotField('Loại hình công trình', getParcelVal(snapLeft, 'buildingType', snapData, snapJson))}
                  {renderSnapshotField('Phân nhóm đối tượng', getParcelVal(snapLeft, 'objectGroup', snapData, snapJson))}
                  {renderSnapshotField('Mã căn hộ / Unit', getParcelVal(snapLeft, 'unitCode', snapData, snapJson))}
                  {renderSnapshotField('Tầng căn hộ', getParcelVal(snapLeft, 'unitFloorNumber', snapData, snapJson))}
                  {renderSnapshotField('Số nhà', getParcelVal(snapLeft, 'houseNumber', snapData, snapJson))}
                  {renderSnapshotField('Đường / Phố', getParcelVal(snapLeft, 'street', snapData, snapJson))}
                  {renderSnapshotField('Phường / Xã', getParcelVal(snapLeft, 'ward', snapData, snapJson))}
                  {renderSnapshotField('Quận / Huyện', getParcelVal(snapLeft, 'district', snapData, snapJson))}
                  {renderSnapshotField('Tên chủ hộ', getParcelVal(snapLeft, 'ownerName', snapData, snapJson))}
                  {renderSnapshotField('Số điện thoại', getParcelVal(snapLeft, 'ownerPhone', snapData, snapJson))}
                  {renderSnapshotField('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode', snapData, snapJson))}
                  {renderSnapshotField('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2', snapData, snapJson))}
                  {renderSnapshotField('Diện tích xây dựng (m²)', getParcelVal(snapLeft, 'constructionAreaM2', snapData, snapJson))}
                  {renderSnapshotField('Tổng diện tích sàn (m²)', getParcelVal(snapLeft, 'totalFloorAreaM2', snapData, snapJson))}
                  {renderSnapshotField('Chiều rộng MT (m)', getParcelVal(snapLeft, 'frontageWidth', snapData, snapJson))}
                  {renderSnapshotField('Chiều sâu thửa (m)', getParcelVal(snapLeft, 'lotDepth', snapData, snapJson))}
                  {renderSnapshotField('Tọa độ GPS', getParcelVal(snapLeft, 'gpsCoords', snapData, snapJson))}
                  {renderSnapshotField('Khoảng cách tim Metro (m)', getParcelVal(snapLeft, 'metroOffsetDistance', snapData, snapJson))}
                  {renderSnapshotField('Khoảng cách mép ga (m)', getParcelVal(snapLeft, 'clearanceOffsetDistance', snapData, snapJson))}
                  {renderSnapshotField('Lý trình (Chainage)', getParcelVal(snapLeft, 'chainage', snapData, snapJson))}
                  {renderSnapshotField('Trường hợp khảo sát', getParcelVal(snapLeft, 'surveyCaseType', snapData, snapJson))}
                  {renderSnapshotField('Ghi chú đất trống', getParcelVal(snapLeft, 'vacantLandNotes', snapData, snapJson))}
                  {renderSnapshotField('Ghi chú thi công', getParcelVal(snapLeft, 'constructionStageNotes', snapData, snapJson))}
                </div>
              </div>

              {/* Section 2: Thông số kỹ thuật, Móng & Lịch sử công trình (Mục 02 & 03) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>2. Thông Số Kỹ Thuật, Móng & Lịch Sử Công Trình (Mục 02 & 03)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Hệ kết cấu chính', getSpecVal(snapLeft, 'structureSystem', snapData, snapJson))}
                  {renderSnapshotField('Số tầng nổi', getSpecVal(snapLeft, 'floorCount', snapData, snapJson))}
                  {renderSnapshotField('Số tầng hầm', getSpecVal(snapLeft, 'basementCount', snapData, snapJson))}
                  {renderSnapshotField('Chiều cao công trình (m)', getSpecVal(snapLeft, 'buildingHeightM', snapData, snapJson))}
                  {renderSnapshotField('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction', snapData, snapJson))}
                  {renderSnapshotField('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated', snapData, snapJson)))}
                  {renderSnapshotField('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction', snapData, snapJson))}
                  {renderSnapshotField('Loại móng chi tiết', getSpecVal(snapLeft, 'foundationType', snapData, snapJson))}
                  {renderSnapshotField(
                    'Cấp móng (CAT)',
                    snapLeft?.specs?.foundationCatScore ?? snapData?.foundationCatScore ?? '---',
                    snapLeft?.specs?.foundationCatScore ? `CAT ${snapLeft.specs.foundationCatScore}` : undefined
                  )}
                  {renderSnapshotField('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM', snapData, snapJson))}
                  {renderSnapshotField('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM', snapData, snapJson))}
                  {renderSnapshotField('Kích thước cọc / đài (mm)', getSpecVal(snapLeft, 'pileDimensionMm', snapData, snapJson))}
                  {renderSnapshotField('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes', snapData, snapJson))}
                  {renderSnapshotField('Công trình liền kề', getSpecVal(snapLeft, 'adjacentBuildings', snapData, snapJson))}
                  {renderSnapshotField('Cải tạo / Nâng tầng', getNestedSectionVal('historyInterview', 'renovationLoad', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Năm cải tạo', getNestedSectionVal('historyInterview', 'renovationYear', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Sửa chữa lớn kết cấu', getNestedSectionVal('historyInterview', 'majorRepair', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Lịch sử lún / nghiêng', getNestedSectionVal('historyInterview', 'pastSettlement', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Ảnh hưởng nhà kế bên', getNestedSectionVal('historyInterview', 'neighborDamage', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Sự cố cháy nổ / ngập', getNestedSectionVal('historyInterview', 'fireFloodIncident', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Thiết bị nhạy cảm rung', getNestedSectionVal('historyInterview', 'sensitiveEquipment', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Vận hành 24/7', getNestedSectionVal('historyInterview', 'continuousOperation247', snapData, snapLeft, snapJson))}
                </div>

                {/* As-Built Drawings */}
                {snapData?.asBuiltDrawings && snapData.asBuiltDrawings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      Bản vẽ hoàn công đính kèm ({snapData.asBuiltDrawings.length}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {snapData.asBuiltDrawings.map((drawing: SnapshotPhotoNode, idx: number) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                          {drawing.photoUrl ? (
                            <img
                              src={drawing.photoUrl}
                              alt={drawing.title || `Bản vẽ ${idx + 1}`}
                              className="w-full h-24 object-cover rounded mb-1"
                            />
                          ) : (
                            <div className="w-full h-24 bg-slate-100 rounded flex items-center justify-center text-slate-400 mb-1">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                          <p className="text-[11px] font-medium text-slate-700 truncate">
                            {drawing.title || `Bản vẽ ${idx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Mặt bằng các tầng, Burland & Biến động GIS (Mục 04, 05, 06) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>3. Mặt Bằng Các Tầng, Tổng Hợp Burland & Phạm Vi GIS (Mục 04, 05, 06)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-2">
                  {renderSnapshotField('Cấp Burland cực đại cục bộ', getNestedSectionVal('burlandSummary', 'localMaxGrade', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Cấp Burland phổ biến', getNestedSectionVal('burlandSummary', 'predominantGrade', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Cờ cảnh báo kết cấu', getNestedSectionVal('burlandSummary', 'structuralFlagLevel', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Vùng hư hại quyết định', getNestedSectionVal('burlandSummary', 'governingZoneCode', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Tính đại diện mẫu', getNestedSectionVal('burlandSummary', 'representativeness', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Cần KS kết cấu thẩm định', getNestedSectionVal('burlandSummary', 'needStructuralEngineerReview', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Nhận xét tổng hợp Burland', getNestedSectionVal('burlandSummary', 'evaluationNotes', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Mức độ tiếp cận', getNestedSectionVal('accessLimitation', 'type', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Lý do hạn chế tiếp cận', getNestedSectionVal('accessLimitation', 'mainReason', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Khu vực hạn chế tiếp cận', getNestedSectionVal('accessLimitation', 'restrictedAreas', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Loại biến động ranh GIS', getNestedSectionVal('gisMutationConfirmed', 'type', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Ghi chú biến động GIS', getNestedSectionVal('gisMutationConfirmed', 'adminNotes', snapData, snapLeft, snapJson))}
                </div>
                {(() => {
                  const floors = snapRight?.floors || snapData?.floors || snapJson?.floors || [];
                  if (!Array.isArray(floors) || floors.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 italic py-2">
                        Không có dữ liệu mặt bằng tầng trong bản chụp này.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {floors.map((floor: SnapshotFloorNode, fIdx: number) => {
                        const zones = floor.damageZones || floor.zones || [];
                        return (
                          <div key={fIdx} className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Building className="w-4 h-4 text-indigo-600" />
                                <span>{floor.floorName || `Tầng ${floor.floorNumber ?? fIdx + 1}`}</span>
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {zones.length} Vùng hư hại (Z)
                              </span>
                            </div>

                            {zones.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Không có vùng hư hại trên tầng này.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {zones.map((zone: SnapshotZoneNode, zIdx: number) => {
                                  const defects = zone.defects || zone.defectItems || [];
                                  return (
                                    <div key={zIdx} className="bg-white rounded-lg p-2.5 border border-slate-200 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-700">
                                          {zone.zoneCode || `Z${zIdx + 1}`}: {zone.zoneName || 'Vùng hư hại'}
                                        </span>
                                        {zone.cadPins && (
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            📍 X: {zone.cadPins.xPercent ?? zone.cadPins.x ?? 0}%, Y: {zone.cadPins.yPercent ?? zone.cadPins.y ?? 0}%
                                          </span>
                                        )}
                                      </div>
                                      {defects.length > 0 && (
                                        <div className="text-[11px] text-slate-700 space-y-0.5">
                                          {defects.map((def: SnapshotDefectNode, dIdx: number) => (
                                            <div key={dIdx} className="flex items-center gap-1.5 text-slate-700">
                                              <span className="text-amber-500 font-bold">•</span>
                                              <span className="font-mono font-bold text-indigo-700">{def.defectCode || `D${dIdx + 1}`}:</span>
                                              <span>{def.defectType || def.description || 'Khuyết tật'}</span>
                                              {def.severity && (
                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                                  Cấp {def.severity}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Section 4: Bảng điểm rủi ro (ECS / VI / BRA) & Kết luận (Mục 07 & 08) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>4. Đánh Giá Rủi Ro (ECS / VI / BRA), Gate & Kết Luận (Mục 07 & 08)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {renderSnapshotField('E1 - Hạng nứt Burland', snapRight?.riskCard?.e1_burland_score ?? getNestedSectionVal('ecs', 'e1', snapData, snapRight, snapJson))}
                  {renderSnapshotField('E2 - Khuyết tật kết cấu', snapRight?.riskCard?.e2_structure_score ?? getNestedSectionVal('ecs', 'e2', snapData, snapRight, snapJson))}
                  {renderSnapshotField('E3 - Biến dạng lún nghiêng', snapRight?.riskCard?.e3_deformation_score ?? getNestedSectionVal('ecs', 'e3', snapData, snapRight, snapJson))}
                  {renderSnapshotField('E4 - Hiện trạng vật liệu', snapRight?.riskCard?.e4_material_score ?? getNestedSectionVal('ecs', 'e4', snapData, snapRight, snapJson))}
                  {renderSnapshotField('E5 - Lịch sử công trình', snapRight?.riskCard?.e5_history_score ?? getNestedSectionVal('ecs', 'e5', snapData, snapRight, snapJson))}
                  {renderSnapshotField('E6 - Công năng & Môi trường', snapRight?.riskCard?.e6_overall_function_score ?? getNestedSectionVal('ecs', 'e6', snapData, snapRight, snapJson))}
                  {renderSnapshotField(
                    'Tổng điểm ECS',
                    snapRight?.riskCard?.total_ecs_score ?? getNestedSectionVal('ecs', 'totalEcs', snapData, snapRight, snapJson),
                    snapRight?.riskCard?.ecs_class ? `Hạng ${snapRight.riskCard.ecs_class}` : undefined
                  )}
                  {renderSnapshotField(
                    'Điểm thành phần VI (V1..V6)',
                    ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((k) => `${k.toUpperCase()}:${getNestedSectionVal('vi', k, snapData, snapRight, snapJson)}`).join(' | ')
                  )}
                  {renderSnapshotField(
                    'Điểm tổn thương VI trung bình',
                    snapRight?.riskCard?.avg_vi_score ?? getNestedSectionVal('vi', 'avgVi', snapData, snapRight, snapJson),
                    snapRight?.riskCard?.vi_class ? `Hạng ${snapRight.riskCard.vi_class}` : undefined
                  )}
                  {renderSnapshotField('Quyết định cổng dữ liệu (Gate)', getParcelVal(snapRight, 'gateDecision', snapData, snapJson))}
                  {renderSnapshotField('Ghi chú cổng dữ liệu', getParcelVal(snapRight, 'gateNotes', snapData, snapJson))}
                  {renderSnapshotField('Đánh giá rủi ro chung (BRA)', snapRight?.riskCard?.bra ?? getNestedSectionVal('executiveSummary', 'braStatus', snapData, snapRight, snapJson), snapRight?.riskCard?.bra)}
                  {renderSnapshotField('Cấp độ tác động thi công (I)', snapRight?.riskCard?.construction_impact_level_i ?? getNestedSectionVal('executiveSummary', 'constructionImpactStatus', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Lý do can thiệp Impact', getNestedSectionVal('executiveSummary', 'impactOverrideReason', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Phán quyết KST áp dụng', String(snapRight?.riskCard?.is_engineering_judgement_applied ?? false))}
                  {renderSnapshotField('Hành động phán quyết', snapRight?.riskCard?.engineering_judgement_action ?? '---')}
                  {renderSnapshotField('Khuyết tật & nguy cơ chính', getNestedSectionVal('executiveSummary', 'keyRisksDefectsText', snapData, snapRight, snapJson))}
                  {renderSnapshotField('Kết luận tóm tắt toàn diện', getNestedSectionVal('executiveSummary', 'summaryConclusions', snapData, snapRight, snapJson))}
                </div>
                {snapRight?.riskCard?.is_engineering_judgement_applied && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs space-y-1">
                    <span className="font-bold text-purple-800">Lý do can thiệp chuyên gia:</span>
                    <p className="text-slate-700 italic">{snapRight?.riskCard?.engineering_judgement_reason || 'Không có lý do chi tiết'}</p>
                  </div>
                )}
              </div>

              {/* Section 5: Hồ sơ ảnh & Biên bản (Mục 09) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>5. Hồ Sơ Ảnh Hiện Trường & Chữ Ký Biên Bản (Mục 09)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Họ tên Khảo sát viên', snapJson?.signatures?.surveyorName || snapData?.surveyorName)}
                  {renderSnapshotField('SĐT Khảo sát viên', getNestedSectionVal('signatures', 'surveyorPhone', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Ngày khảo sát', getParcelVal(snapLeft, 'surveyDate', snapData, snapJson))}
                  {renderSnapshotField('Chữ ký KSV', snapData?.surveyorSignatureUrl || snapJson?.signatures?.surveyorSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Chữ ký Chủ nhà / Đại diện', snapData?.ownerSignatureUrl || snapJson?.signatures?.ownerSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Người làm chứng / Địa phương', getNestedSectionVal('signatures', 'witnessName', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Chức vụ người làm chứng', getNestedSectionVal('signatures', 'witnessRole', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('SĐT người làm chứng', getNestedSectionVal('signatures', 'witnessPhone', snapData, snapLeft, snapJson))}
                  {renderSnapshotField('Ý kiến của chủ hộ', snapJson?.signatures?.ownerFeedback || snapData?.ownerRemarks)}
                  {renderSnapshotField('Khuyến nghị kỹ thuật', snapData?.engineeringRecommendations || snapLeft?.conclusions?.recommendations)}
                </div>

                {/* Visual Photo Gallery of Snapshot */}
                {(() => {
                  const snapPhotos = photoDiffItems.filter((item) => Boolean(item.oldUrl));
                  if (snapPhotos.length === 0) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <span className="text-xs font-bold text-slate-700 block">
                        Thư viện ảnh ghi nhận trong Bản chụp v{selectedVerNumber ?? 0} ({snapPhotos.length} ảnh):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {snapPhotos.map((item) => {
                          const oldRot = item.oldRotation || 0;
                          return (
                            <div
                              key={item.id}
                              className="bg-slate-50 rounded-xl p-2 border border-slate-200 flex flex-col space-y-1.5 group"
                            >
                              <div
                                onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber ?? 0})`, rotation: oldRot })}
                                className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 cursor-pointer flex items-center justify-center"
                              >
                                <img
                                  src={item.oldUrl!}
                                  alt={item.title}
                                  style={{ transform: oldRot ? `rotate(${oldRot}deg)` : undefined }}
                                  className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Maximize2 className="w-4 h-4" />
                                </div>
                              </div>
                              <div className="text-[11px] leading-tight">
                                <span className="font-bold text-slate-800 block truncate" title={item.title}>
                                  {item.title} {oldRot ? `(${oldRot}°)` : ''}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {item.categoryLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Section 6: Bản Chụp Dữ Liệu JSON (Raw Snapshot) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-indigo-600" />
                    <span>6. Bản Chụp Dữ Liệu Gốc (Raw Snapshot JSON)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(snapData, null, 2));
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedJson ? 'Đã sao chép!' : 'Sao chép JSON'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRawJson ? 'rotate-180' : ''}`} />
                      <span>{showRawJson ? 'Thu gọn' : 'Xem chi tiết JSON'}</span>
                    </button>
                  </div>
                </div>

                {showRawJson && (
                  <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 max-h-96 overflow-y-auto overflow-x-auto whitespace-pre">
                    {JSON.stringify(snapData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>
              Cơ chế bất biến (Immutable Append-Only): Mọi hành động hoàn nguyên đều tạo phiên bản mới v
              {latestVersionNumber + 1} và bảo toàn 100% lịch sử kiểm toán.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>

      {/* Rollback Confirmation Sub-dialog (Light Theme) */}
      {showRollbackPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900">
                  Xác Nhận Khôi Phục Về Phiên Bản v{selectedVerNumber}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Dữ liệu đang hoạt động của hồ sơ sẽ được hoàn nguyên về trạng thái của Phiên bản v
                  {selectedVerNumber}. Hành động này sẽ tạo thêm Phiên bản mới{' '}
                  <strong className="text-indigo-700">v{latestVersionNumber + 1}</strong> để lưu vết và giữ nguyên toàn bộ lịch sử trước đó.
                </p>
              </div>
            </div>

            {rollbackError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{rollbackError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteRollback} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do kỹ thuật hoàn nguyên <span className="text-rose-600">*</span>:
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Ví dụ: Hoàn nguyên lại số liệu kết cấu ban đầu do admin trước tính sai tải trọng cải tạo..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu tài khoản Quản trị viên <span className="text-rose-600">*</span>:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tài khoản đăng nhập của bạn..."
                    required
                    className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => setShowRollbackPrompt(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isRollingBack ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang khôi phục...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xác nhận hoàn nguyên</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Photo Dialog */}
      {zoomPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs">
              <span className="font-bold text-slate-800 truncate pr-4">
                {zoomPhoto.title} {zoomPhoto.rotation ? `(${zoomPhoto.rotation}°)` : ''}
              </span>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/70 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center overflow-auto max-h-[82vh] bg-slate-900">
              <img
                src={zoomPhoto.url}
                alt={zoomPhoto.title}
                style={{ transform: zoomPhoto.rotation ? `rotate(${zoomPhoto.rotation}deg)` : undefined }}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
