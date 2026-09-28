import React from 'react';
import { Box, AlertCircle, FileSignature, Compass } from 'lucide-react';
import { EditFormData } from '../../../types';

interface AdjacentAndDeformationSectionProps {
  editFormData: EditFormData;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
}

export const AdjacentAndDeformationSection: React.FC<AdjacentAndDeformationSectionProps> = ({
  editFormData,
  handleUpdateFormField,
}) => {
  return (
    <>
      {/* ── Section 4: Công trình liền kề ba phía ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <Box size={14} className="text-violet-600" />
          <span>4. Công Trình Tiếp Giáp Ba Phía (Liền Kề)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-xs font-bold text-slate-700 block mb-1.5">Bên trái (Left)</span>
            <input
              type="text"
              value={editFormData.adjacentLeftDetails}
              onChange={(e) => handleUpdateFormField('adjacentLeftDetails', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 mb-2 focus:border-sky-500 outline-none"
            />
            <textarea
              rows={2}
              value={editFormData.adjacentLeftNote}
              onChange={(e) => handleUpdateFormField('adjacentLeftNote', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
              placeholder="Ghi chú khoảng hở, nứt khe lún..."
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-xs font-bold text-slate-700 block mb-1.5">Bên phải (Right)</span>
            <input
              type="text"
              value={editFormData.adjacentRightDetails}
              onChange={(e) => handleUpdateFormField('adjacentRightDetails', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 mb-2 focus:border-sky-500 outline-none"
            />
            <textarea
              rows={2}
              value={editFormData.adjacentRightNote}
              onChange={(e) => handleUpdateFormField('adjacentRightNote', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
              placeholder="Ghi chú khoảng hở, nứt khe lún..."
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-xs font-bold text-slate-700 block mb-1.5">Phía sau (Rear)</span>
            <input
              type="text"
              value={editFormData.adjacentBackDetails}
              onChange={(e) => handleUpdateFormField('adjacentBackDetails', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 mb-2 focus:border-sky-500 outline-none"
            />
            <textarea
              rows={2}
              value={editFormData.adjacentBackNote}
              onChange={(e) => handleUpdateFormField('adjacentBackNote', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
              placeholder="Ghi chú khoảng hở, nứt khe lún..."
            />
          </div>
        </div>
      </div>

      {/* ── Section 5: Phạm vi khảo sát & Hạn chế tiếp cận ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <AlertCircle size={14} className="text-amber-600" />
          <span>5. Phạm Vi Không Gian Khảo Sát & Hạn Chế Tiếp Cận (Access Limitations)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Mức độ hạn chế</label>
            <select
              value={editFormData.accessLimitationLevel}
              onChange={(e) => handleUpdateFormField('accessLimitationLevel', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="NONE">Không có hạn chế (Tiếp cận 100%)</option>
              <option value="PARTIAL">Hạn chế một phần (Khóa phòng/mái)</option>
              <option value="SEVERE">Hạn chế nghiêm trọng (Chỉ xem bên ngoài)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Khu vực hạn chế tiếp cận</label>
            <input
              type="text"
              value={editFormData.accessRestrictedAreas}
              onChange={(e) => handleUpdateFormField('accessRestrictedAreas', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Tầng tum, phòng thờ khóa..."
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Nguyên nhân hạn chế</label>
            <input
              type="text"
              value={editFormData.accessMainReason}
              onChange={(e) => handleUpdateFormField('accessMainReason', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Chủ nhà khóa cửa / Đồ đạc chất đầy..."
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Biện pháp xử lý</label>
            <input
              type="text"
              value={editFormData.accessMitigationAction}
              onChange={(e) => handleUpdateFormField('accessMitigationAction', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Khảo sát bổ sung trước TBM"
            />
          </div>
        </div>
      </div>

      {/* ── Section 6: Lịch sử công trình & Phỏng vấn chủ hộ ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <FileSignature size={14} className="text-teal-600" />
          <span>6. Lịch Sử Công Trình & Phỏng Vấn Chủ Hộ (History Interview)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cơi nới / Tăng tải / Nâng tầng</label>
            <input
              type="text"
              value={editFormData.historyRemodeling}
              onChange={(e) => handleUpdateFormField('historyRemodeling', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Không / Nâng thêm 1 tầng năm 2021"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Sửa chữa lớn / Gia cố kết cấu</label>
            <input
              type="text"
              value={editFormData.historyRepairNotes}
              onChange={(e) => handleUpdateFormField('historyRepairNotes', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Không / Đã sửa tường thấm năm 2023"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Lịch sử lún / Nghiêng / Nứt cũ</label>
            <input
              type="text"
              value={editFormData.historySettlementNotes}
              onChange={(e) => handleUpdateFormField('historySettlementNotes', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              placeholder="Ví dụ: Không phát hiện lún bất thường"
            />
          </div>
        </div>
      </div>

      {/* ── Section 7: Đo đạc biến dạng & Lún nghiêng ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <Compass size={14} className="text-indigo-600" />
          <span>7. Đo Đạc Biến Dạng & Lún Nghiêng (Settlement & Tilt)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Độ nghiêng X (‰)</label>
            <input
              type="text"
              value={editFormData.tiltX}
              onChange={(e) => handleUpdateFormField('tiltX', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Độ nghiêng Y (‰)</label>
            <input
              type="text"
              value={editFormData.tiltY}
              onChange={(e) => handleUpdateFormField('tiltY', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Hướng nghiêng</label>
            <input
              type="text"
              value={editFormData.tiltDirection}
              onChange={(e) => handleUpdateFormField('tiltDirection', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp nghiêng (0–4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={editFormData.buildingTiltLevel}
              onChange={(e) => handleUpdateFormField('buildingTiltLevel', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Võng dầm (mm)</label>
            <input
              type="text"
              value={editFormData.beamSagMm}
              onChange={(e) => handleUpdateFormField('beamSagMm', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp võng dầm (0–4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={editFormData.beamSaggingLevel}
              onChange={(e) => handleUpdateFormField('beamSaggingLevel', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-mono"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[11px] font-bold text-slate-600 block mb-1">
            Nhận xét của kỹ sư về biến dạng & Quan trắc bổ sung (Notes)
          </label>
          <textarea
            rows={2}
            value={editFormData.deformationNotes}
            onChange={(e) => handleUpdateFormField('deformationNotes', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            placeholder="Đánh giá xu hướng nghiêng, so sánh với công trình liền kề, đề xuất mốc quan trắc..."
          />
        </div>
      </div>
    </>
  );
};
