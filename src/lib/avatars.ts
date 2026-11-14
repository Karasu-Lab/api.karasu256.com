import { z } from 'zod';
import { cdnUrl, getCdnFile, isAllowedUpload, sha256Hex, upsertCdnFile } from './cdn-files';

export function avatarPath(userId: string, slot: string): string {
  return `u/profiles/${userId}/avatars/${slot}/avatar.png`;
}

async function readAvatarSource(source: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const dataUrl = /^data:([^;,]+);base64,\s*(.*)$/s.exec(source);
  if (dataUrl) {
    const [, contentType, encoded] = dataUrl;
    return { body: Uint8Array.from(atob(encoded.replace(/\s/g, '')), (char) => char.charCodeAt(0)).buffer, contentType };
  }
  const response = await fetch(z.url().parse(source));
  if (!response.ok) throw new Error(`Avatar source responded ${response.status}`);
  return { body: await response.arrayBuffer(), contentType: response.headers.get('content-type')?.split(';')[0].trim() ?? '' };
}

export async function signedAvatarUploadUrl(env: Env, sessionJwt: string, path: string): Promise<string> {
  const res = await fetch(`${env.CDN_BASE_URL}/upload/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionJwt}` },
    body: JSON.stringify({ path, ttlSeconds: 300 }),
  });
  if (!res.ok) throw new Error(`cdn.karasu256.com responded ${res.status} for ${res.url}`);
  const { ticket } = z.object({ ticket: z.string().min(1) }).parse(await res.json());
  const url = new URL('/upload/signed', env.CDN_BASE_URL);
  url.searchParams.set('path', path);
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

export async function storeProviderAvatar(env: Env, userId: string, providerId: string, source: string): Promise<string> {
  const { body, contentType } = await readAvatarSource(source);
  if (!isAllowedUpload(contentType, body.byteLength)) throw new Error('Unsupported avatar image');
  const path = avatarPath(userId, providerId);
  const sha256 = await sha256Hex(body);
  if ((await getCdnFile(env, path))?.sha256 !== sha256) {
    await env.CLOUDFLARE_IMAGES.put(path, body, { httpMetadata: { contentType } });
    await upsertCdnFile(env, { path, sha256, contentType, size: body.byteLength, uploaderId: userId });
  }
  return `${cdnUrl(env, path)}?v=${sha256.slice(0, 16)}`;
}
