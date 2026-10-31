import React from 'react';
import {
  Building2,
  Camera,
  History,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

export const MasterStep1Identification: React.FC<
  CondoAuditStepProps<CondoMasterFormState>
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
}) => {
  const photosList = [
    {
      key: 'photoP01' as const,
      code: 'P-01',
      type: 'P01_HOUSE_NUMBER',
      label: 'P-01: Biển tên tòa nhà / Số nhà cổng chính',
      item: formState.photoP01,
    },
    {
      key: 'photoP02' as const,
      code: 'P-02',
      type: 'P02_MAIN_FACADE',
      label: 'P-02: Mặt đứng chính khối tháp chung cư',
      item: formState.photoP02,
    },
    {
      key: 'photoP03' as const,
      code: 'P-03',
      type: 'P03_SIDE_OR_REAR',
      label: 'P-03: Mặt bên / Khối đế tiếp giáp công trình lân cận',
      item: formState.photoP03,
    },
    {
      key: 'photoP04' as const,
      code: 'P-04',
      type: 'P04_CONTEXT_STREET',
      label: 'P-04: Ngữ cảnh đường phố / Hành lang tuyến Metro',
      item: formState.photoP04,
    },
  ];

  const renderFieldHeader = (fieldKey: string, label: string) => (
    <div className="flex items-center justify-between mb-1">
      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {isFieldDirty(fieldKey) && (
        <button
          type="button"
          onClick={() => discardField(fieldKey)}
          className="text-[10px] font-bold text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
          title="Hoàn tác trường này"
        >
          <RotateCcw className="w-2.5 h-2.5" /> Hoàn tác
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. Định danh & Địa chỉ Tòa tháp */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          {renderFieldHeader('buildingName', 'Tên thương mại / Khối tháp chung cư')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.buildingName}
              onChange={(e) =>
                handleFieldChange(
                  'buildingName',
                  'Tên thương mại / Khối tháp',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{formState.buildingName || 'Chưa cập nhật tên tòa tháp'}</span>
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('projectParcelCode', 'Mã thửa dự án (Project Parcel Code)')}
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-teal-700 dark:text-teal-300">
            {formState.projectParcelCode || '--'}
          </div>
        </div>

        <div>
          {renderFieldHeader('officialCadastralCode', 'Số hiệu tờ / thửa địa chính')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.officialCadastralCode}
              onChange={(e) =>
                handleFieldChange(
                  'officialCadastralCode',
                  'Số hiệu tờ/thửa địa chính',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200">
              {formState.officialCadastralCode || 'Chưa ghi nhận'}
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('houseNumber', 'Số nhà / Ký hiệu lô')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.houseNumber}
              onChange={(e) =>
                handleFieldChange('houseNumber', 'Số nhà tòa tháp', e.target.value)
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {formState.houseNumber || '--'}
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('street', 'Tên đường / Tuyến phố')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.street}
              onChange={(e) =>
                handleFieldChange('street', 'Tên đường tòa tháp', e.target.value)
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {formState.street || '--'}
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('ward', 'Phường / Xã (Theo NQ 1685)')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.ward}
              onChange={(e) =>
                handleFieldChange('ward', 'Phường/Xã', e.target.value)
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {formState.ward || '--'}
            </div>
          )}
        </div>
      </div>

      {/* 2. Thông tin Ban Quản Lý (BQL) & Tình trạng Tiếp cận */}
      <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-slate-800/50 border border-indigo-200/70 dark:border-slate-750 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          {renderFieldHeader('managementBoardName', 'Đơn vị Quản lý Vận hành / BQT')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.managementBoardName}
              onChange={(e) =>
                handleFieldChange(
                  'managementBoardName',
                  'Đơn vị Quản lý Vận hành',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {formState.managementBoardName || 'Ban Quản Lý Tòa Nhà'}
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('managementContactName', 'Người đại diện BQL phối hợp khảo sát')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.managementContactName}
              onChange={(e) =>
                handleFieldChange(
                  'managementContactName',
                  'Đại diện BQL phối hợp',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {formState.managementContactName || 'Chưa ghi nhận'}
            </div>
          )}
        </div>

        <div>
          {renderFieldHeader('managementContactPhone', 'Số điện thoại liên hệ BQL')}
          {isEditMode ? (
            <input
              type="text"
              value={formState.managementContactPhone}
              onChange={(e) =>
                handleFieldChange(
                  'managementContactPhone',
                  'SĐT liên hệ BQL',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          ) : (
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
              {formState.managementContactPhone || '--'}
            </div>
          )}
        </div>

        <div className="md:col-span-3 pt-2 border-t border-indigo-200/50 dark:border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Mức độ tiếp cận khối tháp
            </label>
            {isEditMode ? (
              <select
                value={formState.accessLimitation?.type || 'FULL_100'}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'accessLimitation',
                    'type',
                    'Mức độ tiếp cận khối tháp',
                    e.target.value
                  )
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="FULL_100">Tiếp cận 100% khu vực chung &amp; kỹ thuật</option>
                <option value="PARTIAL">Tiếp cận một phần (Có phòng kỹ thuật khóa)</option>
                <option value="EXTERNAL_ONLY">Chỉ khảo sát mặt ngoài khối tháp</option>
              </select>
            ) : (
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {formState.accessLimitation?.type === 'PARTIAL'
                  ? 'Tiếp cận một phần (Có giới hạn)'
                  : formState.accessLimitation?.type === 'EXTERNAL_ONLY'
                    ? 'Chỉ khảo sát mặt ngoài'
                    : 'Tiếp cận đầy đủ 100%'}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Ghi chú giới hạn tiếp cận (nếu có)
            </label>
            {isEditMode ? (
              <input
                type="text"
                value={String(formState.accessLimitation?.notes || '')}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'accessLimitation',
                    'notes',
                    'Ghi chú tiếp cận khối tháp',
                    e.target.value
                  )
                }
                placeholder="Ghi chú các phòng máy / tầng kỹ thuật chưa mở cửa..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            ) : (
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {formState.accessLimitation?.notes || 'Không có giới hạn tiếp cận.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bộ 4 Ảnh Định Danh Tòa Tháp (P-01 .. P-04) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Bộ 4 Ảnh Định Danh Pháp Lý Khối Tháp (P-01 → P-04)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {photosList.map((p) => {
            const url = p.item?.url || '';
            return (
              <div
                key={p.code}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded font-mono font-black text-[11px] bg-indigo-600 text-white">
                    {p.code}
                  </span>
                  <div className="flex items-center gap-1">
                    {onOpenPhotoAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoAction({
                            initialMode: url ? 'REPLACE' : 'ADD',
                            category: 'IDENTIFICATION',
                            targetPhotoType: p.type,
                            currentPhotoUrl: url || undefined,
                            currentPhotoCode: p.code,
                            photoTitle: p.label,
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3 text-indigo-600" />
                        <span>{url ? 'Thay ảnh' : 'Bổ sung'}</span>
                      </button>
                    )}

                    {onOpenPhotoHistory && (p.item?.hasHistory || url) && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoHistory({
                            photoCode: p.code,
                            photoType: p.type,
                            photoTitle: p.label,
                            currentPhotoUrl: url || undefined,
                          })
                        }
                        className="p-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                        title="Xem lịch sử phả hệ ảnh"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {url ? (
                  <button
                    type="button"
                    onClick={() => onOpenPhotoZoom(url, p.label, p.code)}
                    className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-300 group cursor-pointer block"
                  >
                    <img
                      src={url}
                      alt={p.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-36 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 flex flex-col items-center justify-center text-amber-700 text-xs font-semibold p-3 text-center">
                    <span>Chưa có ảnh {p.code}</span>
                  </div>
                )}

                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                  {p.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
