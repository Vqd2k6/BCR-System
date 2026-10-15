import React from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, ZoomControl } from 'react-leaflet';
import { CheckCircle, ShieldCheck, CheckCircle2, Check, Layers, Building } from 'lucide-react';
import type { CadastralParcelData, MutationPayloadData } from '../../../shared/types';
import { MapBoundsController, HelpBadge } from '../../../shared/MapControllers';

interface MatchPanelProps {
  parcelData: CadastralParcelData;
  totalLandArea: number;
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  tileMode: 'osm' | 'satellite';
  setTileMode: (mode: 'osm' | 'satellite') => void;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

export const MatchPanel: React.FC<MatchPanelProps> = ({
  parcelData,
  totalLandArea,
  realActiveCoords,
  activeCentroid,
  tileMode,
  setTileMode,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}) => {
  const isConfirmed = mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed;

  return (
    <div className="bg-white border border-emerald-300 rounded-xl p-3 flex flex-col gap-3 shadow-xs">
      {/* 1. THANH TIÊU ĐỀ KHỚP RANH */}
      <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center text-emerald-700 font-extrabold text-sm">
          <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
          <span>Bản Đồ Đối Soát Ranh GIS (Thửa Hiện Tại)</span>
          <HelpBadge
            title="Khớp Ranh 100%"
            content="Công trình xây dựng trọn vẹn 100% diện tích thửa đất địa chính ban đầu. Không có tranh chấp ranh hay biến động diện tích."
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Khớp 100%: <strong>{totalLandArea} m²</strong>
          </span>
        </div>
      </div>

      {/* 2. BỐ CỤC 2 CỘT STUDIO: CỘT TRÁI THÔNG TIN PHÁP LÝ & CỘT PHẢI BẢN ĐỒ TOÀN CẢNH */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch flex-1">
        {/* CỘT TRÁI: THÔNG SỐ & XÁC NHẬN (WIDTH ~330PX) */}
        <div className="w-full lg:w-[330px] shrink-0 bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Hiện trạng hồ sơ địa chính</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mã dự án (Metro 2)</span>
                <span className="font-extrabold text-slate-800 font-mono">{parcelData.projectParcelCode}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mã địa chính chính thức</span>
                <span className="font-bold text-amber-700 font-mono">{parcelData.officialCadastralCode || '—'}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Diện tích thửa đất (S)</span>
                <span className="font-extrabold text-emerald-700 font-mono text-sm">{totalLandArea} m² (100%)</span>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed shadow-xs">
              Thửa đất được đối soát trọn vẹn theo ranh PostGIS WGS84. Không phát sinh phân chia cắt xén hay nhập thửa với các bất động sản kế cận.
            </div>

            {isConfirmed && (
              <div className="p-2.5 bg-emerald-100/70 rounded-xl border border-emerald-300 text-xs text-emerald-900 font-bold flex items-start justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Đã ghi nhận ranh khớp 100% ({mutationData.submittedAt || 'Hiện tại'})</span>
                </div>
                <button
                  type="button"
                  onClick={() => onMutationDataChange({ ...mutationData, matchConfirmed: false, activeProposalType: null })}
                  className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                const nowStr = new Date().toLocaleTimeString('vi-VN');
                onMutationDataChange({
                  ...mutationData,
                  activeProposalType: 'MATCH',
                  matchConfirmed: true,
                  isSubmitted: false,
                  submittedAt: nowStr,
                });
                if (onToastMessage) {
                  onToastMessage(`✓ Đã xác nhận thửa ${parcelData.projectParcelCode} khớp ranh 100%!`);
                }
              }}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                isConfirmed
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md'
              }`}
            >
              {isConfirmed ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <span>{isConfirmed ? 'ĐÃ XÁC NHẬN KHỚP RANH 100%' : 'Xác nhận Khớp ranh 100%'}</span>
            </button>
          </div>
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ TOÀN CẢNH LEAFLET (FLEX-1, MAXZOOM = 24) */}
        <div className="flex-1 min-h-[500px] h-[58vh] relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100">
          {/* TOOLBAR NỔI TRÊN BẢN ĐỒ */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
            <button
              type="button"
              onClick={() => setTileMode('satellite')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                tileMode === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3 h-3" />
              Vệ Tinh (Esri)
            </button>
            <button
              type="button"
              onClick={() => setTileMode('osm')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                tileMode === 'osm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building className="w-3 h-3" />
              Bản Đồ (OSM)
            </button>
          </div>

          <MapContainer
            center={activeCentroid}
            zoom={19}
            maxZoom={24}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <MapBoundsController coords={realActiveCoords} zoom={19} />
            <ZoomControl position="bottomright" />

            {tileMode === 'satellite' ? (
              <TileLayer
                attribution="Esri World Imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={24}
              />
            ) : (
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={24}
              />
            )}

            {/* THỬA ĐẤT KHỚP RANH 100% (MÀU XANH LÁ RỰC RỠ) */}
            <Polygon
              positions={realActiveCoords}
              pathOptions={{
                color: '#16a34a',
                fillColor: '#22c55e',
                fillOpacity: 0.5,
                weight: 3.5,
              }}
            >
              <Tooltip direction="top" opacity={0.95} permanent>
                <div className="text-xs font-bold text-emerald-900 text-center">
                  {parcelData.projectParcelCode} ({totalLandArea} m²)
                </div>
              </Tooltip>
            </Polygon>
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
