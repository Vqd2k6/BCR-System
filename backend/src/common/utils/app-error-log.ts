import fs from 'fs';
import path from 'path';

/**
 * Tìm thư mục gốc của dự án (chứa đồng thời thư mục frontend và backend).
 * app_errors.log nằm ở đây để cả lỗi frontend (qua DevController) và lỗi 500 backend cùng một chỗ.
 */
export function getProjectRootDir(): string {
  const currentDir = process.cwd();
  if (path.basename(currentDir) === 'backend') {
    return path.resolve(currentDir, '..');
  }

  let dir = currentDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'backend')) && fs.existsSync(path.join(dir, 'frontend'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return currentDir;
}

export function formatGmt7Now(): string {
  return new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getAppErrorLogPath(): string {
  return path.join(getProjectRootDir(), 'app_errors.log');
}

/**
 * Ghi một khối lỗi vào app_errors.log theo đúng định dạng DevController đang dùng.
 * Không bao giờ ném lỗi: ghi log thất bại chỉ in ra console.
 */
export async function appendAppErrorLog(section: string, lines: string[]): Promise<void> {
  const separator = '='.repeat(80);
  const content = [separator, `[${formatGmt7Now()} GMT+7] [${section}]`, ...lines, separator, '\n'].join('\n');
  try {
    await fs.promises.appendFile(getAppErrorLogPath(), content, 'utf8');
  } catch (err: unknown) {
    console.error('[AppErrorLog:append] Không ghi được app_errors.log:', err);
  }
}
