import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import {
  ApplyDecisionSchema,
  UpdateTime2Schema,
  ApproveSchema,
  MarkNaSchema,
  RejectSchema,
  RotateItemSchema,
  TaskQuerySchema,
  UploadResurveyPhotoSchema,
  UuidSchema,
} from './photo-resurvey.schemas';
import { PhotoResurveyService } from './photo-resurvey.service';

function requireUser(req: Request): JwtPayload {
  if (!req.user) throw new UnauthorizedError('Người dùng chưa xác thực');
  return req.user;
}

type Handler = (req: Request) => Promise<unknown>;

/** Bọc handler: trả `{ success, data }`, lỗi chuyển cho errorHandler (Problem Details). */
function wrap(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await fn(req);
      res.status(200).json({ success: true, data });
    } catch (err: unknown) {
      next(err);
    }
  };
}

export class PhotoResurveyController {
  static tasks = wrap((req) => PhotoResurveyService.listTasks(requireUser(req), TaskQuerySchema.parse(req.query)));

  static view = wrap((req) => PhotoResurveyService.getView(requireUser(req), UuidSchema.parse(req.params.reportId)));

  static start = wrap((req) => PhotoResurveyService.startSession(requireUser(req), UuidSchema.parse(req.params.reportId), req.ip));

  static upload = wrap((req) =>
    PhotoResurveyService.uploadPhoto(requireUser(req), UuidSchema.parse(req.params.sessionId), UploadResurveyPhotoSchema.parse(req.body), req.ip)
  );

  static markNa = wrap((req) =>
    PhotoResurveyService.markNa(requireUser(req), UuidSchema.parse(req.params.sessionId), MarkNaSchema.parse(req.body), req.ip)
  );

  static removeItem = wrap((req) =>
    PhotoResurveyService.removeItem(requireUser(req), UuidSchema.parse(req.params.sessionId), UuidSchema.parse(req.params.itemId), req.ip)
  );

  static rotateItem = wrap((req) =>
    PhotoResurveyService.rotateItem(
      requireUser(req),
      UuidSchema.parse(req.params.sessionId),
      UuidSchema.parse(req.params.itemId),
      RotateItemSchema.parse(req.body).rotation,
      req.ip
    )
  );

  static submit = wrap((req) => PhotoResurveyService.submit(requireUser(req), UuidSchema.parse(req.params.sessionId), req.ip));

  static approve = wrap((req) =>
    PhotoResurveyService.approve(requireUser(req), UuidSchema.parse(req.params.sessionId), ApproveSchema.parse(req.body ?? {}), req.ip)
  );

  static apply = wrap((req) =>
    PhotoResurveyService.decideApply(requireUser(req), UuidSchema.parse(req.params.sessionId), ApplyDecisionSchema.parse(req.body), req.ip)
  );

  static updateTime2 = wrap((req) =>
    PhotoResurveyService.updateExtraTime2(
      requireUser(req),
      UuidSchema.parse(req.params.sessionId),
      UuidSchema.parse(req.params.itemId),
      UpdateTime2Schema.parse(req.body),
      req.ip
    )
  );

  static reject = wrap((req) =>
    PhotoResurveyService.reject(requireUser(req), UuidSchema.parse(req.params.sessionId), RejectSchema.parse(req.body), req.ip)
  );
}
