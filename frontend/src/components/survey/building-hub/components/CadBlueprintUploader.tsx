import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Copy,
  ChevronRight,
  Layers,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  loadPdfDocument,
  renderPdfPageThumbnail,
  renderPdfPageToBlob,
  type PdfDocumentInfo,
} from '../../../../utils/pdfToImageConverter';

interface FloorOption {
  floorNumber: number;
  floorName: string;
  cadPhotoUrl: string;
  unitCount?: number;
}

interface CadBlueprintUploaderProps {
  floorNumber: number;
  floorName?: string;
  onUploadSuccess: (url: string) => void;
  onCopyFromOtherFloor?: (sourceFloor: FloorOption) => void;
  otherFloorsWithCad?: FloorOption[];
  readOnly?: boolean;
}

export const CadBlueprintUploader: React.FC<CadBlueprintUploaderProps> = ({
  floorNumber,
  floorName,
  onUploadSuccess,
  onCopyFromOtherFloor,
  otherFloorsWithCad = [],
  readOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  // PDF Page Selection states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfDocumentInfo | null>(null);
  const [thumbnails, setThumbnails] = useState<{ pageNumber: number; dataUrl: string }[]>([]);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isExtractingPage, setIsExtractingPage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý upload Blob hoặc File ảnh lên Storage
  const uploadImageBlob = async (blob: Blob, filename: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('folder', 'cad_blueprints');

    try {
      const res = await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.data?.url) {
        return res.data.data.url;
      }
      if (res.data?.url) {
        return res.data.url;
      }
      throw new Error('Máy chủ không trả về URL ảnh');
    } catch (err) {
      console.warn('[CadBlueprintUploader] API upload thất bại, fallback sang DataURL:', err);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  };

  // Xử lý khi người dùng chọn file ảnh
  const handleProcessImageFile = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    try {
      const url = await uploadImageBlob(file, file.name);
      onUploadSuccess(url);
    } catch (err: unknown) {
      console.error('[CadBlueprintUploader:handleProcessImageFile] Lỗi tải ảnh bản vẽ:', err);
      setUploadError(`Không thể tải ảnh bản vẽ: ${getErrorMessage(err, 'Lỗi kết nối')}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Xử lý khi người dùng chọn file PDF
  const handleProcessPdfFile = async (file: File) => {
    setPdfFile(file);
    setIsLoadingPdf(true);
    setUploadError('');
    setThumbnails([]);
    setSelectedPdfPage(1);

    try {
      const info = await loadPdfDocument(file);
      setPdfInfo(info);

      const thumbs: { pageNumber: number; dataUrl: string }[] = [];
      for (let i = 1; i <= info.numPages; i++) {
        const thumbUrl = await renderPdfPageThumbnail(info.pdfDoc, i, 360);
        thumbs.push({ pageNumber: i, dataUrl: thumbUrl });
        setThumbnails([...thumbs]);
      }
    } catch (err: unknown) {
      console.error('[CadBlueprintUploader:handleProcessPdfFile] Lỗi đọc tài liệu PDF:', err);
      setUploadError(`Không thể đọc tài liệu PDF: ${getErrorMessage(err, 'File PDF không hợp lệ hoặc bị khóa')}`);
      setPdfFile(null);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Xác nhận trích xuất trang PDF đã chọn
  const handleConfirmPdfPage = async () => {
    if (!pdfInfo || !pdfFile) return;
    setIsExtractingPage(true);
    setUploadError('');

    try {
      const pageBlob = await renderPdfPageToBlob(pdfInfo.pdfDoc, selectedPdfPage, 2048, 0.92);
      const filename = `cad_tang_${floorNumber}_p${selectedPdfPage}_${Date.now()}.jpg`;
      const url = await uploadImageBlob(pageBlob, filename);
      // Reset PDF state
      setPdfFile(null);
      setPdfInfo(null);
      setThumbnails([]);
      onUploadSuccess(url);
    } catch (err: unknown) {
      console.error('[CadBlueprintUploader:handleConfirmPdfPage] Lỗi trích xuất trang PDF:', err);
      setUploadError(`Lỗi trích xuất trang PDF: ${getErrorMessage(err, 'Vui lòng thử lại')}`);
    } finally {
      setIsExtractingPage(false);
    }
  };

  const handleFileSelected = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      handleProcessPdfFile(file);
    } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
      handleProcessImageFile(file);
    } else {
      setUploadError('Định dạng tệp không được hỗ trợ. Vui lòng tải file ảnh (PNG, JPG, SVG) hoặc hồ sơ PDF.');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (readOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }, [readOnly]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!readOnly) setIsDragging(true);
  }, [readOnly]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-4">
      {/* 1. Màn hình chọn trang PDF nếu đã nạp file PDF */}
      {pdfFile && pdfInfo ? (
        <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col gap-4 animate-in fade-in duration-200 text-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Chọn Trang Bản Vẽ Mặt Bằng Tầng {floorNumber}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono border border-slate-200">
                    {pdfFile.name} ({pdfInfo.numPages} trang)
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  Nhấp vào trang có sơ đồ kiến trúc Tầng {floorNumber} để trích xuất bản vẽ CAD độ phân giải cao.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPdfFile(null);
                setPdfInfo(null);
                setThumbnails([]);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid hiển thị thumbnail các trang */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1">
            {thumbnails.map((t) => {
              const isSelected = selectedPdfPage === t.pageNumber;
              return (
                <div
                  key={t.pageNumber}
                  onClick={() => setSelectedPdfPage(t.pageNumber)}
                  className={`group relative flex flex-col items-center p-2 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/40 shadow-sm'
                      : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="w-full aspect-[4/3] bg-white rounded-lg overflow-hidden flex items-center justify-center relative shadow-xs border border-slate-200">
                    <img
                      src={t.dataUrl}
                      alt={`Trang ${t.pageNumber}`}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-teal-600 text-white shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-bold transition-colors ${isSelected ? 'text-teal-800' : 'text-slate-700 group-hover:text-teal-700'}`}>
                    Trang {t.pageNumber}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Nút hành động */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Đang chọn: <strong className="text-teal-700">Trang {selectedPdfPage}</strong> (Bản vẽ CAD Tầng {floorNumber})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPdfFile(null);
                  setPdfInfo(null);
                  setThumbnails([]);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Hủy Chọn
              </button>
              <button
                type="button"
                disabled={isExtractingPage}
                onClick={handleConfirmPdfPage}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isExtractingPage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang trích xuất 2048px...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sử Dụng Trang {selectedPdfPage} Làm CAD</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Drag & Drop Zone chính */
        <div className="w-full max-w-2xl flex flex-col items-center gap-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => {
              if (!readOnly && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className={`w-full p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              isDragging
                ? 'border-teal-500 bg-teal-50 scale-[1.01]'
                : 'border-slate-300 hover:border-teal-500 bg-white hover:bg-slate-50/80 shadow-md'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,application/pdf,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div className="p-4 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 mb-3 shadow-sm">
              {isUploading || isLoadingPdf ? (
                <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
              ) : (
                <UploadCloud className="w-10 h-10" />
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              {isUploading
                ? 'Đang tải bản vẽ lên máy chủ...'
                : isLoadingPdf
                ? 'Đang nạp file PDF hồ sơ kiến trúc...'
                : `Tải Lên Bản Vẽ CAD Mặt Bằng ${floorName || `Tầng ${floorNumber}`}`}
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-3 leading-relaxed">
              Kéo thả hoặc nhấp để chọn tệp từ máy tính.
            </p>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Chọn Tệp PDF Hồ Sơ Thiết Kế (hoặc ảnh PNG, JPG, SVG)</span>
              </button>
              <span className="text-[11px] text-slate-500 text-center max-w-md">
                ℹ️ Định dạng hỗ trợ: PDF thiết kế hoàn công (chọn trang), PNG, JPG, WEBP, SVG. Tự động trích xuất bản vẽ kỹ thuật số độ nét cao 2048px.
              </span>
            </div>
          </div>

          {/* Lỗi nếu có */}
          {uploadError && (
            <div className="w-full p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* 3. Tùy chọn Kế thừa / Sao chép từ tầng khác */}
          {!readOnly && otherFloorsWithCad.length > 0 && onCopyFromOtherFloor && (
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Copy className="w-3.5 h-3.5 text-teal-600" />
                <span>Hoặc kế thừa bản vẽ & ô căn hộ từ tầng đã có CAD:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {otherFloorsWithCad.map((fl) => (
                  <button
                    key={fl.floorNumber}
                    type="button"
                    onClick={() => onCopyFromOtherFloor(fl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title={`Sao chép bản vẽ và ô căn hộ từ ${fl.floorName || `Tầng ${fl.floorNumber}`}`}
                  >
                    <Layers className="w-3 h-3 text-teal-600" />
                    <span>{fl.floorName || `Tầng ${fl.floorNumber}`}</span>
                    {fl.unitCount !== undefined && fl.unitCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 font-mono">
                        {fl.unitCount} căn
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
