import { Request, Response, NextFunction } from 'express';
import { ScoringService } from './scoring.service';
import { EngineeringJudgementDto } from './scoring.dto';
import { BadRequestError } from '../../common/errors/problem-details';

export class ScoringController {
  static async calculateScores(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await ScoringService.calculatePhase1Scores(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async applyJudgement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = EngineeringJudgementDto.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          'Dữ liệu can thiệp kỹ sư không hợp lệ',
          parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
        );
      }

      const result = await ScoringService.applyEngineeringJudgement(
        id,
        parsed.data.action,
        parsed.data.reason
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQualityGate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await ScoringService.verifyQualityGate(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
