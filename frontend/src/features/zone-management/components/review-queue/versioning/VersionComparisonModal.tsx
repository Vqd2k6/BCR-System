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
  diffSummary?: any[];
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode?: string;
  reportCode?: string;
  currentData: any; // Full AuditStepwiseData
  onClose: () => void;
  onRollbackSuccess: () => void;
}

export const VersionComparisonModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  reportCode,
  currentData,
  onClose,
  onRollbackSuccess,
}) => {
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versions, setVersions] = useState<SurveyReportVersionItem[]>([]);
  const [selectedVerNumber, setSelectedVerNumber] = useState<number | null>(null);

  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Dual-mode state: Diff vs Full Snapshot
  const [viewMode, setViewMode] = useState<'DIFF' | 'FULL_SNAPSHOT'>('DIFF');
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Photo comparison tab state: 'DIFF_ONLY' | 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL' | 'ALL'
  const [photoDiffTab, setPhotoDiffTab] = useState<'DIFF_ONLY' | 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL' | 'ALL'>('DIFF_ONLY');
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);

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

  // Extract comparable data from snapshot & currentData
  const snapData = selectedSnapshot?.snapshotData || {};
  const snapLeft = snapData.leftPane || {};
  const snapRight = snapData.rightPane || {};
  const snapJson = snapData.surveyJson || {};

  const curLeft = currentData?.leftPane || {};
  const curRight = currentData?.rightPane || {};
  const curJson = currentData?.surveyJson || {};

  // Extraction helpers
  const getParcelVal = (pane: any, field: string) => pane?.parcel?.[field] ?? pane?.[field] ?? '---';
  const getSpecVal = (pane: any, field: string) => pane?.specs?.[field] ?? '---';

  interface PhotoDiffItem {
    id: string;
    category: 'IDENT' | 'SETTLEMENT' | 'DEFECTS' | 'SPECIAL';
    categoryLabel: string;
    title: string;
    code?: string;
    oldUrl?: string | null;
    newUrl?: string | null;
    status: 'UNCHANGED' | 'ADDED' | 'REPLACED' | 'REMOVED';
    note?: string;
  }

  // Calculate comprehensive visual photo diff between snapshot and current state
  const photoDiffItems = useMemo<PhotoDiffItem[]>(() => {
    const items: PhotoDiffItem[] = [];

    const getUrl = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val.trim() || null;
      if (typeof val === 'object' && val.url) return String(val.url).trim() || null;
      if (typeof val === 'object' && val.photoUrl) return String(val.photoUrl).trim() || null;
      return null;
    };

    const getStatus = (oldU: string | null, newU: string | null): 'UNCHANGED' | 'ADDED' | 'REPLACED' | 'REMOVED' => {
      if (!oldU && newU) return 'ADDED';
      if (oldU && !newU) return 'REMOVED';
      if (oldU && newU && oldU !== newU) return 'REPLACED';
      return 'UNCHANGED';
    };

    // 1. Identification Photos (P01..P04)
    const snapIdent = snapData?.identificationPhotos || snapLeft?.identificationPhotos || snapJson?.identificationPhotos || {};
    const curIdent = currentData?.identificationPhotos || curLeft?.identificationPhotos || curJson?.identificationPhotos || {};

    const identDefs = [
      { key: 'photoP01', code: 'P-01', title: 'P-01: Biển số nhà & Mặt tiền cận', snapKey: 'photoP01' },
      { key: 'photoP02', code: 'P-02', title: 'P-02: Toàn cảnh mặt tiền công trình', snapKey: 'photoP02' },
      { key: 'photoP03', code: 'P-03', title: 'P-03: Hiện trạng mặt bên / mặt sau', snapKey: 'photoP03' },
      { key: 'photoP04', code: 'P-04', title: 'P-04: Không gian & kết cấu lân cận', snapKey: 'photoP04' },
    ];

    identDefs.forEach((d) => {
      const oldU = getUrl(snapIdent[d.key]?.url || snapIdent[d.key]?.rawUrl || snapJson?.[d.snapKey]?.url);
      const newU = getUrl(curIdent[d.key]?.url || curIdent[d.key]?.rawUrl || curJson?.[d.snapKey]?.url);

      if (oldU || newU) {
        items.push({
          id: `ident_${d.code}`,
          category: 'IDENT',
          categoryLabel: 'Ảnh định danh',
          title: d.title,
          code: d.code,
          oldUrl: oldU,
          newUrl: newU,
          status: getStatus(oldU, newU),
        });
      }
    });

    // P-03 Supplementary Photos
    const oldP03Add: any[] = Array.isArray(snapIdent?.photoP03?.additionalPhotos) ? snapIdent.photoP03.additionalPhotos : (Array.isArray(snapJson?.photoP03?.additionalPhotos) ? snapJson.photoP03.additionalPhotos : []);
    const newP03Add: any[] = Array.isArray(curIdent?.photoP03?.additionalPhotos) ? curIdent.photoP03.additionalPhotos : (Array.isArray(curJson?.photoP03?.additionalPhotos) ? curJson.photoP03.additionalPhotos : []);
    const maxP03Add = Math.max(oldP03Add.length, newP03Add.length);
    for (let i = 0; i < maxP03Add; i++) {
      const oldU = getUrl(oldP03Add[i]);
      const newU = getUrl(newP03Add[i]);
      if (oldU || newU) {
        items.push({
          id: `ident_P03_add_${i + 1}`,
          category: 'IDENT',
          categoryLabel: 'Ảnh định danh P-03 bổ sung',
          title: `P-03 (Bổ sung ${i + 1}): Mặt bên / mặt sau góc phụ`,
          code: `P-03-EXTRA-${i + 1}`,
          oldUrl: oldU,
          newUrl: newU,
          status: getStatus(oldU, newU),
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
      const pOld: any[] = Array.isArray(st.photosOld) ? st.photosOld : [];
      const pNew: any[] = Array.isArray(st.photosNew) ? st.photosNew : [];
      const maxLen = Math.max(pOld.length, pNew.length);
      for (let i = 0; i < maxLen; i++) {
        const oldU = getUrl(pOld[i]);
        const newU = getUrl(pNew[i]);
        if (oldU || newU) {
          items.push({
            id: `st_${st.code}_${i + 1}`,
            category: 'SETTLEMENT',
            categoryLabel: `Lún nghiêng - ${st.label}`,
            title: `${st.label} (Ảnh #${i + 1})`,
            code: `${st.code}-${i + 1}`,
            oldUrl: oldU,
            newUrl: newU,
            status: getStatus(oldU, newU),
            note: (typeof pNew[i] === 'object' && pNew[i]?.description) || (typeof pOld[i] === 'object' && pOld[i]?.description) || undefined,
          });
        }
      }
    });

    // 3. Defects & Damage Zones (Step 3)
    const getZoneList = (data: any, json: any): any[] => {
      if (Array.isArray(data?.damageZones) && data.damageZones.length > 0) return data.damageZones;
      if (Array.isArray(data?.rightPane?.damageZones) && data.rightPane.damageZones.length > 0) return data.rightPane.damageZones;
      if (Array.isArray(data?.floors) && data.floors.length > 0) {
        const zArr: any[] = [];
        data.floors.forEach((fl: any) => {
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
      ...snapZones.map((z: any) => z.zoneCode || z.zone_code || z.id),
      ...curZones.map((z: any) => z.zoneCode || z.zone_code || z.id)
    ])).filter(Boolean);

    allZoneCodes.forEach((zCode) => {
      const sZone = snapZones.find((z: any) => (z.zoneCode || z.zone_code || z.id) === zCode);
      const cZone = curZones.find((z: any) => (z.zoneCode || z.zone_code || z.id) === zCode);

      // CTX Overview Photo
      const oldCtx = getUrl(sZone?.ctxPhotoUrl || sZone?.ctx_photo_url || sZone?.photoUrl);
      const newCtx = getUrl(cZone?.ctxPhotoUrl || cZone?.ctx_photo_url || cZone?.photoUrl);
      if (oldCtx || newCtx) {
        items.push({
          id: `zone_ctx_${zCode}`,
          category: 'DEFECTS',
          categoryLabel: `Vùng hư hại ${zCode}`,
          title: `Ảnh toàn cảnh (CTX) - ${sZone?.zoneName || cZone?.zoneName || zCode}`,
          code: `${zCode}-CTX`,
          oldUrl: oldCtx,
          newUrl: newCtx,
          status: getStatus(oldCtx, newCtx),
        });
      }

      // Defects CU Photos
      const sDefects: any[] = Array.isArray(sZone?.defects || sZone?.defectItems) ? (sZone?.defects || sZone?.defectItems) : [];
      const cDefects: any[] = Array.isArray(cZone?.defects || cZone?.defectItems) ? (cZone?.defects || cZone?.defectItems) : [];

      const allDefCodes = Array.from(new Set([
        ...sDefects.map((d: any) => d.defectCode || d.defect_code || d.id),
        ...cDefects.map((d: any) => d.defectCode || d.defect_code || d.id)
      ])).filter(Boolean);

      allDefCodes.forEach((dCode) => {
        const sDef = sDefects.find((d: any) => (d.defectCode || d.defect_code || d.id) === dCode);
        const cDef = cDefects.find((d: any) => (d.defectCode || d.defect_code || d.id) === dCode);

        const oldCu = getUrl(sDef?.cuPhotoUrl || sDef?.cu_photo_url || (Array.isArray(sDef?.cuPhotos) ? sDef?.cuPhotos[0] : null));
        const newCu = getUrl(cDef?.cuPhotoUrl || cDef?.cu_photo_url || (Array.isArray(cDef?.cuPhotos) ? cDef?.cuPhotos[0] : null));

        if (oldCu || newCu) {
          items.push({
            id: `defect_cu_${zCode}_${dCode}`,
            category: 'DEFECTS',
            categoryLabel: `Khuyết tật ${zCode} / ${dCode}`,
            title: `Ảnh cận cảnh (CU) - ${cDef?.defectType || sDef?.defectType || dCode}`,
            code: `${dCode}-CU`,
            oldUrl: oldCu,
            newUrl: newCu,
            status: getStatus(oldCu, newCu),
            note: cDef?.widthMaxMm ? `Bề rộng nứt: ${cDef.widthMaxMm}mm` : (sDef?.widthMaxMm ? `Bề rộng nứt: ${sDef.widthMaxMm}mm` : undefined),
          });
        }
      });
    });

    // 4. Special Photos (Signatures, Vacant Land, Construction)
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

    const oldVacant: any[] = Array.isArray(snapJson?.vacantLandPhotos) ? snapJson.vacantLandPhotos : (Array.isArray(snapData?.vacantLandPhotos) ? snapData.vacantLandPhotos : []);
    const newVacant: any[] = Array.isArray(curJson?.vacantLandPhotos) ? curJson.vacantLandPhotos : (Array.isArray(currentData?.vacantLandPhotos) ? currentData.vacantLandPhotos : []);
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

    const oldConst: any[] = Array.isArray(snapJson?.constructionPhotos) ? snapJson.constructionPhotos : (Array.isArray(snapData?.constructionPhotos) ? snapData.constructionPhotos : []);
    const newConst: any[] = Array.isArray(curJson?.constructionPhotos) ? curJson.constructionPhotos : (Array.isArray(currentData?.constructionPhotos) ? currentData.constructionPhotos : []);
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
      const res = await api.post(`/admin/reports/${reportId}/versions/${selectedVerNumber}/rollback`, {
        adminPassword: adminPassword.trim(),
        rollbackReason: rollbackReason.trim(),
      });

      if (res.data?.success) {
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
  const renderCompareRow = (label: string, oldVal: any, newVal: any) => {
    const isDifferent = String(oldVal ?? '').trim() !== String(newVal ?? '').trim();
    return (
      <div
        className={`py-2 px-3 rounded-lg border text-xs grid grid-cols-2 gap-4 transition-colors ${
          isDifferent
            ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-medium'
            : 'bg-white border-slate-100 text-slate-700'
        }`}
      >
        <div className="flex items-start justify-between pr-2 border-r border-slate-200/60">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className="font-semibold text-right break-words">{String(oldVal ?? '---')}</span>
        </div>
        <div className="flex items-start justify-between pl-2">
          <span className="text-slate-500 font-normal shrink-0 mr-2">{label}:</span>
          <span className={`font-semibold text-right break-words ${isDifferent ? 'text-amber-800' : ''}`}>
            {String(newVal ?? '---')}
            {isDifferent && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                Khác biệt
              </span>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Helper row renderer for full snapshot inspection
  const renderSnapshotField = (label: string, val: any, badge?: string) => (
    <div className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs flex items-start justify-between gap-2">
      <span className="text-slate-400 font-normal shrink-0">{label}:</span>
      <div className="flex items-center gap-1.5 text-right font-semibold text-slate-200">
        <span className="break-words">{String(val ?? '---')}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl h-[92vh] overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  So Sánh Phiên Bản & Hoàn Nguyên Thời Gian
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Time-Travel Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Thửa đất: <strong className="text-white">{parcelCode || '---'}</strong> • Mã báo cáo:{' '}
                <strong className="text-slate-300">{reportCode || '---'}</strong>
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
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi Phục Về v{selectedVerNumber}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Version Picker Carousel & Dual-Mode Tabs */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              Phiên bản:
            </span>

            <div className="flex items-center gap-2">
              {versions.map((v) => {
                const isSelected = v.versionNumber === selectedVerNumber;
                const isCurrent = v.versionNumber === latestVersionNumber;
                return (
                  <button
                    key={v.id || v.versionNumber}
                    type="button"
                    onClick={() => setSelectedVerNumber(v.versionNumber)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="font-mono font-bold">v{v.versionNumber}</span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                        Hiện tại
                      </span>
                    )}
                    <span className="text-[11px] opacity-80 truncate max-w-[130px]">{v.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual-Mode Tabs */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('DIFF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'DIFF'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Đối Soát Sai Khác (Diff)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FULL_SNAPSHOT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'FULL_SNAPSHOT'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Bản Xem Đầy Đủ (Full Snapshot)</span>
            </button>
          </div>
        </div>

        {/* Version Metadata Banner */}
        {selectedVerItem && (
          <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-indigo-300">
                Phiên bản v{selectedVerItem.versionNumber}: {selectedVerItem.title}
              </span>
              {getTagBadge(selectedVerItem.versionTag)}
              {selectedVerItem.editReason && (
                <span className="text-slate-400 italic">Lý do: &ldquo;{selectedVerItem.editReason}&rdquo;</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {selectedVerItem.createdByName || 'Hệ thống'} ({selectedVerItem.createdByRole || 'ADMIN'})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date(selectedVerItem.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        )}

        {/* Comparison Workspace (Diff or Full Snapshot) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/30">
          {loadingSnapshot ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Đang tải dữ liệu bản chụp phiên bản v{selectedVerNumber}...</span>
            </div>
          ) : viewMode === 'DIFF' ? (
            <>
              {/* Header titles for 2 columns */}
              <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-900/90 text-xs font-bold text-slate-300 shrink-0">
                <div className="p-3 border-r border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>Dữ Liệu Bản Chụp: Phiên Bản v{selectedVerNumber}</span>
                  </div>
                  {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                </div>
                <div className="p-3 flex items-center justify-between bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Dữ Liệu Hiện Tại: Phiên Bản v{latestVersionNumber} (Active)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Đang áp dụng
                  </span>
                </div>
              </div>

              {/* Scrollable comparison lists */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Section 1: Thửa đất & Chủ hộ */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>1. Thông Tin Định Danh & Thửa Đất</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Số nhà', getParcelVal(snapLeft, 'houseNumber'), getParcelVal(curLeft, 'houseNumber'))}
                    {renderCompareRow('Đường / Phố', getParcelVal(snapLeft, 'street'), getParcelVal(curLeft, 'street'))}
                    {renderCompareRow('Phường / Xã', getParcelVal(snapLeft, 'ward'), getParcelVal(curLeft, 'ward'))}
                    {renderCompareRow('Quận / Huyện', getParcelVal(snapLeft, 'district'), getParcelVal(curLeft, 'district'))}
                    {renderCompareRow('Chủ hộ', getParcelVal(snapLeft, 'ownerName'), getParcelVal(curLeft, 'ownerName'))}
                    {renderCompareRow('SĐT chủ hộ', getParcelVal(snapLeft, 'ownerPhone'), getParcelVal(curLeft, 'ownerPhone'))}
                    {renderCompareRow('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode'), getParcelVal(curLeft, 'officialCadastralCode'))}
                    {renderCompareRow('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2'), getParcelVal(curLeft, 'landAreaM2'))}
                    {renderCompareRow('Diện tích XD (m²)', getParcelVal(snapLeft, 'constructionAreaM2'), getParcelVal(curLeft, 'constructionAreaM2'))}
                    {renderCompareRow('Chiều rộng mặt tiền (m)', getParcelVal(snapLeft, 'frontageWidth'), getParcelVal(curLeft, 'frontageWidth'))}
                    {renderCompareRow('Chiều sâu thửa đất (m)', getParcelVal(snapLeft, 'lotDepth'), getParcelVal(curLeft, 'lotDepth'))}
                  </div>
                </div>

                {/* Section 2: Thông số kỹ thuật & Kết cấu */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>2. Thông Số Kỹ Thuật & Kết Cấu Công Trình</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow('Số tầng nổi', getSpecVal(snapLeft, 'floorCount'), getSpecVal(curLeft, 'floorCount'))}
                    {renderCompareRow('Số tầng ngầm/hầm', getSpecVal(snapLeft, 'basementCount'), getSpecVal(curLeft, 'basementCount'))}
                    {renderCompareRow('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction'), getSpecVal(curLeft, 'yearOfConstruction'))}
                    {renderCompareRow('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated')), String(getSpecVal(curLeft, 'isYearEstimated')))}
                    {renderCompareRow('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction'), getSpecVal(curLeft, 'landUseFunction'))}
                    {renderCompareRow('Phân loại cấp móng (CAT)', snapLeft?.specs?.foundationCatScore ?? '---', curLeft?.specs?.foundationCatScore ?? '---')}
                    {renderCompareRow('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM'), getSpecVal(curLeft, 'foundationDepthM'))}
                    {renderCompareRow('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM'), getSpecVal(curLeft, 'foundationSpacingM'))}
                    {renderCompareRow('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes'), getSpecVal(curLeft, 'foundationNotes'))}
                  </div>
                </div>

                {/* Section 3: Bảng điểm rủi ro & Phán quyết Kỹ sư trưởng */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>3. Bảng Điểm Rủi Ro (ECS / VI / BRA) & Can Thiệp Chuyên Môn</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Hạng nứt Burland (E1)',
                      snapRight?.riskCard?.e1_burland_score ?? '---',
                      curRight?.riskCard?.e1_burland_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Khuyết tật kết cấu (E2)',
                      snapRight?.riskCard?.e2_structure_score ?? '---',
                      curRight?.riskCard?.e2_structure_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Biến dạng lún nghiêng (E3)',
                      snapRight?.riskCard?.e3_deformation_score ?? '---',
                      curRight?.riskCard?.e3_deformation_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Tổng điểm ECS',
                      snapRight?.riskCard?.total_ecs_score ?? '---',
                      curRight?.riskCard?.total_ecs_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Xếp hạng ECS',
                      snapRight?.riskCard?.ecs_class ?? '---',
                      curRight?.riskCard?.ecs_class ?? '---'
                    )}
                    {renderCompareRow(
                      'Điểm tổn thương VI trung bình',
                      snapRight?.riskCard?.avg_vi_score ?? '---',
                      curRight?.riskCard?.avg_vi_score ?? '---'
                    )}
                    {renderCompareRow(
                      'Xếp hạng VI',
                      snapRight?.riskCard?.vi_class ?? '---',
                      curRight?.riskCard?.vi_class ?? '---'
                    )}
                    {renderCompareRow(
                      'Đánh giá rủi ro chung (BRA)',
                      snapRight?.riskCard?.bra ?? '---',
                      curRight?.riskCard?.bra ?? '---'
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
                  </div>
                </div>

                {/* Section 4: Chữ ký & Ý kiến hiện trường */}
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    <span>4. Xác Nhận Chữ Ký & Ý Kiến Hiện Trường</span>
                  </h3>
                  <div className="space-y-1.5">
                    {renderCompareRow(
                      'Họ tên Khảo sát viên',
                      snapJson?.signatures?.surveyorName || snapData?.surveyorName,
                      curJson?.signatures?.surveyorName || currentData?.surveyorName
                    )}
                    {renderCompareRow(
                      'Chữ ký Khảo sát viên',
                      snapData?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.surveyorSignatureUrl ? 'Đã ký' : 'Chưa có'
                    )}
                    {renderCompareRow(
                      'Chữ ký Chủ nhà / Đại diện',
                      snapData?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có',
                      currentData?.ownerSignatureUrl ? 'Đã ký' : 'Chưa có'
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
                          5. Đối Soát Trực Quan Hồ Sơ Ảnh (Side-by-Side Photo Diff)
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
                        Khuyết tật (Step 3)
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoDiffTab('SPECIAL')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          photoDiffTab === 'SPECIAL' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Chữ ký & Đất trống
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
                                    Đã thay ảnh
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
                                  <span>Bản chụp v{selectedVerNumber}</span>
                                  {item.oldUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber})` })}
                                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                                      title="Phóng to ảnh"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                                {item.oldUrl ? (
                                  <div
                                    onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber})` })}
                                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer"
                                  >
                                    <img
                                      src={item.oldUrl}
                                      alt={`${item.title} (v${selectedVerNumber})`}
                                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
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
                                  <span>Hiện tại (v{latestVersionNumber})</span>
                                  {item.newUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setZoomPhoto({ url: item.newUrl!, title: `${item.title} (Hiện tại)` })}
                                      className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 cursor-pointer"
                                      title="Phóng to ảnh"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                                {item.newUrl ? (
                                  <div
                                    onClick={() => setZoomPhoto({ url: item.newUrl!, title: `${item.title} (Hiện tại)` })}
                                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group cursor-pointer"
                                  >
                                    <img
                                      src={item.newUrl}
                                      alt={`${item.title} (Hiện tại)`}
                                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
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
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Full Snapshot Info Callout */}
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        Bản Chụp Toàn Diện Hiện Trạng: Phiên Bản v{selectedVerNumber}
                      </h4>
                      {selectedVerItem && getTagBadge(selectedVerItem.versionTag)}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Lưu vết bất biến lúc {selectedVerItem?.createdAt ? new Date(selectedVerItem.createdAt).toLocaleString('vi-VN') : '---'} bởi{' '}
                      <strong className="text-white">{selectedVerItem?.createdByName || 'Hệ thống'}</strong>
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
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi Phục Theo Bản Chụp v{selectedVerNumber}</span>
                  </button>
                )}
              </div>

              {/* Section 1: Thông tin Thửa đất & Chủ sở hữu */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>1. Thông Tin Định Danh & Thửa Đất</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Số nhà', getParcelVal(snapLeft, 'houseNumber'))}
                  {renderSnapshotField('Đường / Phố', getParcelVal(snapLeft, 'street'))}
                  {renderSnapshotField('Phường / Xã', getParcelVal(snapLeft, 'ward'))}
                  {renderSnapshotField('Quận / Huyện', getParcelVal(snapLeft, 'district'))}
                  {renderSnapshotField('Tên chủ hộ', getParcelVal(snapLeft, 'ownerName'))}
                  {renderSnapshotField('Số điện thoại', getParcelVal(snapLeft, 'ownerPhone'))}
                  {renderSnapshotField('Số tờ / Số thửa', getParcelVal(snapLeft, 'officialCadastralCode'))}
                  {renderSnapshotField('Diện tích đất (m²)', getParcelVal(snapLeft, 'landAreaM2'))}
                  {renderSnapshotField('Diện tích XD (m²)', getParcelVal(snapLeft, 'constructionAreaM2'))}
                  {renderSnapshotField('Chiều rộng MT (m)', getParcelVal(snapLeft, 'frontageWidth'))}
                  {renderSnapshotField('Chiều sâu thửa (m)', getParcelVal(snapLeft, 'lotDepth'))}
                </div>
              </div>

              {/* Section 2: Thông số kỹ thuật & Móng */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>2. Thông Số Kỹ Thuật, Móng & Bản Vẽ Hoàn Công</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {renderSnapshotField('Số tầng nổi', getSpecVal(snapLeft, 'floorCount'))}
                  {renderSnapshotField('Số tầng hầm', getSpecVal(snapLeft, 'basementCount'))}
                  {renderSnapshotField('Năm xây dựng', getSpecVal(snapLeft, 'yearOfConstruction'))}
                  {renderSnapshotField('Năm XD ước lượng', String(getSpecVal(snapLeft, 'isYearEstimated')))}
                  {renderSnapshotField('Công năng sử dụng', getSpecVal(snapLeft, 'landUseFunction'))}
                  {renderSnapshotField(
                    'Cấp móng (CAT)',
                    snapLeft?.specs?.foundationCatScore ?? snapData?.foundationCatScore ?? '---',
                    snapLeft?.specs?.foundationCatScore ? `CAT ${snapLeft.specs.foundationCatScore}` : undefined
                  )}
                  {renderSnapshotField('Độ sâu móng (m)', getSpecVal(snapLeft, 'foundationDepthM'))}
                  {renderSnapshotField('Khoảng cách móng (m)', getSpecVal(snapLeft, 'foundationSpacingM'))}
                  {renderSnapshotField('Ghi chú móng', getSpecVal(snapLeft, 'foundationNotes'))}
                </div>

                {/* As-Built Drawings */}
                {snapData?.asBuiltDrawings && snapData.asBuiltDrawings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-300 block mb-2">
                      Bản vẽ hoàn công đính kèm ({snapData.asBuiltDrawings.length}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {snapData.asBuiltDrawings.map((drawing: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 rounded-lg p-2 border border-slate-800">
                          {drawing.photoUrl ? (
                            <img
                              src={drawing.photoUrl}
                              alt={drawing.title || `Bản vẽ ${idx + 1}`}
                              className="w-full h-24 object-cover rounded mb-1"
                            />
                          ) : (
                            <div className="w-full h-24 bg-slate-900 rounded flex items-center justify-center text-slate-600 mb-1">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                          <p className="text-[11px] font-medium text-slate-300 truncate">
                            {drawing.title || `Bản vẽ ${idx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Mặt bằng các tầng & Vùng hư hại / Ghim CAD */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span>3. Mặt Bằng Các Tầng, Vùng Hư Hại & Ghim CAD</span>
                </h3>
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
                      {floors.map((floor: any, fIdx: number) => {
                        const zones = floor.damageZones || floor.zones || [];
                        return (
                          <div key={fIdx} className="bg-slate-950/70 rounded-xl border border-slate-800 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="text-xs font-bold text-white flex items-center gap-2">
                                <Building className="w-4 h-4 text-indigo-400" />
                                <span>{floor.floorName || `Tầng ${floor.floorNumber ?? fIdx + 1}`}</span>
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {zones.length} Vùng hư hại (Z)
                              </span>
                            </div>

                            {zones.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">Không có vùng hư hại trên tầng này.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {zones.map((zone: any, zIdx: number) => {
                                  const defects = zone.defects || zone.defectItems || [];
                                  return (
                                    <div key={zIdx} className="bg-slate-900 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-300">
                                          {zone.zoneCode || `Z${zIdx + 1}`}: {zone.zoneName || 'Vùng hư hại'}
                                        </span>
                                        {zone.cadPins && (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            📍 X: {zone.cadPins.xPercent ?? zone.cadPins.x ?? 0}%, Y: {zone.cadPins.yPercent ?? zone.cadPins.y ?? 0}%
                                          </span>
                                        )}
                                      </div>
                                      {defects.length > 0 && (
                                        <div className="text-[11px] text-slate-300 space-y-0.5">
                                          {defects.map((def: any, dIdx: number) => (
                                            <div key={dIdx} className="flex items-center gap-1.5 text-slate-300">
                                              <span className="text-amber-400 font-bold">•</span>
                                              <span className="font-mono text-indigo-300">{def.defectCode || `D${dIdx + 1}`}:</span>
                                              <span>{def.defectType || def.description || 'Khuyết tật'}</span>
                                              {def.severity && (
                                                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
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

              {/* Section 4: Bảng điểm rủi ro (ECS / VI / BRA) */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>4. Đánh Giá Rủi Ro (ECS / VI / BRA) & Phán Quyết Chuyên Môn</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {renderSnapshotField('E1 - Hạng nứt Burland', snapRight?.riskCard?.e1_burland_score ?? '---')}
                  {renderSnapshotField('E2 - Khuyết tật kết cấu', snapRight?.riskCard?.e2_structure_score ?? '---')}
                  {renderSnapshotField('E3 - Biến dạng lún nghiêng', snapRight?.riskCard?.e3_deformation_score ?? '---')}
                  {renderSnapshotField('E4 - Hiện trạng vật liệu', snapRight?.riskCard?.e4_material_score ?? '---')}
                  {renderSnapshotField('E5 - Lịch sử công trình', snapRight?.riskCard?.e5_history_score ?? '---')}
                  {renderSnapshotField('E6 - Công năng & Môi trường', snapRight?.riskCard?.e6_overall_function_score ?? '---')}
                  {renderSnapshotField(
                    'Tổng điểm ECS',
                    snapRight?.riskCard?.total_ecs_score ?? '---',
                    snapRight?.riskCard?.ecs_class ? `Hạng ${snapRight.riskCard.ecs_class}` : undefined
                  )}
                  {renderSnapshotField(
                    'Điểm tổn thương VI trung bình',
                    snapRight?.riskCard?.avg_vi_score ?? '---',
                    snapRight?.riskCard?.vi_class ? `Hạng ${snapRight.riskCard.vi_class}` : undefined
                  )}
                  {renderSnapshotField('Đánh giá rủi ro chung (BRA)', snapRight?.riskCard?.bra ?? '---', snapRight?.riskCard?.bra)}
                  {renderSnapshotField('Cấp độ tác động thi công (I)', snapRight?.riskCard?.construction_impact_level_i ?? '---')}
                  {renderSnapshotField('Phán quyết KST áp dụng', String(snapRight?.riskCard?.is_engineering_judgement_applied ?? false))}
                  {renderSnapshotField('Hành động phán quyết', snapRight?.riskCard?.engineering_judgement_action ?? '---')}
                </div>
                {snapRight?.riskCard?.is_engineering_judgement_applied && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs space-y-1">
                    <span className="font-bold text-purple-300">Lý do can thiệp chuyên gia:</span>
                    <p className="text-slate-300 italic">{snapRight?.riskCard?.engineering_judgement_reason || 'Không có lý do chi tiết'}</p>
                  </div>
                )}
              </div>

              {/* Section 5: Hồ sơ ảnh & Biên bản */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>5. Hồ Sơ Ảnh Hiện Trường (P-01..P-04) & Chữ Ký Biên Bản</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {renderSnapshotField('Họ tên Khảo sát viên', snapJson?.signatures?.surveyorName || snapData?.surveyorName)}
                  {renderSnapshotField('Chữ ký KSV', snapData?.surveyorSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Chữ ký Chủ nhà / Đại diện', snapData?.ownerSignatureUrl ? 'Đã ký xác nhận' : 'Chưa có')}
                  {renderSnapshotField('Ý kiến của chủ hộ', snapJson?.signatures?.ownerFeedback || snapData?.ownerRemarks)}
                  {renderSnapshotField('Khuyến nghị kỹ thuật', snapData?.engineeringRecommendations || snapLeft?.conclusions?.recommendations)}
                </div>

                {/* Visual Photo Gallery of Snapshot */}
                {(() => {
                  const snapPhotos = photoDiffItems.filter((item) => Boolean(item.oldUrl));
                  if (snapPhotos.length === 0) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                      <span className="text-xs font-bold text-slate-300 block">
                        Thư viện ảnh ghi nhận trong Bản chụp v{selectedVerNumber} ({snapPhotos.length} ảnh):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {snapPhotos.map((item) => (
                          <div
                            key={item.id}
                            className="bg-slate-950 rounded-xl p-2 border border-slate-800 flex flex-col space-y-1.5 group"
                          >
                            <div
                              onClick={() => setZoomPhoto({ url: item.oldUrl!, title: `${item.title} (v${selectedVerNumber})` })}
                              className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 cursor-pointer"
                            >
                              <img
                                src={item.oldUrl!}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Maximize2 className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="text-[11px] leading-tight">
                              <span className="font-bold text-indigo-300 block truncate" title={item.title}>
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {item.categoryLabel}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Section 6: Bản Chụp Dữ Liệu JSON (Raw Snapshot) */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-indigo-400" />
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
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedJson ? 'Đã sao chép!' : 'Sao chép JSON'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRawJson ? 'rotate-180' : ''}`} />
                      <span>{showRawJson ? 'Thu gọn' : 'Xem chi tiết JSON'}</span>
                    </button>
                  </div>
                </div>

                {showRawJson && (
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto overflow-x-auto whitespace-pre">
                    {JSON.stringify(snapData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>
              Cơ chế bất biến (Immutable Append-Only): Mọi hành động hoàn nguyên đều tạo phiên bản mới v
              {latestVersionNumber + 1} và bảo toàn 100% lịch sử kiểm toán.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>

      {/* Rollback Confirmation Sub-dialog */}
      {showRollbackPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Xác Nhận Khôi Phục Về Phiên Bản v{selectedVerNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Dữ liệu đang hoạt động của hồ sơ sẽ được hoàn nguyên về trạng thái của Phiên bản v
                  {selectedVerNumber}. Hành động này sẽ tạo thêm Phiên bản mới{' '}
                  <strong className="text-indigo-400">v{latestVersionNumber + 1}</strong> để lưu vết và giữ nguyên toàn bộ lịch sử trước đó.
                </p>
              </div>
            </div>

            {rollbackError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rollbackError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteRollback} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lý do kỹ thuật hoàn nguyên <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Ví dụ: Hoàn nguyên lại số liệu kết cấu ban đầu do admin trước tính sai tải trọng cải tạo..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật khẩu tài khoản Quản trị viên <span className="text-rose-400">*</span>:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tài khoản đăng nhập của bạn..."
                    required
                    className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => setShowRollbackPrompt(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-xs">
              <span className="font-bold text-white truncate pr-4">{zoomPhoto.title}</span>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center overflow-auto max-h-[82vh] bg-slate-950/60">
              <img
                src={zoomPhoto.url}
                alt={zoomPhoto.title}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
