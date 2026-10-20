import React from 'react';
import { Polygon, Popup } from 'react-leaflet';
import type { PreviewParcelItem } from '../../../shared/types';
import { MapPin, Building, ArrowRight } from 'lucide-react';

interface Props {
  previewParcels: PreviewParcelItem[];
}

export const PreviewParcelsLayer: React.FC<Props> = ({ previewParcels }) => {
  if (!previewParcels || previewParcels.length === 0) {
    return null;
  }

  return (
    <>
      {previewParcels.map((p, idx) => {
        return (
          <Polygon
            key={`preview-${p.mathuadat}-${idx}`}
            positions={p.ranhCoords}
            pathOptions={{
              color: '#d97706', // amber-600
              fillColor: '#fef3c7', // amber-100
              fillOpacity: 0.45,
              weight: 2.5,
              dashArray: '6, 6', // nét đứt chuẩn
            }}
          >
            <Popup className="preview-parcel-popup">
              <div className="p-1 space-y-2 min-w-[220px] text-slate-800">
                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                    XEM TRƯỚC
                  </span>
                  <span className="font-mono font-bold text-xs text-sky-800">
                    {p.projectParcelCode}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1">
                    <Building size={12} className="text-amber-600" />
                    <span>Thửa {p.sothua}, Tờ {p.soto}</span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-start gap-1">
                    <MapPin size={11} className="text-slate-400 mt-0.5 shrink-0" />
                    <span>{p.street || 'Đường chính'}, {p.ward}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Diện tích đất:</span>
                    <strong className="text-slate-900 font-mono">
                      {p.dientich ? `${p.dientich.toLocaleString('vi-VN')} m²` : '---'}
                    </strong>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono">
                    Mã ĐC: {p.mathuadat}
                  </div>
                </div>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
};
