import { memoryStorage } from 'multer';
import { join } from 'path';
import type { Request } from 'express';

export const PRODUCTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');

/**
 * Product / store listing images (max 5 MB).
 * Always use memory storage so `file.buffer` is set at request time. That way Cloudinary
 * uploads work even if env vars were not visible when the module first loaded (and local
 * fallback can write the buffer to disk in the controller).
 */
export function multerImageFileOptions() {
  return {
    storage: memoryStorage(),
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
