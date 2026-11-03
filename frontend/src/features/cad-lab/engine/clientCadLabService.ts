/**
 * Cầu nối giao diện với Web Worker vector hóa.
 * - Giải mã ảnh, xoay theo lựa chọn của người dùng, thu về cạnh dài tối đa 1600px, đổi sang thang xám.
 * - Gửi sang worker; worker không khởi tạo được hoặc bị sập thì chạy trên luồng chính.
 */

import { api } from '../../../services/api';
import { ClientImageLabService } from '../../image-lab/engine/clientImageLabService';
import { vectorizeSketch } from './cadLabDspCore';
import type {
  CadLabParams,
  CadLabResult,
  CadLabWorkerRequest,
  CadLabWorkerResponse,
  CadProjectSketch,
  CadProjectSketchPage,
  CadProjectSketchType,
} from '../types/cadLab.types';

export const CAD_LAB_MAX_WORKING_DIMENSION = 1600;
const WORKER_TIMEOUT_MS = 30000;

export type QuarterTurns = 0 | 1 | 2 | 3;

export interface LoadedSketch {
  width: number;
  height: number;
  gray: Uint8Array;
  /** Ảnh làm việc (đã xoay, thu nhỏ) để lót dưới bản vẽ. */
  previewUrl: string;
  sourceWidth: number;
  sourceHeight: number;
}

let workerInstance: Worker | null = null;
let workerFailed = false;
let requestSeq = 1;
const pending = new Map<number, { resolve: (r: CadLabResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

function failAllPending(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (workerInstance) return workerInstance;
  try {
    workerInstance = new Worker(new URL('./cadLab.worker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (event: MessageEvent<CadLabWorkerResponse>) => {
      const data = event.data;
      const entry = pending.get(data.requestId);
      if (!entry) return;
      pending.delete(data.requestId);
      clearTimeout(entry.timer);
      if (data.type === 'WORKER_ERROR') entry.reject(new Error(data.errorMessage));
      else entry.resolve(data.result);
    };
    workerInstance.onerror = (err) => {
      console.error('[ClientCadLabService:Worker] Web Worker gặp lỗi, chuyển sang luồng chính:', err);
      workerFailed = true;
      workerInstance?.terminate();
      workerInstance = null;
      failAllPending('WORKER_CRASHED');
    };
    return workerInstance;
  } catch (err: unknown) {
    console.error('[ClientCadLabService:Worker] Không khởi tạo được Web Worker, dùng luồng chính:', err);
    workerFailed = true;
    return null;
  }
}

/** Chấm dứt worker, ví dụ khi người dùng bấm chạy lại trong lúc lượt cũ còn chạy. */
export function resetCadLabWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  failAllPending('WORKER_RESET');
}

export async function vectorizeInBackground(
  gray: Uint8Array,
  width: number,
  height: number,
  params: CadLabParams
): Promise<CadLabResult> {
  const worker = getWorker();
  if (worker) {
    const requestId = requestSeq++;
    // Sao chép để ảnh gốc còn dùng được cho lần chạy lại với tham số khác
    const buffer = gray.slice().buffer;
    try {
      return await new Promise<CadLabResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error('WORKER_TIMEOUT'));
        }, WORKER_TIMEOUT_MS);
        pending.set(requestId, { resolve, reject, timer });
        const msg: CadLabWorkerRequest = { type: 'VECTORIZE', requestId, width, height, grayBuffer: buffer, params };
        worker.postMessage(msg, [buffer]);
      });
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.message !== 'WORKER_CRASHED') throw err;
      console.error('[ClientCadLabService:Vectorize] Worker sập giữa chừng, chạy lại trên luồng chính:', err);
    }
  }
  return vectorizeSketch(gray, width, height, params);
}

async function decodeImage(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch (err: unknown) {
      console.error('[ClientCadLabService:Decode] createImageBitmap lỗi, thử thẻ <img>:', err);
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Không đọc được tệp ảnh. Hãy chọn ảnh JPG hoặc PNG.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadSketchImage(file: Blob, quarterTurns: QuarterTurns): Promise<LoadedSketch> {
  const source = await decodeImage(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const scale = Math.min(1, CAD_LAB_MAX_WORKING_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const scaledW = Math.max(1, Math.round(sourceWidth * scale));
  const scaledH = Math.max(1, Math.round(sourceHeight * scale));
  const swap = quarterTurns % 2 === 1;
  const width = swap ? scaledH : scaledW;
  const height = swap ? scaledW : scaledH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Trình duyệt không cấp được canvas 2D.');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(source, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
  if ('close' in source && typeof source.close === 'function') source.close();

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
  canvas.width = 0;
  canvas.height = 0;
  return { width, height, gray, previewUrl, sourceWidth, sourceHeight };
}

// ---------------------------------------------------------------------------
// Nguồn bản vẽ có sẵn: mẫu vẽ tay và bản vẽ CAD trong dự án
// ---------------------------------------------------------------------------

export const CAD_LAB_SAMPLE_URL = '/samples/sample-hand-drawn-structural-cad.jpg';

export interface CadProjectSketchQuery {
  type: CadProjectSketchType | 'ALL';
  search: string;
  offset: number;
  limit?: number;
}

interface CadProjectSketchResponse {
  success: boolean;
  meta: { total: number };
  data: CadProjectSketch[];
}

/** Danh mục bản vẽ CAD trong phạm vi Zone của tài khoản; backend tự giới hạn theo Zone được gán. */
export async function fetchProjectCadSketches(query: CadProjectSketchQuery): Promise<CadProjectSketchPage> {
  const res = await api.get<CadProjectSketchResponse>('/image-lab/cad-sketches', {
    params: {
      type: query.type,
      q: query.search || undefined,
      offset: query.offset,
      limit: query.limit ?? 50,
    },
  });
  return { total: res.data.meta.total, items: res.data.data };
}

/** Tải ảnh từ URL (mẫu nội bộ hoặc R2). R2 chặn CORS thì đi qua proxy của Image Lab. */
export async function fetchSketchBlob(url: string): Promise<Blob> {
  if (url.startsWith('/')) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Không tải được ảnh mẫu (HTTP ${resp.status}).`);
    return await resp.blob();
  }
  return await ClientImageLabService.fetchImageBlob(null, url);
}
