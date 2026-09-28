import React from 'react';
import {
  Building2,
  X,
  FileText,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { GisParcel } from '../../../gis/LeafletSweepMap';

interface MasterSurveyViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcel: GisParcel;
  isMasterSurveyDone: boolean;
  masterReportData: any;
  isUpdatePending: boolean;
  updateNotes: string;
  setUpdateNotes: (notes: string) => void;
  onSendMasterUpdate: (e: React.FormEvent) => void;
  onStartMasterSurvey: (parcel: GisParcel) => void;
  onParentClose: () => void;
  availableFloorsCount: number;
}

export const MasterSurveyViewModal: React.FC<MasterSurveyViewModalProps> = ({
  isOpen,
  onClose,
  parcel,
  isMasterSurveyDone,
  masterReportData,
  isUpdatePending,
  updateNotes,
  setUpdateNotes,
  onSendMasterUpdate,
  onStartMasterSurvey,
  onParentClose,
  availableFloorsCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-white border-b border-slate-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 flex-shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Khảo Sát Hạng Mục Dùng Chung Tòa Nhà
              </h3>
              <p className="text-xs text-slate-500">
                Số {parcel.houseNumber} {parcel.street} • Mã: {parcel.projectParcelCode || 'B-05272'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {!isMasterSurveyDone ? (
            <div className="text-center py-8 px-4 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                <Building2 size={32} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Chưa Có Dữ Liệu Khảo Sát Tổng Quan Chung Cư
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Tòa nhà này mới chỉ được thiết lập loại hình Chung cư từ bước khởi tạo thửa đất. Chưa có số liệu khảo sát thực tế về kết cấu chịu lực, loại móng, bộ ảnh mặt đứng và hạ tầng kỹ thuật dùng chung.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onParentClose();
                  onStartMasterSurvey(parcel);
                }}
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <FileText size={16} />
                <span>Mở Wizard Khảo Sát Chi Tiết Tòa Nhà</span>
              </button>
            </div>
          ) : (
            <>
              {/* Status Notice */}
              {isUpdatePending ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                  <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Đang chờ Zone Admin phê duyệt bản cập nhật mới</strong>
                    <span>Bản cập nhật hạng mục chung đã được gửi lên hệ thống và đang chờ quản trị viên khu vực phê duyệt trước khi đồng bộ toàn bộ căn hộ con.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Hồ sơ chung đã được kế thừa và xác thực</strong>
                    <span>Thông tin kết cấu, móng, mặt đứng (P-01 đến P-04) đã được khảo sát ở biểu mẫu tòa nhà tổng thể. Bạn có thể xem và gửi yêu cầu cập nhật bổ sung bên dưới.</span>
                  </div>
                </div>
              )}

              {/* Thông số kỹ thuật thực tế đã khảo sát */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex flex-col gap-2.5 text-xs">
                <span className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider text-sky-700">
                  1. Thông số kết cấu & kiến trúc thực tế:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>• Loại công trình: <strong>{masterReportData?.building_type || 'Chung cư / Nhà tập thể'}</strong></div>
                  <div>• Quy mô: <strong>{masterReportData?.buildingSpecs?.floor_count || parcel.floorCount || availableFloorsCount} Tầng nổi + {masterReportData?.buildingSpecs?.basement_count || 0} Hầm</strong></div>
                  <div>• Kết cấu móng: <strong>{masterReportData?.buildingSpecs?.foundation_category || 'Theo hồ sơ khảo sát đã duyệt'}</strong></div>
                  <div>• Khung chịu lực: <strong>{masterReportData?.buildingSpecs?.structural_system || 'Theo hồ sơ khảo sát đã duyệt'}</strong></div>
                  <div>• Mặt đứng kiến trúc: <strong>{masterReportData?.identificationPhotos?.length ? `P-01 đến P-04 (${masterReportData.identificationPhotos.length} ảnh đã chụp)` : 'Đã chụp bộ ảnh P-01 đến P-04'}</strong></div>
                  <div>• Tình trạng nứt lún chung: <strong>{masterReportData?.summary_conclusions || 'Đã ghi nhận trong hồ sơ tổng thể'}</strong></div>
                </div>
              </div>

              {/* Gửi bản update mới */}
              <form onSubmit={onSendMasterUpdate} className="flex flex-col gap-2.5 pt-1">
                <label className="block text-xs font-bold text-slate-800">
                  Ghi chú nội dung cập nhật bổ sung (nếu có thay đổi hiện trạng):
                </label>
                <textarea
                  rows={3}
                  placeholder="Nhập chi tiết các thay đổi hoặc vết nứt mới phát hiện ở khu vực dùng chung..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onParentClose();
                      onStartMasterSurvey(parcel);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <FileText size={14} className="text-sky-600" />
                    <span>Mở Wizard Khảo Sát Chi Tiết</span>
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Gửi Bản Cập Nhật Mới Về Cho Zone Admin</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
