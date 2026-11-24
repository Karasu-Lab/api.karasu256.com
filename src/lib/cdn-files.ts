export interface CdnFile {
  path: string;
  sha256: string;
  contentType: string;
  size: number;
  uploaderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CdnFileRow {
  path: string;
  sha256: string;
  content_type: string;
  size: number;
  uploader_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectedObject {
  sha256: string;
  size: number;
  contentType: string;
  body: ArrayBuffer;
  httpMetadata: { contentType?: string } | undefined;
}

export function isSafePath(path: string): boolean {
  if (!path || path.length > 1024) return false;
  if (path.startsWith('/') || /[\u0000-\u001f\u007f]/.test(path)) return false;
  return !path.split('/').includes('..');
}

export function isAllowedUpload(
  contentType: string,
  size: number,
  allowedTypes: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: number = 5 * 1024 * 1024
): boolean {
  return allowedTypes.includes(contentType) && Number.isInteger(size) && size > 0 && size <= maxBytes;
}

export function cdnUrl(env: Env, path: string): string {
  return `${env.CDN_BASE_URL}/${path}`;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function inspectObject(env: Env, path: string): Promise<InspectedObject | null> {
  const object = await env.CLOUDFLARE_IMAGES.get(path);
  if (!object) return null;
  const body = await object.arrayBuffer();
  return {
    sha256: await sha256Hex(body),
    size: body.byteLength,
    contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
    body,
    httpMetadata: object.httpMetadata,
  };
}

export async function getCdnFile(env: Env, path: string): Promise<CdnFile | null> {
  const row = await env.CDN_DB.prepare('SELECT * FROM cdn_files WHERE path = ?').bind(path).first<CdnFileRow>();
  if (!row) return null;
  return {
    path: row.path,
    sha256: row.sha256,
    contentType: row.content_type,
    size: row.size,
    uploaderId: row.uploader_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCdnFile(env: Env, file: Pick<CdnFile, 'path' | 'sha256' | 'contentType' | 'size' | 'uploaderId'>): Promise<void> {
  const now = new Date().toISOString();
  await env.CDN_DB.prepare(
    `INSERT INTO cdn_files (path, sha256, content_type, size, uploader_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       sha256 = excluded.sha256,
       content_type = excluded.content_type,
       size = excluded.size,
       uploader_id = excluded.uploader_id,
       updated_at = excluded.updated_at`
  )
    .bind(file.path, file.sha256, file.contentType, file.size, file.uploaderId, now, now)
    .run();
}
