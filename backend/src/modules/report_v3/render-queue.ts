/**
 * ============================================================================
 * RENDER QUEUE (V3)
 * Giới hạn số PDF render song song (Chromium rất tốn RAM) + timeout cứng.
 * ============================================================================
 */

export class RenderTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Render PDF vượt quá thời gian cho phép (${timeoutMs}ms)`);
    this.name = 'RenderTimeoutError';
  }
}

export class RenderQueue {
  private static active = 0;
  private static readonly waiters: Array<() => void> = [];

  public static get maxConcurrency(): number {
    const n = parseInt(process.env.REPORT_RENDER_CONCURRENCY || '2', 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
  }

  public static get activeCount(): number {
    return RenderQueue.active;
  }

  public static get waitingCount(): number {
    return RenderQueue.waiters.length;
  }

  private static async acquire(): Promise<void> {
    if (RenderQueue.active < RenderQueue.maxConcurrency) {
      RenderQueue.active += 1;
      return;
    }
    await new Promise<void>((resolve) => RenderQueue.waiters.push(resolve));
    RenderQueue.active += 1;
  }

  private static release(): void {
    RenderQueue.active -= 1;
    const next = RenderQueue.waiters.shift();
    if (next) next();
  }

  public static async run<T>(task: () => Promise<T>, timeoutMs: number = 150000): Promise<T> {
    await RenderQueue.acquire();
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RenderTimeoutError(timeoutMs)), timeoutMs);
      });
      return await Promise.race([task(), timeout]);
    } catch (err) {
      console.error('[RenderQueue] Tác vụ render thất bại:', err);
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      RenderQueue.release();
    }
  }
}
