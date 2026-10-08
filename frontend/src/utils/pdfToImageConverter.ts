import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Cấu hình Worker cục bộ 100% offline thông qua cơ chế ?url của Vite
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface PdfDocumentInfo {
  numPages: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
}

/**
 * Nạp file PDF và trả về đối tượng PDFDocument
 */
export async function loadPdfDocument(file: File): Promise<PdfDocumentInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
  });
  const pdfDoc = await loadingTask.promise;
  return {
    numPages: pdfDoc.numPages,
    pdfDoc,
  };
}

/**
 * Render một trang PDF thành ảnh chất lượng cao (mặc định chiều rộng 2048px)
 */
export async function renderPdfPageToBlob(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number = 2048,
  quality: number = 0.9
): Promise<Blob> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1.0 });

  // Tính tỷ lệ scale để chiều rộng đạt targetWidth nhưng không vượt quá kích thước hợp lý
  const scale = targetWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context.');

  // Nền trắng cho bản vẽ CAD
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Thu hồi bộ nhớ canvas ngay sau khi xuất blob
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = 0;
          canvas.height = 0;
        } catch (_) {}

        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Lỗi chuyển đổi trang PDF sang định dạng ảnh JPEG.'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Render thumbnail thu nhỏ của một trang PDF phục vụ giao diện chọn trang
 */
export async function renderPdfPageThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  thumbWidth: number = 300
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const scale = thumbWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (_) {}

  return dataUrl;
}
