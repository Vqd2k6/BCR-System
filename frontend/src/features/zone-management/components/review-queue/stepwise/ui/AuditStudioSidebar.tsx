import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Edit3,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useAuditStudioImgOptional } from '../context/AuditStudioImgContext';

export interface AuditSidebarStep {
  id: string;
  number: string;
  title: string;
  icon: LucideIcon;
  hasWarning?: boolean;
}

interface AuditStudioSidebarProps {
  heading: string;
  steps: AuditSidebarStep[];
  activeStepId: string;
  /** Mục đang đọc, dùng để tự cuộn mục lục (có thể là mục con của một bước). */
  activeNavKey?: string;
  onSelectStep: (stepId: string) => void;
  isLocked: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  pendingCount: number;
  stagedPhotoCount: number;
  onSave: () => void;
  onDiscard: () => void;
  renderTopSlot?: (isCollapsed: boolean) => React.ReactNode;
  renderStepAddon?: (stepId: string) => React.ReactNode;
  renderStepChildren?: (stepId: string, isCollapsed: boolean) => React.ReactNode;
}

/** Mục lục bên trái của màn thẩm định, dùng chung cho Nhà dân và Chung cư. */
export const AuditStudioSidebar: React.FC<AuditStudioSidebarProps> = ({
  heading,
  steps,
  activeStepId,
  activeNavKey,
  onSelectStep,
  isLocked,
  isEditMode,
  onToggleEditMode,
  pendingCount,
  stagedPhotoCount,
  onSave,
  onDiscard,
  renderTopSlot,
  renderStepAddon,
  renderStepChildren,
}) => {
  const studioCtx = useAuditStudioImgOptional();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const sidebarNavRef = React.useRef<HTMLElement | null>(null);
  const isHoldingSKey = Boolean(studioCtx?.isHoldingSKey);
  const selectedPhotoCount = studioCtx?.selectedPhotos.length ?? 0;

  // Tự cuộn nội bộ mục lục (không dùng scrollIntoView để tránh hủy cuộn mượt của #audit-studio-scroll-container)
  React.useEffect(() => {
    const navEl = sidebarNavRef.current;
    if (!navEl) return;
    const targetNavId = activeNavKey || activeStepId;
    const activeBtn = navEl.querySelector<HTMLElement>(`[data-nav-id="${targetNavId}"]`);
    if (activeBtn) {
      const navRect = navEl.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      if (btnRect.top < navRect.top + 8) {
        navEl.scrollTop += btnRect.top - navRect.top - 12;
      } else if (btnRect.bottom > navRect.bottom - 8) {
        navEl.scrollTop += btnRect.bottom - navRect.bottom + 12;
      }
    }
  }, [activeNavKey, activeStepId]);

  return (
    <div
      className={`w-full shrink-0 transition-all duration-200 ${
        isSidebarCollapsed ? 'lg:w-14' : 'lg:w-56'
      }`}
    >
      <div className="sticky top-2 max-h-[calc(100vh-3.75rem)] flex flex-col bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200/90 shadow-sm p-2.5 gap-2">
        {/* Header Sidebar + Nút Thu Nhỏ / Mở Rộng */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 shrink-0 gap-1">
          {!isSidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase text-sky-700 tracking-wider block truncate">
                Mục Lục Thẩm Định
              </span>
              <h4 className="text-xs font-black text-slate-800 truncate">{heading}</h4>
            </div>
          )}

          <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'w-full justify-center flex-col' : ''}`}>
            {/* Nút bật/tắt chế độ sửa hoặc badge đã khóa duyệt */}
            {isLocked ? (
              <span
                title="Đã Khóa Duyệt"
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1 shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {!isSidebarCollapsed && <span>Đã Khóa</span>}
              </span>
            ) : (
              <button
                type="button"
                title={isEditMode ? 'Đang ở Chế Độ Sửa (Bấm hoặc nhấn phím E để tắt)' : 'Bật Chế Độ Sửa (Phím tắt: E)'}
                onClick={onToggleEditMode}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
                  isEditMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                {!isSidebarCollapsed && (
                  <>
                    <span>{isEditMode ? 'Đang Sửa' : 'Sửa'}</span>
                    <kbd
                      className={`ml-0.5 px-1 py-0.2 rounded text-[9px] font-mono ${
                        isEditMode
                          ? 'bg-amber-600/80 text-white border border-amber-400/60'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      E
                    </kbd>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Mở rộng mục lục bên trái' : 'Thu gọn mục lục bên trái'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Nút Studio Img: Xử lý ảnh đã chọn (Nhấn giữ S + Click ảnh ở mọi chế độ View/Edit) */}
        {studioCtx && (
          <button
            type="button"
            onClick={() => studioCtx.setIsStudioModalOpen(true)}
            title="Mở Studio Img • Nhấn giữ phím S + Click vào ảnh bất kỳ để chọn/bỏ chọn đưa vào Studio"
            className={`w-full rounded-xl text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer border shrink-0 ${
              isSidebarCollapsed ? 'p-1.5 justify-center relative' : 'px-2.5 py-1.5'
            } ${
              isHoldingSKey
                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400/60 shadow-sm'
                : selectedPhotoCount > 0
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-indigo-50/70 hover:text-indigo-800 hover:border-indigo-200'
            }`}
          >
            {isSidebarCollapsed ? (
              <>
                <Sparkles
                  className={`w-4 h-4 ${
                    isHoldingSKey
                      ? 'text-white animate-spin'
                      : selectedPhotoCount > 0
                        ? 'text-indigo-600'
                        : 'text-slate-500'
                  }`}
                />
                {selectedPhotoCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {selectedPhotoCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isHoldingSKey
                        ? 'text-white animate-pulse'
                        : selectedPhotoCount > 0
                          ? 'text-indigo-600'
                          : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{isHoldingSKey ? 'Đang giữ S • Click ảnh' : 'Studio Img'}</span>
                </div>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                    isHoldingSKey
                      ? 'bg-white/20 text-white'
                      : selectedPhotoCount > 0
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200/80 text-slate-600 font-mono'
                  }`}
                >
                  {selectedPhotoCount > 0 ? `${selectedPhotoCount} ảnh` : 'S+Click'}
                </span>
              </>
            )}
          </button>
        )}

        {renderTopSlot?.(isSidebarCollapsed)}

        {/* Danh sách bước (Cuộn độc lập và tự động nhảy theo vị trí cuộn của TDV) */}
        <nav ref={sidebarNavRef} className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-0.5 scrollbar-thin">
          {steps.map((st) => {
            const Icon = st.icon;
            const isActive = activeStepId === st.id;

            return (
              <div key={st.id} className="space-y-0.5">
                <button
                  type="button"
                  data-nav-id={st.id}
                  title={`${st.number}. ${st.title}${st.hasWarning ? ' (Có cảnh báo cần kiểm tra)' : ''}`}
                  onClick={() => onSelectStep(st.id)}
                  className={`w-full text-left rounded-xl text-[11px] font-semibold transition-all flex items-center group cursor-pointer relative ${
                    isSidebarCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 justify-between'
                  } ${
                    isActive
                      ? 'bg-sky-50 text-sky-900 font-bold border border-sky-300 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  {isSidebarCollapsed ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span className="text-[9px] font-mono leading-none">{st.number}</span>
                      {st.hasWarning && (
                        <span
                          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
                          title="Mục này đang có cảnh báo cần kiểm tra"
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                        <span className="truncate">{st.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {st.hasWarning && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 shrink-0"
                            title="Mục này đang có cảnh báo hoặc ảnh cần kiểm tra"
                          />
                        )}
                        {renderStepAddon?.(st.id)}
                        <span
                          className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                            isActive
                              ? 'bg-sky-200/80 text-sky-900 font-bold'
                              : 'text-slate-400 group-hover:bg-slate-200/60'
                          }`}
                        >
                          {st.number}
                        </span>
                      </div>
                    </>
                  )}
                </button>

                {renderStepChildren?.(st.id, isSidebarCollapsed)}
              </div>
            );
          })}
        </nav>

        {/* Thanh công cụ Lưu / Hủy khi có thay đổi - GIỮ BẢO LƯU KHI TẮT CHẾ ĐỘ SỬA */}
        {pendingCount > 0 && (
          <div className="pt-2.5 border-t border-amber-200/80 bg-amber-500/10 -mx-2.5 -mb-2.5 p-2.5 rounded-b-2xl space-y-1.5 border-b border-x border-amber-200/80 shrink-0">
            {isSidebarCollapsed ? (
              <button
                type="button"
                onClick={onSave}
                title={`Lưu Diff (${pendingCount} sửa đổi)`}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 transition-colors shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{pendingCount}</span>
              </button>
            ) : (
              <>
                <div className="text-[10px] font-bold text-amber-950 flex items-center justify-between">
                  <div className="flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="truncate">
                      {pendingCount} sửa đổi
                      {stagedPhotoCount > 0 ? ` (${stagedPhotoCount} ảnh)` : ''}
                    </span>
                  </div>
                  {!isEditMode && (
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-200/60 px-1 py-0.5 rounded shrink-0">
                      Chưa lưu
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onDiscard}
                    className="flex-1 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Hủy</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Lưu ({pendingCount})</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
