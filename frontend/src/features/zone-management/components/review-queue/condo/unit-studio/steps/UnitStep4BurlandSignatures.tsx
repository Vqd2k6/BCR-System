import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  FileSignature,
  Maximize2,
  UserX,
  MessageSquare,
  Clock,
  Camera,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { api } from '../../../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep4BurlandSignatures: React.FC<
  CondoAuditStepProps<CondoUnitFormState>
> = ({
  isEditMode,
  formState,
  data,
  reportId,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenEngineeringJudgement,
}) => {
  const [verifyingAbsentee, setVerifyingAbsentee] = useState(false);
  const [absenteeVerifyMsg, setAbsenteeVerifyMsg] = useState<string | null>(null);
  const [absenteeVerifyError, setAbsenteeVerifyError] = useState<string | null>(null);

  const bSum = formState.burlandSummary || {};
  const maxGrade = Number(bSum.localMaxGrade ?? 0);
  const sigs = formState.signatures || {};

  const isAbsentOrRefused =
    formState.isRefusedOrAbsent ||
    formState.occupancyStatus === 'POSTPONED_ABSENT' ||
    formState.occupancyStatus === 'REFUSED_ENTRY' ||
    data.status === 'POSTPONED_ABSENT' ||
    data.status === 'POSTPONED_ABSENT_VERIFIED';

  const isAlreadyVerifiedAbsent = data.status === 'POSTPONED_ABSENT_VERIFIED';

  const handleVerifyAbsenteeDossier = async () => {
    setVerifyingAbsentee(true);
    setAbsenteeVerifyError(null);
    setAbsenteeVerifyMsg(null);
    try {
      await api.post(`/admin/reports/${reportId}/approve-absentee`, {
        notes: `Xác thực pháp lý hồ sơ vắng chủ căn hộ ${formState.unitCode} (${formState.absenceLogs?.length || 0} lượt viếng thăm)`,
      });
      setAbsenteeVerifyMsg(
        'Đã xác thực pháp lý hồ sơ Vắng chủ (POSTPONED_ABSENT_VERIFIED) thành công!'
      );
    } catch (err: unknown) {
      console.error('[UnitStep4BurlandSignatures] Lỗi xác thực hồ sơ vắng chủ:', err);
      setAbsenteeVerifyError(getErrorMessage(err));
    } finally {
      setVerifyingAbsentee(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Tổng hợp Cấp độ Hư hại Burland của Căn hộ con */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
          maxGrade >= 3
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
            : maxGrade >= 1
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {maxGrade >= 3 ? (
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
          )}
          <div>
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
              Cấp Độ Hư Hại Burland Nội Bộ Căn Hộ ({formState.unitCode})
            </div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              Burland Cấp {maxGrade} • Số khuyết tật ghi nhận:{' '}
              {bSum.controllingDefectsCount ?? 0} vị trí
              {bSum.governingZoneCode
                ? ` (Vùng quyết định: ${bSum.governingZoneCode})`
                : ''}
            </div>
            {bSum.needStructuralEngineerReview && (
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                Yêu cầu Kỹ sư Kết cấu kiểm định chuyên sâu trước khi phê duyệt
              </div>
            )}
          </div>
        </div>

        {onOpenEngineeringJudgement && (
          <button
            type="button"
            onClick={onOpenEngineeringJudgement}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ghi nhận Nhận định Kỹ sư (Override)
          </button>
        )}
      </div>

      {/* 2. Panel Hồ sơ Pháp lý Vắng chủ / Từ chối hợp tác (nếu căn hộ thuộc diện vắng mặt) */}
      {isAbsentOrRefused && (
        <div className="rounded-2xl border border-purple-300 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-200">
                  Hồ Sơ Pháp Lý Căn Hộ Vắng Chủ / Từ Chối Hợp Tác (3+ Lượt Viếng Thăm)
                </h4>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Lý do ghi nhận:{' '}
                  <strong>
                    {formState.absenceReason ||
                      'Chủ hộ vắng mặt nhiều lần / Không mở cửa tiếp cận'}
                  </strong>
                </p>
              </div>
            </div>

            {isAlreadyVerifiedAbsent ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                <CheckCheck className="w-4 h-4" /> Đã xác thực Vắng chủ (POSTPONED_ABSENT_VERIFIED)
              </span>
            ) : (
              <button
                type="button"
                disabled={verifyingAbsentee}
                onClick={handleVerifyAbsenteeDossier}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <CheckCheck className="w-4 h-4" />
                {verifyingAbsentee
                  ? 'Đang xác thực pháp lý...'
                  : 'Xác thực & Khóa Hồ Sơ Vắng Chủ'}
              </button>
            )}
          </div>

          {absenteeVerifyMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
              {absenteeVerifyMsg}
            </div>
          )}
          {absenteeVerifyError && (
            <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 text-xs font-bold">
              {absenteeVerifyError}
            </div>
          )}

          {/* Nhật ký các lượt viếng thăm hiện trường */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Nhật ký các lượt gõ cửa / dán thông báo ({formState.absenceLogs?.length || 0} lượt):
            </div>
            {formState.absenceLogs && formState.absenceLogs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {formState.absenceLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-purple-200 dark:border-purple-800/70 bg-white dark:bg-slate-900 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-bold text-purple-800 dark:text-purple-300">
                      <span>Lượt {log.attemptNumber || log.attempt_number || idx + 1}</span>
                      <span className="font-mono text-[11px]">
                        {log.attemptDate || log.created_at || 'Đã ghi nhận'}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      {log.notes || log.reason || 'Đã dán thông báo trước cửa căn hộ có BQL chứng kiến.'}
                    </p>
                    {log.photoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoZoom(
                            log.photoUrl!,
                            `Ảnh bằng chứng lượt ${idx + 1} - Căn hộ ${formState.unitCode}`
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:underline cursor-pointer"
                      >
                        <Camera className="w-3 h-3" /> Xem ảnh niêm yết thông báo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-purple-700/80 dark:text-purple-300/80 italic">
                Chưa có danh sách lượt viếng thăm chi tiết; đối chiếu biên bản xác nhận
                BQL bên dưới.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. Kết luận, Kiến nghị kỹ thuật & Ý kiến Chủ căn hộ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Kết luận hiện trạng Căn hộ ({formState.unitCode})
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={formState.summaryConclusions}
              onChange={(e) =>
                handleFieldChange(
                  'summaryConclusions',
                  'Kết luận hiện trạng căn hộ',
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs min-h-[76px]">
              {formState.summaryConclusions ||
                'Đã ghi nhận đầy đủ hiện trạng kiến trúc và kết cấu nội bộ căn hộ.'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Kiến nghị kỹ thuật / Quan trắc
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={formState.engineeringRecommendations}
              onChange={(e) =>
                handleFieldChange(
                  'engineeringRecommendations',
                  'Kiến nghị kỹ thuật căn hộ',
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs min-h-[76px]">
              {formState.engineeringRecommendations ||
                'Theo dõi định kỳ cùng hồ sơ quan trắc của tòa nhà chung cư.'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            Ý kiến của Chủ sở hữu / Cư dân Căn hộ
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={formState.ownerFeedback}
              onChange={(e) =>
                handleFieldChange(
                  'ownerFeedback',
                  'Ý kiến chủ sở hữu căn hộ',
                  e.target.value
                )
              }
              placeholder="Ghi nhận ý kiến của chủ hộ khi ký biên bản..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs min-h-[76px]">
              {formState.ownerFeedback ||
                'Chủ hộ thống nhất với nội dung ghi nhận hiện trạng trong biên bản.'}
            </div>
          )}
        </div>
      </div>

      {/* 4. Chữ ký điện tử Kỹ sư Khảo sát & Chủ Căn Hộ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-500">
              <FileSignature className="w-4 h-4 text-indigo-600" />
              Kỹ sư Khảo sát Hiện trường
            </div>
            <div className="font-black text-slate-900 dark:text-white">
              {sigs.surveyorName || 'Kỹ sư khảo sát'}
            </div>
            {sigs.surveyorPhone && (
              <div className="text-[11px] font-mono text-slate-500">
                SĐT: {sigs.surveyorPhone}
              </div>
            )}
          </div>

          {sigs.surveyorSignature ? (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoZoom(sigs.surveyorSignature!, 'Chữ ký Kỹ sư khảo sát')
              }
              className="w-28 h-14 rounded-lg border border-slate-300 bg-white force-light overflow-hidden cursor-pointer relative group shrink-0"
            >
              <img
                src={sigs.surveyorSignature}
                alt="Surveyor Signature"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Chưa ký số</span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-500">
              <FileSignature className="w-4 h-4 text-emerald-600" />
              Chủ sở hữu / Đại diện Căn hộ ({formState.unitCode})
            </div>
            <div className="font-black text-slate-900 dark:text-white">
              {sigs.ownerName || formState.ownerName || 'Chủ căn hộ'}
            </div>
          </div>

          {sigs.ownerSignature ? (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoZoom(
                  sigs.ownerSignature!,
                  `Chữ ký Chủ căn hộ ${formState.unitCode}`
                )
              }
              className="w-28 h-14 rounded-lg border border-slate-300 bg-white force-light overflow-hidden cursor-pointer relative group shrink-0"
            >
              <img
                src={sigs.ownerSignature}
                alt="Owner Signature"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              {isAbsentOrRefused ? 'Vắng mặt / Biên bản BQL' : 'Chưa ký số'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
