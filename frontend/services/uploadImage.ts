import { useAuthStore } from '@/store/authStore';

function apiBaseUrl(): string {
  let base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  return base.replace(/\/$/, '');
}

function bearerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return useAuthStore.getState().token ?? localStorage.getItem('vybe_token');
}

/** Multipart upload (ADMIN or STORE_OWNER). Uses fetch so JSON Content-Type is not applied. */
export async function uploadMenuImageFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const token = bearerToken();
  const res = await fetch(`${apiBaseUrl()}/uploads/image`, {
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
