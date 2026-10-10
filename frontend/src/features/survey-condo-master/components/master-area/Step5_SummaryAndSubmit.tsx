import React, { useState } from 'react';
import {
  Layers,
  Building2,
  AlertTriangle,
  Award,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DefectItem } from '../../../../components/canvas/DefectPinningCanvas';
import type {
  PreFlightValidationResult,
  PreFlightCheckItem,
} from '../../types/masterAreaSurvey.types';

interface Step5SummaryAndSubmitProps {
  zonesCount: number;
  structuralElementsCount: number;
  hasStructuralElements: boolean;
  allDefects: DefectItem[];
  dominantBurlandGrade: number;
  burlandCounts: number[];
  surveyorRemarks: string;
  setSurveyorRemarks: (val: string) => void;
  surveyorSignatureUrl?: string;
  setSurveyorSignatureUrl?: (val: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  isReadOnly: boolean;
  isZoneAdminAdjusting?: boolean;
  onBack: () => void;
  preFlightValidation?: PreFlightValidationResult;
  onJumpToItem?: (item: PreFlightCheckItem) => void;
}

export const Step5_SummaryAndSubmit: React.FC<Step5SummaryAndSubmitProps> = ({
  zonesCount,
  structuralElementsCount,
  hasStructuralElements,
  allDefects,
  dominantBurlandGrade,
  burlandCounts,
  surveyorRemarks,
  setSurveyorRemarks,
  isSubmitting,
  onSubmit,
  isReadOnly,
  isZoneAdminAdjusting = false,
  onBack,
  preFlightValidation,
  onJumpToItem,
}) => {
  const [showValidItems, setShowValidItems] = useState(false);
  const blockingErrors = preFlightValidation?.blockingErrors || [];
  const warnings = preFlightValidation?.warnings || [];
  const validItems = preFlightValidation?.allItems.filter((i) => i.status === 'VALID') || [];
  const hasBlocking = blockingErrors.length > 0;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Tiêu đề ngắn gọn */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-indigo-600 text-white font-bold text-xs">
            BƯỚC 5
          </span>
          <h3 className="text-sm font-bold text-slate-800">
            Tổng kết khảo sát & Cấp Burland chủ đạo
          </h3>
        </div>
      </div>

      {/* 4 Thẻ KPI Tóm tắt */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Layers size={13} className="text-emerald-600" />
            VÙNG Z
          </span>
          <span className="text-lg font-bold font-mono text-slate-800">
            {zonesCount}
          </span>
          <span className="text-[10px] text-slate-400">Vùng kiến trúc</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Building2 size={13} className="text-amber-600" />
            CẤU KIỆN E
          </span>
          <span className="text-lg font-bold font-mono text-slate-800">
            {hasStructuralElements ? structuralElementsCount : 0}
          </span>
          <span className="text-[10px] text-slate-400">
            {hasStructuralElements ? 'Cột, Dầm, Vách' : 'Miễn trừ'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <AlertTriangle size={13} className="text-red-600" />
            KHUYẾT TẬT (D)
          </span>
          <span className="text-lg font-bold font-mono text-slate-800">
            {allDefects.length}
          </span>
          <span className="text-[10px] text-slate-400">Điểm nứt / bong tróc</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Award size={13} className="text-indigo-600" />
            BURLAND CHỦ ĐẠO
          </span>
          <span
            className={`text-lg font-bold font-mono ${
              dominantBurlandGrade === 0
                ? 'text-emerald-600'
                : dominantBurlandGrade <= 2
                ? 'text-amber-600'
                : 'text-red-600'
            }`}
          >
            Cấp {dominantBurlandGrade}
          </span>
          <span className="text-[10px] text-slate-400">Tự động từ max(D)</span>
        </div>
      </div>

      {/* Đánh giá Cấp Burland Chủ đạo Nổi bật */}
      <div
        className={`p-3.5 sm:p-4 rounded-xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
          dominantBurlandGrade === 0
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
            : dominantBurlandGrade === 1
            ? 'bg-sky-50/80 border-sky-300 text-sky-950'
            : dominantBurlandGrade === 2
            ? 'bg-amber-50/80 border-amber-300 text-amber-950'
            : dominantBurlandGrade === 3
            ? 'bg-orange-50/80 border-orange-300 text-orange-950'
            : 'bg-red-50/80 border-red-300 text-red-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl font-mono font-bold text-lg text-white ${
              dominantBurlandGrade === 0
                ? 'bg-emerald-600'
                : dominantBurlandGrade === 1
                ? 'bg-sky-600'
                : dominantBurlandGrade === 2
                ? 'bg-amber-600'
                : dominantBurlandGrade === 3
                ? 'bg-orange-600'
                : 'bg-red-600'
            }`}
          >
            B-{dominantBurlandGrade}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold">
              {dominantBurlandGrade === 0 && 'Cấp 0: Không Hư Hại (Bề mặt hoàn hảo)'}
              {dominantBurlandGrade === 1 && 'Cấp 1: Rất Nhẹ (Vết nứt chân chim < 0.1 mm)'}
              {dominantBurlandGrade === 2 && 'Cấp 2: Nhẹ (Vết nứt bề mặt < 5.0 mm)'}
              {dominantBurlandGrade === 3 && 'Cấp 3: Trung Bình (Vết nứt 5.0 - 15.0 mm)'}
              {dominantBurlandGrade === 4 && 'Cấp 4: Hư Hại Nặng (15.0 - 25.0 mm)'}
              {dominantBurlandGrade === 5 && 'Cấp 5: Nguy Hiểm Kết Cấu (> 25.0 mm)'}
            </h4>
            <p className="text-[11px] opacity-75 mt-0.5">
              Cấp độ nghiêm trọng nhất trong {allDefects.length} khuyết tật ghi nhận.
            </p>
          </div>
        </div>

        {/* Phân bố các cấp Burland */}
        <div className="flex items-center gap-1 bg-white/80 p-1.5 rounded-lg border border-slate-200 text-slate-800 text-[10px] font-mono shrink-0">
          {burlandCounts.map((cnt, gr) => (
            <span
              key={gr}
              className={`px-1 py-0.5 rounded ${cnt > 0 ? 'bg-indigo-100 text-indigo-900 font-bold' : 'text-slate-400'}`}
              title={`Cấp ${gr}: ${cnt} khuyết tật`}
            >
              B{gr}:{cnt}
            </span>
          ))}
        </div>
      </div>

      {/* =============================================================== */}
      {/* BẢNG TIỀN KIỂM TRA HỒ SƠ KHẢO SÁT (PRE-FLIGHT VALIDATION)        */}
      {/* =============================================================== */}
      {preFlightValidation && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${hasBlocking ? 'text-red-500' : 'text-emerald-600'}`} />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                  Kiểm tra điều kiện nộp hồ sơ (Pre-Flight Check)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Tự động rà soát 100% dữ liệu trước khi bàn giao hồ sơ kỹ thuật
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                  hasBlocking
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {preFlightValidation.passedChecks} / {preFlightValidation.totalChecks} đạt chuẩn
              </span>
            </div>
          </div>

          {/* Danh sách lỗi BẮT BUỘC (BLOCKING) */}
          {hasBlocking && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-red-50/70 border border-red-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                <AlertCircle size={15} />
                <span>Bắt buộc hoàn thành {blockingErrors.length} mục sau trước khi nộp:</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {blockingErrors.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-red-100 shadow-2xs"
                  >
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] shrink-0 mt-0.5">
                        BƯỚC {item.step}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{item.title}</span>
                        <span className="text-[11px] text-slate-600">{item.description}</span>
                      </div>
                    </div>

                    {onJumpToItem && (
                      <button
                        type="button"
                        onClick={() => onJumpToItem(item)}
                        className="self-end sm:self-center px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-2xs transition-colors cursor-pointer"
                      >
                        <span>{item.actionLabel || 'Bổ sung ngay'}</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách lưu ý KHUYẾN NGHỊ (WARNING) */}
          {warnings.length > 0 && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle size={15} />
                <span>Lưu ý khuyến nghị ({warnings.length} mục):</span>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {warnings.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded-lg border border-amber-100"
                  >
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px] shrink-0 mt-0.5">
                        BƯỚC {item.step}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">{item.title}</span>
                        <span className="text-[11px] text-slate-500">{item.description}</span>
                      </div>
                    </div>

                    {onJumpToItem && item.actionLabel && (
                      <button
                        type="button"
                        onClick={() => onJumpToItem(item)}
                        className="self-end sm:self-center px-2 py-0.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <span>{item.actionLabel}</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách mục đã đạt chuẩn (collapsible) */}
          {validItems.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowValidItems(!showValidItems)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-600 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 size={14} />
                  <span>{validItems.length} mục đã kiểm tra đạt chuẩn</span>
                </div>
                {showValidItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showValidItems && (
                <div className="p-3 bg-white flex flex-col gap-1.5 border-t border-slate-100">
                  {validItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        <span className="font-medium text-slate-700">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Bước {item.step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nhận xét của KSV đối với khu vực (Đã đổi tên và bỏ chữ ký theo yêu cầu) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-800">
          Nhận xét của KSV đối với khu vực
        </label>
        <textarea
          rows={3}
          value={surveyorRemarks}
          onChange={(e) => setSurveyorRemarks(e.target.value)}
          placeholder="Nhận xét tổng thể về tình trạng an toàn, rêu mốc, độ võng, kiến nghị kỹ thuật quan trắc..."
          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
          disabled={isReadOnly}
        />
      </div>

      {/* Nút Submit / Quay lại */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Bước 4</span>
        </button>

        {!isReadOnly && (
          <div className="flex items-center gap-3">
            {hasBlocking && (
              <span className="text-xs font-bold text-red-600 hidden sm:inline">
                Chưa thể nộp: còn {blockingErrors.length} mục thiếu
              </span>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSubmit}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all ${
                hasBlocking
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={hasBlocking ? `Còn ${blockingErrors.length} mục bắt buộc chưa hoàn tất` : 'Nộp hồ sơ khảo sát'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Nộp...</span>
                </>
              ) : hasBlocking ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Kiểm Tra Lại Để Nộp ({blockingErrors.length})</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isZoneAdminAdjusting
                      ? 'Lưu Điều Chỉnh Hồ Sơ (Zone Admin)'
                      : 'Nộp Hồ Sơ Khảo Sát'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
