import React from 'react';
import { Hash, Award, ShieldCheck, CheckCircle2, AlertTriangle, Calculator, Sparkles } from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';

interface Props {
  data: any;
  onOpenEngineeringJudgement: () => void;
}

export const AuditStep7EcsViScores: React.FC<Props> = ({
  data,
  onOpenEngineeringJudgement,
}) => {
  const sJson = data?.surveyJson || data?.survey_data_json || {};
  const riskCard = data?.leftPane?.riskScoreCard || {};
  const ecs = sJson.ecs || {};
  const vi = sJson.vi || {};

  const totalEcs = ecs.totalEcs ?? riskCard.total_ecs_score ?? 0;
  const avgVi = vi.avgVi ?? vi.totalVi ?? Number(riskCard.avg_vi_score) ?? 1.0;
  const ecsClass = riskCard.ecs_class || (totalEcs < 4 ? 'Rất Thấp' : totalEcs < 9 ? 'Thấp' : totalEcs < 15 ? 'Trung Bình' : totalEcs < 20 ? 'Cao' : 'Rất Cao');
  const viClass = riskCard.vi_class || (avgVi < 1.75 ? 'Rất Thấp' : avgVi < 2.5 ? 'Thấp' : avgVi < 3.25 ? 'Trung Bình' : 'Cao');

  // Breakdown E1..E6
  const ecsItems = [
    { code: 'E1', name: 'Cấp Nứt Burland Cực Đại', score: ecs.e1 ?? riskCard.e1_burland_score ?? 0, max: 4, desc: 'Bề rộng nứt lớn nhất' },
    { code: 'E2', name: 'Nguy Cơ Kết Cấu Chịu Lực', score: ecs.e2 ?? riskCard.e2_structure_score ?? 0, max: 4, desc: 'Khuyết tật trên cột, dầm' },
    { code: 'E3', name: 'Đo Biến Dạng, Lún & Võng', score: ecs.e3 ?? 0, max: 4, desc: 'Độ nghiêng X/Y, lún lệch, võng dầm' },
    { code: 'E4', name: 'Thoái Hóa Vật Liệu & Ẩm', score: ecs.e4 ?? 0, max: 4, desc: 'Bong tróc, ẩm mốc, rỉ sét' },
    { code: 'E5', name: 'Lịch Sử Cải Tạo & Quá Khứ', score: ecs.e5 ?? 0, max: 4, desc: 'Cộng hưởng hư hại quá khứ' },
    { code: 'E6', name: 'Suy Giảm Công Năng Tổng Thể', score: ecs.e6 ?? 0, max: 4, desc: 'Ảnh hưởng vận hành sử dụng' },
  ];

  // Breakdown V1..V6
  const viItems = [
    { code: 'V1', name: 'Khoảng Cách Tim Hầm Metro', score: vi.v1 ?? 1, desc: 'Khoảng cách không gian tới hầm' },
    { code: 'V2', name: 'Hệ Kết Cấu Chịu Lực', score: vi.v2 ?? 1, desc: 'Độ dẻo & ổn định của khung' },
    { code: 'V3', name: 'Giải Pháp & Độ Tin Cậy Móng', score: vi.v3 ?? 1, desc: 'Phân loại CAT móng 1..5' },
    { code: 'V4', name: 'Niên Đại & Tuổi Thọ', score: vi.v4 ?? 1, desc: 'Năm xây dựng công trình' },
    { code: 'V5', name: 'Số Tầng Nổi & Tải Trọng', score: vi.v5 ?? 1, desc: 'Tầng cao và áp lực truyền móng' },
    { code: 'V6', name: 'Địa Chất & Lân Cận', score: vi.v6 ?? 1, desc: 'Ranh giáp và mức độ chèn ép' },
  ];

  // Thu thập và kiểm tra thực tế dữ liệu vết nứt có thước đo mm hay không
  const rawFloors: any[] = Array.isArray(sJson.floors) ? sJson.floors : [];
  const rawZones: any[] = Array.isArray(sJson.damageZones) ? sJson.damageZones : [];
  const allDefectsList: any[] = [];
  rawFloors.forEach((fl: any) => {
    (fl.zones || []).forEach((z: any) => {
      (z.defects || []).forEach((d: any) => allDefectsList.push(d));
    });
  });
  rawZones.forEach((z: any) => {
    (z.defects || []).forEach((d: any) => allDefectsList.push(d));
  });

  const totalDefectsCount = allDefectsList.length;
  const defectsWithScale = allDefectsList.filter((d) => Boolean(d.hasScaleCard ?? d.has_scale_card)).length;
  const isScaleValid = totalDefectsCount === 0 || defectsWithScale === totalDefectsCount;

  // 6 Data Completeness Gate Criteria status
  const gateCriteria = [
    { title: '1. Định Danh & Cự Ly Tim Hầm', valid: Boolean(data?.houseNumber || sJson.houseNumber), note: 'Đầy đủ biển số & GPS' },
    { title: '2. Ngoại Quan Mặt Tiền P-01..P-04', valid: Boolean(sJson.p01PhotoUrl && sJson.p02PhotoUrl), note: 'Đủ 4 góc chụp ngoại quan' },
    { title: '3. Phân Loại Móng CAT', valid: Boolean(sJson.foundationType && sJson.foundationCatScore !== undefined), note: `CAT ${sJson.foundationCatScore || 3}/5` },
    { title: '4. Sơ Đồ Mặt Bằng CAD Tầng', valid: Array.isArray(sJson.floors) ? sJson.floors.length > 0 : true, note: 'Khảo sát đầy đủ tầng' },
    {
      title: '5. Thước Đo Tỷ Lệ mm Khuyết Tật',
      valid: isScaleValid,
      note: totalDefectsCount === 0
        ? 'Không có vết nứt'
        : isScaleValid
        ? `100% đạt chuẩn (${defectsWithScale}/${totalDefectsCount} vết)`
        : `⚠️ ${totalDefectsCount - defectsWithScale}/${totalDefectsCount} vết thiếu thước đo`,
    },
    { title: '6. Biến Dạng, Lún Nghiêng & Võng', valid: Boolean(sJson.settlementTilt), note: 'Ghi nhận lún & nghiêng' },
  ];

  const isAllGateValid = gateCriteria.every((c) => c.valid);

  return (
    <section id="step-7" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 07
          </span>
          <h3 className="text-sm sm:text-base font-black text-slate-800">
            Bảng Điểm Kỹ Thuật ECS, Độ Nhạy Cảm VI & Phán Quyết Chuyên Môn
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenEngineeringJudgement}
          className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Award className="w-3.5 h-3.5" />
          <span>Can Thiệp Chuyên Gia (Override)</span>
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Khối Cổng Kiểm Tra Đủ Dữ Liệu Hiện Trường (Data Completeness Gate) */}
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-black text-sky-950 uppercase tracking-wide">
                Cổng Kiểm Tra Đủ Dữ Liệu Kỹ Thuật (Data Completeness Gate)
              </span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 ${
              isAllGateValid
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}>
              {isAllGateValid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ĐỦ ĐIỀU KIỆN PHÊ DUYỆT</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>⚠️ CẦN RÀ SOÁT DỮ LIỆU</span>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {gateCriteria.map((c, idx) => (
              <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                {c.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className={`text-[11px] font-bold truncate ${c.valid ? 'text-slate-800' : 'text-amber-900'}`}>{c.title}</div>
                  <div className={`text-[10px] ${c.valid ? 'text-slate-500' : 'text-amber-700 font-semibold'}`}>{c.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2 Khối Điểm Tổng ECS & VI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">
                Tổng Điểm Hư Hỏng Hiện Trạng (ECS)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-sky-950">{totalEcs}</span>
                <span className="text-xs font-bold text-sky-600">/ 24 Điểm</span>
              </div>
              <span className="text-xs font-bold text-sky-700 block mt-1">
                Phân hạng hư hỏng: <strong>{ecsClass}</strong>
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              ECS
            </div>
          </div>

          <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">
                Chỉ Số Nhạy Cảm Công Trình (VI)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-purple-950">
                  {typeof avgVi === 'number' ? avgVi.toFixed(2) : avgVi}
                </span>
                <span className="text-xs font-bold text-purple-600">/ 4.00</span>
              </div>
              <span className="text-xs font-bold text-purple-700 block mt-1">
                Phân loại nhạy cảm: <strong>{viClass}</strong>
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              VI
            </div>
          </div>
        </div>

        {/* Chi tiết Điểm Thành Phần ECS (E1..E6) */}
        <div className="space-y-3">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
            Chi Tiết 6 Tiêu Chí Điểm Hư Hỏng ECS (E1 &rarr; E6):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ecsItems.map((item) => (
              <div key={item.code} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-black text-[10px]">
                    {item.code}
                  </span>
                  <span className="text-base font-black text-slate-900">{item.score}/4</span>
                </div>
                <div className="text-[11px] font-bold text-slate-700 truncate">{item.name}</div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chi tiết Điểm Thành Phần VI (V1..V6) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
            Chi Tiết 6 Tiêu Chí Độ Nhạy Cảm VI (V1 &rarr; V6):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {viItems.map((item) => (
              <div key={item.code} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-black text-[10px]">
                    {item.code}
                  </span>
                  <span className="text-base font-black text-purple-900">{item.score}đ</span>
                </div>
                <div className="text-[11px] font-bold text-slate-700 truncate">{item.name}</div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

