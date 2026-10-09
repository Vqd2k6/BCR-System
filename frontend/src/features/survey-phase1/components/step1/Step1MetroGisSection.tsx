import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { InfoPopover } from '../../../../core/components/ui/InfoPopover';
import { MapPin } from 'lucide-react';
import type { Phase1SurveyFormData } from '../../types/phase1.types';

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
        <InfoPopover title="Ý nghĩa thông số Tuyến Metro & Tọa độ GIS">
          <div className="space-y-2 text-xs text-slate-700">
            <p><strong>1. Khoảng cách tới tim Metro:</strong> Cự ly ngắn nhất từ đỉnh ranh thửa đất đến đường tim hầm Metro, quyết định phân vùng rung chấn.</p>
            <p><strong>2. Khoảng cách đến đường bao ngoài:</strong> Cự ly ngắn nhất từ đỉnh ranh thửa đất đến mép công trình nhà ga màu trắng hoặc ranh hành lang an toàn tuyến Metro.</p>
            <p><strong>3. Tọa độ thửa đất (GIS Parcel):</strong> Tọa độ trắc địa WGS84 của đỉnh polygon ranh thửa gần tim hầm và công trình ga nhất.</p>
          </div>
        </InfoPopover>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 block font-medium mb-1">Khoảng cách tới tim Metro</span>
          <span className="text-base font-bold text-slate-800">{formData.metroOffsetDistance || '---'}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Tính từ đỉnh ranh thửa gần nhất tới tim hầm</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 block font-medium mb-1">Khoảng cách đến đường bao ngoài</span>
          <span className="text-base font-bold text-slate-800">{formData.clearanceOffsetDistance || '---'}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Cự ly tới mép ga màu trắng / ranh an toàn</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-600 block font-medium">Tọa độ thửa đất (GIS Parcel)</span>
            <InfoPopover title="Đỉnh ranh gần tim Metro nhất">
              <div className="space-y-1.5 text-xs text-slate-700">
                <p className="font-semibold text-emerald-800">Cơ sở kỹ thuật & Pháp lý trắc địa:</p>
                <p>Tọa độ này được trích xuất từ <strong>đỉnh đa giác ranh thửa đất gần nhất</strong> với tim hầm và công trình nhà ga màu trắng của tuyến Metro Số 2.</p>
                <p>Đây là điểm nhạy cảm nhất về rung chấn máy đào TBM và lún sụt kết cấu, được sử dụng làm căn cứ tính toán 2 chỉ số cự ly (Tim hầm & Đường bao ngoài).</p>
              </div>
            </InfoPopover>
          </div>
          <div className="mt-1">
            <span className="text-sm font-bold text-emerald-700 font-mono tracking-tight block">
              {formData.gpsCoords?.lat ? `${formData.gpsCoords.lat.toFixed(6)}, ${formData.gpsCoords.lng.toFixed(6)}` : 'Chưa có tọa độ'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">
              WGS84 • Đỉnh polygon gần Metro nhất
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
