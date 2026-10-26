/**
 * ============================================================================
 * FORENSIC IMAGE LAB WEB WORKER (BACKGROUND DSP THREAD)
 * Lưu giữ bộ đệm điểm ảnh đã giải mã (lumOrig, rgbOrig) ngay trong RAM của Worker
 * để khi người dùng chuyển đổi Preset (Auto / v1 / v2 / Cứu tối) hoặc kéo thanh trượt
 * Tăng/Giảm sáng & Tăng nét, luồng chính chỉ cần gửi thông điệp JSON < 200 bytes
 * và nhận về ArrayBuffer kết quả qua cơ chế Zero-Copy Transferable trong ~50-90ms.
 * ============================================================================
 */

import {
  analyzeLuminanceQuality,
  resolveClientEnhancementParams,
  runClientLuminancePipeline,
} from './imageLabDspCore';
import type {
  ImageLabPreset,
  ImageEnhancementParams,
  ImageQualityMetrics,
} from '../ForensicImageLabModal';

interface WorkerSessionEntry {
  sessionKey: string;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  format: string;
  sizeBytes: number;
  rgbOrig: Uint8Array;
  lumOrig: Uint8Array;
  lowClip: number;
  highClip: number;
  beforeMetrics: ImageQualityMetrics;
  lastUsedAt: number;
}

export interface RegisterSessionMessage {
  type: 'REGISTER_SESSION';
  requestId: number;
  sessionKey: string;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  format: string;
  sizeBytes: number;
  rgbOrigBuffer: ArrayBuffer;
  lumOrigBuffer: ArrayBuffer;
  lowClip: number;
  highClip: number;
  beforeMetrics: ImageQualityMetrics;
}

export interface ProcessSessionMessage {
  type: 'PROCESS_SESSION';
  requestId: number;
  sessionKey: string;
  preset: ImageLabPreset;
  customParams?: Partial<ImageEnhancementParams>;
}

export type ImageLabWorkerRequest = RegisterSessionMessage | ProcessSessionMessage;

export interface ImageLabWorkerProcessSuccess {
  type: 'PROCESS_SUCCESS';
  requestId: number;
  sessionKey: string;
  width: number;
  height: number;
  rgbaOutBuffer: ArrayBuffer;
  beforeMetrics: ImageQualityMetrics;
  afterMetrics: ImageQualityMetrics;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
  computeTimeMs: number;
}

export interface ImageLabWorkerRegisterSuccess {
  type: 'REGISTER_SUCCESS';
  requestId: number;
  sessionKey: string;
}

export interface ImageLabWorkerErrorResponse {
  type: 'WORKER_ERROR';
  requestId: number;
  errorMessage: string;
}

export type ImageLabWorkerResponse =
  | ImageLabWorkerProcessSuccess
  | ImageLabWorkerRegisterSuccess
  | ImageLabWorkerErrorResponse;

const MAX_WORKER_SESSIONS = 12;
const workerSessions = new Map<string, WorkerSessionEntry>();

function evictOldestIfNeeded(): void {
  if (workerSessions.size < MAX_WORKER_SESSIONS) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [k, v] of workerSessions.entries()) {
    if (v.lastUsedAt < oldestTime) {
      oldestTime = v.lastUsedAt;
      oldestKey = k;
    }
  }
  if (oldestKey) {
    workerSessions.delete(oldestKey);
  }
}

const workerScope = self as unknown as {
  onmessage: ((ev: MessageEvent<ImageLabWorkerRequest>) => void) | null;
  postMessage: (message: ImageLabWorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event: MessageEvent<ImageLabWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  try {
    if (msg.type === 'REGISTER_SESSION') {
      if (!workerSessions.has(msg.sessionKey)) {
        evictOldestIfNeeded();
      }
      workerSessions.set(msg.sessionKey, {
        sessionKey: msg.sessionKey,
        width: msg.width,
        height: msg.height,
        origWidth: msg.origWidth,
        origHeight: msg.origHeight,
        format: msg.format,
        sizeBytes: msg.sizeBytes,
        rgbOrig: new Uint8Array(msg.rgbOrigBuffer),
        lumOrig: new Uint8Array(msg.lumOrigBuffer),
        lowClip: msg.lowClip,
        highClip: msg.highClip,
        beforeMetrics: msg.beforeMetrics,
        lastUsedAt: Date.now(),
      });

      workerScope.postMessage({
        type: 'REGISTER_SUCCESS',
        requestId: msg.requestId,
        sessionKey: msg.sessionKey,
      });
      return;
    }

    if (msg.type === 'PROCESS_SESSION') {
      const startTime = performance.now();
      const session = workerSessions.get(msg.sessionKey);
      if (!session) {
        workerScope.postMessage({
          type: 'WORKER_ERROR',
          requestId: msg.requestId,
          errorMessage: 'SESSION_NOT_FOUND',
        });
        return;
      }

      session.lastUsedAt = Date.now();
      const appliedParams = resolveClientEnhancementParams(
        msg.preset,
        session.beforeMetrics,
        msg.customParams
      );

      const { rgbaOut, lumFinal } = runClientLuminancePipeline({
        width: session.width,
        height: session.height,
        rgbOrig: session.rgbOrig,
        lumOrig: session.lumOrig,
        lowClip: session.lowClip,
        highClip: session.highClip,
        beforeMetrics: session.beforeMetrics,
        preset: msg.preset,
        appliedParams,
      });

      const afterMetrics = analyzeLuminanceQuality(lumFinal, session.width, session.height, {
        origWidth: session.origWidth,
        origHeight: session.origHeight,
        format: session.format,
        sizeBytes: session.sizeBytes,
      });

      const computeTimeMs = Math.max(1, Math.round(performance.now() - startTime));
      const outBuffer = rgbaOut.buffer as ArrayBuffer;

      workerScope.postMessage(
        {
          type: 'PROCESS_SUCCESS',
          requestId: msg.requestId,
          sessionKey: msg.sessionKey,
          width: session.width,
          height: session.height,
          rgbaOutBuffer: outBuffer,
          beforeMetrics: session.beforeMetrics,
          afterMetrics,
          presetUsed: msg.preset,
          appliedParams,
          computeTimeMs,
        },
        [outBuffer]
      );
    }
  } catch (err: unknown) {
    console.error('[ImageLabWorker] Lỗi xử lý ảnh trong Web Worker:', err);
    workerScope.postMessage({
      type: 'WORKER_ERROR',
      requestId: msg.requestId,
      errorMessage: err instanceof Error ? err.message : 'Lỗi không xác định trong Web Worker.',
    });
  }
};
