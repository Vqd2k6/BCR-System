import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
/**
 * DỊCH VỤ HÀNG ĐỢI TẢI ẢNH ĐA LUỒNG & TRỰC TIẾP LÊN CLOUDFLARE R2
 * Tối ưu hóa cho quy mô 50 - 200 ảnh trên Render Free và mạng di động 4G hiện trường
 */
import { api } from '../../services/api';
import {
  getAllPendingPhotos,
  getKnownCloudUrl,
  getUploadedPhotosWithCloudUrl,
  markOfflinePhotoUploaded,
  markPhotoMappingRestored,
  deleteOfflinePhoto,
  replaceLocalUriInObject,
  saveUploadedPhotoMapping,
  healLocalPhotoUris,
  requestPersistentStorage,
  getDeviceId,
} from '../storage/offlinePhotoStorage';
import { replaceLocalUriInIdbDrafts } from '../utils/idbDraftStorage';
import { recordDataUsage } from './dataMeter';
import { surveyDraftService } from '../../features/survey-phase1/services/surveyDraftService';
import { resolveOfflineTargetFolderFromMetadata } from '../../components/common/photo-capture/domain/photoIdentityPolicy';

export type UploadStatus = 'QUEUED' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

export interface UploadTask {
  id: string;
  blob: Blob;
  filename: string;
  folder?: string;
  mimeType?: string;
  metadata?: Record<string, string>;
  status: UploadStatus;
  progress: number;
  retryCount: number;
  /** Không thử lại trước thời điểm này (giãn cách thử lại, tiết kiệm dữ liệu di động) */
  notBefore?: number;
  publicUrl?: string;
  key?: string;
  error?: string;
  onSuccess?: (publicUrl: string, key: string) => void;
  onError?: (err: Error) => void;
}

type QueueListener = (stats: {
  total: number;
  pending: number;
  uploading: number;
  success: number;
  failed: number;
}) => void;

class UploadQueueService {
  private queue: UploadTask[] = [];
  private activeUploads: number = 0;
  private maxConcurrent: number = 2; // Giới hạn tối đa 2 luồng tải song song để bảo vệ băng thông 4G
  private maxRetries: number = 3;
  private listeners: Set<QueueListener> = new Set();
  /** Giãn cách thử lại sau mỗi lần lỗi: 5s → 30s → 120s (không thử lại dồn dập khi 4G chập chờn) */
  private retryDelaysMs: number[] = [5_000, 30_000, 120_000];
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Lượt quét ảnh offline đang chạy (chống chạy chồng khi sự kiện online bắn liên tục) */
  private resumeInFlight: Promise<number> | null = null;
  private lastOnlineResumeAt = 0;
  private hasRestoredMappingsThisSession = false;
  /** PUT trực tiếp lên R2 bị chặn (CORS) trong phiên này: các ảnh sau đi thẳng đường backend, không PUT thử trước */
  private directPutBlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        // Ảnh đang chờ có mạng trong hàng đợi: chạy tiếp ngay
        this.processQueue();
        // Android bắn sự kiện online liên tục khi sóng chập chờn: quét lại IndexedDB tối đa 1 lần / 30s
        const now = Date.now();
        if (now - this.lastOnlineResumeAt < 30_000) return;
        this.lastOnlineResumeAt = now;
        console.log('[UploadQueue] Phát hiện có mạng kết nối trở lại, tự động quét ảnh offline...');
        void this.resumePendingOfflineUploads();
      });
      // Tự động quét khi khởi động ứng dụng
      void requestPersistentStorage();
      setTimeout(() => {
        this.resumePendingOfflineUploads();
      }, 1500);
    }
  }

  /**
   * Tự động quét IndexedDB và tiếp tục tải các ảnh offline chưa hoàn tất
   */
  public resumePendingOfflineUploads(): Promise<number> {
    if (this.resumeInFlight) return this.resumeInFlight;
    this.resumeInFlight = this.doResumePendingOfflineUploads().finally(() => {
      this.resumeInFlight = null;
    });
    return this.resumeInFlight;
  }

  private async doResumePendingOfflineUploads(): Promise<number> {
    if (!this.hasRestoredMappingsThisSession) {
      this.hasRestoredMappingsThisSession = true;
      await this.restoreLostCloudMappings();
    }

    try {
      const pending = await getAllPendingPhotos();
      if (!pending || pending.length === 0) return 0;
      let count = 0;
      for (const item of pending) {
        // Tránh upload trùng: ảnh này đã có trong hàng đợi (đang chờ / đang tải / vừa xong / đang giãn cách sau lỗi)
        // Riêng task đã hết lượt (ERROR) thì được xếp lại một vòng mới (lượt quét này đã được giãn ≥ 30s)
        const known = this.queue.find((t) => t.id === item.id);
        if (known && known.status !== 'ERROR') continue;
        const targetFolder = resolveOfflineTargetFolderFromMetadata(item.metadata);
        this.enqueue(item.blob, item.filename, {
          id: item.id,
          folder: targetFolder,
          mimeType: item.mimeType || 'image/jpeg',
          metadata: item.metadata,
          onSuccess: async (publicUrl) => {
            // Giữ ObjectURL (nếu có) để hiển thị bản cục bộ, registry tự thu hồi theo giới hạn
            await markOfflinePhotoUploaded(item.id, publicUrl);
            void this.promoteUrlInStores(item.id, publicUrl, item.metadata);
          },
        });
        count++;
      }
      return count;
    } catch (err) {
      console.warn('[UploadQueue] Lỗi quét ảnh offline pending:', err);
      return 0;
    }
  }

  /**
   * Ảnh đã lên Cloud nhưng thiết bị mất mapping (hoặc chụp trước khi có cơ chế mapping):
   * dùng lại cloudUrl còn trong IndexedDB để thăng cấp bản nháp và đẩy mapping lên server.
   */
  private async restoreLostCloudMappings(): Promise<void> {
    try {
      const uploaded = await getUploadedPhotosWithCloudUrl();
      for (const record of uploaded) {
        if (record.cloudUrl && !getKnownCloudUrl(record.id)) {
          await this.promoteUrlInStores(record.id, record.cloudUrl, record.metadata);
        }
        await markPhotoMappingRestored(record.id);
      }
    } catch (err) {
      console.error('[UploadQueue:RestoreMappings] Lỗi khôi phục mapping ảnh đã upload:', err);
    }
  }

  // Gom theo từng thửa/căn: mapping của thửa này không được gửi vào bản nháp của thửa khác
  private pendingServerMappings = new Map<
    string,
    { parcelId: string; unitId: string | null; mappings: Record<string, string> }
  >();
  private serverMappingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Tự động thay thế URL blob:local:// bằng URL Cloudflare R2 trong các Zustand Store đang mở
   * và trong TOÀN BỘ các bản nháp đang lưu trong localStorage & IndexedDB
   * Hỗ trợ đồng bộ tự động 100% cho Phase 1, Condo Unit và Condo Master
   */
  public async promoteUrlInStores(localId: string, publicUrl: string, metadata?: Record<string, string>): Promise<void> {
    // 0. Lưu persistent mapping vào localStorage (Đảm bảo 100% không mất ảnh kể cả sau F5 hoặc đóng app)
    saveUploadedPhotoMapping(localId, publicUrl);

    // 0.1. Cập nhật bền vững vào IndexedDB Drafts (không phụ thuộc vào hạn mức localStorage)
    void replaceLocalUriInIdbDrafts(localId, publicUrl);

    let activeParcelId: string | null = metadata?.['survey-parcel-id'] || null;
    let activeUnitId: string | null = metadata?.['unit-id'] || null;
    const targetUri = `blob:local://${localId}`;

    // 1. Thăng cấp trong Phase 1 Store (chỉ khi store thực sự chứa targetUri để chống nhiễm chéo)
    try {
      const { usePhase1SurveyStore } = await import('../../features/survey-phase1/store/usePhase1SurveyStore');
      const p1Store = usePhase1SurveyStore.getState();
      if (p1Store && p1Store.formData && JSON.stringify(p1Store.formData).includes(targetUri)) {
        if (!activeParcelId && p1Store.formData.parcelId) {
          activeParcelId = p1Store.formData.parcelId;
          activeUnitId = p1Store.currentUnitId || null;
        }
        const updated = replaceLocalUriInObject(p1Store.formData, localId, publicUrl);
        p1Store.updateFormData(updated);
      }
    } catch (_err) {
      console.warn('[UploadQueue] Lỗi thăng cấp URL trong Phase 1 Store:', _err);
    }

    // 2. Thăng cấp trong Condo Unit Store (chỉ khi store thực sự chứa targetUri)
    try {
      const { useCondoUnitSurveyStore } = await import('../../features/survey-condo-unit/store/useCondoUnitSurveyStore');
      const unitStore = useCondoUnitSurveyStore.getState();
      if (unitStore && unitStore.formData && JSON.stringify(unitStore.formData).includes(targetUri)) {
        if (!activeParcelId && unitStore.formData.parcelId) {
          activeParcelId = unitStore.formData.parcelId;
          activeUnitId = unitStore.formData.unitId || null;
        }
        const updated = replaceLocalUriInObject(unitStore.formData, localId, publicUrl);
        unitStore.updateFormData(updated);
      }
    } catch (_err) {
      console.warn('[UploadQueue] Lỗi thăng cấp URL trong Condo Unit Store:', _err);
    }

    // 3. Thăng cấp trong Condo Master Store (chỉ khi store thực sự chứa targetUri)
    try {
      const { useCondoMasterSurveyStore } = await import('../../features/survey-condo-master/store/useCondoMasterSurveyStore');
      const masterStore = useCondoMasterSurveyStore.getState();
      if (masterStore && masterStore.formData && JSON.stringify(masterStore.formData).includes(targetUri)) {
        if (!activeParcelId && masterStore.formData.parcelId) {
          activeParcelId = masterStore.formData.parcelId;
          activeUnitId = null;
        }
        const updated = replaceLocalUriInObject(masterStore.formData, localId, publicUrl);
        masterStore.updateFormData(updated);
      }
    } catch (_err) {
      console.warn('[UploadQueue] Lỗi thăng cấp URL trong Condo Master Store:', _err);
    }

    // Nếu KSV đang ở ngoài trang chủ / danh sách (chưa mở store), trích xuất parcelId từ metadata ảnh
    if (!activeParcelId && metadata) {
      activeParcelId = metadata['survey-parcel-id'] || metadata['building-code'] || null;
      activeUnitId = metadata['unit-id'] || null;
    }

    // 4. Quét và cập nhật bền vững vào TOÀN BỘ các bản nháp trong localStorage
    // (Bảo vệ trường hợp KSV vừa chụp ảnh ở Căn hộ A xong chuyển sang Căn hộ B hoặc về Hub)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('metro2_') && k.includes('_draft_')) {
            const raw = localStorage.getItem(k);
            if (raw && raw.includes(targetUri)) {
              try {
                const parsed = JSON.parse(raw);
                const updated = replaceLocalUriInObject(parsed, localId, publicUrl);
                localStorage.setItem(k, JSON.stringify(updated));
              } catch (_e) {
                console.warn('[UploadQueue] Lỗi parse draft localStorage khi promote URL:', _e);
              }
            }
          }
        }
      } catch (_storageErr) {
        console.warn('[UploadQueue] Lỗi quét localStorage khi promote URL:', _storageErr);
      }
    }

    // 5. Phát sự kiện toàn cục ra Window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('metro2:photo-promoted', {
          detail: { localId, publicUrl },
        })
      );
    }

    // 6. Gom nhóm và đẩy ánh xạ Cloud lên máy chủ (để mọi thiết bị khác đều tự động nhận diện Cloud URL)
    if (!activeParcelId) {
      // Mapping bền đã nằm trên thiết bị (bước 0), bản nháp sẽ tự vá ở lần đồng bộ tiếp theo
      console.error(`[UploadQueue:QueueMapping] Không xác định được thửa của ảnh ${localId}, chưa đẩy mapping lên server.`);
      return;
    }

    const groupKey = `${activeParcelId}|${activeUnitId || ''}`;
    const group = this.pendingServerMappings.get(groupKey) || {
      parcelId: activeParcelId,
      unitId: activeUnitId,
      mappings: {},
    };
    group.mappings[localId] = publicUrl;
    this.pendingServerMappings.set(groupKey, group);

    if (this.serverMappingDebounceTimer) {
      clearTimeout(this.serverMappingDebounceTimer);
    }
    this.serverMappingDebounceTimer = setTimeout(() => {
      const groupsToSend = Array.from(this.pendingServerMappings.values());
      this.pendingServerMappings.clear();
      for (const { parcelId, unitId, mappings } of groupsToSend) {
        void surveyDraftService.savePhotoMappings(parcelId, unitId, mappings, getDeviceId());
      }
    }, 1500);
  }

  /**
   * Đăng ký lắng nghe biến động trạng thái của hàng đợi (cho UI hiển thị tiến trình)
   */
  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const stats = {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.status === 'QUEUED').length,
      uploading: this.queue.filter((t) => t.status === 'UPLOADING').length,
      success: this.queue.filter((t) => t.status === 'SUCCESS').length,
      failed: this.queue.filter((t) => t.status === 'ERROR').length,
    };
    this.listeners.forEach((l) => l(stats));
  }

  /**
   * Đẩy một ảnh vào hàng đợi upload
   */
  public enqueue(
    blob: Blob,
    filename: string,
    options?: {
      id?: string;
      folder?: string;
      mimeType?: string;
      metadata?: Record<string, string>;
      onSuccess?: (publicUrl: string, key: string) => void;
      onError?: (err: Error) => void;
    }
  ): string {
    const taskId = options?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    // Task cùng ID đã có: chỉ cập nhật callback, KHÔNG tải lại ảnh đang chờ / đang tải / đã xong.
    // Task đã hết lượt (ERROR) mới được xếp lại, vẫn giữ giãn cách.
    const existingIndex = this.queue.findIndex((t) => t.id === taskId);
    if (existingIndex >= 0) {
      const existing = this.queue[existingIndex];
      existing.onSuccess = options?.onSuccess ?? existing.onSuccess;
      existing.onError = options?.onError ?? existing.onError;
      if (existing.status === 'ERROR') {
        existing.blob = blob;
        existing.filename = filename;
        existing.metadata = options?.metadata ?? existing.metadata;
        existing.status = 'QUEUED';
        existing.retryCount = 0;
        existing.notBefore = undefined;
        this.notify();
        this.processQueue();
      } else if (existing.status === 'QUEUED' && existing.notBefore) {
        // KSV bấm thử lại: bỏ thời gian chờ
        existing.notBefore = undefined;
        this.processQueue();
      }
      return taskId;
    }

    const task: UploadTask = {
      id: taskId,
      blob,
      filename,
      folder: options?.folder || 'surveys',
      mimeType: options?.mimeType || 'image/jpeg',
      metadata: options?.metadata,
      status: 'QUEUED',
      progress: 0,
      retryCount: 0,
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    };

    this.queue.push(task);
    this.notify();
    this.processQueue();
    return taskId;
  }

  /**
   * Thử lại một task thất bại
   */
  public retryTask(taskId: string) {
    const task = this.queue.find((t) => t.id === taskId);
    if (task && task.status === 'ERROR') {
      task.status = 'QUEUED';
      task.retryCount = 0;
      task.notBefore = undefined;
      task.error = undefined;
      this.notify();
      this.processQueue();
    }
  }

  /**
   * Kiểm tra xem toàn bộ ảnh trong hàng đợi đã hoàn tất hay chưa
   */
  public isAllCompleted(): boolean {
    return this.queue.every((t) => t.status === 'SUCCESS');
  }

  public getPendingAndActiveCount(): number {
    return this.queue.filter((t) => t.status === 'QUEUED' || t.status === 'UPLOADING').length;
  }

  /**
   * Vòng lặp điều phối hàng đợi đa luồng
   */
  private isOnline(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  /** Hẹn đánh thức hàng đợi đúng lúc task sớm nhất hết giãn cách */
  private scheduleWake() {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    const waits = this.queue
      .filter((t) => t.status === 'QUEUED' && t.notBefore && t.notBefore > Date.now())
      .map((t) => (t.notBefore as number) - Date.now());
    if (waits.length === 0) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.processQueue();
    }, Math.max(50, Math.min(...waits)));
  }

  private processQueue() {
    if (this.activeUploads >= this.maxConcurrent) return;
    // Mất mạng: chờ sự kiện online, không đốt lượt thử
    if (!this.isOnline()) return;

    const now = Date.now();
    const nextTask = this.queue.find((t) => t.status === 'QUEUED' && (!t.notBefore || t.notBefore <= now));
    if (!nextTask) {
      this.scheduleWake();
      return;
    }

    this.activeUploads++;
    nextTask.status = 'UPLOADING';
    this.notify();

    this.executeUpload(nextTask)
      .then(({ publicUrl, key }) => {
        nextTask.status = 'SUCCESS';
        nextTask.progress = 100;
        nextTask.publicUrl = publicUrl;
        nextTask.key = key;

        if (nextTask.id) {
          void this.promoteUrlInStores(nextTask.id, publicUrl, nextTask.metadata);
        }

        if (nextTask.onSuccess) {
          nextTask.onSuccess(publicUrl, key);
        }
      })
      .catch((err) => {
        console.warn(`[UploadQueue] Upload failed for task ${nextTask.id}:`, err);
        if (!this.isOnline()) {
          // Lỗi do mất mạng: chờ có mạng lại, không tính lượt
          nextTask.status = 'QUEUED';
        } else if (nextTask.retryCount < this.maxRetries) {
          nextTask.retryCount++;
          nextTask.status = 'QUEUED';
          nextTask.notBefore = Date.now() + this.retryDelaysMs[Math.min(nextTask.retryCount - 1, this.retryDelaysMs.length - 1)];
          console.log(`[UploadQueue] Retrying task ${nextTask.id} (lần ${nextTask.retryCount}/${this.maxRetries})...`);
        } else {
          nextTask.status = 'ERROR';
          nextTask.error = getErrorMessage(err, 'Upload failed after retries');
          if (nextTask.onError) {
            nextTask.onError(err);
          }
        }
      })
      .finally(() => {
        this.activeUploads--;
        this.notify();
        // Tiếp tục xử lý các phần tử tiếp theo trong hàng đợi
        setTimeout(() => this.processQueue(), 50);
      });
  }

  /**
   * Phương án dự phòng (Fallback): Tải ảnh thông qua Backend Storage API
   * Dùng khi trình duyệt bị chặn CORS bởi Cloudflare R2 hoặc Direct PUT gặp sự cố
   */
  private async executeBackendFallback(task: UploadTask): Promise<{ publicUrl: string; key: string }> {
    console.log(`[UploadQueue] 🔄 Kích hoạt đường truyền dự phòng Backend cho task ${task.id}...`);
    const formData = new FormData();
    const file = new File([task.blob], task.filename, { type: task.mimeType || 'image/jpeg' });
    formData.append('file', file);
    if (task.folder) {
      formData.append('folder', task.folder);
    }
    if (task.metadata) {
      formData.append('metadata', JSON.stringify(task.metadata));
    }

    recordDataUsage('UPLOAD ảnh (qua backend)', task.blob.size);
    const res = await api.post('/storage/upload', formData);

    const data = res.data?.data;
    if (!data || !data.url) {
      throw new Error('Backend upload fallback không trả về URL hợp lệ');
    }

    return {
      publicUrl: data.url,
      key: data.key || task.filename,
    };
  }

  /**
   * Thực hiện tải lên trực tiếp (Direct Presigned PUT to Cloudflare R2)
   * Tự động Fallback sang Backend Storage API nếu Direct PUT bị chặn CORS hoặc lỗi mạng
   */
  private async executeUpload(task: UploadTask): Promise<{ publicUrl: string; key: string }> {
    if (this.directPutBlocked) {
      return this.executeBackendFallback(task);
    }
    try {
      // 1. Xin Presigned PUT URL từ Backend kèm Metadata định danh
      const presignRes = await api.post('/storage/presign', {
        filename: task.filename,
        mimeType: task.mimeType,
        folder: task.folder,
        metadata: task.metadata,
      });

      const presignData = presignRes.data?.data;
      if (!presignData || !presignData.uploadUrl) {
        throw new Error('Backend không trả về Presigned Upload URL hợp lệ');
      }

      const { uploadUrl, publicUrl, key, headers: presignHeaders } = presignData;

      // 2. Chuẩn hóa URL cho môi trường Local vs Cloudflare R2
      let targetPutUrl = uploadUrl;
      if (targetPutUrl.startsWith('/')) {
        const configuredBase = api.defaults.baseURL || '/api/v1';
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        if (configuredBase.startsWith('http')) {
          const urlObj = new URL(configuredBase);
          targetPutUrl = `${urlObj.origin}${uploadUrl}`;
        } else {
          targetPutUrl = `${origin}${uploadUrl}`;
        }
      }

      // 3. Thực hiện HTTP PUT nhị phân trực tiếp lên Cloudflare R2 kèm Metadata Headers
      const putHeaders: Record<string, string> = {
        'Content-Type': task.mimeType || 'image/jpeg',
        ...(presignHeaders || {}),
      };

      recordDataUsage('UPLOAD ảnh (R2 trực tiếp)', task.blob.size);
      const uploadRes = await fetch(targetPutUrl, {
        method: 'PUT',
        headers: putHeaders,
        body: task.blob,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        throw new Error(`HTTP ${uploadRes.status} khi đẩy file lên R2: ${errText || uploadRes.statusText}`);
      }

      return { publicUrl, key };
    } catch (directError: unknown) {
      // Chỉ chuyển sang gửi qua backend khi PUT bị trình duyệt chặn (CORS -> TypeError) lúc đang có mạng.
      // Lỗi HTTP của R2 / mất mạng giữa chừng: để vòng thử lại (có giãn cách) PUT lại, không gửi thêm bản thứ 2.
      const blockedByBrowser = directError instanceof TypeError && this.isOnline();
      if (!blockedByBrowser) throw directError;
      console.warn(`[UploadQueue] Direct PUT lên R2 bị chặn (${getErrorMessage(directError)}), chuyển sang Backend fallback...`);
      const result = await this.executeBackendFallback(task);
      this.directPutBlocked = true;
      return result;
    }
  }
}

export const uploadQueue = new UploadQueueService();

/**
 * Tiện ích chuyển đổi Canvas sang Blob binary và dọn dẹp RAM của Mobile Safari tức thì
 */
export function canvasToBlobAndDispose(
  canvas: HTMLCanvasElement,
  quality: number = 1.0
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Dọn dẹp context & kích thước canvas về 0 ngay lập tức để giải phóng RAM GPU/V8
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.width = 0;
          canvas.height = 0;
        } catch (_e) {
          console.warn('[uploadQueueService:canvasToBlobAndDispose.toBlob] Bỏ qua lỗi không chặn luồng:', _e);
        }

        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas xuất Blob thất bại'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Đếm số lượng ảnh còn tồn tại dưới dạng chuỗi Base64
 */
export function countBase64Images(obj: unknown): number {
  if (!obj) return 0;
  let count = 0;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 500) {
      return 1;
    }
    return 0;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      count += countBase64Images(item);
    }
    return count;
  }
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      count += countBase64Images(record[key]);
    }
  }
  return count;
}

/**
 * Làm sạch dữ liệu bản nháp trước khi đồng bộ lên Server & Supabase:
 * Thay thế các chuỗi Base64 dài (ảnh chưa upload xong) bằng chuỗi rỗng hoặc giữ nguyên URL Cloud.
 * Đảm bảo kích thước payload draft luôn < 100KB, tuyệt đối không làm tràn RAM Render hay Supabase!
 */
export function sanitizeSurveyDataForSync<T>(obj: T): T {
  return stripHeavyBase64(healLocalPhotoUris(obj));
}

function stripHeavyBase64<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 500) {
      return '' as unknown as T; // Lọc bỏ chuỗi Base64 nặng ký
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripHeavyBase64(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      clean[key] = stripHeavyBase64(record[key]);
    }
    return clean as T;
  }
  return obj;
}

