import React, { useState, useEffect } from 'react';
import { X, FileText, Check, Loader2, AlertCircle, Layers } from 'lucide-react';
import {
  loadPdfDocument,
  renderPdfPageThumbnail,
  renderPdfPageToBlob,
  PdfDocumentInfo,
} from '../../utils/pdfToImageConverter';

interface PdfFloorPlanPickerModalProps {
  isOpen: boolean;
  file: File | null;
  floorName?: string;
  onClose: () => void;
  onConfirmPage: (imageBlob: Blob, pageNumber: number) => void;
}

export const PdfFloorPlanPickerModal: React.FC<PdfFloorPlanPickerModalProps> = ({
  isOpen,
  file,
  floorName = 'Tầng hiện tại',
  onClose,
  onConfirmPage,
}) => {
  const [loading, setLoading] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<PdfDocumentInfo | null>(null);
  const [thumbnails, setThumbnails] = useState<{ pageNumber: number; dataUrl: string }[]>([]);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setPdfInfo(null);
      setThumbnails([]);
      setSelectedPage(1);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadAndRender = async () => {
      try {
        const info = await loadPdfDocument(file);
        if (!isMounted) return;
        setPdfInfo(info);
        setSelectedPage(1);

        const thumbs: { pageNumber: number; dataUrl: string }[] = [];
        // Render thumbnail từng trang
        for (let i = 1; i <= info.numPages; i++) {
          if (!isMounted) break;
          const url = await renderPdfPageThumbnail(info.pdfDoc, i, 360);
          thumbs.push({ pageNumber: i, dataUrl: url });
          if (isMounted) {
            setThumbnails([...thumbs]);
          }
        }
      } catch (err: any) {
        console.error('[PdfPicker] Lỗi đọc file PDF:', err);
        if (isMounted) {
          setError('Không thể đọc file PDF bản vẽ. Vui lòng kiểm tra lại file hoặc chuyển sang dạng ảnh JPG/PNG.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      isMounted = false;
    };
  }, [isOpen, file]);

  const handleConfirm = async () => {
    if (!pdfInfo || isConverting) return;
    setIsConverting(true);
    setError(null);
    try {
      // Render độ phân giải 2048px sắc nét
      const blob = await renderPdfPageToBlob(pdfInfo.pdfDoc, selectedPage, 2048, 0.92);
      onConfirmPage(blob, selectedPage);
      onClose();
    } catch (err: any) {
      console.error('[PdfPicker] Lỗi render trang PDF:', err);
      setError('Lỗi khi chuyển đổi trang PDF sang ảnh. Vui lòng thử lại.');
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Chọn Trang Mặt Bằng Cho: <span className="text-emerald-700">{floorName}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {pdfInfo
                  ? `Tập hồ sơ PDF gồm ${pdfInfo.numPages} trang. Vui lòng bấm chọn đúng trang mặt bằng để nạp sơ đồ CAD.`
                  : 'Đang giải mã bản vẽ PDF kỹ thuật...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConverting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100/60 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && thumbnails.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Đang nạp các trang bản vẽ PDF...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {thumbnails.map((thumb) => {
                const isSelected = selectedPage === thumb.pageNumber;
                return (
                  <div
                    key={`pdf_page_${thumb.pageNumber}`}
                    onClick={() => setSelectedPage(thumb.pageNumber)}
                    className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all bg-white shadow-2xs flex flex-col ${
                      isSelected
                        ? 'border-emerald-600 ring-3 ring-emerald-500/25 shadow-md'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {/* Top bar của card */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-500" />
                        Trang {thumb.pageNumber}
                      </span>
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                          <Check size={10} strokeWidth={3} />
                          Đang chọn
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600">
                          Chạm để chọn
                        </span>
                      )}
                    </div>

                    {/* Khung ảnh preview trang bản vẽ */}
                    <div className="aspect-[4/3] w-full bg-slate-50 flex items-center justify-center p-2 overflow-hidden">
                      {thumb.dataUrl ? (
                        <img
                          src={thumb.dataUrl}
                          alt={`Trang ${thumb.pageNumber}`}
                          className="max-h-full max-w-full object-contain shadow-xs border border-slate-200 rounded"
                        />
                      ) : (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-600 font-medium">
            {pdfInfo ? (
              <span>
                Đang chọn: <strong>Trang {selectedPage}</strong> / {pdfInfo.numPages} trang
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConverting || loading || !pdfInfo}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang trích xuất ảnh nét...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Sử dụng Trang {selectedPage} cho {floorName}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
