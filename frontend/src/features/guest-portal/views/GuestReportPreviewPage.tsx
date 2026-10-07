import React, { useState, useEffect } from 'react';
import { GisParcel } from '../../../components/gis/shared/types';
import { api } from '../../../services/api';
import {
  ArrowLeft,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Building2,
  Clock,
} from 'lucide-react';
import {
  getEffectiveParcelStatus,
  getStatusColor,
} from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import {
  maskClientName,
  getParcelBraRiskLevel,
  getBraBadgeStyle,
} from '../utils/guestPortalHelpers';

interface GuestReportPreviewPageProps {
  parcel: GisParcel;
  onBack: () => void;
}

export const GuestReportPreviewPage: React.FC<GuestReportPreviewPageProps> = ({
  parcel,
  onBack,
}) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotSurveyedYet, setIsNotSurveyedYet] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | '100' | '75' | '125'>('fit');
  const [renderKey, setRenderKey] = useState<number>(0);

  const effStatus = getEffectiveParcelStatus(parcel);
  const statusColor = getStatusColor(effStatus);
  const braLevel = getParcelBraRiskLevel(parcel);
  const braStyle = getBraBadgeStyle(braLevel);

  // Nạp mã HTML xem trước của Báo cáo BCS
  const fetchReportHtml = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsNotSurveyedYet(false);

    // Nếu trạng thái chưa từng được khảo sát
    if (effStatus === 'NOT_SURVEYED') {
      setIsNotSurveyedYet(true);
      setIsLoading(false);
      return;
    }

    const reportId = (parcel as any).activePhase1ReportId || parcel.id || parcel.projectParcelCode;

    try {
      // 1. Thử gọi endpoint V2 (Mẫu Song Ngữ Chuẩn 0410 CRLG-CRSRI-TT)
      try {
        const resV2 = await api.get(`/v2/reports/${encodeURIComponent(reportId)}/preview/html`, {
          params: { isGuest: 'true', maskPii: 'true', watermark: 'true' },
          responseType: 'text',
        });
        if (resV2.data && typeof resV2.data === 'string' && resV2.data.trim().length > 100) {
          setHtmlContent(resV2.data);
          setRenderKey((k) => k + 1);
          setIsLoading(false);
          return;
        }
      } catch (errV2: any) {
        // Nếu là 404, thử fallback sang V1
        if (errV2.response?.status !== 404) {
          console.warn('[GuestPreview] Lỗi khi nạp report V2, thử fallback V1:', errV2);
        }
      }

      // 2. Fallback sang endpoint V1 nếu V2 không có
      const resV1 = await api.get(`/reports/${encodeURIComponent(reportId)}/preview/html`, {
        params: { isGuest: 'true', maskPii: 'true', watermark: 'true' },
        responseType: 'text',
      });
      if (resV1.data && typeof resV1.data === 'string') {
        setHtmlContent(resV1.data);
        setRenderKey((k) => k + 1);
      } else {
        throw new Error('Dữ liệu HTML rỗng từ máy chủ');
      }
    } catch (err: any) {
      console.warn('[GuestPreview] Không thể tải bản xem trước báo cáo:', err);
      if (err.response?.status === 404) {
        setIsNotSurveyedYet(true);
      } else {
        setErrorMessage(
          err.response?.data?.detail ||
          err.message ||
          'Không thể kết nối máy chủ để nạp bản in báo cáo.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportHtml();
  }, [parcel.id]);

  // Quản lý Blob URL cho Iframe an toàn
  useEffect(() => {
    if (!htmlContent) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    // Chèn thêm thẻ CSS ngăn in ấn & bảo đảm watermark toàn trang (Security & Watermark Protection)
    const securityInjectedHtml = htmlContent.replace(
      '</head>',
      `<style>
        @media print {
          body { display: none !important; }
        }
        ::selection { background: transparent; }
        body.guest-watermark-mode .a4-page-sheet::before,
        .a4-page-sheet::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='500' height='380' viewBox='0 0 500 380'><g transform='rotate(-32 250 190)'><text x='250' y='140' text-anchor='middle' font-family='Arial, sans-serif' font-weight='900' font-size='22' fill='rgba(2,132,199,0.13)' letter-spacing='2'>BẢN XEM TRƯỚC - GUEST ONLY</text><text x='250' y='175' text-anchor='middle' font-family='Arial, sans-serif' font-weight='bold' font-size='14' fill='rgba(15,23,42,0.10)' letter-spacing='1'>LIÊN DANH CRLG – CRSRI – TT</text><text x='250' y='200' text-anchor='middle' font-family='Arial, sans-serif' font-weight='600' font-size='11' fill='rgba(100,116,139,0.09)'>TUYẾN METRO 2 • BẢN DỰ THẢO KHÔNG DÙNG NGHIỆM THU</text></g></svg>");
          background-repeat: repeat;
          background-position: center center;
        }
      </style></head>`
    );

    const blob = new Blob([securityInjectedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [htmlContent, renderKey]);

  // Chặn phím tắt in ấn (Ctrl+P / Cmd+P) trên toàn trang
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-slate-100 font-sans text-slate-800 select-none">
      {/* ─── 1. TOP EXECUTIVE HEADER NAVIGATION BAR (Clean Light Theme) ─── */}
      <header className="h-16 bg-white px-4 sm:px-6 flex items-center justify-between border-b border-slate-200 shadow-xs shrink-0 z-30">
        {/* Left: Back Button & Project Branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Quay lại Bản đồ Giám sát GIS"
          >
            <ArrowLeft size={16} className="text-sky-600" />
            <span className="hidden sm:inline">Quay lại Bản đồ GIS</span>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Logo & Report Title */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-sky-50 rounded-xl border border-sky-200 flex items-center justify-center shrink-0">
              <FileCheck size={18} className="text-sky-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900">
                  BÁO CÁO KHẢO SÁT HIỆN TRẠNG (BCS REPORT)
                </span>
                <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                  Mẫu 0410 Song Ngữ (CRLG-CRSRI-TT)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md">
                Tuyến Metro Số 2 (Bến Thành – Tham Lương) • Ban Quản Lý ĐSĐT (MAUR)
              </p>
            </div>
          </div>
        </div>

        {/* Center: Parcel Summary Info Strip */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
          <Building2 size={14} className="text-sky-600 shrink-0" />
          <span className="font-mono text-xs font-black text-slate-900">
            {parcel.projectParcelCode}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-700 font-medium truncate max-w-[180px]">
            {parcel.houseNumber ? `${parcel.houseNumber} ` : ''}
            {parcel.street}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-500">
            Chủ hộ: <strong className="text-slate-800">{maskClientName(parcel.ownerName)}</strong>
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ml-1"
            style={{ backgroundColor: statusColor }}
          >
            {effStatus}
          </span>
        </div>

        {/* Right: Security Badge & Zoom Controls & Refresh */}
        <div className="flex items-center gap-2">
          {/* Security Badge: Watermark & View-Only */}
          <div className="hidden sm:flex items-center gap-1.5 bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow-2xs">
            <ShieldCheck size={14} className="text-sky-600 shrink-0" />
            <span>Watermark Bảo Mật (View-Only)</span>
          </div>

          {/* Zoom Switcher */}
          <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setPreviewZoom('fit')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                previewZoom === 'fit'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tự động co giãn vừa khung nhìn"
            >
              Vừa Khung
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom('100')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                previewZoom === '100'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tỷ lệ 100% chuẩn khổ A4"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom('75')}
              className={`px-2 py-1 rounded-lg transition-all hidden md:block ${
                previewZoom === '75'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Thu nhỏ 75%"
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom('125')}
              className={`px-2 py-1 rounded-lg transition-all hidden md:block ${
                previewZoom === '125'
                  ? 'bg-white text-sky-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Phóng to 125%"
            >
              125%
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchReportHtml}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Làm mới bản in báo cáo"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-sky-600' : ''} />
          </button>
        </div>
      </header>

      {/* ─── 2. MAIN PREVIEW VIEWPORT (Soft Technical Gray Stage) ─── */}
      <main className="flex-1 w-full overflow-y-auto bg-slate-200/70 p-4 sm:p-6 flex flex-col items-center justify-start relative">
        {/* Case 1: Loading Spinner */}
        {isLoading && (
          <div className="my-auto p-10 max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center gap-3 animate-in fade-in">
            <RefreshCw size={36} className="text-sky-600 animate-spin" />
            <span className="text-sm font-bold text-slate-900">
              Đang biên dịch Báo cáo Kỹ thuật Tuyến Metro Số 2...
            </span>
            <p className="text-xs text-slate-500 max-w-sm">
              Hệ thống đang kết xuất bản in A4 chuẩn Song Ngữ 0410 gồm 9 chương và các phụ lục ảnh đính kèm.
            </p>
          </div>
        )}

        {/* Case 2: Not Surveyed Yet Notice Card */}
        {!isLoading && isNotSurveyedYet && (
          <div className="my-auto p-8 sm:p-10 max-w-lg w-full bg-white border border-slate-200 rounded-3xl shadow-xl text-center flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Clock size={32} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Hồ Sơ Đang Trong Tiến Trình Khảo Sát
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Công trình <strong className="text-sky-700">{parcel.projectParcelCode}</strong> ({parcel.houseNumber ? `${parcel.houseNumber} ` : ''}{parcel.street}) hiện đang ở trạng thái:{' '}
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-bold text-white inline-block mt-1"
                  style={{ backgroundColor: statusColor }}
                >
                  {effStatus}
                </span>
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 text-left space-y-1.5 w-full">
              <div className="flex items-center gap-2 text-sky-700 font-semibold text-[11px]">
                <ShieldAlert size={14} />
                <span>Quy trình nghiệm thu báo cáo Metro 2:</span>
              </div>
              <p className="text-[11px] text-slate-600">
                1. Kỹ sư hiện trường thu thập số liệu kết cấu, nứt lún và lấy chữ ký chủ hộ.
              </p>
              <p className="text-[11px] text-slate-600">
                2. Hội đồng Giám sát (Zone Admin) kiểm duyệt và khóa dữ liệu bất biến.
              </p>
              <p className="text-[11px] text-slate-600">
                3. Báo cáo kỹ thuật chuẩn 0410 Song Ngữ sẽ tự động hiển thị tại đây sau khi được phê duyệt.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 cursor-pointer active:scale-95"
            >
              Quay lại Danh Sách Giám Sát
            </button>
          </div>
        )}

        {/* Case 3: Error Loading Report */}
        {!isLoading && !isNotSurveyedYet && errorMessage && (
          <div className="my-auto p-8 max-w-md w-full bg-white border border-rose-200 rounded-3xl shadow-xl text-center flex flex-col items-center space-y-3">
            <AlertCircle size={36} className="text-rose-500" />
            <span className="text-sm font-bold text-slate-900">
              Không thể tải bản xem trước báo cáo
            </span>
            <p className="text-xs text-slate-600">
              {errorMessage}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={fetchReportHtml}
                className="py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw size={13} />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}

        {/* Case 4: Report Rendered Successfully in Responsive A4 Container */}
        {!isLoading && !isNotSurveyedYet && htmlContent && (
          <div
            className={`transition-all duration-200 flex justify-center w-full min-h-full ${
              previewZoom === '75'
                ? 'scale-75 origin-top -mb-48'
                : previewZoom === '125'
                ? 'scale-125 origin-top mb-48'
                : ''
            }`}
          >
            <iframe
              key={`guest-report-iframe-${renderKey}`}
              src={blobUrl || undefined}
              title={`Báo cáo Khảo sát Hiện trạng ${parcel.projectParcelCode}`}
              className={`${
                previewZoom === 'fit'
                  ? 'w-full max-w-[920px]'
                  : 'w-[840px] max-w-full'
              } min-h-[calc(100vh-100px)] border border-slate-300 rounded-xl shadow-2xl bg-white block`}
            />
          </div>
        )}
      </main>
    </div>
  );
};
