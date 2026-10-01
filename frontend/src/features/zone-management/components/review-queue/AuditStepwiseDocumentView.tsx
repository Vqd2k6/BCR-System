import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Home,
  MapPin,
  Calendar,
  Layers,
  Ruler,
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Undo2,
  Save,
  Eye,
  Camera,
  Maximize2,
  ChevronRight,
  Info,
  ExternalLink,
  Flame,
  Activity,
  Award,
  Hash,
  PenTool,
  Clock,
  UserX,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../../../core/components/ui/Card';
import { Badge } from '../../../../core/components/ui/Badge';
import { Button } from '../../../../core/components/ui/Button';

export interface AuditStepwiseDocumentViewProps {
  data: any;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: {
    targetPhotoType: string;
    targetPhotoId?: string;
    defectId?: string;
    zoneId?: string;
    photoIndex?: number;
    currentPhotoUrl: string;
    photoTitle?: string;
  }) => void;
  onOpenDiffModal: (diffItems: any[], updates: any) => void;
}

export const AuditStepwiseDocumentView: React.FC<AuditStepwiseDocumentViewProps> = ({
  data,
  reportId,
  onRefresh,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenDiffModal,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeNavStep, setActiveNavStep] = useState<string>('step-1');

  // Form state & Dirty fields tracker
  const [formState, setFormState] = useState<any>({});
  const [originalState, setOriginalState] = useState<any>({});
  const [dirtyFields, setDirtyFields] = useState<Record<string, { label: string; oldValue: any; newValue: any }>>({});

  // Sync initial data from data prop
  useEffect(() => {
    if (!data) return;
    const leftPane = data.leftPane || {};
    const rightPane = data.rightPane || {};
    const sJson = data.surveyJson || data.survey_data_json || {};

    const initial = {
      // Step 1: Specs & General
      projectParcelCode: data.projectParcelCode || sJson.projectParcelCode || '',
      houseNumber: data.houseNumber || sJson.houseNumber || '',
      street: data.street || sJson.street || '',
      ownerName: sJson.ownerName || '',
      ownerPhone: sJson.ownerPhone || '',
      cadastralCode: sJson.officialCadastralCode || '',
      buildingType: data.buildingType || sJson.buildingType || 'RESIDENTIAL',
      aboveFloors: sJson.aboveFloors !== undefined ? sJson.aboveFloors : 1,
      undergroundFloors: sJson.undergroundFloors !== undefined ? sJson.undergroundFloors : 0,
      constructionYear: sJson.constructionYear || '',
      isEstimatedYear: sJson.isEstimatedYear || false,
      constructionAreaM2: sJson.constructionAreaM2 || '',
      buildingHeightM: sJson.buildingHeightM || '',
      structureSystem: sJson.structureSystem || '',
      foundationType: sJson.foundationType || '',
      foundationDepthM: sJson.foundationDepthM || '',
      pileDimensionMm: sJson.pileDimensionMm || '',
      foundationNotes: sJson.foundationNotes || '',
      metroOffsetDistance: sJson.metroOffsetDistance || '',
      clearanceOffsetDistance: sJson.clearanceOffsetDistance || '',

      // Step 2: Interview
      historyInterview: sJson.historyInterview || {},

      // Step 4: Burland
      burlandSummary: sJson.burlandSummary || {},

      // Step 5: Tilt & Settlement
      settlementTilt: sJson.settlementTilt || {},

      // Step 6: Scope
      accessLimitation: sJson.accessLimitation || {},
      gisMutationConfirmed: sJson.gisMutationConfirmed || {},

      // Step 8: Conclusions
      executiveSummary: sJson.executiveSummary || {},

      // Step 9: Signatures
      signatures: sJson.signatures || {},
    };

    setFormState(initial);
    setOriginalState(initial);
    setDirtyFields({});
  }, [data]);

  // Handle generic field change
  const handleFieldChange = (fieldKey: string, label: string, val: any) => {
    setFormState((prev: any) => {
      const updated = { ...prev, [fieldKey]: val };
      return updated;
    });

    const originalVal = originalState[fieldKey];
    if (JSON.stringify(originalVal) === JSON.stringify(val)) {
      setDirtyFields((prev) => {
        const copy = { ...prev };
        delete copy[fieldKey];
        return copy;
      });
    } else {
      setDirtyFields((prev) => ({
        ...prev,
        [fieldKey]: {
          label,
          oldValue: originalVal,
          newValue: val,
        },
      }));
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (window.confirm('Bạn có chắc muốn hủy bỏ mọi thay đổi vừa chỉnh sửa?')) {
      setFormState(originalState);
      setDirtyFields({});
    }
  };

  // Review & Save changes
  const handleReviewSave = () => {
    const diffItems = Object.entries(dirtyFields).map(([k, v]) => ({
      field: k,
      label: v.label,
      oldValue: v.oldValue,
      newValue: v.newValue,
    }));

    const updatesPayload: Record<string, any> = {};
    Object.keys(dirtyFields).forEach((k) => {
      updatesPayload[k] = formState[k];
    });

    onOpenDiffModal(diffItems, updatesPayload);
  };

  // Navigation steps definition
  const stepsList = [
    { id: 'step-1', number: '01', title: 'Định Danh & Hiện Trạng', icon: Home },
    { id: 'step-2', number: '02', title: 'Phỏng Vấn Chủ Hộ', icon: User },
    { id: 'step-3', number: '03', title: 'Tầng, Vùng Z & Khuyết Tật D', icon: Layers },
    { id: 'step-4', number: '04', title: 'Tổng Hợp Nứt Burland', icon: Award },
    { id: 'step-5', number: '05', title: 'Đo Biến Dạng & Lún Nghiêng', icon: Activity },
    { id: 'step-6', number: '06', title: 'Phạm Vi KS & Biến Động GIS', icon: MapPin },
    { id: 'step-7', number: '07', title: 'Bảng Điểm Kỹ Thuật ECS & VI', icon: Hash },
    { id: 'step-8', number: '08', title: 'Kết Luận & Tác Động TBM', icon: FileCheck2 },
    { id: 'step-9', number: '09', title: 'Pháp Lý, Chữ Ký & Vắng Mặt', icon: PenTool },
  ];

  const scrollToStep = (id: string) => {
    setActiveNavStep(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const leftPane = data?.leftPane || {};
  const rightPane = data?.rightPane || {};
  const damageZones = leftPane.damageZones || [];
  const riskCard = leftPane.riskScoreCard || {};
  const absenceLogs = leftPane.absenceLogs || [];
  const identificationPhotos = rightPane.identificationPhotos || {};

  const dirtyCount = Object.keys(dirtyFields).length;

  return (
    <div className="relative flex flex-col lg:flex-row gap-6 w-full min-h-[600px]">
      {/* 1. Sticky Navigation Sidebar (Left Column) */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="sticky top-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">
                Mục Lục Thẩm Định
              </span>
              <h4 className="text-sm font-black text-slate-800">9 Bước Khảo Sát</h4>
            </div>
            {/* Toggle Edit Mode */}
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                isEditMode
                  ? 'bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Đang Hiệu Chỉnh' : 'Chế Độ Sửa'}</span>
            </button>
          </div>

          {/* Jump Links List */}
          <nav className="space-y-1">
            {stepsList.map((st) => {
              const Icon = st.icon;
              const isActive = activeNavStep === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => scrollToStep(st.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-slate-400 font-bold group-hover:text-sky-600">
                      {st.number}
                    </span>
                    <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-sky-600" />
                    <span className="truncate">{st.title}</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isActive ? 'text-sky-600 translate-x-0.5' : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Information & Instructions pill */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1 leading-relaxed">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-sky-600" />
              <span>Quy tắc thẩm định:</span>
            </div>
            <p>
              &bull; Click vào bất kỳ ảnh nào để xem <strong>toàn màn hình và cuộn chuột phóng to 800%</strong>.
            </p>
            <p>
              &bull; Bật <strong>Chế độ sửa</strong> để hiệu chỉnh thông tin. Mọi thay đổi bắt buộc xác thực mật khẩu.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Long Document Viewport (Right Column) */}
      <div className="flex-1 space-y-6 pb-24 min-w-0">
        {/* ========================================== */}
        {/* BƯỚC 1: ĐỊNH DANH & HIỆN TRẠNG CHUNG */}
        {/* ========================================== */}
        <section id="step-1" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 01
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Định Danh & Hiện Trạng Công Trình
              </h3>
            </div>
            <Badge variant="default" size="sm">
              Mã Thửa: {formState.projectParcelCode || data.projectParcelCode}
            </Badge>
          </div>

          <div className="p-5 space-y-5">
            {/* Lưới 4 ảnh định danh P-01 .. P-04 (LÀM PHẲNG) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>Bộ 4 Ảnh Định Danh Hiện Trường (P-01 &rarr; P-04)</span>
                </span>
                <span className="text-[11px] text-slate-400">Click ảnh để phóng to &bull; Di chuột để đổi ảnh</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'photoP01', code: 'P-01', label: 'Mặt chính công trình' },
                  { key: 'photoP02', code: 'P-02', label: 'Biển số nhà / Số ngõ' },
                  { key: 'photoP03', code: 'P-03', label: 'Bên trái công trình' },
                  { key: 'photoP04', code: 'P-04', label: 'Bên phải công trình' },
                ].map((item) => {
                  const url = identificationPhotos[item.key] || (data.surveyJson && data.surveyJson[item.key]) || '';
                  return (
                    <div
                      key={item.key}
                      className="group relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex flex-col h-44 shadow-xs"
                    >
                      <div
                        className="flex-1 bg-black/5 relative cursor-pointer overflow-hidden flex items-center justify-center"
                        onClick={() => {
                          if (url) onOpenPhotoZoom(url, `${item.code} - ${item.label}`, item.code);
                        }}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={item.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có ảnh</span>
                        )}
                        {/* Overlay Hover Icon */}
                        {url && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Maximize2 className="w-6 h-6 drop-shadow-md" />
                          </div>
                        )}
                        {/* Badge mã ảnh */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white font-mono font-bold text-[10px]">
                          {item.code}
                        </div>
                      </div>

                      {/* Footer label + Button thay ảnh */}
                      <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700 truncate" title={item.label}>
                          {item.label}
                        </span>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPhotoReplace({
                                targetPhotoType: 'IDENTIFICATION_P',
                                targetPhotoId: item.key,
                                currentPhotoUrl: url,
                                photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                              })
                            }
                            className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded transition-colors"
                            title="Thay thế ảnh này bằng mã 6 số ngẫu nhiên"
                          >
                            Đổi ảnh
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Các trường thông tin chi tiết */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              {/* Số nhà */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Số nhà / Địa chỉ
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.houseNumber || ''}
                    onChange={(e) => handleFieldChange('houseNumber', 'Số nhà', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="text-xs font-black text-slate-800">{formState.houseNumber || '---'}</div>
                )}
              </div>

              {/* Tên đường */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Tuyến đường
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.street || ''}
                    onChange={(e) => handleFieldChange('street', 'Tuyến đường', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="text-xs font-semibold text-slate-800">{formState.street || '---'}</div>
                )}
              </div>

              {/* Tên chủ sở hữu */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Chủ sở hữu / Người đại diện
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.ownerName || ''}
                    onChange={(e) => handleFieldChange('ownerName', 'Chủ sở hữu', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="text-xs font-bold text-slate-800">{formState.ownerName || '---'}</div>
                )}
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Điện thoại liên hệ
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.ownerPhone || ''}
                    onChange={(e) => handleFieldChange('ownerPhone', 'SĐT chủ hộ', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <div className="text-xs font-mono text-slate-700">{formState.ownerPhone || '---'}</div>
                )}
              </div>

              {/* Số tầng nổi & Số tầng ngầm */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Quy mô tầng (Nổi / Hầm)
                </label>
                {isEditMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formState.aboveFloors}
                      onChange={(e) => handleFieldChange('aboveFloors', 'Số tầng nổi', Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold"
                      placeholder="Tầng nổi"
                    />
                    <input
                      type="number"
                      value={formState.undergroundFloors}
                      onChange={(e) => handleFieldChange('undergroundFloors', 'Số tầng hầm', Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold"
                      placeholder="Hầm"
                    />
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-800">
                    {formState.aboveFloors} tầng nổi {Number(formState.undergroundFloors) > 0 ? `+ ${formState.undergroundFloors} hầm` : ''}
                  </div>
                )}
              </div>

              {/* Năm xây dựng */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Năm xây dựng
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.constructionYear || ''}
                    onChange={(e) => handleFieldChange('constructionYear', 'Năm xây dựng', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold"
                  />
                ) : (
                  <div className="text-xs font-bold text-slate-800">{formState.constructionYear || '---'}</div>
                )}
              </div>

              {/* Kết cấu chịu lực */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Kết cấu chịu lực chính
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.structureSystem || ''}
                    onChange={(e) => handleFieldChange('structureSystem', 'Kết cấu chịu lực', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs"
                  />
                ) : (
                  <div className="text-xs text-slate-800">{formState.structureSystem || '---'}</div>
                )}
              </div>

              {/* Loại móng */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Giải pháp móng công trình
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.foundationType || ''}
                    onChange={(e) => handleFieldChange('foundationType', 'Loại móng', e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold"
                  />
                ) : (
                  <div className="text-xs font-bold text-slate-800">{formState.foundationType || '---'}</div>
                )}
              </div>

              {/* Cự ly tim Metro 2 */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Khoảng cách tim tuyến Metro 2
                </label>
                <div className="text-xs font-black text-sky-700 font-mono">
                  {formState.metroOffsetDistance || '---'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 2: PHỎNG VẤN CHỦ HỘ */}
        {/* ========================================== */}
        <section id="step-2" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 02
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Phỏng Vấn Chủ Hộ & Lịch Sử Công Trình
              </h3>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Lịch sử sửa chữa lớn:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.historyInterview?.majorRepair ? 'Có sửa chữa' : 'Không có'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Sự cố lún nứt quá khứ:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.historyInterview?.pastSettlement ? 'Có ghi nhận' : 'Không có'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Tải trọng cơi nới:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.historyInterview?.renovationLoad ? 'Có cơi nới' : 'Nguyên trạng'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Thiết bị nhạy cảm:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.historyInterview?.sensitiveEquipment?.has ? 'Có thiết bị' : 'Không có'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 3: TẦNG, VÙNG Z & KHUYẾT TẬT D (LÀM PHẲNG TOÀN DIỆN) */}
        {/* ========================================== */}
        <section id="step-3" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 03
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Khảo Sát Các Tầng, Vùng Kiến Trúc Z & Khuyết Tật D
              </h3>
            </div>
            <Badge variant="info" size="sm">
              {damageZones.length} Vùng Kiến Trúc &bull; Trải Phẳng Toàn Bộ Ảnh
            </Badge>
          </div>

          <div className="p-5 space-y-6">
            {damageZones.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <span className="font-semibold text-xs">Không có dữ liệu Vùng Kiến Trúc Z</span>
              </div>
            ) : (
              damageZones.map((z: any) => {
                const defectsList = Array.isArray(z.defects)
                  ? z.defects
                  : typeof z.defects === 'string'
                  ? JSON.parse(z.defects)
                  : [];

                return (
                  <div
                    key={z.id}
                    className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-4"
                  >
                    {/* Header Vùng Z */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono font-black text-xs">
                            {z.zone_code}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {z.floor_name || 'Tầng trệt'} &bull; {z.room_name || 'Không gian chính'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Cấu kiện: <strong>{z.component_type || 'Tường gạch'}</strong> &bull; Vật liệu: {z.wall_material || 'Vữa trát xi măng'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={defectsList.length > 0 ? 'warning' : 'success'} size="sm">
                          {defectsList.length} khuyết tật nứt
                        </Badge>
                      </div>
                    </div>

                    {/* Khung Ảnh Ngữ Cảnh CTX & Dải Ảnh Cận Cảnh CU (LÀM PHẲNG) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Ảnh Ngữ Cảnh CTX (1 Cột) */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col">
                        <span className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                          <span>Ảnh Ngữ Cảnh ({z.zone_code}_CTX)</span>
                          <span className="text-[10px] text-slate-400 font-mono">Toàn cảnh phòng</span>
                        </span>
                        <div
                          className="flex-1 min-h-[160px] rounded-lg bg-black/5 relative cursor-pointer overflow-hidden flex items-center justify-center group"
                          onClick={() => {
                            if (z.ctx_photo_url) {
                              onOpenPhotoZoom(z.ctx_photo_url, `${z.zone_code} - Ảnh Ngữ Cảnh`, z.ctx_photo_code || `${z.zone_code}_CTX`);
                            }
                          }}
                        >
                          {z.ctx_photo_url ? (
                            <img
                              src={z.ctx_photo_url}
                              alt="CTX"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa có ảnh CTX</span>
                          )}
                          {z.ctx_photo_url && (
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-5 h-5 drop-shadow-md" />
                            </div>
                          )}
                        </div>

                        {isEditMode && z.ctx_photo_url && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPhotoReplace({
                                targetPhotoType: 'ZONE_CTX',
                                targetPhotoId: z.zone_code,
                                zoneId: z.id,
                                currentPhotoUrl: z.ctx_photo_url,
                                photoTitle: `Ảnh ngữ cảnh ${z.zone_code}`,
                              })
                            }
                            className="mt-2 text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 py-1 rounded text-center transition-colors"
                          >
                            Đổi ảnh CTX (Mã 6 số)
                          </button>
                        )}
                      </div>

                      {/* Danh sách Khuyết Tật D-xx & Ảnh CU Cận Cảnh có thước đo mm (2 Cột) */}
                      <div className="md:col-span-2 space-y-3">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Các Vết Nứt / Khuyết Tật D Trong Vùng {z.zone_code}:
                        </span>

                        {defectsList.length === 0 ? (
                          <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                            Không có khuyết tật nào trong vùng kiến trúc này
                          </div>
                        ) : (
                          defectsList.map((d: any) => {
                            const cuPhotos = d.cuPhotos && d.cuPhotos.length > 0
                              ? d.cuPhotos
                              : d.cuPhotoUrl
                              ? [d.cuPhotoUrl]
                              : [];

                            return (
                              <div
                                key={d.id}
                                className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono font-black text-xs">
                                      {d.defectCode || d.defect_code}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800">
                                      Bề rộng nứt: <strong className="text-red-600">{d.widthMaxMm ?? d.width_max_mm ?? 0} mm</strong>
                                      {d.lengthMm ? ` &bull; Dài ${d.lengthMm} mm` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {d.hasScaleCard ?? d.has_scale_card ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        ✓ Có thước đo mm (Scale Card)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                        ⚠️ Thiếu thước đo mm
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Trải phẳng Dải Ảnh Cận Cảnh CU (Multi-Photo Thumbnails) */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {cuPhotos.map((cuUrl: string, cuIdx: number) => (
                                    <div
                                      key={cuIdx}
                                      className="group relative h-28 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden cursor-pointer flex items-center justify-center"
                                      onClick={() =>
                                        onOpenPhotoZoom(
                                          cuUrl,
                                          `${d.defectCode || d.defect_code} - Ảnh cận cảnh #${cuIdx + 1} (Rộng ${d.widthMaxMm || 0}mm)`,
                                          `${d.defectCode || d.defect_code}_CU_${cuIdx + 1}`
                                        )
                                      }
                                    >
                                      <img
                                        src={cuUrl}
                                        alt="CU"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                      {/* Hover zoom overlay */}
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Maximize2 className="w-5 h-5 drop-shadow-md" />
                                      </div>
                                      {/* Badge thứ tự ảnh */}
                                      <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-black/70 text-white font-mono text-[9px]">
                                        Ảnh #{cuIdx + 1}
                                      </div>
                                      {/* Nút thay ảnh nhanh */}
                                      {isEditMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenPhotoReplace({
                                              targetPhotoType: 'DEFECT_CU',
                                              targetPhotoId: d.defectCode || d.defect_code,
                                              defectId: d.id,
                                              photoIndex: cuIdx,
                                              currentPhotoUrl: cuUrl,
                                              photoTitle: `Khuyết tật ${d.defectCode || d.defect_code} - Ảnh #${cuIdx + 1}`,
                                            });
                                          }}
                                          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-sky-600 text-white text-[9px] font-bold shadow-md hover:bg-sky-700 transition-colors"
                                          title="Thay thế ảnh này bằng mã 6 số"
                                        >
                                          Đổi ảnh
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 4: TỔNG HỢP NỨT BURLAND 1977 */}
        {/* ========================================== */}
        <section id="step-4" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 04
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Tổng Hợp & Đánh Giá Nứt Theo Chuẩn Burland 1977
              </h3>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Cấp độ khống chế lớn nhất:</span>
                <span className="text-sm font-black text-red-600">
                  Cấp {formState.burlandSummary?.localMaxGrade ?? riskCard.e1_burland_score ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Vùng khống chế nguy cơ:</span>
                <span className="text-sm font-bold text-slate-800">
                  {formState.burlandSummary?.governingZoneCode || 'Z-01'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Tính đại diện:</span>
                <span className="text-sm font-bold text-slate-800">
                  {formState.burlandSummary?.representativeness || 'GLOBAL'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Yêu cầu kỹ sư kết cấu:</span>
                <span className="text-sm font-bold text-slate-800">
                  {formState.burlandSummary?.needStructuralEngineerReview ? 'Cần thẩm tra' : 'Không yêu cầu'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 5: ĐO BIẾN DẠNG & LÚN NGHIÊNG */}
        {/* ========================================== */}
        <section id="step-5" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 05
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Đo Đạc Biến Dạng & Lún Nghiêng Công Trình
              </h3>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Độ nghiêng công trình x/y:</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  x: {formState.settlementTilt?.buildingTilt?.xPermille || '0'} ‰ &bull; y: {formState.settlementTilt?.buildingTilt?.yPermille || '0'} ‰
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Độ võng dầm / sàn:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.settlementTilt?.beamSagging?.sagMm ? `${formState.settlementTilt.beamSagging.sagMm} mm` : 'Không phát hiện võng'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Lún chênh lệch:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.settlementTilt?.diffSettlement?.level ? `Cấp ${formState.settlementTilt.diffSettlement.level}` : 'Không phát hiện lún lệch'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 6: PHẠM VI KS & BIẾN ĐỘNG GIS */}
        {/* ========================================== */}
        <section id="step-6" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 06
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Phạm Vi Khảo Sát & Biến Động Ranh Thửa GIS
              </h3>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Tiếp cận khảo sát:</span>
                <span className="text-xs font-bold text-emerald-700">
                  {formState.accessLimitation?.type === 'FULL_100' ? 'Đầy đủ 100%' : 'Bị giới hạn'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Biến động ranh thửa:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formState.gisMutationConfirmed?.type || 'Không có biến động'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 7: BẢNG ĐIỂM KỸ THUẬT ECS & VI */}
        {/* ========================================== */}
        <section id="step-7" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 07
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Bảng Điểm Kỹ Thuật ECS & Độ Nhạy Cảm VI
              </h3>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <span className="text-[11px] text-sky-700 block">Tổng Điểm Hư Hỏng ECS:</span>
                <span className="text-xl font-black text-sky-900">{riskCard.total_ecs_score || 0}</span>
                <span className="text-[10px] text-sky-600 block mt-0.5">Phân hạng: {riskCard.ecs_class || 'Thấp'}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-[11px] text-purple-700 block">Điểm Nhạy Cảm VI:</span>
                <span className="text-xl font-black text-purple-900">{riskCard.avg_vi_score || '0.00'}</span>
                <span className="text-[10px] text-purple-600 block mt-0.5">Phân hạng: {riskCard.vi_class || 'Thấp'}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-[11px] text-amber-700 block">Điểm E1 (Burland Max):</span>
                <span className="text-xl font-black text-amber-900">{riskCard.e1_burland_score || 0}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[11px] text-emerald-700 block">Điểm E2 (Kết Cấu):</span>
                <span className="text-xl font-black text-emerald-900">{riskCard.e2_structure_score || 0}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 8: KẾT LUẬN & TÁC ĐỘNG TBM */}
        {/* ========================================== */}
        <section id="step-8" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 08
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Kết Luận & Kiến Nghị Tác Động Thi Công TBM
              </h3>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Trạng thái rủi ro BRA:</span>
                <span className="text-sm font-black text-slate-800">
                  {formState.executiveSummary?.braStatus || 'Low'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Tác động thi công khiên đào TBM:</span>
                <span className="text-sm font-black text-sky-700">
                  {formState.executiveSummary?.constructionImpactStatus || 'I1 (Tác động rất nhẹ)'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Khuyến nghị kỹ thuật của Kỹ sư Zone
              </label>
              {isEditMode ? (
                <textarea
                  rows={3}
                  value={formState.executiveSummary?.specificRecommendationsText || ''}
                  onChange={(e) =>
                    handleFieldChange(
                      'executiveSummary',
                      'Khuyến nghị kỹ thuật',
                      { ...formState.executiveSummary, specificRecommendationsText: e.target.value }
                    )
                  }
                  className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed">
                  {formState.executiveSummary?.specificRecommendationsText || 'Công trình duy trì theo dõi định kỳ trong quá trình khiên đào TBM vận hành.'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* BƯỚC 9: PHÁP LÝ, CHỮ KÝ & VẮNG MẶT */}
        {/* ========================================== */}
        <section id="step-9" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
                Bước 09
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                Hồ Sơ Pháp Lý, Chữ Ký Hiện Trường & Biên Bản Vắng Mặt
              </h3>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Chữ ký KSV */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                <span className="text-[11px] font-bold text-slate-600 block mb-2">Chữ ký Khảo Sát Viên</span>
                {formState.signatures?.surveyorSignature ? (
                  <img
                    src={formState.signatures.surveyorSignature}
                    alt="Surveyor Sig"
                    className="h-16 mx-auto object-contain cursor-pointer"
                    onClick={() => onOpenPhotoZoom(formState.signatures.surveyorSignature, 'Chữ ký Khảo Sát Viên')}
                  />
                ) : (
                  <span className="text-xs text-slate-400 italic">Đã ký số xác thực</span>
                )}
                <div className="text-[11px] text-slate-700 font-bold mt-2">
                  {data.surveyorName || 'Nguyễn Văn Khảo Sát'}
                </div>
              </div>

              {/* Chữ ký chủ nhà */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                <span className="text-[11px] font-bold text-slate-600 block mb-2">Chữ ký Chủ Hộ</span>
                {formState.signatures?.ownerSignature ? (
                  <img
                    src={formState.signatures.ownerSignature}
                    alt="Owner Sig"
                    className="h-16 mx-auto object-contain cursor-pointer"
                    onClick={() => onOpenPhotoZoom(formState.signatures.ownerSignature, 'Chữ ký Chủ Hộ')}
                  />
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    {data.isRefusedOrAbsent ? 'Vắng mặt / Không tiếp cận' : 'Đã ký tay hiện trường'}
                  </span>
                )}
                <div className="text-[11px] text-slate-700 font-bold mt-2">
                  {formState.ownerName || 'Chủ hộ công trình'}
                </div>
              </div>
            </div>

            {/* Lịch sử vắng mặt nếu có */}
            {absenceLogs.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-bold text-amber-800 block mb-2">
                  Lịch sử các lần liên hệ vắng mặt:
                </span>
                <div className="border border-amber-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-amber-100/60 font-bold text-amber-900">
                      <tr>
                        <th className="p-2.5">Lần</th>
                        <th className="p-2.5">Thời gian</th>
                        <th className="p-2.5">Lý do ghi nhận</th>
                        <th className="p-2.5">Biên bản / Ảnh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {absenceLogs.map((log: any, idx: number) => (
                        <tr key={log.id || idx}>
                          <td className="p-2.5 font-bold">Lần {idx + 1}</td>
                          <td className="p-2.5 font-mono">{new Date(log.recorded_at).toLocaleString('vi-VN')}</td>
                          <td className="p-2.5">{log.reason || 'Chủ nhà đi vắng, cửa khóa ngoài'}</td>
                          <td className="p-2.5">
                            {log.photo_url ? (
                              <button
                                type="button"
                                onClick={() => onOpenPhotoZoom(log.photo_url, `Biên bản vắng mặt lần ${idx + 1}`)}
                                className="text-sky-600 hover:underline font-bold"
                              >
                                Xem biên bản 🔍
                              </button>
                            ) : (
                              <span className="text-slate-400">---</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3. Floating Bottom Action Bar (when fields are dirty) */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-300">
              Đang có <strong>{dirtyCount}</strong> trường thông tin đã thay đổi
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Hủy bỏ</span>
            </button>
            <button
              type="button"
              onClick={handleReviewSave}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Xem Khác Biệt & Lưu 🔒</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
