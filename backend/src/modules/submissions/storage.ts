import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

// Local-disk storage for development. In production this would be S3/GCS with presigned
// uploads so large videos never pass through the API servers.
export const uploadRoot = path.resolve(env.uploadDir);

const ALLOWED_MIME = /^(video\/(mp4|quicktime|webm|3gpp)|image\/(jpeg|png|webp))$/;

export const submissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(uploadRoot, 'submissions', String(req.params.id));
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
      cb(null, `${req.user?.id}-${Date.now()}-${randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) cb(null, true);
    else cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a video (mp4, mov, webm) or image (jpg, png, webp)'));
  },
});

const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;
const MAX_IMAGE_MB = 5;

/** Profile photos, judge photos, cover images. */
export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(uploadRoot, 'images');
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] ?? '';
      cb(null, `${req.user?.id}-${Date.now()}-${randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.test(file.mimetype)) cb(null, true);
    else cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a JPG, PNG or WebP image'));
  },
});

export function storageKeyFor(file: Express.Multer.File): string {
  return path.relative(uploadRoot, file.path).split(path.sep).join('/');
}

export function publicUrlFor(storageKey: string, baseUrl: string): string {
  if (/^https?:\/\//.test(storageKey)) return storageKey; // externally hosted
  if (storageKey.startsWith('/')) return `${baseUrl}${storageKey}`; // a path this API serves (e.g. demo assets)
  return `${baseUrl}/uploads/${storageKey}`;
}

export async function deleteStored(storageKey: string): Promise<void> {
  await unlink(path.join(uploadRoot, storageKey)).catch(() => undefined);
}
