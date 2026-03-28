export type ImageUploadRole = 'admin' | 'store-owner';

function apiBaseUrl(): string {
  let base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  return base.replace(/\/$/, '');
}

/** Multipart upload; uses fetch so default JSON Content-Type is not applied. */
export async function uploadMenuImageFile(file: File, role: ImageUploadRole): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const path = role === 'admin' ? '/admin/uploads/image' : '/store-owner/uploads/image';
  const token = typeof window !== 'undefined' ? localStorage.getItem('vybe_token') : null;
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(', ');
      else if (j.message) msg = String(j.message);
    } catch {
      // keep text
    }
    throw new Error(typeof msg === 'string' && msg ? msg : 'Upload failed');
  }
  const data = JSON.parse(text) as { imageUrl?: string };
  if (!data.imageUrl) throw new Error('Invalid upload response');
  return data.imageUrl;
}
