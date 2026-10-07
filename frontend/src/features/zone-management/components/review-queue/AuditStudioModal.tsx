import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  History,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { RejectReportModal } from './RejectReportModal';
import { EngineeringJudgementModal } from './EngineeringJudgementModal';
import { ImageZoomModal } from '../../../../components/common/ImageZoomModal';
import { AuditStepwiseDocumentView } from './stepwise/AuditStepwiseDocumentView';
import { AuditDiffConfirmModal } from './AuditDiffConfirmModal';
import { AuditPhotoReplaceModal } from './AuditPhotoReplaceModal';
import { AuditHistoryModal } from './AuditHistoryModal';

interface Props {
  isOpen: boolean;
  reportId: string;
  onClose: () => void;
  onRefreshList: () => void;
}

export const AuditStudioModal: React.FC<Props> = ({
  isOpen,
  reportId,
  onClose,
  onRefreshList,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showJudgementModal, setShowJudgementModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Diff Confirmation Modal State
  const [diffModalData, setDiffModalData] = useState<{
    isOpen: boolean;
    diffItems: any[];
    updates: any;
  }>({ isOpen: false, diffItems: [], updates: {} });

  // Photo Replace Modal State (With 6-digit random code)
  const [photoReplaceData, setPhotoReplaceData] = useState<{
    isOpen: boolean;
    targetPhotoType: string;
    targetPhotoId?: string;
    defectId?: string;
    zoneId?: string;
    photoIndex?: number;
    currentPhotoUrl: string;
    photoTitle?: string;
  }>({ isOpen: false, targetPhotoType: 'OTHER', currentPhotoUrl: '' });

  // Audit History Modal State
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  const fetchAuditData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/admin/reports/${reportId}/audit-view`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        setErrorMsg('Không thể tải dữ liệu hồ sơ.');
      }
    } catch (err: any) {
      console.error('[AuditStudioModal] Failed to fetch audit view:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi kết nối khi tải hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      fetchAuditData();
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  // Handle Approve
  const handleApprove = async () => {
    if (!data) return;
    const confirmMsg = `Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ thửa ${data.projectParcelCode}?\nHồ sơ sẽ được khóa bất biến và tự động ký số Zone Admin.`;
    if (!window.confirm(confirmMsg)) return;

    setIsApproving(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/approve`);
      if (res.data?.success || res.status === 200) {
        alert('Đã phê duyệt hồ sơ thành công!');
        onRefreshList();
        onClose();
      } else {
        alert(res.data?.message || 'Không thể phê duyệt hồ sơ.');
      }
    } catch (err: any) {
      console.error('[AuditStudioModal] Error approving:', err);
      alert(err.response?.data?.message || err.message || 'Lỗi kết nối khi phê duyệt.');
    } finally {
      setIsApproving(false);
    }
  };

  const auditFlags = data?.auditFlags || [];
  const riskCard = data?.leftPane?.riskScoreCard;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm text-emerald-400">
                  {data?.projectParcelCode || 'Đang tải...'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-xs font-bold text-white">
                  {data?.houseNumber ? `${data.houseNumber} ${data.street}` : 'Địa chỉ chưa cập nhật'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {data?.zoneId || 'ZONE'}
                </span>
                {data?.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      data.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : data.status === 'POSTPONED_ABSENT'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : data.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {data.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                <span>KSV: <strong>{data?.surveyorName || '---'}</strong></span>
                {data?.surveyorPhone && <span>• SĐT: {data.surveyorPhone}</span>}
                {data?.surveyDate && (
                  <span>
                    • Khảo sát: {new Date(data.surveyDate).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data?.auditHistory && (
              <button
                type="button"
                onClick={() => setShowAuditHistory(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  data.auditHistory.length > 0
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                }`}
                title="Xem nhật ký kiểm toán và lịch sử sửa đổi"
              >
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>Nhật ký ({data.auditHistory.length})</span>
              </button>
            )}

            {auditFlags.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{auditFlags.length} Cờ cảnh báo</span>
              </span>
            )}
            <button
              type="button"
              onClick={fetchAuditData}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Đóng modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: 100% Stepwise Document View (No Split-Pane) */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-sm font-bold">Đang tải hồ sơ thẩm định chi tiết...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-sm font-bold">{errorMsg}</span>
            <button
              type="button"
              onClick={fetchAuditData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
            <AuditStepwiseDocumentView
              data={data}
              reportId={reportId}
              onRefresh={fetchAuditData}
              onOpenPhotoZoom={(url, title) => {
                setSelectedPhotoUrl(url);
                setSelectedPhotoTitle(title || 'Ảnh Hiện Trường');
                setShowImageZoom(true);
              }}
              onOpenPhotoReplace={(params) => {
                setPhotoReplaceData({
                  isOpen: true,
                  targetPhotoType: params.targetPhotoType,
                  targetPhotoId: params.targetPhotoId,
                  defectId: params.defectId,
                  zoneId: params.zoneId,
                  photoIndex: params.photoIndex,
                  currentPhotoUrl: params.currentPhotoUrl,
                  photoTitle: params.photoTitle,
                });
              }}
              onOpenDiffModal={(diffItems, updates) => {
                setDiffModalData({
                  isOpen: true,
                  diffItems,
                  updates,
                });
              }}
              onOpenEngineeringJudgement={() => setShowJudgementModal(true)}
            />
          </div>
        )}

        {/* Bottom Footer: Decision Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const previewUrl = `/api/v1/v2/reports/${reportId}/preview/html`;
                window.open(previewUrl, '_blank', 'noopener,noreferrer');
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Xem Bản In Preview</span>
            </button>

            {data?.status !== 'APPROVED' && (
              <button
                type="button"
                onClick={() => setShowJudgementModal(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Can Thiệp Kỹ Thuật (Override)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {data?.status !== 'APPROVED' && (
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-rose-600" />
                <span>Yêu Cầu Khảo Sát Lại (Reject)</span>
              </button>
            )}

            <button
              type="button"
              disabled={isApproving || data?.status === 'APPROVED'}
              onClick={handleApprove}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 ${
                data?.status === 'APPROVED'
                  ? 'bg-emerald-700/90 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isApproving
                  ? 'Đang ký duyệt...'
                  : data?.status === 'APPROVED'
                  ? '✓ Đã Khóa Duyệt'
                  : 'Phê Duyệt Hồ Sơ (Approve)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Child Modals */}
      {showRejectModal && data && (
        <RejectReportModal
          isOpen={showRejectModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode}
          surveyorName={data.surveyorName}
          onClose={() => setShowRejectModal(false)}
          onSuccess={() => {
            alert('Đã gửi yêu cầu bổ sung cho Surveyor thành công!');
            onRefreshList();
            onClose();
          }}
        />
      )}

      {showJudgementModal && data && (
        <EngineeringJudgementModal
          isOpen={showJudgementModal}
          reportId={reportId}
          parcelCode={data.projectParcelCode}
          currentBurlandGrade={riskCard?.e1_burland_score !== undefined ? `Cấp ${riskCard.e1_burland_score}` : (data?.surveyJson?.ecs?.e1 !== undefined ? `Cấp ${data.surveyJson.ecs.e1}` : undefined)}
          riskCard={riskCard}
          data={data}
          onClose={() => setShowJudgementModal(false)}
          onSuccess={() => {
            alert('Đã lưu phán quyết chuyên gia thành công!');
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {showImageZoom && selectedPhotoUrl && (
        <ImageZoomModal
          isOpen={showImageZoom}
          imageUrl={selectedPhotoUrl}
          title={selectedPhotoTitle}
          onClose={() => setShowImageZoom(false)}
        />
      )}

      {diffModalData.isOpen && (
        <AuditDiffConfirmModal
          isOpen={diffModalData.isOpen}
          reportId={reportId}
          parcelCode={data?.projectParcelCode}
          diffItems={diffModalData.diffItems}
          updatesPayload={diffModalData.updates}
          onClose={() => setDiffModalData({ isOpen: false, diffItems: [], updates: {} })}
          onSuccess={() => {
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {photoReplaceData.isOpen && (
        <AuditPhotoReplaceModal
          isOpen={photoReplaceData.isOpen}
          reportId={reportId}
          targetPhotoType={photoReplaceData.targetPhotoType}
          targetPhotoId={photoReplaceData.targetPhotoId}
          defectId={photoReplaceData.defectId}
          zoneId={photoReplaceData.zoneId}
          photoIndex={photoReplaceData.photoIndex}
          currentPhotoUrl={photoReplaceData.currentPhotoUrl}
          photoTitle={photoReplaceData.photoTitle}
          onClose={() =>
            setPhotoReplaceData({
              isOpen: false,
              targetPhotoType: 'OTHER',
              currentPhotoUrl: '',
            })
          }
          onSuccess={() => {
            fetchAuditData();
            onRefreshList();
          }}
        />
      )}

      {showAuditHistory && (
        <AuditHistoryModal
          isOpen={showAuditHistory}
          onClose={() => setShowAuditHistory(false)}
          reportCode={data?.reportCode}
          parcelCode={data?.projectParcelCode}
          logs={data?.auditHistory || []}
        />
      )}
    </div>
  );
};
