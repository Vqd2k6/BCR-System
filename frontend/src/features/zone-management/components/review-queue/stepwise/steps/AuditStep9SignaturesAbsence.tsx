import React from 'react';
import {
  PenTool,
  CheckCircle2,
  UserX,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building2,
} from 'lucide-react';

interface Props {
  isEditMode?: boolean;
  formState: Record<string, any>;
  data?: any;
  handleFieldChange?: (fieldKey: string, label: string, val: any) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: any) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onConfirmAbsenteeSurvey?: () => void;
}

export const AuditStep9SignaturesAbsence: React.FC<Props> = ({
  isEditMode = false,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
  onConfirmAbsenteeSurvey,
}) => {
  const sigs = formState.signatures || {};
  const absenceLogs = formState.absenceLogs || data?.leftPane?.absenceLogs || [];
  const isAbsentee = formState.isRefusedOrAbsent || formState.status === 'POSTPONED_ABSENT' || absenceLogs.length > 0;

  // Working minutes photos
  const workingMinutesPhotos: any[] = sigs.workingMinutesPhotos || formState.workingMinutesPhotos || [];
  const ownerFeedback = sigs.ownerFeedback || formState.ownerFeedback || formState.ownerRemarks;

  const surveyorName = sigs.surveyorName || formState.surveyorName || data?.surveyorName;
  const surveyorPhone = sigs.surveyorPhone || formState.surveyorPhone || data?.surveyorPhone;
  const ownerName = sigs.ownerName || formState.ownerName || data?.ownerName;
  const ownerPhone = sigs.ownerPhone || formState.ownerPhone || formState.ownerInterview?.phone;
  const surveyDate = formState.surveyDate || data?.surveyDate;

  // Witness / Local Authority Info
  const witnessName = sigs.witnessName || formState.witnessName || formState.witnessInfo?.name;
  const witnessRole = sigs.witnessRole || formState.witnessRole || formState.witnessInfo?.role || 'Tổ trưởng tổ dân phố / Cán bộ địa chính';
  const witnessPhone = sigs.witnessPhone || formState.witnessPhone || formState.witnessInfo?.phone;
  const witnessSignature = sigs.witnessSignature || formState.witnessSignature || formState.witnessInfo?.signature;

  const getPhotoUrl = (p: any): string => {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.url || p.photoUrl || p.raw_photo_url || '';
  };

  return (
    <section id="step-9" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 09
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Pháp Lý Hiện Trường, Chữ Ký Biên Bản & Nhật Ký Vắng Mặt
            </h3>
            <p className="text-xs text-slate-500">
              Đối soát chữ ký điện tử, biên bản làm việc thực địa và thông tin người làm chứng
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Khối Thông Tin Đại Diện Các Bên */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cán bộ Khảo Sát Viên */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <User className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-black uppercase text-slate-800">
                1. Cán Bộ Khảo Sát Viên (Đại diện Tư vấn)
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Họ và tên:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={surveyorName || ''}
                    onChange={(e) => handleFieldChange('surveyorName', 'Họ tên KSV', e.target.value)}
                    placeholder="Tên KSV..."
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{surveyorName || 'Cán bộ hiện trường'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại liên hệ:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={surveyorPhone || ''}
                    onChange={(e) => handleFieldChange('surveyorPhone', 'SĐT KSV', e.target.value)}
                    placeholder="SĐT KSV..."
                    className="p-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-700">{surveyorPhone || '---'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Ngày ký biên bản:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="date"
                    value={surveyDate ? new Date(surveyDate).toISOString().slice(0, 10) : ''}
                    onChange={(e) => handleFieldChange('surveyDate', 'Ngày khảo sát', e.target.value)}
                    className="p-1 text-xs font-mono text-slate-700 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-mono font-semibold text-slate-600">
                    {surveyDate ? new Date(surveyDate).toLocaleDateString('vi-VN') : 'Tại thời điểm khảo sát'}
                  </span>
                )}
              </div>
            </div>

            {/* Chữ ký KSV */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                Chữ Ký Điện Tử Khảo Sát Viên:
              </span>
              {sigs.surveyorSignature ? (
                <div
                  onClick={() => onOpenPhotoZoom(sigs.surveyorSignature, 'Chữ ký Khảo Sát Viên')}
                  className="bg-white rounded-lg p-2 border border-slate-200 cursor-pointer hover:border-sky-400 inline-block transition-colors"
                >
                  <img
                    src={sigs.surveyorSignature}
                    alt="Chữ ký KSV"
                    className="h-16 mx-auto object-contain hover:scale-105 transition-transform"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Click để phóng to</span>
                </div>
              ) : (
                <div className="h-14 flex items-center justify-center text-xs text-slate-400 italic bg-white rounded-lg border border-dashed border-slate-200">
                  Chưa có ảnh chữ ký KSV
                </div>
              )}
            </div>
          </div>

          {/* Đại diện Chủ Hộ / Công Trình */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-black uppercase text-slate-800">
                2. Đại Diện Chủ Hộ / Chủ Sở Hữu Công Trình
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Người ký biên bản:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={ownerName || ''}
                    onChange={(e) => handleFieldChange('ownerName', 'Họ tên chủ hộ', e.target.value)}
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{ownerName || 'Chủ hộ / Đại diện'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại liên hệ:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={ownerPhone || ''}
                    onChange={(e) => handleFieldChange('ownerPhone', 'SĐT chủ hộ', e.target.value)}
                    placeholder="SĐT chủ hộ..."
                    className="p-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-700">{ownerPhone || '---'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Tình trạng tiếp cận:</span>
                <span className="font-bold text-emerald-700">
                  {isAbsentee ? 'Vắng mặt (Ghi nhận biên bản)' : 'Có mặt tại hiện trường'}
                </span>
              </div>
            </div>

            {/* Chữ ký Chủ Hộ */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                Chữ Ký Chủ Hộ / Đại Diện Nhận Bàn Giao:
              </span>
              {sigs.ownerSignature ? (
                <div
                  onClick={() => onOpenPhotoZoom(sigs.ownerSignature, 'Chữ ký Chủ Hộ')}
                  className="bg-white rounded-lg p-2 border border-slate-200 cursor-pointer hover:border-emerald-400 inline-block transition-colors"
                >
                  <img
                    src={sigs.ownerSignature}
                    alt="Chữ ký Chủ hộ"
                    className="h-16 mx-auto object-contain hover:scale-105 transition-transform"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Click để phóng to</span>
                </div>
              ) : (
                <div className="h-14 flex items-center justify-center text-xs text-slate-400 italic bg-white rounded-lg border border-dashed border-slate-200">
                  {isAbsentee ? 'Vắng mặt chủ hộ (Không có chữ ký)' : 'Chưa thu thập chữ ký chủ hộ'}
                </div>
              )}
            </div>
          </div>

          {/* Người Làm Chứng / Xác Nhận Địa Phương */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-black uppercase text-slate-800">
                3. Người Làm Chứng / Đại Diện Địa Phương
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Người làm chứng:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessName || ''}
                    onChange={(e) => handleFieldChange('witnessName', 'Người làm chứng', e.target.value)}
                    placeholder="Họ tên người làm chứng..."
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{witnessName || (isAbsentee ? 'Cán bộ TDP / Địa chính' : 'Không yêu cầu người làm chứng')}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Chức vụ / Đơn vị:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessRole || ''}
                    onChange={(e) => handleFieldChange('witnessRole', 'Chức vụ người làm chứng', e.target.value)}
                    placeholder="VD: Tổ trưởng TDP 12"
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="text-slate-700">{witnessRole || '---'}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessPhone || ''}
                    onChange={(e) => handleFieldChange('witnessPhone', 'SĐT người làm chứng', e.target.value)}
                    placeholder="SĐT..."
                    className="p-1 text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-mono text-slate-700">{witnessPhone || '---'}</span>
                )}
              </div>
            </div>

            {/* Chữ ký Người làm chứng */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                Chữ Ký / Xác Nhận Người Làm Chứng:
              </span>
              {witnessSignature ? (
                <div
                  onClick={() => onOpenPhotoZoom(witnessSignature, 'Chữ ký Người Làm Chứng')}
                  className="bg-white rounded-lg p-2 border border-slate-200 cursor-pointer hover:border-purple-400 inline-block transition-colors"
                >
                  <img
                    src={witnessSignature}
                    alt="Chữ ký Người làm chứng"
                    className="h-16 mx-auto object-contain hover:scale-105 transition-transform"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Click để phóng to</span>
                </div>
              ) : (
                <div className="h-14 flex items-center justify-center text-xs text-slate-400 italic bg-white rounded-lg border border-dashed border-slate-200">
                  {isAbsentee ? 'Chưa đính kèm chữ ký người làm chứng' : 'Không áp dụng khi chủ hộ có mặt'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ý kiến phản hồi của chủ hộ (nếu có) */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
            <MessageSquare className="w-4 h-4 text-blue-700" />
            <span>Ý Kiến & Ghi Chú Phản Hồi Của Chủ Hộ Khi Khảo Sát:</span>
          </div>
          {isEditMode && handleFieldChange ? (
            <textarea
              rows={2}
              value={ownerFeedback || ''}
              onChange={(e) => handleFieldChange('ownerFeedback', 'Ý kiến chủ hộ', e.target.value)}
              placeholder="Nhập ý kiến phản hồi hoặc cam kết của chủ hộ..."
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-blue-300 rounded-lg"
            />
          ) : (
            <p className="text-xs text-slate-800 whitespace-pre-wrap pl-5 bg-white p-3 rounded-lg border border-blue-100 font-medium">
              {ownerFeedback || 'Không có ý kiến phản hồi hay khiếu nại thêm từ chủ hộ.'}
            </p>
          )}
        </div>

        {/* Khối Ảnh Biên Bản Làm Việc & Pháp Lý Đi Kèm */}
        {workingMinutesPhotos.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-black uppercase text-slate-800">
                Ảnh Chụp Biên Bản Hiện Trường & Pháp Lý Đi Kèm ({workingMinutesPhotos.length} ảnh)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {workingMinutesPhotos.map((photoItem: any, idx: number) => {
                const url = getPhotoUrl(photoItem);
                const caption =
                  typeof photoItem === 'object'
                    ? photoItem.caption || photoItem.photoCode || `Biên bản trang ${idx + 1}`
                    : `Biên bản trang ${idx + 1}`;
                if (!url) return null;

                return (
                  <div
                    key={idx}
                    onClick={() => onOpenPhotoZoom(url, caption, photoItem?.photoCode)}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-sky-400 hover:shadow-md transition-all cursor-pointer aspect-4/3"
                  >
                    <img
                      src={url}
                      alt={caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-white">
                      <p className="text-[11px] font-bold truncate">{caption}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Khối Nhật Ký Vắng Mặt */}
        {isAbsentee && (
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-black uppercase text-purple-900">
                  Nhật Ký Khảo Sát Vắng Chủ Hộ ({absenceLogs.length} lần ghi nhận)
                </span>
              </div>
              {onConfirmAbsenteeSurvey && (
                <button
                  type="button"
                  onClick={onConfirmAbsenteeSurvey}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận & Cập Nhật Trạng Thái Vắng Mặt</span>
                </button>
              )}
            </div>

            {absenceLogs.length === 0 ? (
              <div className="text-xs text-purple-700 italic p-3 bg-white rounded-lg border border-purple-100">
                Hồ sơ này được cán bộ hiện trường phân loại là khảo sát ngoại quan do chủ hộ vắng mặt dài ngày.
              </div>
            ) : (
              <div className="space-y-2">
                {absenceLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="p-3 bg-white rounded-xl border border-purple-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">
                        Lần {log.attempt_number || idx + 1}: {log.reason || 'Chủ hộ đi vắng'}
                      </span>
                      {log.notes && <p className="text-[11px] text-slate-500 mt-0.5">{log.notes}</p>}
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      {log.created_at ? new Date(log.created_at).toLocaleDateString('vi-VN') : '---'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cam kết pháp lý & Tiêu chuẩn thẩm định */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Hồ sơ được thẩm định theo quy chuẩn kỹ thuật Liên danh CRLG-CRSRI-TT và Nghị định 15/2021/NĐ-CP về quản lý chất lượng công trình xây dựng phục vụ dự án Tuyến Metro số 2 TP.HCM.
          </span>
        </div>
      </div>
    </section>
  );
};
