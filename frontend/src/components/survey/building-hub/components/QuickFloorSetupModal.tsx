import React, { useMemo, useState } from 'react';
import { X, Wand2, Layers } from 'lucide-react';
import { buildQuickFloorStructure, type QuickFloorItem } from '../../../../core/utils/floorUtils';

interface QuickFloorSetupModalProps {
  isOpen: boolean;
  /** Số tầng nổi gợi ý từ thông tin thửa (null nếu chưa có) */
  suggestedAboveFloors: number | null;
  /** Mã tầng đã có trong tòa (để tầng đặc biệt được đánh số TECH2, ROOF2...) */
  existingFloorCodes: string[];
  /** Số tầng đã có trong tòa: không tạo lại */
  existingFloorNumbers: number[];
  onConfirm: (floors: QuickFloorItem[]) => void;
  onClose: () => void;
}

/** "10, 20" => [10, 20]; bỏ giá trị không phải số nguyên dương */
const parseFloorList = (raw: string): number[] =>
  raw
    .split(/[,;\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);

export const QuickFloorSetupModal: React.FC<QuickFloorSetupModalProps> = ({
  isOpen,
  suggestedAboveFloors,
  existingFloorCodes,
  existingFloorNumbers,
  onConfirm,
  onClose,
}) => {
  const [basementCount, setBasementCount] = useState<string>('0');
  const [hasSemiBasement, setHasSemiBasement] = useState<boolean>(false);
  const [hasGround, setHasGround] = useState<boolean>(true);
  const [hasGroundMezzanine, setHasGroundMezzanine] = useState<boolean>(false);
  const [aboveFloors, setAboveFloors] = useState<string>(suggestedAboveFloors ? String(suggestedAboveFloors) : '');
  const [technicalInput, setTechnicalInput] = useState<string>('');
  const [refugeInput, setRefugeInput] = useState<string>('');
  const [hasRoof, setHasRoof] = useState<boolean>(false);

  const aboveNum = Number(aboveFloors);
  const basementNum = Number(basementCount);
  const isAboveValid = aboveFloors.trim() !== '' && Number.isInteger(aboveNum) && aboveNum >= 0 && aboveNum <= 99;
  const isBasementValid = basementCount.trim() !== '' && Number.isInteger(basementNum) && basementNum >= 0 && basementNum <= 5;

  const preview = useMemo<QuickFloorItem[]>(() => {
    if (!isAboveValid || !isBasementValid) return [];
    const existing = new Set(existingFloorNumbers.map(Number));
    return buildQuickFloorStructure(
      {
        basementCount: basementNum,
        hasSemiBasement,
        hasGround,
        hasGroundMezzanine,
        aboveFloors: aboveNum,
        technicalFloors: parseFloorList(technicalInput),
        refugeFloors: parseFloorList(refugeInput),
        hasRoof,
      },
      existingFloorCodes
    ).filter((f) => !existing.has(f.floorNumber));
  }, [
    isAboveValid,
    isBasementValid,
    basementNum,
    hasSemiBasement,
    hasGround,
    hasGroundMezzanine,
    aboveNum,
    technicalInput,
    refugeInput,
    hasRoof,
    existingFloorCodes,
    existingFloorNumbers,
  ]);

  if (!isOpen) return null;

  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-teal-600 cursor-pointer"
      />
      {label}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-[100005] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden text-slate-800 cursor-default">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Khởi Tạo Nhanh Cấu Trúc Tầng</h3>
              <p className="text-xs text-slate-500">
                Tạo danh sách tầng dự kiến. Tầng chỉ được lưu vào hồ sơ khi bạn nạp bản vẽ CAD cho tầng đó.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 max-h-[65vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-32 text-slate-600 font-medium">Số tầng hầm (0–5)</span>
              <input
                type="number"
                min={0}
                max={5}
                value={basementCount}
                onChange={(e) => setBasementCount(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            {checkbox('Có tầng bán hầm (SB, -0.5)', hasSemiBasement, setHasSemiBasement)}
            {checkbox('Có tầng trệt (G, 0)', hasGround, setHasGround)}
            {checkbox('Có tầng lửng trệt (MEZZ, 0.5)', hasGroundMezzanine, setHasGroundMezzanine)}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-32 text-slate-600 font-medium">Số tầng nổi (Lầu 1..N)</span>
              <input
                type="number"
                min={0}
                max={99}
                value={aboveFloors}
                onChange={(e) => setAboveFloors(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-slate-600 font-medium">Tầng kỹ thuật (số tầng, cách nhau dấu phẩy)</span>
              <input
                type="text"
                placeholder="VD: 10, 20"
                value={technicalInput}
                onChange={(e) => setTechnicalInput(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-slate-600 font-medium">Tầng lánh nạn</span>
              <input
                type="text"
                placeholder="VD: 15"
                value={refugeInput}
                onChange={(e) => setRefugeInput(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            {checkbox('Có tầng mái (ROOF, trên tầng nổi cao nhất)', hasRoof, setHasRoof)}
            {(!isAboveValid || !isBasementValid) && (
              <p className="text-[11px] text-amber-700 font-medium">
                Nhập số tầng hầm (0–5) và số tầng nổi (0–99) là số nguyên.
              </p>
            )}
          </div>

          <div className="flex flex-col min-h-0">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Layers className="w-4 h-4 text-teal-600" />
              Xem trước ({preview.length} tầng mới)
            </span>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 overflow-y-auto max-h-[45vh] space-y-1">
              {preview.length === 0 ? (
                <p className="text-[11px] text-slate-500 p-2">Chưa có tầng mới nào để tạo.</p>
              ) : (
                [...preview].reverse().map((f) => (
                  <div key={f.floorNumber} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs">
                    <span className="text-slate-800">{f.floorName}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-[10px]">
                      {f.floorCode}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={preview.length === 0}
            onClick={() => {
              onConfirm(preview);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tạo {preview.length} tầng
          </button>
        </div>
      </div>
    </div>
  );
};
