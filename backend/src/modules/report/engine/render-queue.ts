/**
 * ============================================================================
 * IN-PROCESS RENDER SEMAPHORE (Q3)
 * Giới hạn đồng thời 2 job Puppeteer để bảo vệ bộ nhớ 1 instance; job thứ 3+
 * xếp hàng FIFO, có timeout để tránh treo request vô hạn.
 * ============================================================================
 */

import { AppError } from '../../../common/errors/problem-details';

const MAX_CONCURRENT = Math.max(1, Number(process.env.REPORT_RENDER_CONCURRENCY) || 2);
const QUEUE_TIMEOUT_MS = Math.max(5_000, Number(process.env.REPORT_RENDER_QUEUE_TIMEOUT_MS) || 60_000);
const MAX_WAITING = 16;

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class Semaphore {
  private active = 0;
  private readonly queue: Waiter[] = [];

  public stats(): { active: number; queued: number; limit: number } {
    return { active: this.active, queued: this.queue.length, limit: MAX_CONCURRENT };
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.queue.length >= MAX_WAITING) {
      return Promise.reject(
        new AppError(
          'Hàng đợi kết xuất PDF đang đầy. Vui lòng thử lại sau ít giây.',
          503,
          'RENDER_QUEUE_FULL'
        )
      );
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => {
          clearTimeout(waiter.timer);
          resolve();
        },
        reject: (err) => {
          clearTimeout(waiter.timer);
          reject(err);
        },
        timer: setTimeout(() => {
          const idx = this.queue.indexOf(waiter);
          if (idx >= 0) this.queue.splice(idx, 1);
          reject(
            new AppError(
              'Hết thời gian chờ trong hàng đợi kết xuất PDF.',
              503,
              'RENDER_QUEUE_TIMEOUT'
            )
          );
        }, QUEUE_TIMEOUT_MS),
      };
      this.queue.push(waiter);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }
}

export const RenderQueue = new Semaphore();

