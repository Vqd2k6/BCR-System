import { X } from 'lucide-react';
import { FacadePolygonCanvas, PolygonPoint, FloorSplitLine, FreehandStroke } from '../../../../components/canvas/FacadePolygonCanvas';
import { Phase1SurveyFormData } from '../../types/phase1.types';

interface Step1PolygonModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoP02Url: string;
  polygonPoints?: PolygonPoint[];
  floorSplits?: FloorSplitLine[];
  onSave: (data: { polygonPoints: PolygonPoint[]; splitLines: FloorSplitLine[]; freehandStrokes?: FreehandStroke[] }) => void;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  photoP02: Phase1SurveyFormData['photoP02'];
}

export const Step1PolygonModal: React.FC<Step1PolygonModalProps> = ({
  isOpen,
  onClose,
  photoP02Url,
  polygonPoints,
  floorSplits,
  onSave,
  updateFormData,
  photoP02,
}) => {
  if (!isOpen || !photoP02Url) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col p-0 sm:p-4 animate-in fade-in"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 flex-1 flex flex-col overflow-hidden h-full">
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="font-bold text-xs sm:text-base text-emerald-800 flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white text-[10px] sm:text-[11px] flex items-center justify-center font-bold flex-shrink-0">
                P2
              </span>
              <span className="truncate">Vẽ Đa Giác Bao & Đường Phân Tầng (Ảnh P-02)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 ml-6 sm:ml-8 hidden xs:block truncate">
              Chấm các đỉnh góc nhà để tính diện tích bao và kéo đường phân tầng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0 cursor-pointer"
            title="Hủy / Đóng"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-1.5 sm:p-3 bg-slate-900 flex flex-col min-h-0">
          <FacadePolygonCanvas
            imageUrl={photoP02Url}
            polygonPoints={polygonPoints}
            floorSplitLines={floorSplits}
            onChange={(points, splitLines) => {
              updateFormData({
                photoP02: {
                  ...photoP02,
                  polygonPoints: points,
                  floorSplits: splitLines,
                },
              });
            }}
            onSave={(data) => {
              onSave(data);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
