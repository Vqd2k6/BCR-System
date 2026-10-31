import React from 'react';
import {
  User,
  Phone,
  Home,
  DoorClosed,
  Droplets,
  Camera,
  Eye,
  Upload,
  History,
  RotateCcw,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep2OwnerStatusPhotos: React.FC<
  CondoAuditStepProps<CondoUnitFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  discardField,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  stagedPhotoActions = [],
  onUndoPhotoAction,
}) => {
  const renderDirtyReset = (fieldKey: string) => {
    if (!isFieldDirty(fieldKey)) return null;
    return (
      <button
        type="button"
        onClick={() => discardField(fieldKey)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer ml-2"
        title="Hoàn tác trường này"
      >
        <RotateCcw className="w-2.5 h-2.5" /> Hoàn tác
      </button>
    );
  };

  const renderIdPhotoCard = (
    photoKey: 'photoP01' | 'photoP04',
    code: 'P-01' | 'P-04',
    targetPhotoType: string,
    defaultTitle: string
  ) => {
    const item = formState[photoKey];
    const staged = stagedPhotoActions.find((a) => a.targetPhotoType === targetPhotoType);
    const effectiveUrl =
      staged && staged.action !== 'DELETE' ? staged.newPhotoUrl : item?.url;
    const isDeleted = staged?.action === 'DELETE';

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-mono text-[11px] font-black">
                {code}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {item?.caption || defaultTitle}
              </span>
            </div>
            {staged && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                Chờ lưu ({staged.action})
              </span>
            )}
          </div>

          <div className="relative h-44 rounded-lg overflow-hidden bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center group">
            {effectiveUrl && !isDeleted ? (
              <>
                <img
                  src={effectiveUrl}
                  alt={defaultTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPhotoZoom(effectiveUrl, defaultTitle, code)}
                    className="p-2 rounded-lg bg-white/90 text-slate-900 hover:bg-white cursor-pointer shadow-sm"
                    title="Phóng to ảnh"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {isEditMode && onOpenPhotoAction && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoAction({
                          initialMode: 'REPLACE',
                          category: 'IDENTIFICATION',
                          targetPhotoType,
                          currentPhotoCode: code,
                          photoTitle: defaultTitle,
                          currentPhotoUrl: effectiveUrl,
                        })
                      }
                      className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
                      title="Thay thế ảnh bằng chứng"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  )}
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoCode: code,
                          photoType: targetPhotoType,
                          photoTitle: defaultTitle,
                          currentPhotoUrl: effectiveUrl,
                        })
                      }
                      className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 cursor-pointer shadow-sm"
                      title="Lịch sử thay đổi ảnh (Lineage)"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <Camera className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isDeleted ? 'Ảnh đã đánh dấu xóa' : 'Chưa có ảnh định danh'}
                </p>
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'IDENTIFICATION',
                        targetPhotoType,
                        currentPhotoCode: code,
                        photoTitle: defaultTitle,
                      })
                    }
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Tải ảnh {code}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {staged && onUndoPhotoAction && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onUndoPhotoAction(staged)}
              className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Hoàn tác thao tác ảnh
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Thông tin Định danh Căn hộ & Chủ hộ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Mã số Căn hộ (Unit Code)
            {renderDirtyReset('unitCode')}
          </label>
          <div className="relative">
            <Home className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              disabled={!isEditMode}
              value={formState.unitCode}
              onChange={(e) =>
                handleFieldChange('unitCode', 'Mã số Căn hộ', e.target.value)
              }
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 disabled:opacity-70"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Tầng (Floor Number)
            {renderDirtyReset('floorNumber')}
          </label>
          <input
            type="number"
            disabled={!isEditMode}
            value={formState.floorNumber}
            onChange={(e) =>
              handleFieldChange('floorNumber', 'Tầng căn hộ', Number(e.target.value))
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 disabled:opacity-70"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Trạng thái Cư trú / Tiếp cận
            {renderDirtyReset('occupancyStatus')}
          </label>
          <select
            disabled={!isEditMode}
            value={formState.occupancyStatus}
            onChange={(e) =>
              handleFieldChange(
                'occupancyStatus',
                'Trạng thái cư trú',
                e.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-70 cursor-pointer"
          >
            <option value="OCCUPIED_OWNER">Chủ hộ đang ở (OCCUPIED_OWNER)</option>
            <option value="OCCUPIED_TENANT">Khách thuê đang ở (OCCUPIED_TENANT)</option>
            <option value="VACANT_ACCESSIBLE">Căn hộ trống - Mở cửa (VACANT)</option>
            <option value="POSTPONED_ABSENT">Vắng chủ / Khóa cửa (POSTPONED_ABSENT)</option>
            <option value="REFUSED_ENTRY">Từ chối hợp tác (REFUSED_ENTRY)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Họ tên Chủ sở hữu / Đại diện căn hộ
            {renderDirtyReset('ownerName')}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              disabled={!isEditMode}
              value={formState.ownerName}
              onChange={(e) =>
                handleFieldChange(
                  'ownerName',
                  'Họ tên Chủ hộ căn hộ',
                  e.target.value
                )
              }
              placeholder="Nhập họ tên chủ căn hộ..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-70"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Số điện thoại Liên hệ
            {renderDirtyReset('ownerPhone')}
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              disabled={!isEditMode}
              value={formState.ownerPhone}
              onChange={(e) =>
                handleFieldChange(
                  'ownerPhone',
                  'Số điện thoại chủ hộ',
                  e.target.value
                )
              }
              placeholder="09xx..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 disabled:opacity-70"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
            Vai trò người làm việc tại hiện trường
            {renderDirtyReset('residentRole')}
          </label>
          <select
            disabled={!isEditMode}
            value={formState.residentRole}
            onChange={(e) =>
              handleFieldChange(
                'residentRole',
                'Vai trò người đại diện',
                e.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-70 cursor-pointer"
          >
            <option value="OWNER">Chủ sở hữu đứng tên (OWNER)</option>
            <option value="FAMILY_MEMBER">Thành viên gia đình (FAMILY_MEMBER)</option>
            <option value="TENANT">Người thuê ủy quyền (TENANT)</option>
            <option value="MANAGEMENT_WITNESS">Đại diện BQL chứng kiến (BQL)</option>
          </select>
        </div>
      </div>

      {/* 2. Kiểm tra Kẹt Cửa (Door Jamming) & Thấm Nước Tầng Trên (Water Leakage) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kẹt cửa do biến dạng khung */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-3.5 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorClosed className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Hiện tượng Kẹt Cửa đi / Cửa sổ (Door Jamming)
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditMode}
                checked={Boolean(formState.doorJamming?.hasJamming)}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'doorJamming',
                    'hasJamming',
                    'Tình trạng kẹt cửa',
                    e.target.checked
                  )
                }
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-slate-700 dark:text-slate-300">Có kẹt cửa</span>
            </label>
          </div>

          {formState.doorJamming?.hasJamming ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Vị trí cửa bị kẹt
                </label>
                <input
                  type="text"
                  disabled={!isEditMode}
                  value={formState.doorJamming.locations}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'doorJamming',
                      'locations',
                      'Vị trí cửa kẹt',
                      e.target.value
                    )
                  }
                  placeholder="VD: Cửa chính, cửa phòng ngủ 1..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Mức độ kẹt
                </label>
                <select
                  disabled={!isEditMode}
                  value={formState.doorJamming.severity}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'doorJamming',
                      'severity',
                      'Mức độ kẹt cửa',
                      e.target.value
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs cursor-pointer"
                >
                  <option value="MINOR">Cọ xát nhẹ (MINOR)</option>
                  <option value="MODERATE">Đóng mở khó khăn (MODERATE)</option>
                  <option value="SEVERE">Không thể đóng/khóa (SEVERE)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  disabled={!isEditMode}
                  value={formState.doorJamming.notes}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'doorJamming',
                      'notes',
                      'Ghi chú kẹt cửa',
                      e.target.value
                    )
                  }
                  placeholder="Ghi chú chi tiết tình trạng khung bao cửa..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hệ thống cửa đi và cửa sổ đóng mở bình thường, không ghi nhận biến dạng
              chèn khung.
            </p>
          )}
        </div>

        {/* Thấm nước từ sàn tầng trên */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-3.5 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Thấm Nước Từ Sàn Tầng Trên / Hộp Kỹ Thuật
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditMode}
                checked={Boolean(formState.waterLeakageFromUpperFloor?.hasLeakage)}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'waterLeakageFromUpperFloor',
                    'hasLeakage',
                    'Tình trạng thấm nước tầng trên',
                    e.target.checked
                  )
                }
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span className="text-slate-700 dark:text-slate-300">Có thấm dột</span>
            </label>
          </div>

          {formState.waterLeakageFromUpperFloor?.hasLeakage ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Vị trí trần/tường bị thấm
                </label>
                <input
                  type="text"
                  disabled={!isEditMode}
                  value={formState.waterLeakageFromUpperFloor.sourceLocation}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'waterLeakageFromUpperFloor',
                      'sourceLocation',
                      'Vị trí thấm nước',
                      e.target.value
                    )
                  }
                  placeholder="VD: Trần WC chính, logia..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Mã căn hộ tầng trên nghi ngờ
                </label>
                <input
                  type="text"
                  disabled={!isEditMode}
                  value={formState.waterLeakageFromUpperFloor.suspectedUpperUnitCode}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'waterLeakageFromUpperFloor',
                      'suspectedUpperUnitCode',
                      'Căn hộ tầng trên nghi ngờ thấm',
                      e.target.value
                    )
                  }
                  placeholder="VD: A-201"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  disabled={!isEditMode}
                  value={formState.waterLeakageFromUpperFloor.notes}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'waterLeakageFromUpperFloor',
                      'notes',
                      'Ghi chú thấm nước',
                      e.target.value
                    )
                  }
                  placeholder="Mô tả vết ố vàng, bong tróc sơn hoặc nhỏ giọt..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trần căn hộ và hộp kỹ thuật khô ráo, không phát hiện thấm nước từ căn hộ
              tầng trên.
            </p>
          )}
        </div>
      </div>

      {/* 3. Bộ 2 Ảnh Định Danh Căn Hộ (P-01: Bảng số cửa & P-04: Hành lang trước cửa) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Bộ Ảnh Định Danh Pháp Lý Căn Hộ (P-01 & P-04)
          </h4>
          <span className="text-[11px] text-slate-500">
            Bắt buộc có ảnh chụp biển số căn hộ (P-01) và không gian hành lang tiếp giáp (P-04)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderIdPhotoCard(
            'photoP01',
            'P-01',
            'P01_HOUSE_NUMBER',
            'Ảnh biển số cửa căn hộ (P-01)'
          )}
          {renderIdPhotoCard(
            'photoP04',
            'P-04',
            'P04_CONTEXT_STREET',
            'Ảnh hành lang trước cửa căn hộ (P-04)'
          )}
        </div>
      </div>
    </div>
  );
};
