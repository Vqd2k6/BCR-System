import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Shield,
  Clock,
  User,
  ArrowRight,
  GitMerge,
  GitFork,
  ArrowLeftRight,
  Edit3,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';

interface HistoryParcel {
  id: string;
  code: string;
  address?: string;
  landAreaM2?: number;
}

interface CadastralMutationHistoryItem {
  id: string;
  mutationCode: string;
  mutationType: 'MERGE' | 'SPLIT' | 'SWAP_SPATIAL' | 'REDRAW' | string;
  actionTitle: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
  operator: {
    id: string;
    fullName: string;
    role: string;
    email?: string;
  };
  reason: string;
  clientIp?: string;
  sourceParcels: HistoryParcel[];
  resultParcels: HistoryParcel[];
  details?: Record<string, any>;
}

interface ParcelMutationHistoryModalProps {
  parcelId: string | null;
  parcelCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ParcelMutationHistoryModal: React.FC<ParcelMutationHistoryModalProps> = ({
  parcelId,
  parcelCode,
  isOpen,
  onClose,
}) => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{
    parcel: {
      id: string;
      code: string;
      address: string;
      landAreaM2: number;
      constructionAreaM2: number;
      surveyStatus: string;
    };
    events: CadastralMutationHistoryItem[];
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !parcelId) return;

    // Kiểm tra quyền nghiêm ngặt phía Frontend
    if (user?.role !== 'SUPER_ADMIN') {
      setError('Quyền truy cập bị từ chối: Chỉ tài khoản SUPER_ADMIN mới có quyền xem lịch sử biến động.');
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/parcels/${parcelId}/mutation-history`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Chỉ SUPER_ADMIN được phép xem lịch sử biến động kiểm toán (403 Forbidden).');
          }
          throw new Error(`Lỗi tải dữ liệu lịch sử (${response.status})`);
        }

        const json = await response.json();
        if (json.success && json.data) {
          setHistoryData(json.data);
        } else {
          throw new Error(json.message || 'Không thể lấy dữ liệu lịch sử');
        }
      } catch (err: any) {
        setError(err.message || 'Đã có lỗi xảy ra khi truy vấn lịch sử biến động');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, parcelId, token, user]);

  if (!isOpen) return null;

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getMutationTypeConfig = (type: string) => {
    switch (type) {
      case 'MERGE':
        return {
          icon: <GitMerge className="w-4 h-4 text-purple-400" />,
          badgeBg: 'bg-purple-900/50 text-purple-200 border-purple-500/30',
          title: 'Gộp Thửa Đất (Merge)',
        };
      case 'SPLIT':
        return {
          icon: <GitFork className="w-4 h-4 text-amber-400" />,
          badgeBg: 'bg-amber-900/50 text-amber-200 border-amber-500/30',
          title: 'Tách Thửa Đất (Split)',
        };
      case 'SWAP_SPATIAL':
        return {
          icon: <ArrowLeftRight className="w-4 h-4 text-blue-400" />,
          badgeBg: 'bg-blue-900/50 text-blue-200 border-blue-500/30',
          title: 'Hoán Vị Ranh Giới (Swap)',
        };
      case 'REDRAW':
        return {
          icon: <Edit3 className="w-4 h-4 text-emerald-400" />,
          badgeBg: 'bg-emerald-900/50 text-emerald-200 border-emerald-500/30',
          title: 'Chỉnh Sửa Ranh Nhà (Redraw)',
        };
      default:
        return {
          icon: <Layers className="w-4 h-4 text-slate-400" />,
          badgeBg: 'bg-slate-800 text-slate-200 border-slate-600',
          title: 'Biến Động Địa Chính',
        };
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/40">Super Admin</span>;
      case 'ZONE_ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/40">Zone Admin</span>;
      case 'SURVEYOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/40">Khảo Sát Viên</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{role}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Lịch Sử Biến Động Thửa Đất</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30">
                  <Shield className="w-3 h-3" /> SUPER_ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mã thửa: <strong className="text-amber-400 font-mono">{historyData?.parcel?.code || parcelCode || 'Đang tải...'}</strong>
                {historyData?.parcel?.address && ` — ${historyData.parcel.address}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Trạng thái Loading */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Đang trích xuất nhật ký biến động địa chính...</p>
            </div>
          )}

          {/* Trạng thái Lỗi */}
          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Không thể tải lịch sử</h4>
                <p className="text-xs text-rose-300/80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Dữ liệu hiển thị */}
          {!loading && !error && historyData && (
            <>
              {/* Thẻ tóm tắt thửa đất hiện tại */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Diện tích đất</span>
                  <strong className="text-slate-200 font-mono text-sm">{historyData.parcel.landAreaM2} m²</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Diện tích xây dựng</span>
                  <strong className="text-slate-200 font-mono text-sm">{historyData.parcel.constructionAreaM2 || 0} m²</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Trạng thái khảo sát</span>
                  <span className="inline-block mt-0.5 font-semibold text-sky-400">{historyData.parcel.surveyStatus}</span>
                </div>
              </div>

              {/* Danh sách Dòng thời gian biến động */}
              {historyData.events.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Layers className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Chưa có sự kiện biến động nào</p>
                  <p className="text-xs text-slate-500 mt-1">Thửa đất này chưa từng thực hiện Tách, Gộp, Hoán vị hay Chỉnh ranh.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {historyData.events.map((ev, idx) => {
                    const cfg = getMutationTypeConfig(ev.mutationType);
                    return (
                      <div key={ev.id || idx} className="relative group">
                        {/* Timeline dot */}
                        <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-amber-500/70 flex items-center justify-center shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        </div>

                        {/* Event Card */}
                        <div className="rounded-xl border border-slate-800 bg-slate-850/60 p-4 hover:border-slate-700/80 transition-all space-y-3 shadow-sm">
                          {/* Header event */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${cfg.badgeBg}`}>
                                {cfg.icon}
                                {cfg.title}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                {ev.mutationCode}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {formatDate(ev.createdAt)}
                            </span>
                          </div>

                          {/* Operator info */}
                          <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-800/60">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>Người thực hiện: <strong className="text-slate-100">{ev.operator.fullName}</strong></span>
                              {getRoleBadge(ev.operator.role)}
                            </div>
                            {ev.clientIp && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                IP: {ev.clientIp}
                              </span>
                            )}
                          </div>

                          {/* Reason Quote */}
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                            <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider mb-1">
                              Lý do kỹ thuật & Ghi chú kiểm toán:
                            </span>
                            <p className="text-slate-200 italic font-mono">"{ev.reason}"</p>
                          </div>

                          {/* Source & Result Parcels Diff */}
                          {(ev.sourceParcels.length > 0 || ev.resultParcels.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/60">
                              {/* Nguồn */}
                              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1.5">
                                  Thửa đất nguồn ({ev.sourceParcels.length})
                                </span>
                                <div className="space-y-1">
                                  {ev.sourceParcels.map((p) => (
                                    <div key={p.id} className="flex justify-between items-center bg-slate-800/60 px-2 py-1 rounded">
                                      <span className="font-mono font-semibold text-amber-300">{p.code}</span>
                                      <span className="text-slate-400 text-[11px] font-mono">{p.landAreaM2 ? `${p.landAreaM2} m²` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Kết quả */}
                              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                                <span className="text-[10px] text-emerald-400 font-bold block uppercase mb-1.5 flex items-center gap-1">
                                  <ArrowRight className="w-3 h-3" /> Thửa đất kết quả ({ev.resultParcels.length})
                                </span>
                                <div className="space-y-1">
                                  {ev.resultParcels.map((p) => (
                                    <div key={p.id} className="flex justify-between items-center bg-slate-800/60 px-2 py-1 rounded">
                                      <span className="font-mono font-semibold text-emerald-300">{p.code}</span>
                                      <span className="text-slate-400 text-[11px] font-mono">{p.landAreaM2 ? `${p.landAreaM2} m²` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Extra Diff Details (Nếu có) */}
                          {ev.details && ev.details.totalLandArea && (
                            <div className="text-[11px] text-slate-400 bg-slate-900/30 px-3 py-1.5 rounded-lg flex items-center gap-4">
                              <span>Tổng diện tích sau gộp: <strong className="text-slate-200">{ev.details.totalLandArea} m²</strong></span>
                              {ev.details.residualAreaM2 && (
                                <span>Phần dư: <strong className="text-amber-300">{ev.details.residualAreaM2} m²</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống Kiểm toán Biến động Địa chính Metro 2 (Append-Only Audit Log)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
