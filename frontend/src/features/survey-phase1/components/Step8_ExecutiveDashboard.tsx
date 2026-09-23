import React, { useEffect } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Textarea } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import {
  calculateConstructionImpact,
  calculateBraRisk,
  BRA_MATRIX_LOOKUP,
} from '../engine/braEngine';
import {
  LayoutDashboard,
  Building,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Compass,
} from 'lucide-react';

export const Step8_ExecutiveDashboard: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const ecs = formData.ecs;
  const vi = formData.vi;
  const ex = formData.executiveSummary;
  const burland = formData.burlandSummary;

  // Tính toán hạng sau can thiệp kỹ sư
  const effectiveEcsClass =
    ecs.engineeringJudgement.action === 'UPGRADE'
      ? 'TĂNG NẶNG (Can thiệp KS)'
      : ecs.engineeringJudgement.action === 'DOWNGRADE'
      ? 'GIẢM NHẸ (Can thiệp KS)'
      : ecs.ecsClass;

  const effectiveViClass =
    vi.engineeringJudgement?.action === 'UPGRADE'
      ? 'TĂNG NẶNG (Can thiệp KS)'
      : vi.engineeringJudgement?.action === 'DOWNGRADE'
      ? 'GIẢM NHẸ (Can thiệp KS)'
      : vi.viClass;

  // 1. Tính toán Tác động thi công Metro (Impact I1 - I4) theo khoảng cách d & nhóm đối tượng
  const impact = calculateConstructionImpact(
    formData.objectGroup,
    formData.metroOffsetDistance
  );

  // 2. Tính toán Đánh giá rủi ro cơ sở BRA theo ma trận 4x4
  const bra = calculateBraRisk(effectiveViClass, impact.code);

  // Tự động đồng bộ kết quả vào executiveSummary nếu trạng thái thay đổi
  useEffect(() => {
    if (ex.constructionImpactStatus !== impact.code || ex.braStatus !== bra.riskLevel) {
      updateFormData({
        executiveSummary: {
          ...ex,
          constructionImpactStatus: impact.code,
          braStatus: bra.riskLevel,
        },
      });
    }
  }, [impact.code, bra.riskLevel]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Thông tin nhận diện công trình tóm tắt */}
      <Card className="bg-slate-50 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {formData.projectParcelCode} - {formData.buildingName || formData.officialCadastralCode || 'Công trình khảo sát'}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {formData.houseNumber} {formData.street} | Chủ hộ: <span className="font-semibold text-slate-700">{formData.ownerName || 'Chưa rõ'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="neutral">Nhóm: {formData.objectGroup || 'GENERAL'}</Badge>
            <Badge variant="neutral">Lý trình: {formData.chainage || 'Km --+---'}</Badge>
            <Badge variant="neutral">Tim Metro: {formData.metroOffsetDistance || '--'} m</Badge>
          </div>
        </div>
      </Card>

      {/* 5 Khối Thẻ Chỉ Số Tổng Hợp Executive Cards */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <LayoutDashboard className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              8. Bảng Tổng Hợp Kết Luận Toàn Diện & Đề Xuất Kỹ Thuật (Executive Summary Dashboard)
            </h2>
            <p className="text-xs text-slate-500">
              Tổng hợp tự động toàn bộ kết quả khảo sát hiện trường trước khi ký biên bản
            </p>
          </div>
        </div>

        {/* Hàng 1: 3 Chỉ số kỹ thuật nội tại (ECS, Burland, VI) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3.5">
          {/* Card 1: ECS */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  1. Hiện trạng ECS / BCS
                </span>
                <InfoPopover title="1. Hiện trạng công trình (ECS / BCS)" size="sm">
                  <p><strong>Nguồn:</strong> Tổng hợp từ 6 chỉ tiêu kỹ thuật E1 đến E6 (thang 0-24 điểm) ở Bước 6.1.</p>
                  <p className="mt-1"><strong>Phân hạng:</strong> GOOD (0-4: Tốt), MEDIUM (5-12: Trung bình), DEFICIENT (13-24: Kém/Hư hại nặng).</p>
                  <p className="mt-1"><strong>Ý nghĩa:</strong> Làm căn cứ pháp lý hiện trạng trước thi công tuyến Metro nhằm phục vụ giải quyết bồi thường hoặc khước từ đền bù.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <span className="text-2xl font-black text-slate-800">{ecs.totalEcs} <span className="text-sm font-normal text-slate-400">/24</span></span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <span className="text-xs font-bold text-emerald-700 block">{effectiveEcsClass}</span>
              {ecs.engineeringJudgement.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {ecs.ecsClass}</span>
              )}
            </div>
          </div>

          {/* Card 2: Burland & Cờ kết cấu */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  2. Burland & Cờ Kết Cấu
                </span>
                <InfoPopover title="2. Cấp Burland & Cờ Khuyết Tật Kết Cấu" size="sm">
                  <p><strong>Nguồn:</strong> Tự động kế thừa từ các Vùng kiến trúc Z (Mục 3.1 & 4.1).</p>
                  <p className="mt-1"><strong>Burland:</strong> Grade phổ biến (Mode) và Grade lớn nhất (Max) theo quy chuẩn nứt tường xây Burland (1977) / Mair et al. (1996).</p>
                  <p className="mt-1"><strong>Cờ kết cấu:</strong> Đánh giá hư hại độc lập cho hệ cột/dầm/sàn chịu lực (None, Low, Moderate, High, Critical).</p>
                </InfoPopover>
              </div>
              <div className="flex items-center justify-center gap-2 my-1">
                <span className="text-xl font-black text-slate-800">Gr.{burland?.predominantGrade ?? 0}</span>
                <span className="text-xs text-slate-400 font-medium">(Max: Gr.{burland?.localMaxGrade ?? 0})</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <span className={`text-xs font-bold block ${
                burland?.structuralFlagLevel === 'HIGH' || burland?.structuralFlagLevel === 'CRITICAL'
                  ? 'text-red-600'
                  : burland?.structuralFlagLevel === 'MODERATE'
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}>
                Cờ KC: {burland?.structuralFlagLevel || 'NONE'}
              </span>
              {burland?.governingZoneDescription && (
                <span className="text-[10px] text-slate-500 block truncate" title={burland.governingZoneDescription}>
                  {burland.governingZoneDescription}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Vulnerability VI */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  3. Chỉ Số Tổn Thương (VI)
                </span>
                <InfoPopover title="3. Chỉ số dễ tổn thương (Vulnerability Index - VI)" size="sm">
                  <p><strong>Nguồn:</strong> Trung bình cộng 6 thông số độ nhạy cảm công trình (V1 đến V6, thang 1-4) ở Bước 6.2.</p>
                  <p className="mt-1"><strong>Phân hạng:</strong> VI-1 (&lt;1.5: Rất thấp), VI-2 (1.5-2.2: Thấp), VI-3 (2.3-3.0: Trung bình), VI-4 (&gt;3.0: Cao).</p>
                  <p className="mt-1"><strong>Ý nghĩa:</strong> Đánh giá mức độ nhạy cảm trước rung động và lún đất do máy đào hầm TBM gây ra.</p>
                </InfoPopover>
              </div>
              <div className="text-center my-1">
                <span className="text-2xl font-black text-purple-700">{vi.viAvg} <span className="text-sm font-normal text-slate-400">/4</span></span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-center">
              <span className="text-xs font-bold text-purple-800 block">{bra.vLabel}</span>
              {vi.engineeringJudgement?.action !== 'KEEP' && (
                <span className="text-[10px] text-amber-600 block italic">Gốc: {vi.viClass}</span>
              )}
            </div>
          </div>
        </div>

        {/* Hàng 2: 2 Chỉ số Tác động thi công Metro & Ma trận Rủi ro Cơ sở BRA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
          {/* Card 4: Construction Impact */}
          <div className="p-4 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-sky-600" />
                  4. Tác Động Thi Công Metro
                </span>
                <InfoPopover title="4. Phân Cấp Tác Động Thi Công Metro (Construction Impact)" size="md">
                  <p className="text-xs leading-relaxed">
                    <strong>Nguyên tắc phân cấp theo khoảng cách gần nhất đến tim Metro (d):</strong>
                  </p>
                  <div className="mt-2 space-y-2 text-[11px] leading-relaxed">
                    <div className="p-2 rounded bg-slate-50 border border-slate-200">
                      <strong className="block text-slate-800">Nhóm Công Trình Bình Thường (General):</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-600">
                        <li>d ≥ 20m ➔ <strong>I1 Low</strong> (Tác động thấp)</li>
                        <li>10m ≤ d &lt; 20m ➔ <strong>I2 Medium</strong> (Tác động trung bình)</li>
                        <li>5m ≤ d &lt; 10m ➔ <strong>I3 High</strong> (Tác động cao)</li>
                        <li>d &lt; 5m ➔ <strong>I4 Very High</strong> (Tác động rất cao)</li>
                      </ul>
                    </div>
                    <div className="p-2 rounded bg-amber-50/60 border border-amber-200">
                      <strong className="block text-amber-900">Nhóm Quan Trọng / Đặc Biệt (Important / Critical):</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-amber-800">
                        <li>d ≥ 30m ➔ <strong>I1 Low</strong></li>
                        <li>20m ≤ d &lt; 30m ➔ <strong>I2 Medium</strong></li>
                        <li>10m ≤ d &lt; 20m ➔ <strong>I3 High</strong></li>
                        <li>d &lt; 10m ➔ <strong>I4 Very High</strong></li>
                      </ul>
                    </div>
                  </div>
                </InfoPopover>
              </div>

              <div className="text-center py-2">
                <span className={`inline-block px-3 py-1 rounded-full text-base font-black border ${impact.badgeBg}`}>
                  {impact.label}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200 text-center text-xs">
              <span className="font-semibold text-slate-700">
                Khoảng cách tim: {impact.distance}m ({impact.conditionFormula})
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Áp dụng chuẩn: <strong>{impact.isSpecialObject ? 'Important / Critical' : 'General'}</strong>
              </span>
            </div>
          </div>

          {/* Card 5: BRA Risk Assessment */}
          <div className="p-4 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  5. Đánh Giá Rủi Ro Cơ Sở (BRA)
                </span>
                <InfoPopover title="5. Ma Trận Đánh Giá Rủi Ro Cơ Sở (BRA Matrix)" size="lg">
                  <p className="text-xs leading-relaxed">
                    <strong>Nguồn:</strong> Ma trận chuẩn ISO/Metro kết hợp giữa <strong>Độ tổn thương công trình (Vulnerability V1..V4)</strong> và <strong>Tác động thi công (Impact I1..I4)</strong>:
                  </p>
                  
                  {/* Bảng ma trận trực quan */}
                  <div className="overflow-x-auto mt-2.5">
                    <table className="w-full text-[10px] text-center border-collapse border border-slate-200">
                      <thead>
                        <tr className="bg-sky-100 text-sky-950 font-bold">
                          <th className="border border-slate-200 p-1.5">Vulnerability ↓ / Impact →</th>
                          <th className={`border border-slate-200 p-1.5 ${impact.code === 'I1' ? 'ring-2 ring-sky-500 bg-sky-200 font-black' : ''}`}>I1 Low</th>
                          <th className={`border border-slate-200 p-1.5 ${impact.code === 'I2' ? 'ring-2 ring-sky-500 bg-sky-200 font-black' : ''}`}>I2 Medium</th>
                          <th className={`border border-slate-200 p-1.5 ${impact.code === 'I3' ? 'ring-2 ring-sky-500 bg-sky-200 font-black' : ''}`}>I3 High</th>
                          <th className={`border border-slate-200 p-1.5 ${impact.code === 'I4' ? 'ring-2 ring-sky-500 bg-sky-200 font-black' : ''}`}>I4 Very High</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['V1', 'V2', 'V3', 'V4'] as const).map((vKey) => {
                          const isCurrentV = bra.vCode === vKey;
                          const vName = vKey === 'V1' ? 'V1 Low' : vKey === 'V2' ? 'V2 Medium' : vKey === 'V3' ? 'V3 High' : 'V4 Very High';
                          return (
                            <tr key={vKey} className={isCurrentV ? 'bg-sky-50/70 font-semibold' : ''}>
                              <td className={`border border-slate-200 p-1 text-left font-bold bg-slate-50 ${isCurrentV ? 'text-sky-900 bg-sky-100/70' : ''}`}>
                                {vName}
                              </td>
                              {(['I1', 'I2', 'I3', 'I4'] as const).map((iKey) => {
                                const cell = BRA_MATRIX_LOOKUP[vKey][iKey];
                                const isCurrentCell = bra.vCode === vKey && impact.code === iKey;
                                return (
                                  <td
                                    key={iKey}
                                    className={`border border-slate-200 p-1 font-bold ${
                                      cell.riskLevel === 'Low'
                                        ? 'bg-emerald-50 text-emerald-800'
                                        : cell.riskLevel === 'Medium'
                                        ? 'bg-amber-50 text-amber-800'
                                        : cell.riskLevel === 'High'
                                        ? 'bg-orange-50 text-orange-800'
                                        : 'bg-red-50 text-red-800'
                                    } ${isCurrentCell ? 'ring-2 ring-red-600 scale-105 shadow-md z-10 relative' : ''}`}
                                  >
                                    {isCurrentCell ? `🎯 ${cell.riskLevel}` : cell.riskLevel}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 italic">
                    Ô có ký hiệu 🎯 thể hiện vị trí đánh giá hiện tại của công trình này trên ma trận rủi ro.
                  </p>
                </InfoPopover>
              </div>

              <div className="text-center py-2">
                <span className={`inline-block px-3.5 py-1 rounded-full text-base font-black border ${bra.badgeBg}`}>
                  {bra.riskLevel}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200 text-center text-xs">
              <span className="font-semibold text-slate-800">
                Giao điểm: <strong>{bra.vCode}</strong> ({bra.vLabel.split(' ')[1]}) × <strong>{impact.code}</strong> ({impact.levelText})
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5 truncate" title={bra.recommendation}>
                {bra.recommendation}
              </span>
            </div>
          </div>
        </div>

        {/* Nhập text Rủi ro chính & Kiến nghị kỹ thuật */}
        <div className="space-y-4">
          <Textarea
            id="textarea-key-risks"
            label="Khuyết Tật / Rủi Ro Chính Nổi Bật Nhất Của Công Trình"
            placeholder="Mô tả tóm quát các khuyết tật đáng chú ý nhất tại hiện trường (vết nứt chi phối, vị trí nguy cơ, vật liệu suy giảm)..."
            rows={3}
            value={ex.keyRisksDefectsText}
            onChange={(e) =>
              updateFormData({
                executiveSummary: { ...ex, keyRisksDefectsText: e.target.value },
              })
            }
          />

          <Textarea
            id="textarea-technical-recommendations"
            label="Kiến Nghị Cụ Thể / Đề Xuất Giải Pháp Kỹ Thuật & Quan Trắc"
            placeholder="Đề xuất các biện pháp theo dõi, đặt mốc quan trắc lún/nghiêng, cắm tấm đo nứt thạch cao/tell-tale, hoặc biện pháp chống đỡ gia cố trước khi đào hầm..."
            rows={3}
            value={ex.specificRecommendationsText}
            onChange={(e) =>
              updateFormData({
                executiveSummary: { ...ex, specificRecommendationsText: e.target.value },
              })
            }
          />
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          {formData.unitId ? '⬅️ Quay lại Bước 5 (Bảng điểm ECS & VI)' : '⬅️ Quay lại Bước 6'}
        </Button>
        <Button onClick={nextStep}>
          {formData.unitId ? 'Tiếp tục: Bước 7 (Ký Biên Bản 3 Bên) ➔' : 'Tiếp tục: Bước 8 (Ký Biên Bản 3 Bên) ➔'}
        </Button>
      </div>
    </div>
  );
};
