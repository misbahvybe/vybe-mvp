import { v2 as cloudinary } from 'cloudinary';

export function isCloudinaryConfigured(): boolean {
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
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    api_key: process.env.CLOUDINARY_API_KEY!.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
    secure: true,
  });
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

