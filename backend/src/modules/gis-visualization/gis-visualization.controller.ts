import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../common/errors/problem-details';
import { GisVisualizationService } from './gis-visualization.service';

const ThematicQuerySchema = z.object({
  zoneId: z.string().trim().min(1).max(32),
});

export class GisVisualizationController {
  static async getZoneThematic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError('Người dùng chưa xác thực');
      const { zoneId } = ThematicQuerySchema.parse(req.query);
      const data = await GisVisualizationService.getZoneThematic(req.user, zoneId);
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  }
}
