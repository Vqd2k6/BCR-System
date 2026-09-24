import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service';

export class ReportController {
  /**
   * GET /api/v1/reports/:id/export/pdf
   * Xuất PDF Báo cáo Hiện trạng Nhà Dân cư độc lập
   */
  static async exportResidentialPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { pdfBuffer, reportCode } = await ReportService.generateResidentialPdf(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="BCS_Phase1_${reportCode}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/:id/preview/html
   * Xem trước HTML của Báo cáo để kỹ sư/đối tác kiểm tra bố cục nhanh trên trình duyệt
   */
  static async previewResidentialHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const html = await ReportService.previewResidentialHtml(id);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }
}
