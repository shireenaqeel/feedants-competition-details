import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (err instanceof mongoose.Error.CastError) return new AppError(400, 'VALIDATION_ERROR', `Invalid ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) return new AppError(400, 'VALIDATION_ERROR', err.message);
  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'FILE_TOO_LARGE', 'File is too large')
      : new AppError(400, 'UPLOAD_ERROR', err.message);
  }
  if (typeof err === 'object' && err !== null) {
    const e = err as { type?: string; code?: number; status?: number };
    if (e.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
    if (e.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    if (e.code === 11000) return new AppError(409, 'DUPLICATE', 'Resource already exists');
  }
  return new AppError(500, 'INTERNAL', 'Something went wrong');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = toAppError(err);
  if (appErr.status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(appErr.status).json({
    error: { code: appErr.code, message: appErr.message, ...(appErr.details !== undefined && { details: appErr.details }) },
  });
};
