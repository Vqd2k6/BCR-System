import React, { useState, useEffect } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { Modal } from '../../../core/components/ui/Modal';
import {
  FileText,
  Wrench,
  Plus,
  History,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  reportConfigService,
  type StandardTextVersion,
  type StandardTextContent,
  type SurveyEquipmentItem,
  type EquipmentInput,
  type BilingualText,
} from '../services/reportConfigService';
import { getErrorMessage } from '../../../utils/errorUtils';

export const ReportContentConfigTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'standard-text' | 'equipment'>('standard-text');

  // State: Standard Text
  const [versions, setVersions] = useState<StandardTextVersion[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [modalTextContent, setModalTextContent] = useState<StandardTextContent>({
    recommendations: [],
    pendingItems: [],
    calibrationNote: null,
    asteriskFootnote: null,
  });
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);

  // State: Equipment
  const [equipmentList, setEquipmentList] = useState<SurveyEquipmentItem[]>([]);
  const [isLoadingEq, setIsLoadingEq] = useState(false);
  const [eqError, setEqError] = useState<string | null>(null);
  const [isEqModalOpen, setIsEqModalOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<SurveyEquipmentItem | null>(null);
  const [eqForm, setEqForm] = useState<EquipmentInput>({
    sortOrder: 1,
    nameVi: '',
    nameEn: '',
    specificationVi: '',
    specificationEn: '',
    purposeVi: '',
    purposeEn: '',
    model: '',
    serialNo: '',
    calibrationCertNo: '',
    calibrationValidTo: '',
  });
  const [isSubmittingEq, setIsSubmittingEq] = useState(false);
  const [deleteEqTarget, setDeleteEqTarget] = useState<SurveyEquipmentItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingEq, setIsDeletingEq] = useState(false);

  const loadStandardText = async () => {
    setIsLoadingText(true);
    setTextError(null);
    try {
      const data = await reportConfigService.listStandardTextVersions();
      setVersions(data);
    } catch (err: unknown) {
      console.error('[ReportContentConfigTab] Lỗi tải phiên bản văn bản chuẩn:', err);
      setTextError(getErrorMessage(err, 'Không thể tải danh sách phiên bản văn bản chuẩn'));
    } finally {
      setIsLoadingText(false);
    }
  };

  const loadEquipment = async () => {
    setIsLoadingEq(true);
    setEqError(null);
    try {
      const data = await reportConfigService.listEquipment();
      setEquipmentList(data);
    } catch (err: unknown) {
      console.error('[ReportContentConfigTab] Lỗi tải danh mục thiết bị:', err);
      setEqError(getErrorMessage(err, 'Không thể tải danh mục thiết bị dự án'));
    } finally {
      setIsLoadingEq(false);
    }
  };

  useEffect(() => {
    loadStandardText();
    loadEquipment();
  }, []);

  const activeVersion = versions.length > 0 ? versions[0] : null;

  // Mở modal tạo phiên bản mới (prefill từ bản hiện hành)
  const handleOpenNewVersionModal = () => {
    if (activeVersion) {
      setModalTextContent(JSON.parse(JSON.stringify(activeVersion.content)));
    } else {
      setModalTextContent({
        recommendations: [
          {
            vi: 'Kiến nghị thiết lập hồ sơ hiện trạng ban đầu làm căn cứ pháp lý; lắp đặt mốc quan trắc biến dạng định kỳ trong suốt quá trình đào hầm TBM; theo dõi các vết nứt đã ghi nhận bằng thước đo nứt.',
            en: 'It is recommended to establish the baseline record as legal evidence, install periodic deformation monitoring points during TBM tunnelling, and follow up recorded cracks with crack gauges.',
          },
        ],
        pendingItems: [],
        calibrationNote: null,
        asteriskFootnote: {
          vi: '(*) Các thông số bổ sung theo yêu cầu kỹ thuật của Chủ đầu tư & Ban Quản lý Tuyến Metro 2.',
          en: '(*) Additional parameters required by the Employer & Metro Line 2 Management Board.',
        },
      });
    }
    setChangeReason('');
    setIsVersionModalOpen(true);
  };

  const handleSubmitNewVersion = async () => {
    if (changeReason.trim().length < 5) {
      alert('Vui lòng nhập lý do thay đổi phiên bản (tối thiểu 5 ký tự)');
      return;
    }
    setIsSubmittingVersion(true);
    try {
      await reportConfigService.createStandardTextVersion(modalTextContent, changeReason.trim());
      setIsVersionModalOpen(false);
      await loadStandardText();
    } catch (err: unknown) {
      console.error('[ReportContentConfigTab] Lỗi tạo phiên bản mới:', err);
      alert(getErrorMessage(err, 'Không thể tạo phiên bản văn bản mới'));
    } finally {
      setIsSubmittingVersion(false);
    }
  };

  // Mở modal thêm/sửa thiết bị
  const handleOpenEquipmentModal = (item?: SurveyEquipmentItem) => {
    if (item) {
      setEditingEq(item);
      setEqForm({
        sortOrder: item.sortOrder,
        nameVi: item.nameVi,
        nameEn: item.nameEn || '',
        specificationVi: item.specificationVi || '',
        specificationEn: item.specificationEn || '',
        purposeVi: item.purposeVi || '',
        purposeEn: item.purposeEn || '',
        model: item.model || '',
        serialNo: item.serialNo || '',
        calibrationCertNo: item.calibrationCertNo || '',
        calibrationValidTo: item.calibrationValidTo || '',
      });
    } else {
      setEditingEq(null);
      setEqForm({
        sortOrder: equipmentList.length + 1,
        nameVi: '',
        nameEn: '',
        specificationVi: '',
        specificationEn: '',
        purposeVi: '',
        purposeEn: '',
        model: '',
        serialNo: '',
        calibrationCertNo: '',
        calibrationValidTo: '',
      });
    }
    setIsEqModalOpen(true);
  };

  const handleSubmitEquipment = async () => {
    if (!eqForm.nameVi.trim()) {
      alert('Vui lòng nhập tên thiết bị (tiếng Việt)');
      return;
    }
    setIsSubmittingEq(true);
    try {
      if (editingEq) {
        await reportConfigService.updateEquipment(editingEq.id, eqForm);
      } else {
        await reportConfigService.createEquipment(eqForm);
      }
      setIsEqModalOpen(false);
      await loadEquipment();
    } catch (err: unknown) {
      console.error('[ReportContentConfigTab] Lỗi lưu thiết bị:', err);
      alert(getErrorMessage(err, 'Không thể lưu thông tin thiết bị'));
    } finally {
      setIsSubmittingEq(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!deleteEqTarget) return;
    if (deleteReason.trim().length < 5) {
      alert('Vui lòng nhập lý do xóa thiết bị (tối thiểu 5 ký tự)');
      return;
    }
    setIsDeletingEq(true);
    try {
      await reportConfigService.deleteEquipment(deleteEqTarget.id, deleteReason.trim());
      setDeleteEqTarget(null);
      setDeleteReason('');
      await loadEquipment();
    } catch (err: unknown) {
      console.error('[ReportContentConfigTab] Lỗi xóa thiết bị:', err);
      alert(getErrorMessage(err, 'Không thể xóa thiết bị khỏi danh mục'));
    } finally {
      setIsDeletingEq(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-purple-950 text-purple-200 border border-purple-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-900 border border-purple-700 flex items-center justify-center text-purple-300">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Chuẩn Hóa Nội Dung & Thiết Bị Báo Cáo BCS</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-purple-900 text-purple-300 border border-purple-700">
                Super Admin Only
              </span>
            </h2>
            <p className="text-xs text-purple-300">
              Quản lý văn bản chuẩn Mục IX / Phụ lục 3 theo phiên bản chỉ-thêm và danh mục thiết bị dự án Metro 2.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('standard-text')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              activeSubTab === 'standard-text'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-purple-900/60 text-purple-200 border-purple-700 hover:bg-purple-900'
            }`}
          >
            Văn Bản Chuẩn (Mục IX & PL3)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('equipment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              activeSubTab === 'equipment'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-purple-900/60 text-purple-200 border-purple-700 hover:bg-purple-900'
            }`}
          >
            Danh Mục Thiết Bị ({equipmentList.length})
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: VĂN BẢN CHUẨN (MỤC IX / PHỤ LỤC 3)
          ===================================================================== */}
      {activeSubTab === 'standard-text' && (
        <div className="space-y-6">
          {/* Active Version Card */}
          <Card>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phiên bản hiệu lực hiện hành:</span>
                    <Badge variant="success" dot>
                      v{activeVersion ? activeVersion.versionNumber : '1 (Khởi tạo)'}
                    </Badge>
                  </div>
                  {activeVersion && (
                    <p className="text-xs text-slate-500 mt-1">
                      Cập nhật: {new Date(activeVersion.createdAt).toLocaleString('vi-VN')} {activeVersion.createdByName ? `bởi ${activeVersion.createdByName}` : ''}
                      {' · '}Lý do: <em>&ldquo;{activeVersion.changeReason}&rdquo;</em>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadStandardText}
                    disabled={isLoadingText}
                    className="cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingText ? 'animate-spin' : ''}`} />
                    Làm mới
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenNewVersionModal}
                    className="cursor-pointer bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Ban hành Phiên bản mới
                  </Button>
                </div>
              </div>

              {textError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {textError}
                </div>
              )}

              {/* Active Content Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Kiến nghị kỹ thuật */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Kiến nghị kỹ thuật (Mục IX - Recommendations)</span>
                  </h4>
                  <div className="space-y-2 text-xs text-slate-700">
                    {activeVersion?.content.recommendations.map((rec, i) => (
                      <div key={i} className="pl-3 border-l-2 border-emerald-500 space-y-0.5">
                        <p className="font-medium text-slate-900">• {rec.vi}</p>
                        {rec.en && <p className="text-slate-500 italic">• {rec.en}</p>}
                      </div>
                    ))}
                    {(!activeVersion || activeVersion.content.recommendations.length === 0) && (
                      <p className="text-slate-400 italic">-- Chưa có văn bản kiến nghị --</p>
                    )}
                  </div>
                </div>

                {/* Nội dung cần bổ sung */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Nội dung cần bổ sung từ hiện trường / thiết kế (Mục IX)</span>
                  </h4>
                  <div className="space-y-2 text-xs text-slate-700">
                    {activeVersion?.content.pendingItems.map((p, i) => (
                      <div key={i} className="pl-3 border-l-2 border-amber-500 space-y-0.5">
                        <p className="font-medium text-slate-900">• {p.vi}</p>
                        {p.en && <p className="text-slate-500 italic">• {p.en}</p>}
                      </div>
                    ))}
                    {(!activeVersion || activeVersion.content.pendingItems.length === 0) && (
                      <p className="text-slate-400 italic">Không có nội dung bổ sung khuôn mẫu (để trống khi xuất)</p>
                    )}
                  </div>
                </div>

                {/* Chú giải dấu * */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Chú giải dấu (*) tại Mục I, Mục IV & Phụ lục
                  </h4>
                  {activeVersion?.content.asteriskFootnote ? (
                    <div className="text-xs text-slate-800 space-y-0.5">
                      <p className="font-medium">{activeVersion.content.asteriskFootnote.vi}</p>
                      {activeVersion.content.asteriskFootnote.en && (
                        <p className="text-slate-500 italic">{activeVersion.content.asteriskFootnote.en}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">-- Không cấu hình footnote --</p>
                  )}
                </div>

                {/* Ghi chú hiệu chuẩn */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ghi chú hiệu chuẩn thiết bị (Phụ lục 3)
                  </h4>
                  {activeVersion?.content.calibrationNote ? (
                    <div className="text-xs text-slate-800 space-y-0.5">
                      <p className="font-medium">{activeVersion.content.calibrationNote.vi}</p>
                      {activeVersion.content.calibrationNote.en && (
                        <p className="text-slate-500 italic">{activeVersion.content.calibrationNote.en}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Đã loại bỏ văn bản khuôn mẫu &ldquo;lưu tại hồ sơ phòng thí nghiệm&rdquo;. Chỉ hiển thị khi Super Admin cấu hình.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Version History Table */}
          <Card>
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">Lịch sử Phiên bản Văn bản Chuẩn (Chỉ-thêm / Immutable)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold w-16">Phiên bản</th>
                      <th className="py-2.5 px-3 font-bold">Lý do điều chỉnh (Bắt buộc)</th>
                      <th className="py-2.5 px-3 font-bold w-36">Người ban hành</th>
                      <th className="py-2.5 px-3 font-bold w-40">Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {versions.map((ver, idx) => (
                      <tr key={ver.id} className={idx === 0 ? 'bg-purple-50/40 font-medium' : ''}>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                            idx === 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            v{ver.versionNumber} {idx === 0 ? '(Hiện hành)' : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">{ver.changeReason}</td>
                        <td className="py-2.5 px-3 text-slate-600">{ver.createdByName || 'Hệ thống'}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(ver.createdAt).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                    {versions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                          Chưa có lịch sử phiên bản
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: DANH MỤC THIẾT BỊ KHẢO SÁT DỰ ÁN (PHỤ LỤC 3)
          ===================================================================== */}
      {activeSubTab === 'equipment' && (
        <Card>
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-purple-700" />
                  <span>Danh Mục Thiết Bị Khảo Sát Cấp Dự Án</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thông tin model, số serial, chứng chỉ hiệu chuẩn in vào Bảng 1 Phụ lục 3. Trường trống sẽ in &lsquo;--&rsquo;.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadEquipment}
                  disabled={isLoadingEq}
                  className="cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingEq ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenEquipmentModal()}
                  className="cursor-pointer bg-purple-700 hover:bg-purple-800 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Thêm thiết bị mới
                </Button>
              </div>
            </div>

            {eqError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {eqError}
              </div>
            )}

            {/* Equipment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 font-bold w-44">Tên thiết bị (VI / EN)</th>
                    <th className="py-2.5 px-3 font-bold w-40">Model / Serial No</th>
                    <th className="py-2.5 px-3 font-bold">Thông số kỹ thuật</th>
                    <th className="py-2.5 px-3 font-bold">Mục đích sử dụng</th>
                    <th className="py-2.5 px-3 font-bold w-44">Hiệu chuẩn (Số / Hạn)</th>
                    <th className="py-2.5 px-3 font-bold w-24 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipmentList.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{eq.sortOrder}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{eq.nameVi}</div>
                        {eq.nameEn && <div className="text-slate-500 italic text-[11px]">{eq.nameEn}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{eq.model || '--'}</div>
                        <div className="text-slate-500 text-[11px]">S/N: {eq.serialNo || '--'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800">{eq.specificationVi || '--'}</div>
                        {eq.specificationEn && (
                          <div className="text-slate-500 italic text-[11px]">{eq.specificationEn}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800">{eq.purposeVi || '--'}</div>
                        {eq.purposeEn && <div className="text-slate-500 italic text-[11px]">{eq.purposeEn}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800">Số: {eq.calibrationCertNo || '--'}</div>
                        <div className="text-slate-500 text-[11px]">Hạn: {eq.calibrationValidTo || '--'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEquipmentModal(eq)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Sửa thiết bị"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteEqTarget(eq);
                              setDeleteReason('');
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa thiết bị"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {equipmentList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                        Chưa có thiết bị nào trong danh mục
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================================
          MODAL: TẠO PHIÊN BẢN VĂN BẢN CHUẨN MỚI
          ===================================================================== */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={() => !isSubmittingVersion && setIsVersionModalOpen(false)}
        title="Ban Hành Phiên Bản Văn Bản Chuẩn Mới"
        description="Mục IX và Phụ lục 3 của các bản nháp và Rev phát hành sau thời điểm này sẽ dùng văn bản này."
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lý do thay đổi phiên bản <span className="text-rose-600">*</span>
            </label>
            <Input
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Ví dụ: Cập nhật kiến nghị quan trắc biến dạng theo yêu cầu Tư vấn giám sát"
            />
          </div>

          {/* Recommendations editor */}
          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Kiến nghị kỹ thuật (Mục IX)</span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="cursor-pointer text-[11px] h-7"
                onClick={() =>
                  setModalTextContent((prev) => ({
                    ...prev,
                    recommendations: [...prev.recommendations, { vi: '', en: '' }],
                  }))
                }
              >
                + Thêm kiến nghị
              </Button>
            </div>
            {modalTextContent.recommendations.map((rec, i) => (
              <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Kiến nghị #{i + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalTextContent((prev) => ({
                        ...prev,
                        recommendations: prev.recommendations.filter((_, idx) => idx !== i),
                      }))
                    }
                    className="text-rose-600 hover:text-rose-800 text-[11px] cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
                <textarea
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  rows={2}
                  value={rec.vi}
                  onChange={(e) => {
                    const updated = [...modalTextContent.recommendations];
                    updated[i] = { ...updated[i], vi: e.target.value };
                    setModalTextContent((prev) => ({ ...prev, recommendations: updated }));
                  }}
                  placeholder="Nội dung kiến nghị (Tiếng Việt)"
                />
                <textarea
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none italic text-slate-600"
                  rows={2}
                  value={rec.en}
                  onChange={(e) => {
                    const updated = [...modalTextContent.recommendations];
                    updated[i] = { ...updated[i], en: e.target.value };
                    setModalTextContent((prev) => ({ ...prev, recommendations: updated }));
                  }}
                  placeholder="English recommendation (tùy chọn)"
                />
              </div>
            ))}
          </div>

          {/* Pending items editor */}
          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Nội dung cần bổ sung từ hiện trường / thiết kế (Mục IX)
              </span>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="cursor-pointer text-[11px] h-7"
                onClick={() =>
                  setModalTextContent((prev) => ({
                    ...prev,
                    pendingItems: [...prev.pendingItems, { vi: '', en: '' }],
                  }))
                }
              >
                + Thêm nội dung bổ sung
              </Button>
            </div>
            {modalTextContent.pendingItems.map((item, i) => (
              <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Nội dung #{i + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalTextContent((prev) => ({
                        ...prev,
                        pendingItems: prev.pendingItems.filter((_, idx) => idx !== i),
                      }))
                    }
                    className="text-rose-600 hover:text-rose-800 text-[11px] cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
                <textarea
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  rows={2}
                  value={item.vi}
                  onChange={(e) => {
                    const updated = [...modalTextContent.pendingItems];
                    updated[i] = { ...updated[i], vi: e.target.value };
                    setModalTextContent((prev) => ({ ...prev, pendingItems: updated }));
                  }}
                  placeholder="Nội dung cần bổ sung (Tiếng Việt)"
                />
                <textarea
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none italic text-slate-600"
                  rows={2}
                  value={item.en}
                  onChange={(e) => {
                    const updated = [...modalTextContent.pendingItems];
                    updated[i] = { ...updated[i], en: e.target.value };
                    setModalTextContent((prev) => ({ ...prev, pendingItems: updated }));
                  }}
                  placeholder="English text (tùy chọn)"
                />
              </div>
            ))}
            {modalTextContent.pendingItems.length === 0 && (
              <p className="text-[11px] text-slate-500 italic">
                Để trống nếu không có yêu cầu bổ sung khuôn mẫu (Mục IX sẽ bỏ qua tiêu đề này).
              </p>
            )}
          </div>

          {/* Footnote editor */}
          <div className="space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-800">Chú giải dấu (*) tại Mục I & Mục IV</span>
            <Input
              value={modalTextContent.asteriskFootnote?.vi || ''}
              onChange={(e) => {
                const vi = e.target.value;
                setModalTextContent((prev) => ({
                  ...prev,
                  asteriskFootnote: vi
                    ? { vi, en: prev.asteriskFootnote?.en || '' }
                    : null,
                }));
              }}
              placeholder="(*) Các thông số bổ sung theo yêu cầu kỹ thuật của Chủ đầu tư..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVersionModalOpen(false)}
              disabled={isSubmittingVersion}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitNewVersion}
              disabled={isSubmittingVersion}
              className="cursor-pointer bg-purple-700 hover:bg-purple-800 text-white"
            >
              {isSubmittingVersion ? 'Đang ban hành...' : 'Xác nhận Ban hành Phiên bản Mới'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL: THÊM / SỬA THIẾT BỊ KHẢO SÁT
          ===================================================================== */}
      <Modal
        isOpen={isEqModalOpen}
        onClose={() => !isSubmittingEq && setIsEqModalOpen(false)}
        title={editingEq ? `Cập Nhật Thiết Bị #${editingEq.sortOrder}` : 'Thêm Thiết Bị Khảo Sát Mới'}
        size="md"
      >
        <div className="space-y-3 p-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thứ tự hiển thị (STT) <span className="text-rose-600">*</span>
              </label>
              <Input
                type="number"
                value={eqForm.sortOrder}
                onChange={(e) => setEqForm({ ...eqForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên thiết bị (Tiếng Việt) <span className="text-rose-600">*</span>
              </label>
              <Input
                value={eqForm.nameVi}
                onChange={(e) => setEqForm({ ...eqForm, nameVi: e.target.value })}
                placeholder="Ví dụ: Máy ảnh số có GPS"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tên thiết bị (English)</label>
            <Input
              value={eqForm.nameEn || ''}
              onChange={(e) => setEqForm({ ...eqForm, nameEn: e.target.value })}
              placeholder="e.g. Digital camera with GPS"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ký hiệu Model</label>
              <Input
                value={eqForm.model || ''}
                onChange={(e) => setEqForm({ ...eqForm, model: e.target.value })}
                placeholder="Ví dụ: Sony Alpha 7 IV"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số Serial (S/N)</label>
              <Input
                value={eqForm.serialNo || ''}
                onChange={(e) => setEqForm({ ...eqForm, serialNo: e.target.value })}
                placeholder="Ví dụ: SN-4920491"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Thông số kỹ thuật</label>
              <Input
                value={eqForm.specificationVi || ''}
                onChange={(e) => setEqForm({ ...eqForm, specificationVi: e.target.value })}
                placeholder="Ví dụ: ≥ 12MP, EXIF WGS-84"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mục đích sử dụng</label>
              <Input
                value={eqForm.purposeVi || ''}
                onChange={(e) => setEqForm({ ...eqForm, purposeVi: e.target.value })}
                placeholder="Ví dụ: Ảnh định danh P-01 - P-07"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số chứng chỉ hiệu chuẩn</label>
              <Input
                value={eqForm.calibrationCertNo || ''}
                onChange={(e) => setEqForm({ ...eqForm, calibrationCertNo: e.target.value })}
                placeholder="Ví dụ: HC-2026/0410"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hiệu lực đến (YYYY-MM-DD)</label>
              <Input
                type="date"
                value={eqForm.calibrationValidTo || ''}
                onChange={(e) => setEqForm({ ...eqForm, calibrationValidTo: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEqModalOpen(false)}
              disabled={isSubmittingEq}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitEquipment}
              disabled={isSubmittingEq}
              className="cursor-pointer bg-purple-700 hover:bg-purple-800 text-white"
            >
              {isSubmittingEq ? 'Đang lưu...' : editingEq ? 'Cập Nhật Thiết Bị' : 'Thêm Thiết Bị'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL: XÁC NHẬN XÓA THIẾT BỊ (SOFT DELETE)
          ===================================================================== */}
      <Modal
        isOpen={Boolean(deleteEqTarget)}
        onClose={() => !isDeletingEq && setDeleteEqTarget(null)}
        title="Xóa Thiết Bị Khỏi Danh Mục"
        size="sm"
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-slate-600">
            Bạn có chắc chắn muốn xóa thiết bị <strong>&ldquo;{deleteEqTarget?.nameVi}&rdquo;</strong>?
            Hành động này là xóa mềm; các bản Rev đã phát hành trong quá khứ vẫn giữ nguyên thông tin snapshot.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lý do xóa (Bắt buộc, tối thiểu 5 ký tự) <span className="text-rose-600">*</span>
            </label>
            <Input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ví dụ: Thiết bị đã thanh lý hoặc ngừng sử dụng"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteEqTarget(null)}
              disabled={isDeletingEq}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteEquipment}
              disabled={isDeletingEq}
              className="cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeletingEq ? 'Đang xóa...' : 'Xác Nhận Xóa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
