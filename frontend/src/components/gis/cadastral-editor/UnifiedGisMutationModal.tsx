import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Split,
  Layers,
  ShieldCheck,
  Building,
  RotateCcw,
  Loader2,
  AlertCircle,
  FileText,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../services/api';
import { GisParcel, MutationPayloadData, CadastralParcelData } from '../shared/types';
import { CadastralGISBoundaryEditor } from '../CadastralGISBoundaryEditor';
import { AdminSecurityChallengeConfirm } from '../../../features/zone-management/components/review-queue/AdminSecurityChallengeConfirm';
import { METRO_22_ZONES, getZoneByCode } from '../../../features/survey-phase1/constants/metroGisConstants';

import { leafletCoordsToGeoJsonPolygon } from '../shared/geoMath';

interface Props {
  isOpen: boolean;
  parcelId: string;
  role?: 'SURVEYOR' | 'ZONE_ADMIN' | 'SUPER_ADMIN';
  initialZoneId?: string;
  reportId?: string;
  parcelCode?: string;
  houseNumber?: string;
  street?: string;
  currentAreaM2?: number;
  initialParcel?: GisParcel;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const UnifiedGisMutationModal: React.FC<Props> = ({
  isOpen,
  parcelId,
  role = 'ZONE_ADMIN',
  initialZoneId,
  reportId,
  parcelCode: propParcelCode,
  houseNumber: propHouseNumber,
  street: propStreet,
  currentAreaM2: propAreaM2,
  initialParcel,
  onClose,
  onSuccess,
}) => {
  const [boundaryStatus, setBoundaryStatus] = useState<'MATCH' | 'SPLIT' | 'MERGE'>('SPLIT');
  const [activeParcel, setActiveParcel] = useState<GisParcel | null>(initialParcel || null);
  const [activeZoneId, setActiveZoneId] = useState<string>(initialZoneId || initialParcel?.zoneId || 'ZONE_01');
  const [isLoadingParcel, setIsLoadingParcel] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Mutation data state
  const [mutationData, setMutationData] = useState<MutationPayloadData>({
    splitReason: '',
    splitCount: 2,
    splitChildren: [],
    splitShapeOption: 'CLICK_TO_DRAW',
    mergeReason: '',
    selectedMergeCodes: [],
    mergeHasPartialBuilding: false,
    residualKind: 'NON_BUILDING',
  });

  // Admin Execution States
  const [adminNotes, setAdminNotes] = useState('');
  const [transferReportToChild1, setTransferReportToChild1] = useState(true);
  const [isChallengeValid, setIsChallengeValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Nạp thông tin chi tiết thửa đất nếu chưa có
  useEffect(() => {
    if (!isOpen || !parcelId) return;

    let isMounted = true;
    const fetchParcelDetail = async () => {
      setIsLoadingParcel(true);
      setFetchError('');
      try {
        const res = await api.get(`/parcels/${parcelId}`);
        if (isMounted && res.data?.success && res.data.data) {
          const raw = res.data.data;
          let coords: [number, number][] = [];
          if (raw.cadastral_geojson?.coordinates?.[0]) {
            coords = raw.cadastral_geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
          } else if (raw.coordinates && Array.isArray(raw.coordinates)) {
            coords = raw.coordinates;
          }

          const parsedParcel: GisParcel = {
            id: raw.id,
            projectParcelCode: raw.project_parcel_code || propParcelCode || '',
            officialCadastralCode: raw.official_cadastral_code || '',
            houseNumber: raw.house_number || propHouseNumber || '',
            street: raw.street || propStreet || '',
            ownerName: raw.owner_name || '',
            ownerPhone: raw.owner_phone || '',
            surveyStatus: raw.survey_status || 'NOT_SURVEYED',
            coordinates: coords,
            landArea: Number(raw.land_area_m2 || propAreaM2 || 0),
            constructionArea: Number(raw.construction_area_m2 || raw.land_area_m2 || propAreaM2 || 0),
            floorCount: Number(raw.floor_count || 1),
            buildingType: raw.building_type || 'STANDALONE',
            zoneId: raw.zone_id || activeZoneId,
          };

          setActiveParcel(parsedParcel);
          if (raw.zone_id) setActiveZoneId(raw.zone_id);
        }
      } catch (err: any) {
        console.error('[UnifiedGisMutationModal] Fetch parcel error:', err);
        if (isMounted) {
          setFetchError(err.response?.data?.message || 'Không thể tải thông tin chi tiết thửa đất từ CSDL.');
        }
      } finally {
        if (isMounted) setIsLoadingParcel(false);
      }
    };

    fetchParcelDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, parcelId]);

  // ParcelData binding cho CadastralGISBoundaryEditor
  const cadastralParcelData = useMemo<CadastralParcelData>(() => {
    return {
      id: parcelId,
      projectParcelCode: activeParcel?.projectParcelCode || propParcelCode || '',
      officialCadastralCode: activeParcel?.officialCadastralCode || '',
      houseNumber: activeParcel?.houseNumber || propHouseNumber || '',
      street: activeParcel?.street || propStreet || '',
      ownerName: activeParcel?.ownerName || '',
      landArea: activeParcel?.landArea || propAreaM2 || 0,
      constructionArea: activeParcel?.constructionArea || activeParcel?.landArea || propAreaM2 || 0,
      floorCount: activeParcel?.floorCount || 1,
      zoneId: activeZoneId,
      surveyStatus:
        activeParcel?.surveyStatus ||
        (activeParcel as any)?.survey_status ||
        initialParcel?.surveyStatus ||
        (initialParcel as any)?.survey_status ||
        'NOT_SURVEYED',
      coordinates: activeParcel?.coordinates || [],
    };
  }, [parcelId, activeParcel, propParcelCode, propHouseNumber, propStreet, propAreaM2, activeZoneId, initialParcel]);

  const handleToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Xử lý Thực thi Tách / Gộp Thửa Đất trực tiếp (Dành cho Zone Admin & Super Admin)
  const handleAdminExecute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminNotes.trim()) {
      setSubmitError('Vui lòng nhập lý do kỹ thuật biến động để lưu vết kiểm toán (Audit Trail).');
      return;
    }

    if (boundaryStatus === 'MATCH') {
      setSubmitError('Vui lòng chọn Tách Thửa (SPLIT) hoặc Gộp Thửa (MERGE) để thực thi biến động.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      let payload: any;

      if (boundaryStatus === 'SPLIT') {
        const splitChildren = mutationData.splitChildren || [];
        const isResidual = mutationData.residualKind === 'NON_BUILDING';

        const areaA = mutationData.portionAAreaM2 || splitChildren[0]?.areaM2 || (cadastralParcelData.landArea ? Math.round(cadastralParcelData.landArea * 0.6 * 10) / 10 : 50);
        const areaB = mutationData.portionBAreaM2 || splitChildren[1]?.areaM2 || (cadastralParcelData.landArea ? Math.round((cadastralParcelData.landArea - areaA) * 10) / 10 : 30);

        payload = {
          mutationType: 'SPLIT',
          sourceParcelIds: [parcelId],
          childParcels: [
            {
              projectParcelCode: cadastralParcelData.projectParcelCode,
              houseNumber: splitChildren[0]?.houseNumber || cadastralParcelData.houseNumber,
              street: cadastralParcelData.street,
              ownerName: splitChildren[0]?.ownerName || cadastralParcelData.ownerName,
              landAreaM2: areaA,
              floorCount: 1,
              polygonGeoJson: mutationData.splitCustomPointsA
                ? leafletCoordsToGeoJsonPolygon(mutationData.splitCustomPointsA)
                : undefined,
              residualKind: 'NEW_BUILDING',
            },
            {
              projectParcelCode: isResidual
                ? `${cadastralParcelData.projectParcelCode}-DU`
                : splitChildren[1]?.suggestedCode || undefined,
              houseNumber: isResidual
                ? `${cadastralParcelData.houseNumber} (Đất dư)`
                : splitChildren[1]?.houseNumber || `${cadastralParcelData.houseNumber}B`,
              street: cadastralParcelData.street,
              ownerName: isResidual
                ? `Chủ sở hữu đất dôi dư (${cadastralParcelData.projectParcelCode})`
                : splitChildren[1]?.ownerName || `Chủ hộ Căn B (${cadastralParcelData.projectParcelCode})`,
              landAreaM2: areaB,
              floorCount: isResidual ? 0 : 1,
              polygonGeoJson: mutationData.splitCustomPointsB
                ? leafletCoordsToGeoJsonPolygon(mutationData.splitCustomPointsB)
                : undefined,
              residualKind: mutationData.residualKind || 'NON_BUILDING',
            },
          ],
          adminNotes: adminNotes.trim(),
          transferSurveyReportId: transferReportToChild1 && reportId ? reportId : undefined,
        };
      } else {
        // MERGE
        const selectedCodes = mutationData.selectedMergeCodes || [];
        if (selectedCodes.length === 0) {
          setSubmitError('Vui lòng chọn ít nhất một thửa đất liền kề trên bản đồ để thực hiện gộp.');
          setIsSubmitting(false);
          return;
        }

        // Lấy danh sách ID từ các mã thửa được chọn
        const allZoneParcelsRes = await api.get('/parcels/zone-map', { params: { zoneId: activeZoneId } });
        const allParcelsInZone: any[] = allZoneParcelsRes.data?.data || [];
        const candidateIds = selectedCodes
          .map((code) => allParcelsInZone.find((p: any) => (p.project_parcel_code || p.projectParcelCode) === code)?.id)
          .filter((id): id is string => !!id);

        if (candidateIds.length === 0) {
          setSubmitError('Không tìm thấy thông tin thửa đất liền kề đã chọn trong phân khu. Vui lòng kiểm tra lại bản đồ.');
          setIsSubmitting(false);
          return;
        }

        const rawSourceIds = Array.from(new Set([parcelId, ...candidateIds].filter(Boolean)));
        if (rawSourceIds.length < 2) {
          setSubmitError('Thao tác gộp thửa yêu cầu ít nhất 2 thửa đất hợp lệ khác nhau.');
          setIsSubmitting(false);
          return;
        }

        const primaryCode = mutationData.primaryMergeCode || cadastralParcelData.projectParcelCode || '';
        let primaryParcelId = parcelId;
        if (primaryCode && primaryCode !== cadastralParcelData.projectParcelCode) {
          const matched = allParcelsInZone.find((p: any) => (p.project_parcel_code || p.projectParcelCode) === primaryCode);
          if (matched?.id) {
            primaryParcelId = matched.id;
          }
        }

        payload = {
          mutationType: 'MERGE',
          sourceParcelIds: rawSourceIds,
          primaryParcelId,
          primaryProjectParcelCode: primaryCode,
          mergeHasPartialBuilding: mutationData.mergeHasPartialBuilding ?? false,
          mergeBuildingAreaM2: mutationData.mergeBuildingAreaM2,
          mergeResidualAreaM2: mutationData.mergeResidualAreaM2,
          mergeBuildingCustomPoints: mutationData.mergeBuildingCustomPoints && mutationData.mergeBuildingCustomPoints.length >= 3
            ? leafletCoordsToGeoJsonPolygon(mutationData.mergeBuildingCustomPoints)
            : undefined,
          mergePartitionKind: mutationData.mergePartitionKind || 'NON_BUILDING',
          mergeSecondaryParcelCode: mutationData.mergeSecondaryParcelCode || mutationData.mergeResidualParcelCode || (mutationData.mergePartitionKind === 'NEW_BUILDING' ? undefined : `${primaryCode}-DU`),
          mergeSecondaryHouseNumber: mutationData.mergeSecondaryHouseNumber,
          mergeSecondaryOwnerName: mutationData.mergeSecondaryOwnerName,
          mergeSecondaryPhone: mutationData.mergeSecondaryPhone,
          mergeSecondaryFloorCount: mutationData.mergeSecondaryFloorCount,
          mergeSecondaryFunctionalType: mutationData.mergeSecondaryFunctionalType || mutationData.mergeResidualType,
          mergeResidualType: mutationData.mergeResidualType,
          adminNotes: adminNotes.trim(),
          transferSurveyReportId: reportId || undefined,
        };
      }

      const res = await api.post('/admin/parcels/execute-mutation', payload);

      if (res.data?.success) {
        onSuccess(res.data.message || 'Đã thực thi biến động thửa đất GIS thành công!');
        onClose();
      } else {
        setSubmitError(res.data?.message || 'Không thể thực thi biến động trên CSDL PostGIS.');
      }
    } catch (err: any) {
      console.error('[UnifiedGisMutationModal] Submit error:', err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Lỗi thực thi biến động thửa đất trên hệ thống CSDL PostGIS.';
      setSubmitError(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-800">
                  Studio Biên Tập & Biến Động Thửa Đất GIS (Unified Cadastral Studio)
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  {role === 'SUPER_ADMIN' ? '👑 Super Admin Control' : '🛡️ Zone Admin Studio'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Zone: {activeZoneId}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhân lõi dùng chung chuẩn 100% PostGIS • Hỗ trợ cả 2 nhánh Đất dôi dư ({cadastralParcelData.projectParcelCode}-DU) và Căn nhà mới
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dropdown đổi Zone nhanh cho Super Admin */}
            {role === 'SUPER_ADMIN' && (
              <select
                value={activeZoneId}
                onChange={(e) => setActiveZoneId(e.target.value)}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none"
                title="Chuyển phân khu Zone"
              >
                {METRO_22_ZONES.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thông báo Toast nếu có */}
        {toastMsg && (
          <div className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Body Studio */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {fetchError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {isLoadingParcel ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
              <span className="text-xs font-bold">Đang tải ranh địa chính PostGIS...</span>
            </div>
          ) : (
            <>
              {/* Nhúng trực tiếp Bộ công cụ chuẩn CadastralGISBoundaryEditor */}
              <CadastralGISBoundaryEditor
                activeParcelId={parcelId}
                parcelData={cadastralParcelData}
                parcel={activeParcel}
                boundaryStatus={boundaryStatus}
                onStatusChange={setBoundaryStatus}
                mutationData={mutationData}
                onMutationDataChange={setMutationData}
                onToastMessage={handleToast}
              />

              {/* Phần Thực thi Biến động dành cho Quản trị viên (Zone Admin / Super Admin) */}
              {(role === 'ZONE_ADMIN' || role === 'SUPER_ADMIN') && boundaryStatus !== 'MATCH' && (
                <form onSubmit={handleAdminExecute} className="pt-4 border-t border-slate-200 space-y-4">
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Tùy chọn bảo toàn hồ sơ khảo sát */}
                  {reportId && (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transferReportToChild1}
                        onChange={(e) => setTransferReportToChild1(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                      />
                      <span>
                        Tự động điều chuyển và bảo toàn 100% hồ sơ khảo sát (báo cáo, khuyết tật, ảnh watermark) gắn với Thửa chính A ({cadastralParcelData.projectParcelCode})
                      </span>
                    </label>
                  )}

                  {/* Nhập ghi chú kỹ thuật kiểm toán */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Ghi Chú Kỹ Thuật Biến Động (Audit Trail - Bắt buộc):
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={
                        boundaryStatus === 'SPLIT'
                          ? `Ví dụ: Hiện trường ghi nhận thửa ${cadastralParcelData.projectParcelCode} chia 2 căn rõ rệt, lối đi riêng. Phê duyệt tách thửa ${mutationData.residualKind === 'NON_BUILDING' ? 'đất dôi dư' : 'căn nhà mới'} trên Master GIS.`
                          : `Ví dụ: Công trình xây dựng bao trùm qua các thửa [${cadastralParcelData.projectParcelCode}, ${mutationData.selectedMergeCodes?.join(', ')}]. Thực hiện hợp nhất khuôn viên ST_Union trên Master GIS.`
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-slate-800"
                    />
                  </div>

                  {/* Xác thực 6 số ngẫu nhiên chống nhấp nhầm */}
                  <AdminSecurityChallengeConfirm
                    actionDescription={
                      boundaryStatus === 'SPLIT'
                        ? `tách thửa [${cadastralParcelData.projectParcelCode}] thành 2 thửa con (${mutationData.residualKind === 'NON_BUILDING' ? `Đất dôi dư ${cadastralParcelData.projectParcelCode}-DU` : 'Căn nhà mới'})`
                        : `gộp thửa [${cadastralParcelData.projectParcelCode}] với ${mutationData.selectedMergeCodes?.length || 0} thửa đất liền kề`
                    }
                    onValidityChange={(valid) => setIsChallengeValid(valid)}
                  />

                  {/* Thanh nút bấm hành động */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !isChallengeValid}
                      className={`px-5 py-2.5 text-xs font-black rounded-xl text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                        isChallengeValid && !isSubmitting
                          ? boundaryStatus === 'SPLIT'
                            ? 'bg-orange-600 hover:bg-orange-700 active:scale-95'
                            : 'bg-sky-600 hover:bg-sky-700 active:scale-95'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang thực thi PostGIS...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {boundaryStatus === 'SPLIT'
                              ? `Xác Nhận & Kích Hoạt Tách Thửa (${mutationData.residualKind === 'NON_BUILDING' ? 'Đất Dôi Dư' : 'Nhà Mới'})`
                              : `Xác Nhận & Hợp Nhất Gộp ${(mutationData.selectedMergeCodes?.length || 0) + 1} Thửa Đất`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
