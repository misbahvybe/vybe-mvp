import { getBackendBaseUrl } from './client';

function guessMimeAndName(localUri: string): { name: string; type: string } {
  const clean = localUri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return { name: 'photo.png', type: 'image/png' };
  if (clean.endsWith('.webp')) return { name: 'photo.webp', type: 'image/webp' };
  if (clean.endsWith('.gif')) return { name: 'photo.gif', type: 'image/gif' };
  return { name: 'photo.jpg', type: 'image/jpeg' };
}

/** Uploads a gallery image; returns public `imageUrl` from the API. */
export async function uploadStoreOwnerImage(localUri: string, token: string): Promise<string> {
  const base = getBackendBaseUrl();
  const { name, type } = guessMimeAndName(localUri);
  const form = new FormData();
  form.append('file', { uri: localUri, name, type } as unknown as Blob);
  const res = await fetch(`${base}/store-owner/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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
    throw new Error(msg || 'Upload failed');
  }
  const data = JSON.parse(text) as { imageUrl?: string };
  if (!data.imageUrl) throw new Error('Invalid upload response');
  return data.imageUrl;
}
