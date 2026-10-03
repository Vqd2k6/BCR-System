import React, { useState } from 'react';
import {
  X,
  Split,
  Merge,
  AlertTriangle,
  CheckCircle2,
  Building,
  Home,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AdminSecurityChallengeConfirm } from './AdminSecurityChallengeConfirm';

interface Props {
  isOpen: boolean;
  parcelId: string;
  parcelCode: string;
  houseNumber?: string;
  street?: string;
  currentAreaM2?: number;
  reportId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ChildParcelInput {
  houseNumber: string;
  ownerName: string;
  ownerPhone: string;
  landAreaM2: number;
  floorCount: number;
}

export const AdminGisMutationModal: React.FC<Props> = ({
  isOpen,
  parcelId,
  parcelCode,
  houseNumber = '',
  street = '',
  currentAreaM2 = 0,
  reportId,
  onClose,
  onSuccess,
}) => {
  const [mutationType, setMutationType] = useState<'SPLIT' | 'MERGE'>('SPLIT');
  const [adminNotes, setAdminNotes] = useState('');
  const [transferReportToChild1, setTransferReportToChild1] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  // Default 2 child parcels for SPLIT
  const [childParcels, setChildParcels] = useState<ChildParcelInput[]>([
    {
      houseNumber: houseNumber ? `${houseNumber}A` : 'Căn A',
      ownerName: '',
      ownerPhone: '',
      landAreaM2: currentAreaM2 > 0 ? Math.round((currentAreaM2 / 2) * 10) / 10 : 50,
      floorCount: 1,
    },
    {
      houseNumber: houseNumber ? `${houseNumber}B` : 'Căn B',
      ownerName: '',
      ownerPhone: '',
      landAreaM2: currentAreaM2 > 0 ? Math.round((currentAreaM2 / 2) * 10) / 10 : 50,
      floorCount: 1,
    },
  ]);

  if (!isOpen) return null;

  const handleAddChild = () => {
    const nextChar = String.fromCharCode(65 + childParcels.length); // C, D, ...
    setChildParcels((prev) => [
      ...prev,
      {
        houseNumber: houseNumber ? `${houseNumber}${nextChar}` : `Căn ${nextChar}`,
        ownerName: '',
        ownerPhone: '',
        landAreaM2: 50,
        floorCount: 1,
      },
    ]);
  };

  const handleRemoveChild = (index: number) => {
    if (childParcels.length <= 2) return;
    setChildParcels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChildChange = (index: number, field: keyof ChildParcelInput, val: any) => {
    setChildParcels((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNotes.trim()) {
      setErrorMsg('Vui lòng nhập lý do biến động để lưu vết kiểm toán.');
      return;
    }

    // Kiểm tra tổng diện tích
    const totalArea = childParcels.reduce((sum, c) => sum + (Number(c.landAreaM2) || 0), 0);
    if (mutationType === 'SPLIT' && totalArea <= 0) {
      setErrorMsg('Vui lòng nhập diện tích hợp lệ cho các căn tách thửa.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // Mock polygon GeoJSON dựa trên thửa nguồn (hoặc bounding box)
      const mockPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [106.71, 10.79],
            [106.711, 10.79],
            [106.711, 10.791],
            [106.71, 10.791],
            [106.71, 10.79],
          ],
        ],
      };

      const payload = {
        mutationType,
        sourceParcelIds: [parcelId],
        childParcels: childParcels.map((c) => ({
          houseNumber: c.houseNumber,
          street: street,
          ownerName: c.ownerName,
          ownerPhone: c.ownerPhone,
          landAreaM2: Number(c.landAreaM2) || 0,
          floorCount: Number(c.floorCount) || 1,
          polygonGeoJson: mockPolygon,
        })),
        adminNotes: adminNotes.trim(),
        transferSurveyReportId: (transferReportToChild1 && reportId) ? reportId : undefined,
      };

      const res = await api.post('/admin/parcels/execute-mutation', payload);

      if (res.data?.success) {
        onSuccess(res.data.message || 'Đã thực thi biến động thửa đất thành công!');
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể thực thi biến động thửa');
      }
    } catch (err: any) {
      console.error('[AdminGisMutationModal] Error:', err);
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Lỗi thực thi biến động thửa đất trên GIS.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Tách / Gộp Thửa Đất GIS (Zone Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Thực thi biến động trực tiếp trên GIS khi KSV không rành thao tác hiện trường
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thửa Nguồn Card */}
        <div className="p-4 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
              Thửa Đất Gốc Cần Biến Động
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono font-black text-sm text-sky-900">[{parcelCode}]</span>
              <span className="text-xs font-semibold text-slate-700">
                {houseNumber ? `Số ${houseNumber}` : ''} {street || ''}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 block">Diện tích hiện trạng</span>
            <span className="font-bold text-xs text-slate-800 font-mono">
              {currentAreaM2 ? `${currentAreaM2} m²` : '---'}
            </span>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loại biến động */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Loại Hình Biến Động:</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer text-xs font-bold transition-all ${
                  mutationType === 'SPLIT'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mutType"
                  checked={mutationType === 'SPLIT'}
                  onChange={() => setMutationType('SPLIT')}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <Split className="w-4 h-4 text-sky-600" />
                <span>Tách Thửa Thực Địa (Căn A / B)</span>
              </label>

              <label
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer text-xs font-bold transition-all ${
                  mutationType === 'MERGE'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mutType"
                  checked={mutationType === 'MERGE'}
                  onChange={() => setMutationType('MERGE')}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <Merge className="w-4 h-4 text-sky-600" />
                <span>Gộp Thửa Thực Địa (Khuôn viên chung)</span>
              </label>
            </div>
          </div>

          {/* Danh sách căn con phát sinh */}
          {mutationType === 'SPLIT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Danh Sách Thửa Con Phát Sinh Sau Tách ({childParcels.length} thửa):
                </label>
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm thửa con</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {childParcels.map((child, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end text-xs"
                  >
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Số nhà con:
                      </label>
                      <input
                        type="text"
                        value={child.houseNumber}
                        onChange={(e) => handleChildChange(idx, 'houseNumber', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Chủ sở hữu con:
                      </label>
                      <input
                        type="text"
                        placeholder="Họ tên chủ nhà..."
                        value={child.ownerName}
                        onChange={(e) => handleChildChange(idx, 'ownerName', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Diện tích (m²):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={child.landAreaM2}
                        onChange={(e) => handleChildChange(idx, 'landAreaM2', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold font-mono text-slate-800"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Số tầng:
                        </label>
                        <input
                          type="number"
                          value={child.floorCount}
                          onChange={(e) => handleChildChange(idx, 'floorCount', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold font-mono text-slate-800"
                        />
                      </div>
                      {childParcels.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(idx)}
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                          title="Xóa thửa con này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Checkbox chuyển hồ sơ khảo sát sang Thửa Con 1 */}
              {reportId && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferReportToChild1}
                    onChange={(e) => setTransferReportToChild1(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold">
                    Tự động gán biên bản khảo sát hiện tại sang thửa con đầu tiên ({childParcels[0]?.houseNumber || 'Căn A'})
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Lý do biến động */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Ghi Chú Kỹ Thuật Biến Động (Audit Log):
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ví dụ: Hiện trường thực tế là nhà chia 2 căn A và B riêng biệt có 2 lối đi và đồng hồ điện riêng. Thực hiện tách thửa GIS và cấp mã tự động."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Mã bảo mật 6 số bắt buộc */}
          <AdminSecurityChallengeConfirm
            actionDescription={
              mutationType === 'SPLIT'
                ? `tách thửa [${parcelCode}] thành ${childParcels.length} thửa con độc lập`
                : `gộp thửa [${parcelCode}] với các thửa liền kề`
            }
            onValidityChange={(isValid) => setIsChallengeValid(isValid)}
          />

          {/* Footer buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isChallengeValid}
              className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang thực thi biến động...' : 'Xác Nhận & Cấp Mã Thửa GIS Mới'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
