import React, { useState } from 'react';
import { X, Plus, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { FloorSurveyData } from '../../survey-phase1/types/phase1.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddArea: (newFloor: FloorSurveyData) => void;
  existingFloorsCount: number;
}

const PRESET_NAMES = [
  'Ram dốc xuống hầm B1-B2',
  'Bể nước ngầm & Trạm bơm PCCC',
  'Khuôn viên sân vườn tiếp giáp Metro',
  'Tum thang máy & Phòng kỹ thuật mái',
  'Trạm biến áp & Máy phát điện dự phòng',
  'Hành lang kỹ thuật & Rãnh thoát nước ngoài nhà',
];

export const CondoMasterAddAreaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddArea,
  existingFloorsCount,
}) => {
  const [areaName, setAreaName] = useState('');
  const [areaType, setAreaType] = useState('OUTDOOR');
  const [notes, setNotes] = useState('');
  const [sketchUrl, setSketchUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = areaName.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập tên khu vực phát sinh.');
      return;
    }

    const newFloor: FloorSurveyData = {
      id: `area_custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      floorName: trimmed,
      overviewPhotos: [],
      cadSketchPhotoUrl: sketchUrl || '',
      cadStructuralSketchPhotoUrl: sketchUrl || '',
      cadZonePins: [],
      cadElementPins: [],
      zones: [],
      structuralElements: [],
      hasStructuralElements: true,
      noStructuralElementsReason: undefined,
    };

    onAddArea(newFloor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100005] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Thêm Khu Vực Khảo Sát Phát Sinh</h3>
              <p className="text-xs text-slate-500">
                Thêm các không gian dùng chung ngoài CAD để khảo sát hiện trạng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Tên khu vực */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên khu vực khảo sát <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={areaName}
              onChange={(e) => {
                setAreaName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="VD: Ram dốc thoát hiểm, Bể nước ngầm..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
              autoFocus
            />

            {/* Quick preset suggestions */}
            <div className="mt-2">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Gợi ý nhanh tên khu vực thường gặp:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setAreaName(name);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 border border-slate-200 text-slate-700 transition-colors cursor-pointer text-left"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Phân loại không gian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phân loại không gian
            </label>
            <select
              value={areaType}
              onChange={(e) => setAreaType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="BASEMENT">Khu vực tầng ngầm / Hầm</option>
              <option value="OUTDOOR">Khuôn viên ngoại cảnh / Tiếp giáp tuyến Metro</option>
              <option value="TECHNICAL_REFUGE">Tầng kỹ thuật / Mái tum</option>
              <option value="PODIUM_FACILITY">Khu tiện ích khối đế</option>
              <option value="OTHER_COMMON">Khu vực dùng chung khác</option>
            </select>
          </div>

          {/* Sơ đồ phác thảo hoặc link CAD (tùy chọn) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sơ đồ phác thảo / Ảnh mặt bằng (Tùy chọn)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sketchUrl}
                onChange={(e) => setSketchUrl(e.target.value)}
                placeholder="Dán link ảnh sơ đồ / bản vẽ nếu có"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-500"
              />
              <div className="p-2 rounded-xl bg-slate-100 text-slate-400 border border-slate-200">
                <ImageIcon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              (Nếu chưa có, kỹ sư có thể vẽ sơ đồ hoặc chụp ảnh tổng quan trực tiếp trong bước khảo sát)
            </p>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú bối cảnh hiện trường (Tùy chọn)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Khu vực phát sinh nứt do tải trọng xe tải ra vào công trường lân cận..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Khu Vực</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
