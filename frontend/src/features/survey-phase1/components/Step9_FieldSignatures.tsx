import React, { useRef } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Textarea } from '../../../core/components/ui/FormControls';
import {
  FileCheck2,
  Send,
  Camera,
  Upload,
  Trash2,
  FileText,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Step9Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
}

export const Step9_FieldSignatures: React.FC<Step9Props> = ({ onSubmitFinal, isSubmitting = false }) => {
  const { formData, updateFormData, prevStep } = usePhase1SurveyStore();
  const sigs = formData.signatures;

  // File input refs
  const preparedPhotoCameraRef = useRef<HTMLInputElement>(null);
  const preparedPhotoFileRef = useRef<HTMLInputElement>(null);

  const ownerPhotoCameraRef = useRef<HTMLInputElement>(null);
  const ownerPhotoFileRef = useRef<HTMLInputElement>(null);

  const minutesCameraRef = useRef<HTMLInputElement>(null);
  const minutesFileRef = useRef<HTMLInputElement>(null);

  // Thống kê nhanh toàn bộ hồ sơ
  const totalFloors = formData.floors.length;
  const totalZones = formData.floors.reduce(
    (acc, f) => acc + (f.zones?.length || 0) + (f.structuralElements?.length || 0),
    0
  );
  const totalDefects = formData.floors.reduce(
    (acc, f) =>
      acc +
      (f.zones?.reduce((zacc, z) => zacc + (z.defects?.length || 0), 0) || 0) +
      (f.structuralElements?.reduce((eacc, e) => eacc + (e.defects?.length || 0), 0) || 0),
    0
  );

  const handleCompleteSurvey = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    onSubmitFinal();
  };

  const handleSignatureUpload = (
    role: 'preparedBy' | 'ownerRepresentative',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (role === 'preparedBy') {
        updateFormData({
          signatures: {
            ...sigs,
            preparedBy: { ...sigs.preparedBy, photoUrl: url },
          },
        });
      } else if (role === 'ownerRepresentative') {
        updateFormData({
          signatures: {
            ...sigs,
            ownerRepresentative: { ...sigs.ownerRepresentative, photoUrl: url },
          },
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMinutesPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          const currentPhotos = sigs.workingMinutesPhotos || [];
          updateFormData({
            signatures: {
              ...sigs,
              workingMinutesPhotos: [...currentPhotos, url],
            },
          });
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeMinutesPhoto = (index: number) => {
    const updated = (sigs.workingMinutesPhotos || []).filter((_, i) => i !== index);
    updateFormData({
      signatures: {
        ...sigs,
        workingMinutesPhotos: updated,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 9.1. Thống kê chốt số liệu */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
          <FileCheck2 className="w-5 h-5 text-emerald-700" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              9.1. Tổng Kết Khảo Sát Hiện Trường Trước Khi Ký Xác Nhận
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống tự động thống kê toàn bộ dữ liệu đã ghi nhận tại thực địa
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số tầng khảo sát</span>
            <span className="text-xl font-black text-slate-800">{totalFloors} Tầng</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số Vùng Z</span>
            <span className="text-xl font-black text-slate-800">{totalZones} Vùng</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số Vết nứt D</span>
            <span className="text-xl font-black text-emerald-700">{totalDefects} Nứt</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Biên ranh GIS</span>
            <span className="text-sm font-bold text-sky-700 block mt-1">
              {formData.gisMutationConfirmed?.type === 'MATCH'
                ? 'Khớp ranh 100%'
                : formData.gisMutationConfirmed?.type === 'SPLIT'
                ? 'Tách thửa'
                : 'Gộp thửa'}
            </span>
          </div>
        </div>

        <Textarea
          label="Ý Kiến / Phản Hồi Của Chủ Sở Hữu (Ghi nhận nguyên văn ý kiến hiện trường)"
          placeholder="Ví dụ: Chủ nhà nhất trí với biên bản khảo sát hiện trạng; xác nhận các vết nứt đã có từ trước khi làm đường..."
          rows={2}
          value={sigs.ownerFeedback}
          onChange={(e) =>
            updateFormData({
              signatures: { ...sigs, ownerFeedback: e.target.value },
            })
          }
        />
      </Card>

      {/* 9.2. Ảnh chụp Chữ ký Cán bộ & Chủ hộ */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <FileText className="w-5 h-5 text-purple-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              9.2. Ảnh Chụp Chữ Ký Xác Nhận Hiện Trường
            </h2>
            <p className="text-xs text-slate-500">
              Chụp ảnh trực tiếp hoặc tải ảnh chữ ký giấy / ảnh chân dung ký kết tại chỗ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Bên 1: Cán bộ khảo sát */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 block uppercase">
                  1. Cán Bộ Khảo Sát (Prepared by)
                </span>
                {sigs.preparedBy.photoUrl ? (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Đã có ảnh chữ ký
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Chờ chụp / tải ảnh
                  </span>
                )}
              </div>

              <Input
                label="Họ và tên cán bộ"
                value={sigs.preparedBy.fullName}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      preparedBy: { ...sigs.preparedBy, fullName: e.target.value },
                    },
                  })
                }
              />

              <Input
                label="Chức danh / Đơn vị"
                value={sigs.preparedBy.title}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      preparedBy: { ...sigs.preparedBy, title: e.target.value },
                    },
                  })
                }
              />

              <Input
                label="Ngày khảo sát"
                type="date"
                value={sigs.preparedBy.date}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      preparedBy: { ...sigs.preparedBy, date: e.target.value },
                    },
                  })
                }
              />
            </div>

            {/* Photo Preview & Upload Controls */}
            <div className="pt-3 border-t border-slate-200 text-center">
              {sigs.preparedBy.photoUrl ? (
                <div className="mb-3 relative group">
                  <img
                    src={sigs.preparedBy.photoUrl}
                    alt="Ảnh chữ ký cán bộ"
                    className="h-28 mx-auto border rounded-lg bg-white p-1 object-contain shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateFormData({
                        signatures: {
                          ...sigs,
                          preparedBy: { ...sigs.preparedBy, photoUrl: '' },
                        },
                      })
                    }
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-80 hover:opacity-100"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-white mb-3 text-xs text-slate-400 italic">
                  Chưa có ảnh chữ ký cán bộ khảo sát
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={preparedPhotoCameraRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleSignatureUpload('preparedBy', e)}
              />
              <input
                type="file"
                ref={preparedPhotoFileRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSignatureUpload('preparedBy', e)}
              />

              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => preparedPhotoCameraRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Chụp ảnh
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => preparedPhotoFileRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1 text-slate-600" />
                  Tải ảnh lên
                </Button>
              </div>
            </div>
          </div>

          {/* Bên 2: Chủ hộ / Người đại diện */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 block uppercase">
                  2. Chủ Sở Hữu (Owner / Rep.)
                </span>
                {sigs.ownerRepresentative.photoUrl ? (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Đã có ảnh chữ ký
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Chờ chụp / tải ảnh
                  </span>
                )}
              </div>

              <Input
                label="Họ và tên chủ hộ / người đại diện"
                value={sigs.ownerRepresentative.fullName || formData.ownerName}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      ownerRepresentative: {
                        ...sigs.ownerRepresentative,
                        fullName: e.target.value,
                      },
                    },
                  })
                }
              />

              <Input
                label="Vai trò (Chủ hộ / Người thuê / Đại diện)"
                value={sigs.ownerRepresentative.role}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      ownerRepresentative: {
                        ...sigs.ownerRepresentative,
                        role: e.target.value,
                      },
                    },
                  })
                }
              />

              <Input
                label="Ngày ký xác nhận"
                type="date"
                value={sigs.ownerRepresentative.date}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      ownerRepresentative: {
                        ...sigs.ownerRepresentative,
                        date: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>

            {/* Photo Preview & Upload Controls */}
            <div className="pt-3 border-t border-slate-200 text-center">
              {sigs.ownerRepresentative.photoUrl ? (
                <div className="mb-3 relative group">
                  <img
                    src={sigs.ownerRepresentative.photoUrl}
                    alt="Ảnh chữ ký chủ hộ"
                    className="h-28 mx-auto border rounded-lg bg-white p-1 object-contain shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateFormData({
                        signatures: {
                          ...sigs,
                          ownerRepresentative: { ...sigs.ownerRepresentative, photoUrl: '' },
                        },
                      })
                    }
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-80 hover:opacity-100"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-white mb-3 text-xs text-slate-400 italic">
                  Chưa có ảnh chữ ký chủ sở hữu
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={ownerPhotoCameraRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleSignatureUpload('ownerRepresentative', e)}
              />
              <input
                type="file"
                ref={ownerPhotoFileRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSignatureUpload('ownerRepresentative', e)}
              />

              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ownerPhotoCameraRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Chụp ảnh
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ownerPhotoFileRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1 text-slate-600" />
                  Tải ảnh lên
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 9.3. Ảnh Chụp Biên Bản Làm Việc Hiện Trường (Có thể có nhiều ảnh) */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                9.3. Ảnh Chụp Biên Bản Làm Việc Hiện Trường (Tùy chọn nhiều ảnh)
              </h2>
              <p className="text-xs text-slate-500">
                Đính kèm ảnh chụp các trang biên bản khảo sát giấy hoặc biên bản làm việc có chữ ký tươi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={minutesCameraRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleMinutesPhotoUpload}
            />
            <input
              type="file"
              ref={minutesFileRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleMinutesPhotoUpload}
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => minutesCameraRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5 mr-1 text-sky-600" />
              Chụp biên bản
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => minutesFileRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Tải file ảnh
            </Button>
          </div>
        </div>

        {/* Danh sách ảnh biên bản */}
        {sigs.workingMinutesPhotos && sigs.workingMinutesPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sigs.workingMinutesPhotos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-100 aspect-3/4 flex items-center justify-center shadow-xs"
              >
                <img
                  src={photoUrl}
                  alt={`Biên bản trang ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <span className="text-[10px] text-white font-bold bg-slate-900/80 px-2 py-0.5 rounded self-start">
                    Trang {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMinutesPhoto(idx)}
                    className="p-1.5 bg-red-600 text-white rounded-lg self-end hover:bg-red-700 transition-colors"
                    title="Xóa trang này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center text-xs text-slate-400">
            Chưa có ảnh chụp biên bản làm việc nào được đính kèm. Bấm &quot;Chụp biên bản&quot; hoặc &quot;Tải file ảnh&quot; để bổ sung.
          </div>
        )}
      </Card>

      {/* Final Submit Buttons */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 8
        </Button>
        <Button
          size="lg"
          variant="success"
          icon={<Send className="w-4 h-4" />}
          loading={isSubmitting}
          onClick={handleCompleteSurvey}
        >
          Hoàn Tất & Nộp Hồ Sơ Khảo Sát Hiện Trường
        </Button>
      </div>
    </div>
  );
};
