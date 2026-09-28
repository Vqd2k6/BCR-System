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
      const overrides = req.method === 'POST' ? req.body : undefined;
      const { pdfBuffer, reportCode } = await ReportService.generateResidentialPdf(id, overrides);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="BCS_Phase1_${reportCode}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET/POST /api/v1/reports/:id/export/docx
   * Xuất DOCX Báo cáo Hiện trạng Nhà Dân cư độc lập
   */
  static async exportResidentialDocx(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const overrides = req.method === 'POST' ? req.body : undefined;
      const { docxBuffer, reportCode } = await ReportService.generateResidentialDocx(id, overrides);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="BCS_Phase1_${reportCode}.docx"`);
      res.setHeader('Content-Length', docxBuffer.length);

      res.status(200).send(docxBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET/POST /api/v1/reports/:id/preview/html
   * Xem trước HTML của Báo cáo để kỹ sư/đối tác kiểm tra bố cục nhanh trên trình duyệt
   */
  static async previewResidentialHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const overrides = req.method === 'POST' ? req.body : undefined;
      const html = await ReportService.previewResidentialHtml(id, overrides);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT/PATCH /api/v1/reports/:id/survey-data
   * Cho phép chỉnh sửa trực tiếp thông tin/ghi chú của Báo cáo trước khi xuất PDF
   */
  static async updateReportSurveyData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ReportService.updateReportSurveyData(id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/:id
   * Lấy chi tiết thông tin hồ sơ khảo sát (phục vụ form chỉnh sửa)
   */
  static async getReportDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const report = await ReportService.getReportDetail(id);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
}

