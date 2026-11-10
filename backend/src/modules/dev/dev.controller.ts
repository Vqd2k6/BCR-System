import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { formatGmt7Now, getProjectRootDir } from '../../common/utils/app-error-log';

/**
 * Payload báo cáo lỗi từ Frontend
 */
export interface DevErrorPayload {
  errorType?: string;
  message?: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  timestamp?: string;
  userAgent?: string;
  componentStack?: string;
}

export class DevController {
  /**
   * POST /api/dev/report-error
   * Tiếp nhận lỗi runtime từ frontend và append vào tệp app_errors.log tại thư mục gốc dự án
   */
  static async reportError(req: Request, res: Response): Promise<void> {
    try {
      const payload: DevErrorPayload = req.body || {};
      const errorType = payload.errorType || 'RUNTIME_ERROR';
      const message = payload.message || 'No error message provided';
      const source = payload.source;
      const lineno = payload.lineno;
      const colno = payload.colno;
      const url = payload.url || req.headers.referer || 'N/A';
      const userAgent = payload.userAgent || req.headers['user-agent'] || 'N/A';
      const stack = payload.stack;
      const componentStack = payload.componentStack;

      const timeFormatted = formatGmt7Now();

      const separator = '='.repeat(80);
      const lines = [
        separator,
        `[${timeFormatted} GMT+7] [${errorType}]`,
        `URL: ${url}`,
        `Message: ${message}`,
      ];

      if (source) {
        lines.push(`Source: ${source}${lineno ? `:${lineno}` : ''}${colno ? `:${colno}` : ''}`);
      }

      if (userAgent) {
        lines.push(`UserAgent: ${userAgent}`);
      }

      if (componentStack) {
        lines.push(`Component Stack:\n${componentStack}`);
      }

      if (stack) {
        lines.push(`Stack Trace:\n${stack}`);
      }

      lines.push(separator);
      lines.push('\n');

      const logContent = lines.join('\n');
      const rootDir = getProjectRootDir();
      const logFilePath = path.join(rootDir, 'app_errors.log');

      await fs.promises.appendFile(logFilePath, logContent, 'utf8');

      console.warn(
        `\x1b[33m[DevErrorReporter]\x1b[0m Recorded ${errorType} to app_errors.log: ${message.slice(0, 100)}`
      );

      res.status(200).json({
        success: true,
        message: 'Lỗi đã được ghi nhận vào app_errors.log',
        logFile: 'app_errors.log',
      });
    } catch (err: any) {
      console.error('[DevErrorReporter] Lỗi khi ghi file app_errors.log:', err);
      res.status(500).json({
        success: false,
        error: 'Không thể ghi nhận lỗi vào log file',
        details: err?.message,
      });
    }
  }
}
