import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import { Activity, ShieldAlert, AlertTriangle } from 'lucide-react';

const STRUCTURAL_FLAG_LEVELS = [
  { value: 'NONE', label: 'None - Không có cờ kết cấu', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'LOW', label: 'Low - Cờ kết cấu thấp', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'MODERATE', label: 'Moderate - Cờ kết cấu trung bình', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'HIGH', label: 'High - Cờ kết cấu cao / Nguy cơ chịu lực', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  { value: 'CRITICAL', label: 'Critical - Cờ kết cấu nguy cấp / Cảnh báo sập', color: 'bg-red-50 text-red-800 border-red-200' },
];

export const Step4_BurlandSummary: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const bs = formData.burlandSummary;

  // Lấy danh sách tất cả các mã Zone Z-xx hiện có
  const allZones = formData.floors.flatMap((f) => f.zones);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 4.1. Tổng hợp Burland */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              4.1. Tổng Hợp Burland Toàn Công Trình
            </h2>
          </div>

          {/* Popover Bảng tra cứu Cheat Sheet */}
          <InfoPopover title="Bảng tra cứu quy chuẩn phân cấp hư hỏng Burland (Cheat Sheet)" size="lg">
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden bg-white">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-14 text-center">Cấp</th>
                    <th className="p-2 w-24">Mức độ</th>
                    <th className="p-2">Mô tả & Mức sửa chữa điển hình</th>
                    <th className="p-2 w-28 text-center">Bề rộng nứt xấp xỉ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2 text-center font-bold">0</td>
                    <td className="p-2 font-semibold text-emerald-800">Negligible</td>
                    <td className="p-2 text-slate-600">Nứt tóc; không cần sửa chữa.</td>
                    <td className="p-2 text-center font-mono">≤ 0.1 mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold">1</td>
                    <td className="p-2 font-semibold text-blue-800">Very slight</td>
                    <td className="p-2 text-slate-600">Nứt mảnh, dễ xử lý trong trang trí/bảo trì.</td>
                    <td className="p-2 text-center font-mono">~ 0.1 – 1 mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold">2</td>
                    <td className="p-2 font-semibold text-cyan-800">Slight</td>
                    <td className="p-2 text-slate-600">Nứt dễ trám; có thể cần miết mạch; cửa hơi kẹt.</td>
                    <td className="p-2 text-center font-mono">~ 1 – 5 mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold">3</td>
                    <td className="p-2 font-semibold text-amber-800">Moderate</td>
                    <td className="p-2 text-slate-600">Cần vá nứt, sửa cục bộ khối xây; nhiều vết &gt;3mm, kẹt cửa.</td>
                    <td className="p-2 text-center font-mono">~ 5 – 15 mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold">4</td>
                    <td className="p-2 font-semibold text-orange-800">Severe</td>
                    <td className="p-2 text-slate-600">Sửa chữa lớn/thay thế cục bộ; tường biến dạng; ảnh hưởng gối tựa.</td>
                    <td className="p-2 text-center font-mono">~ 15 – 25 mm</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold">5</td>
                    <td className="p-2 font-semibold text-red-800">Very severe</td>
                    <td className="p-2 text-slate-600">Hư hỏng rất nặng; cần chống đỡ/xây lại một phần hoặc toàn bộ.</td>
                    <td className="p-2 text-center font-mono">≥ 25 mm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Burland Chủ Đạo Toàn Nhà (Predominant)"
            value={bs.predominantGrade}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, predominantGrade: Number(e.target.value) },
              })
            }
            options={[
              { value: 0, label: '0 - Không đáng kể (<=0.1mm)' },
              { value: 1, label: '1 - Rất nhẹ (~0.1-1mm)' },
              { value: 2, label: '2 - Nhẹ (~1-5mm)' },
              { value: 3, label: '3 - Trung bình (~5-15mm)' },
              { value: 4, label: '4 - Nặng (~15-25mm)' },
              { value: 5, label: '5 - Rất nặng (>=25mm)' },
            ]}
            hint="Mức độ nứt xuất hiện phổ biến nhất"
          />

          <Select
            label="2. Burland Cục Bộ Lớn Nhất (Local Max)"
            value={bs.localMaxGrade}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, localMaxGrade: Number(e.target.value) },
              })
            }
            options={[
              { value: 0, label: '0 - Không đáng kể (<=0.1mm)' },
              { value: 1, label: '1 - Rất nhẹ (~0.1-1mm)' },
              { value: 2, label: '2 - Nhẹ (~1-5mm)' },
              { value: 3, label: '3 - Trung bình (~5-15mm)' },
              { value: 4, label: '4 - Nặng (~15-25mm)' },
              { value: 5, label: '5 - Rất nặng (>=25mm)' },
            ]}
            hint="Vết nứt nặng nhất ghi nhận được (dùng để tính E1)"
          />

          <Select
            label="3. Vùng Kiểm Soát Chi Phối (Governing Zone)"
            value={bs.governingZoneCode}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, governingZoneCode: e.target.value },
              })
            }
            options={
              allZones.length > 0
                ? allZones.map((z) => ({
                    value: z.zoneCode,
                    label: `${z.zoneCode} - ${z.floorName} - ${z.roomName} (${z.defects.length} nứt)`,
                  }))
                : [{ value: 'Z-01', label: 'Z-01 (Mặc định)' }]
            }
          />

          <Input
            label="Mô Tả Mảng Tường / Khu Vực Vùng Chi Phối"
            placeholder="VD: Mảng tường chịu lực phòng khách tầng trệt tiếp giáp khe lún..."
            value={bs.governingZoneDescription || ''}
            onChange={(e) =>
              updateFormData({
                burlandSummary: { ...bs, governingZoneDescription: e.target.value },
              })
            }
          />

          <Select
            label="4. Tính Đại Diện (Representativeness)"
            value={bs.representativeness}
            onChange={(e) =>
              updateFormData({
                burlandSummary: {
                  ...bs,
                  representativeness: e.target.value as 'GLOBAL' | 'LOCAL',
                },
              })
            }
            options={[
              { value: 'GLOBAL', label: 'Toàn công trình (Đại diện chung toàn nhà)' },
              { value: 'LOCAL', label: 'Cục bộ (Chỉ xuất hiện tại một vài khu vực)' },
            ]}
          />

          <Select
            label="5. Cần Kỹ Sư Kết Cấu Thẩm Định (Structural Review)"
            value={bs.needStructuralEngineerReview ? 'YES' : 'NO'}
            onChange={(e) =>
              updateFormData({
                burlandSummary: {
                  ...bs,
                  needStructuralEngineerReview: e.target.value === 'YES',
                },
              })
            }
            options={[
              { value: 'NO', label: 'Không - Mức độ hư hỏng thông thường' },
              { value: 'YES', label: 'Có - Cần Kỹ sư kết cấu thẩm tra chuyên sâu' },
            ]}
          />
        </div>
      </Card>

      {/* 4.2. Cờ khuyết tật kết cấu */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              4.2. Đánh Giá Cờ Khuyết Tật Kết Cấu
            </h2>
          </div>

          <InfoPopover title="Hướng dẫn đánh giá Cờ khuyết tật kết cấu (E2)">
            <p className="mb-2">Thang đánh giá mức độ khuyết tật kết cấu chịu lực (Cột/Dầm/Sàn/Tường):</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>None (0đ):</strong> Không có khuyết tật kết cấu đáng kể.</li>
              <li><strong>Low (1đ):</strong> Vết nứt tóc nhỏ ở dầm/sàn không ảnh hưởng chịu lực.</li>
              <li><strong>Moderate (2đ):</strong> Nứt dầm/cột vừa phải, cần theo dõi biến dạng.</li>
              <li><strong>High (3đ):</strong> Nứt lớn qua dầm/cột, lộ thép rỉ sét, đe dọa chịu tải.</li>
              <li><strong>Critical (4đ):</strong> Mất ổn định kết cấu, nứt toác nghiêm trọng, nguy cơ sập đổ.</li>
            </ul>
          </InfoPopover>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Cờ kết cấu đánh giá độc lập các khuyết tật cột/dầm/sàn/tường chịu lực
        </p>

        <div className="space-y-2">
          {STRUCTURAL_FLAG_LEVELS.map((flag) => {
            const isSelected = bs.structuralFlagLevel === flag.value;
            return (
              <label
                key={flag.value}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${flag.color} border-current shadow-sm font-semibold`
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="structuralFlagLevel"
                  checked={isSelected}
                  onChange={() =>
                    updateFormData({
                      burlandSummary: {
                        ...bs,
                        structuralFlagLevel: flag.value as any,
                      },
                    })
                  }
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-xs sm:text-sm">{flag.label}</span>
              </label>
            );
          })}
        </div>

        {/* Khóa an toàn */}
        {(bs.structuralFlagLevel === 'HIGH' || bs.structuralFlagLevel === 'CRITICAL') && (
          <div className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">
              <strong>CẢNH BÁO AN TOÀN (ECS Override):</strong> Khi Cờ kết cấu ở mức High hoặc Critical, hệ thống sẽ tự động khóa <strong>KHÔNG CHO PHÉP HẠ HẠNG ECS</strong> để bảo đảm an toàn kết cấu và bảo vệ quyền lợi dự án.
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 3
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 5 (Lún - Nghiêng ‰) ➔
        </Button>
      </div>
    </div>
  );
};
