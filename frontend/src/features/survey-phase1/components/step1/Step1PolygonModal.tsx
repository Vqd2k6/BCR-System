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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-emerald-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold flex-shrink-0">
                P2
              </span>
              Vẽ Đa Giác Bao Mặt Đứng & Đường Phân Tầng (Ảnh P-02)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 ml-8">
              Chấm các đỉnh góc nhà để tính diện tích bao và kéo đường phân tầng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
            title="Hủy / Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-3 bg-slate-50">
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
