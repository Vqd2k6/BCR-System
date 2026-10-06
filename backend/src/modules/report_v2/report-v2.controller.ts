/**
 * ============================================================================
 * REPORT V2 CONTROLLER
 * API Routing độc lập (/api/v2/reports/...)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ReportV2Service } from './report-v2.service';

export class ReportV2Controller {
  /**
   * GET /api/v2/reports/:id/export/pdf
   * POST /api/v2/reports/:id/export/pdf
   * Xuất file PDF Báo cáo V2 A4 chuẩn 300 DPI
   */
  public static async exportResidentialPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier = req.params.id;
      const overrides = req.body?.overrides || (req.method === 'POST' ? req.body : undefined);
      const enableWatermark = req.query.watermark !== 'false' && req.query.watermark !== '0' && req.body?.enableWatermark !== false;

      const { pdfBuffer, reportNo, buildingId } = await ReportV2Service.generateResidentialPdf(identifier, overrides, enableWatermark);

      const safeFilename = `${reportNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeFilename)}"`);
      res.setHeader('X-Report-No', reportNo);
      res.setHeader('X-Building-ID', encodeURIComponent(buildingId));

      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v2/reports/:id/preview/html
   * POST /api/v2/reports/:id/preview/html
   * Xem trước mã HTML của Báo cáo V2
   */
  public static async previewResidentialHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier = req.params.id;
      const overrides = req.body?.overrides || (req.method === 'POST' ? req.body : undefined);
      const isGuest = req.user?.role === 'GUEST' || req.query.isGuest === 'true' || req.query.maskPii === 'true';
      const enableWatermark = isGuest || (req.query.watermark !== 'false' && req.query.watermark !== '0' && req.body?.enableWatermark !== false);

      const { html, viewModel } = await ReportV2Service.generateResidentialHtml(identifier, overrides, isGuest, enableWatermark);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob: https:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https:;");
      res.setHeader('X-Report-No', viewModel.metadata.reportNo);
      res.setHeader('X-Building-ID', encodeURIComponent(viewModel.metadata.buildingId));

      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }
}
