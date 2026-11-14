import React, { useState } from 'react';
import { Archive, Star, Trash2, Eye } from 'lucide-react';
import { CadBlueprintUploader } from './CadBlueprintUploader';
import {
  activeFloorCadResources,
  CAD_CATEGORY_LABEL,
  MAX_FLOOR_CAD_RESOURCES,
  newFloorCadResourceId,
  type FloorCadCategory,
  type FloorCadResource,
} from '../../../../core/utils/cadSources';

interface FloorCadResourcePanelProps {
  floorNumber: number;
  floorName: string;
  floorCode: string;
  projectCode: string;
  resources: FloorCadResource[];
  structuralUrl: string;
  inheritedFromFloor?: number;
  readOnly?: boolean;
  onChangeResources: (next: FloorCadResource[]) => void;
  onSetMainStructural: (url: string) => void;
}

const CATEGORY_BADGE: Record<FloorCadCategory, string> = {
  CAD_Z: 'bg-teal-950 text-teal-300 border-teal-700',
  CAD_E: 'bg-indigo-950 text-indigo-300 border-indigo-700',
  OTHER: 'bg-slate-800 text-slate-300 border-slate-600',
};

export const FloorCadResourcePanel: React.FC<FloorCadResourcePanelProps> = ({
  floorNumber,
  floorName,
  floorCode,
  projectCode,
  resources,
  structuralUrl,
  inheritedFromFloor,
  readOnly = false,
  onChangeResources,
  onSetMainStructural,
}) => {
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<FloorCadCategory>('CAD_E');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const active = activeFloorCadResources(resources);
  const deleted = resources.filter((r) => r.deletedAt);
  const isFull = active.length >= MAX_FLOOR_CAD_RESOURCES;

  const update = (id: string, patch: Partial<FloorCadResource>) =>
    onChangeResources(resources.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Archive className="w-4 h-4 text-teal-600" /> Kho tài nguyên CAD — {floorName}
        </h4>
        <span className="text-[11px] text-slate-500">
          {active.length}/{MAX_FLOOR_CAD_RESOURCES} tờ đang dùng
          {inheritedFromFloor !== undefined ? ` · theo Tầng ${inheritedFromFloor}` : ''}
        </span>
      </div>

      {!readOnly && (
        <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              placeholder="Tên tờ (VD: Mặt bằng kết cấu sàn, Điện nước...)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 min-w-[180px] px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as FloorCadCategory)}
              className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 cursor-pointer"
            >
              {(Object.keys(CAD_CATEGORY_LABEL) as FloorCadCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CAD_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          {isFull ? (
            <p className="text-[11px] text-amber-700">Kho đã đủ {MAX_FLOOR_CAD_RESOURCES} tờ. Xóa bớt tờ không dùng trước khi thêm.</p>
          ) : (
            <CadBlueprintUploader
              floorNumber={floorNumber}
              floorName={floorName}
              floorCode={floorCode}
              buildingCode={projectCode}
              cadCategory={newCategory === 'CAD_E' ? 'CAD_E' : 'OTHER'}
              onUploadSuccess={(url) => {
                onChangeResources([
                  ...resources,
                  {
                    id: newFloorCadResourceId(),
                    title: newTitle.trim() || CAD_CATEGORY_LABEL[newCategory],
                    category: newCategory,
                    url,
                    createdAt: new Date().toISOString(),
                    deletedAt: null,
                  },
                ]);
                setNewTitle('');
              }}
            />
          )}
        </div>
      )}

      {active.length === 0 ? (
        <p className="text-xs text-slate-500">
          {readOnly ? 'Tầng chưa có tờ bản vẽ bổ sung. Vui lòng liên hệ Zone Admin nếu cần thêm.' : 'Chưa có tờ nào trong kho.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {active.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setPreviewUrl(r.url)}
                className="force-light h-32 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                title="Xem lớn"
              >
                <img src={r.url} alt={r.title} className="max-h-full max-w-full object-contain" />
              </button>
              <div className="p-2 space-y-1.5 text-xs">
                {readOnly ? (
                  <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-750 text-slate-200 truncate">{r.title}</div>
                ) : (
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => update(r.id, { title: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500"
                  />
                )}
                <div className="flex items-center justify-between gap-1">
                  {readOnly ? (
                    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${CATEGORY_BADGE[r.category]}`}>
                      {CAD_CATEGORY_LABEL[r.category]}
                    </span>
                  ) : (
                    <select
                      value={r.category}
                      onChange={(e) => update(r.id, { category: e.target.value as FloorCadCategory })}
                      className="px-1.5 py-0.5 rounded-md bg-white border border-slate-300 text-[11px] cursor-pointer"
                    >
                      {(Object.keys(CAD_CATEGORY_LABEL) as FloorCadCategory[]).map((c) => (
                        <option key={c} value={c}>
                          {CAD_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  )}
                  {r.url === structuralUrl && (
                    <span className="px-1.5 py-0.5 rounded-md border text-[10px] font-bold bg-emerald-950 text-emerald-300 border-emerald-700">
                      CAD_E chính
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1.5">
                    {r.url !== structuralUrl && (
                      <button
                        type="button"
                        onClick={() => onSetMainStructural(r.url)}
                        className="flex-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3 h-3" /> Đặt làm CAD_E chính
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Xóa tờ "${r.title}" khỏi kho? Tờ được giữ dạng đã xóa để truy vết.`)) {
                          update(r.id, { deletedAt: new Date().toISOString() });
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleted.length > 0 && (
        <div className="text-xs">
          <button
            type="button"
            onClick={() => setShowDeleted((v) => !v)}
            className="text-slate-600 underline cursor-pointer"
          >
            {showDeleted ? 'Ẩn' : 'Xem'} {deleted.length} tờ đã xóa (lưu vết)
          </button>
          {showDeleted && (
            <ul className="mt-2 space-y-1">
              {deleted.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="truncate text-slate-600 line-through">
                    {r.title} · {CAD_CATEGORY_LABEL[r.category]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(r.url)}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Eye className="w-3 h-3" /> Xem
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[100006] bg-slate-900/70 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} alt="Xem tờ CAD" className="force-light max-h-[90vh] max-w-[95vw] bg-white rounded-xl" />
        </div>
      )}
    </div>
  );
};
