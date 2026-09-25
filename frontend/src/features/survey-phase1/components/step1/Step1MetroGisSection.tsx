import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { InfoPopover } from '../../../../core/components/ui/InfoPopover';
import { MapPin } from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';

interface Step1MetroGisSectionProps {
  formData: Phase1SurveyFormData;
}

export const Step1MetroGisSection: React.FC<Step1MetroGisSectionProps> = ({ formData }) => {
  return (
    <Card className="border-slate-200 bg-slate-50/40 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            1.3. Thông Tin Tuyến Metro & Tọa Độ GIS
          </h2>
        </div>
        <InfoPopover title="Ý nghĩa 4 thông số Tuyến Metro & Tọa độ GIS">
          <div className="space-y-2 text-xs text-slate-700">
            <p><strong>1. Lý trình (Chainage):</strong> Vị trí mốc Km trên tuyến Metro Số 2 (Bến Thành – Tham Lương) tương ứng với vị trí lô đất.</p>
            <p><strong>2. Khoảng cách tới tim Metro:</strong> Cự ly vuông góc ngắn nhất từ các đỉnh đa giác thửa đất đến đường tim tuyến hầm Metro, quyết định phân vùng rung chấn.</p>
            <p><strong>3. Khoảng cách tới ranh GPMB:</strong> Cự ly ngắn nhất từ ranh thửa đất đến mốc hành lang giải phóng mặt bằng thu hồi đất dự án Metro.</p>
            <p><strong>4. Tọa độ thửa đất (GIS Parcel):</strong> Tọa độ trắc địa WGS84 tâm lô đất cố định trích xuất từ cơ sở dữ liệu địa chính quy hoạch.</p>
          </div>
        </InfoPopover>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-slate-500 block font-medium">Lý trình (Chainage)</span>
          <span className="text-sm font-bold text-slate-800">{formData.chainage || 'Km 0+000'}</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-slate-500 block font-medium">Khoảng cách tới tim Metro</span>
          <span className="text-sm font-bold text-slate-800">{formData.metroOffsetDistance || '15.0m'}</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-slate-500 block font-medium">Khoảng cách tới ranh GPMB</span>
          <span className="text-sm font-bold text-slate-800">{formData.clearanceOffsetDistance || '5.2m'}</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 block font-medium">Tọa độ thửa đất (GIS Parcel)</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Đỉnh ranh gần tim Metro nhất
            </span>
          </div>
          <span className="text-sm font-bold text-emerald-700 font-mono mt-1 block">
            {formData.gpsCoords?.lat ? `${formData.gpsCoords.lat.toFixed(6)}, ${formData.gpsCoords.lng.toFixed(6)}` : 'Chưa có tọa độ'}
          </span>
        </div>
      </div>
    </Card>
  );
};
