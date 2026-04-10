import { v2 as cloudinary } from 'cloudinary';

/** Dashboard → `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` (single var on Railway/Heroku). */
function parseCloudinaryUrl(url: string): { cloud_name: string; api_key: string; api_secret: string } | null {
  const u = url.trim();
  const m = u.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/]+)$/i);
  if (!m) return null;
  return { api_key: m[1]!, api_secret: m[2]!, cloud_name: m[3]! };
}

export function isCloudinaryConfigured(): boolean {
  const fromUrl = process.env.CLOUDINARY_URL?.trim();
  if (fromUrl && parseCloudinaryUrl(fromUrl)) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

let configured = false;
export function configureCloudinaryOnce() {
  if (configured) return;
  if (!isCloudinaryConfigured()) return;
  const fromUrl = process.env.CLOUDINARY_URL?.trim();
  const parsed = fromUrl ? parseCloudinaryUrl(fromUrl) : null;
  if (parsed) {
    cloudinary.config({
      cloud_name: parsed.cloud_name,
      api_key: parsed.api_key,
      api_secret: parsed.api_secret,
      secure: true,
    });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
      api_key: process.env.CLOUDINARY_API_KEY!.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
      secure: true,
    });
  }
  configured = true;
}

export async function uploadProductImageToCloudinary(params: {
  buffer: Buffer;
  mimetype: string;
  folder?: string;
  publicId?: string;
}): Promise<{ secureUrl: string; publicId: string }> {
  configureCloudinaryOnce();
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }
  const folder = params.folder ?? 'vybe/products';
  const format = params.mimetype.includes('png')
    ? 'png'
    : params.mimetype.includes('webp')
      ? 'webp'
      : params.mimetype.includes('gif')
        ? 'gif'
        : 'jpg';

  const base64 = params.buffer.toString('base64');
  const dataUri = `data:${params.mimetype};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: params.publicId,
    resource_type: 'image',
    overwrite: true,
    unique_filename: true,
    format,
  });

  return { secureUrl: result.secure_url, publicId: result.public_id };
}

