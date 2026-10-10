import React from 'react';
import { FileText, Building, Compass, Layers } from 'lucide-react';
import type { EditFormData } from '../../../types';

interface GeneralAndFoundationSectionProps {
  editFormData: EditFormData;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
}

export const GeneralAndFoundationSection: React.FC<GeneralAndFoundationSectionProps> = ({
  editFormData,
  handleUpdateFormField,
}) => {
  return (
    <>
      {/* ── Section 0: Thông tin Định danh & Cán bộ khảo sát ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <FileText size={14} className="text-indigo-600" />
          <span>0. Thông Tin Định Danh Hồ Sơ & Cán Bộ Khảo Sát</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Mã số báo cáo</label>
            <input
              type="text"
              value={editFormData.reportCode}
              onChange={(e) => handleUpdateFormField('reportCode', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Mã thửa địa chính</label>
            <input
              type="text"
              value={editFormData.officialCadastralCode}
              onChange={(e) => handleUpdateFormField('officialCadastralCode', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Ngày lập báo cáo</label>
            <input
              type="date"
              value={editFormData.surveyDate}
              onChange={(e) => handleUpdateFormField('surveyDate', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cán bộ khảo sát</label>
            <input
              type="text"
              value={editFormData.surveyorName}
              onChange={(e) => handleUpdateFormField('surveyorName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Mã thẻ cán bộ</label>
            <input
              type="text"
              value={editFormData.surveyorCode}
              onChange={(e) => handleUpdateFormField('surveyorCode', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Giám đốc kiểm duyệt</label>
            <input
              type="text"
              value={editFormData.zoneAdminName}
              onChange={(e) => handleUpdateFormField('zoneAdminName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Section 1: Thông tin chung & Quy mô công trình ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <Building size={14} className="text-sky-600" />
          <span>1. Thông Tin Chung & Quy Mô Kiến Trúc</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên công trình</label>
            <input
              type="text"
              value={editFormData.buildingName}
              onChange={(e) => handleUpdateFormField('buildingName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Nhà dân cư kết hợp kinh doanh"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Chủ sở hữu / Người đại diện</label>
            <input
              type="text"
              value={editFormData.ownerName}
              onChange={(e) => handleUpdateFormField('ownerName', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Số điện thoại liên hệ</label>
            <input
              type="text"
              value={editFormData.ownerPhone}
              onChange={(e) => handleUpdateFormField('ownerPhone', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Số nhà</label>
            <input
              type="text"
              value={editFormData.houseNumber}
              onChange={(e) => handleUpdateFormField('houseNumber', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên đường</label>
            <input
              type="text"
              value={editFormData.street}
              onChange={(e) => handleUpdateFormField('street', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Công năng sử dụng</label>
            <input
              type="text"
              value={editFormData.usageFunction}
              onChange={(e) => handleUpdateFormField('usageFunction', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Số tầng nổi</label>
            <input
              type="number"
              min="1"
              max="50"
              value={editFormData.aboveFloors}
              onChange={(e) => handleUpdateFormField('aboveFloors', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Số tầng hầm</label>
            <input
              type="number"
              min="0"
              max="10"
              value={editFormData.undergroundFloors}
              onChange={(e) => handleUpdateFormField('undergroundFloors', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Năm xây dựng</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editFormData.constructionYear}
                onChange={(e) => handleUpdateFormField('constructionYear', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              />
              <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={editFormData.isEstimatedYear}
                  onChange={(e) => handleUpdateFormField('isEstimatedYear', e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Ước tính</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Diện tích sàn XD (m²)</label>
            <input
              type="text"
              value={editFormData.constructionAreaM2}
              onChange={(e) => handleUpdateFormField('constructionAreaM2', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Chiều cao công trình (m)</label>
            <input
              type="text"
              value={editFormData.buildingHeightM}
              onChange={(e) => handleUpdateFormField('buildingHeightM', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Hệ kết cấu chịu lực</label>
            <select
              value={editFormData.structureSystem}
              onChange={(e) => handleUpdateFormField('structureSystem', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="KHUNG_BTCT_CHIU_LUC">Khung bê tông cốt thép (BTCT) chịu lực</option>
              <option value="TUONG_GACH_CHIU_LUC">Tường gạch chịu lực</option>
              <option value="KET_CAU_THEP">Khung kết cấu thép</option>
              <option value="KET_CAU_HON_HOP">Kết cấu hỗn hợp</option>
              <option value="NHA_GO">Nhà gỗ</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 2: Tuyến Metro, Tọa độ & Phân loại khảo sát ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <Compass size={14} className="text-blue-600" />
          <span>2. Tuyến Metro Số 2, Tọa Độ & Phân Loại Đối Tượng</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Lý trình tim hầm (Chainage)</label>
            <input
              type="text"
              value={editFormData.chainage}
              onChange={(e) => handleUpdateFormField('chainage', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Km 03+450"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cự ly cách tim hầm (m)</label>
            <input
              type="text"
              value={editFormData.metroOffsetDistance}
              onChange={(e) => handleUpdateFormField('metroOffsetDistance', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: 12.5"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Phân loại trường hợp khảo sát</label>
            <select
              value={editFormData.surveyCaseType}
              onChange={(e) => handleUpdateFormField('surveyCaseType', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="NORMAL">Khảo sát bình thường (NORMAL)</option>
              <option value="ABSENTEE">Chủ hộ vắng mặt (ABSENTEE)</option>
              <option value="VACANT_LAND">Khu đất trống (VACANT_LAND)</option>
              <option value="APARTMENT">Căn hộ chung cư (APARTMENT)</option>
              <option value="UNDER_CONSTRUCTION">Công trình đang thi công (UNDER_CONSTRUCTION)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Nhóm đối tượng công trình</label>
            <select
              value={editFormData.objectGroup}
              onChange={(e) => handleUpdateFormField('objectGroup', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="GENERAL">Nhà dân cư thông thường (GENERAL)</option>
              <option value="IMPORTANT">Công trình tập trung đông người (IMPORTANT)</option>
              <option value="SENSITIVE">Di tích / Nhạy cảm biến dạng (SENSITIVE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Kết cấu nền móng chi tiết ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <Layers size={14} className="text-emerald-600" />
          <span>3. Kết Cấu Nền Móng & Chi Tiết Cọc</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Phân loại móng</label>
            <input
              type="text"
              value={editFormData.foundationType}
              onChange={(e) => handleUpdateFormField('foundationType', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Nguồn thông tin</label>
            <input
              type="text"
              value={editFormData.foundationSource}
              onChange={(e) => handleUpdateFormField('foundationSource', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Chiều sâu móng (m)</label>
            <input
              type="text"
              value={editFormData.foundationDepthM}
              onChange={(e) => handleUpdateFormField('foundationDepthM', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Kích thước cọc (cm)</label>
            <input
              type="text"
              value={editFormData.pileDimensionMm}
              onChange={(e) => handleUpdateFormField('pileDimensionMm', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Chiều dài cọc (mm)</label>
            <input
              type="text"
              value={editFormData.pileLengthMm}
              onChange={(e) => handleUpdateFormField('pileLengthMm', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">
            Ghi chú chi tiết về móng (Notes) - Xuất trực tiếp lên Báo cáo
          </label>
          <textarea
            rows={2}
            value={editFormData.foundationNotes}
            onChange={(e) => handleUpdateFormField('foundationNotes', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            placeholder="Nhập ghi chú móng: cấu tạo móng, tình trạng đài giằng, cừ tràm, chiều sâu chôn cọc..."
          />
        </div>
      </div>
    </>
  );
};
