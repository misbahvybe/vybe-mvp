import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { isCloudinaryConfigured } from './cloudinary';

export const PRODUCTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');

/** Shared disk storage for product / store listing images (max 5 MB). */
export function multerImageFileOptions() {
  // For Cloudinary we want the file bytes in memory (buffer).
  const useMemory = isCloudinaryConfigured();
  return {
    storage: useMemory
      ? memoryStorage()
      : diskStorage({
          destination: PRODUCTS_UPLOAD_DIR,
          filename: (_req, file, cb) => {
            const ext = extname(file.originalname || '').toLowerCase();
            const safe = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
            cb(null, `${randomUUID()}${safe}`);
          },
        }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      cb(null, /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype));
    },
  };
}

export function publicUploadedImageUrl(req: Request, filename: string): string {
  const configured = process.env.API_PUBLIC_URL?.trim().replace(/\/$/, '');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:4000').split(',')[0].trim();
  const base = configured || `${proto}://${host}`;
  return `${base}/uploads/products/${filename}`;
}
