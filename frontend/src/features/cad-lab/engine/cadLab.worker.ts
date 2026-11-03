/**
 * Web Worker chạy toàn bộ pipeline vector hóa để giao diện không bị đơ.
 * Nhận ảnh xám qua ArrayBuffer chuyển quyền (zero-copy), trả đồ thị CAD dạng JSON.
 */

import { vectorizeSketch } from './cadLabDspCore';
import type { CadLabWorkerRequest, CadLabWorkerResponse } from '../types/cadLab.types';

const workerScope = self as unknown as {
  onmessage: ((ev: MessageEvent<CadLabWorkerRequest>) => void) | null;
  postMessage: (message: CadLabWorkerResponse) => void;
};

workerScope.onmessage = (event: MessageEvent<CadLabWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'VECTORIZE') return;
  try {
    const gray = new Uint8Array(msg.grayBuffer);
    const result = vectorizeSketch(gray, msg.width, msg.height, msg.params);
    workerScope.postMessage({ type: 'VECTORIZE_SUCCESS', requestId: msg.requestId, result });
  } catch (err: unknown) {
    console.error('[CadLabWorker:Vectorize] Lỗi vector hóa trong Web Worker:', err);
    workerScope.postMessage({
      type: 'WORKER_ERROR',
      requestId: msg.requestId,
      errorMessage: err instanceof Error ? err.message : 'Lỗi không xác định trong Web Worker.',
    });
  }
};
