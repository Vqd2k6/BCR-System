/**
 * DỊCH VỤ HÀNG ĐỢI TẢI ẢNH ĐA LUỒNG & TRỰC TIẾP LÊN CLOUDFLARE R2
 * Tối ưu hóa cho quy mô 50 - 200 ảnh trên Render Free và mạng di động 4G hiện trường
 */
import { api } from '../../services/api';

export type UploadStatus = 'QUEUED' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

export interface UploadTask {
  id: string;
  blob: Blob;
  filename: string;
  folder?: string;
  mimeType?: string;
  status: UploadStatus;
  progress: number;
  retryCount: number;
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
      onSuccess?: (publicUrl: string, key: string) => void;
      onError?: (err: Error) => void;
    }
  ): string {
    const taskId = options?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    // Nếu task cùng ID đang tồn tại và chưa thành công, cập nhật blob
    const existingIndex = this.queue.findIndex((t) => t.id === taskId);
    if (existingIndex >= 0 && this.queue[existingIndex].status !== 'SUCCESS') {
      this.queue[existingIndex].blob = blob;
      this.queue[existingIndex].filename = filename;
      this.queue[existingIndex].status = 'QUEUED';
      this.queue[existingIndex].retryCount = 0;
      this.queue[existingIndex].onSuccess = options?.onSuccess;
      this.queue[existingIndex].onError = options?.onError;
      this.processQueue();
      return taskId;
    }

    const task: UploadTask = {
      id: taskId,
      blob,
      filename,
      folder: options?.folder || 'surveys',
      mimeType: options?.mimeType || 'image/jpeg',
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
  private processQueue() {
    if (this.activeUploads >= this.maxConcurrent) return;

    const nextTask = this.queue.find((t) => t.status === 'QUEUED');
    if (!nextTask) return;

    this.activeUploads++;
    nextTask.status = 'UPLOADING';
    this.notify();

    this.executeUpload(nextTask)
      .then(({ publicUrl, key }) => {
        nextTask.status = 'SUCCESS';
        nextTask.progress = 100;
        nextTask.publicUrl = publicUrl;
        nextTask.key = key;
        if (nextTask.onSuccess) {
          nextTask.onSuccess(publicUrl, key);
        }
      })
      .catch((err) => {
        console.warn(`[UploadQueue] Upload failed for task ${nextTask.id}:`, err);
        if (nextTask.retryCount < this.maxRetries) {
          nextTask.retryCount++;
          nextTask.status = 'QUEUED';
          console.log(`[UploadQueue] Retrying task ${nextTask.id} (lần ${nextTask.retryCount}/${this.maxRetries})...`);
        } else {
          nextTask.status = 'ERROR';
          nextTask.error = err?.message || 'Upload failed after retries';
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

    const res = await api.post('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

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
    try {
      // 1. Xin Presigned PUT URL từ Backend (Request payload cực nhẹ ~80 bytes, RAM backend tiêu tốn = 0)
      const presignRes = await api.post('/storage/presign', {
        filename: task.filename,
        mimeType: task.mimeType,
        folder: task.folder,
      });

      const presignData = presignRes.data?.data;
      if (!presignData || !presignData.uploadUrl) {
        throw new Error('Backend không trả về Presigned Upload URL hợp lệ');
      }

      const { uploadUrl, publicUrl, key } = presignData;

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

      // 3. Thực hiện HTTP PUT nhị phân trực tiếp lên Cloudflare R2
      const uploadRes = await fetch(targetPutUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': task.mimeType || 'image/jpeg',
        },
        body: task.blob,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        throw new Error(`HTTP ${uploadRes.status} khi đẩy file lên R2: ${errText || uploadRes.statusText}`);
      }

      return { publicUrl, key };
    } catch (directError: any) {
      console.warn(`[UploadQueue] Direct PUT lên R2 thất bại (${directError?.message}), tự động chuyển hướng qua Backend fallback...`);
      return this.executeBackendFallback(task);
    }
  }
}

export const uploadQueue = new UploadQueueService();

/**
 * Tiện ích chuyển đổi Canvas sang Blob binary và dọn dẹp RAM của Mobile Safari tức thì
 */
export function canvasToBlobAndDispose(
  canvas: HTMLCanvasElement,
  quality: number = 0.82
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
        } catch (_e) {}

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
export function countBase64Images(obj: any): number {
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
    for (const key of Object.keys(obj)) {
      count += countBase64Images(obj[key]);
    }
  }
  return count;
}

/**
 * Làm sạch dữ liệu bản nháp trước khi đồng bộ lên Server & Supabase:
 * Thay thế các chuỗi Base64 dài (ảnh chưa upload xong) bằng chuỗi rỗng hoặc giữ nguyên URL Cloud.
 * Đảm bảo kích thước payload draft luôn < 100KB, tuyệt đối không làm tràn RAM Render hay Supabase!
 */
export function sanitizeSurveyDataForSync(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 500) {
      return ''; // Lọc bỏ chuỗi Base64 nặng ký
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSurveyDataForSync(item));
  }
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      clean[key] = sanitizeSurveyDataForSync(obj[key]);
    }
    return clean;
  }
  return obj;
}

