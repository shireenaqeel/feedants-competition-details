import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { objectIdSchema } from '../../lib/objectId.js';
import { publicBaseUrl } from '../../lib/http.js';
import { requireAuth, userId } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { submissionUpload, storageKeyFor } from './storage.js';
import { assertCanSubmit, getMySubmission, saveSubmission, serializeSubmission } from './submission.service.js';

// Mounted at /competitions/:id/submissions
export const submissionRouter = Router({ mergeParams: true });

const params = z.object({ id: objectIdSchema });
const body = z.object({ caption: z.string().trim().max(500).optional() });

submissionRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  // Reject before accepting a (possibly large) upload.
  async (req, _res, next) => {
    const { id } = params.parse(req.params);
    await assertCanSubmit(id, userId(req));
    next();
  },
  submissionUpload.single('file'),
  async (req, res) => {
    const { id } = params.parse(req.params);
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Attach the submission as "file"');
    const { caption } = body.parse(req.body ?? {});
    const submission = await saveSubmission(
      id,
      userId(req),
      { storageKey: storageKeyFor(req.file), mimeType: req.file.mimetype, sizeBytes: req.file.size },
      caption,
    );
    res.status(201).json({ submission: serializeSubmission(submission, publicBaseUrl(req)) });
  },
);

submissionRouter.get('/me', requireAuth, async (req, res) => {
  const { id } = params.parse(req.params);
  const submission = await getMySubmission(id, userId(req));
  res.json({ submission: submission ? serializeSubmission(submission, publicBaseUrl(req)) : null });
});
