import { Elysia } from 'elysia';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userAvatarDelete } from '../src/api/users/[userId]/avatar/delete';
import { userAvatarPost } from '../src/api/users/[userId]/avatar/post';
import { userAvatarProviderDelete } from '../src/api/users/[userId]/avatars/[providerId]/delete';
import { userAvatarProviderPost } from '../src/api/users/[userId]/avatars/[providerId]/post';
import { errorHandler } from '../src/lib/error-handler';

const AUTH_URL = 'https://api-auth.karasu256.com';
const API_ORIGIN = 'https://api.karasu256.com';
const INTERNAL_API_SECRET = 'test-internal-secret';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

const keyPermissions = vi.hoisted(() => new Map<string, string[]>());
const apiKeys = vi.hoisted(() => new Map<string, { userId: string; keyId: string }>());

vi.mock('../src/db/data-source', () => ({
  withDataSource: async (_env: unknown, work: (dataSource: unknown) => Promise<unknown>) => work({}),
}));

vi.mock('../src/db/typeorm-permission-repository', () => ({
  TypeOrmPermissionRepository: class {},
}));

vi.mock('@karasu-lab/api-permissions', () => ({
  PermissionService: class {
    async resolve(keyId: string) {
      return keyPermissions.get(keyId) ?? [];
    }
  },
  isPermitted: (auth: { authMethod: string; permissionIds: string[] | null; scopes: string[] | null }, publicId: string) => {
    if (auth.authMethod === 'session') return true;
    if (auth.authMethod === 'apiKey') return auth.permissionIds?.includes(publicId) ?? false;
    const match = /^([a-z0-9-]+):([a-z0-9-]+)\.([a-z0-9-]+)$/.exec(publicId);
    if (!match) return false;
    return auth.scopes?.includes(`${match[3]}:${match[1]}.${match[2]}`) ?? false;
  },
}));

const jwksState = vi.hoisted(() => ({ jwks: null as JWK | null, privateKey: null as CryptoKey | null }));

vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url === `${AUTH_URL}/api/auth/jwks`) {
    return Response.json({ keys: jwksState.jwks ? [jwksState.jwks] : [] });
  }
  if (url === `${AUTH_URL}/api/api-keys/verify`) {
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { key?: string };
    const record = body.key ? apiKeys.get(body.key) : undefined;
    if (!record) return new Response('Unauthorized', { status: 401 });
    return Response.json(record);
  }
  throw new Error(`unexpected fetch: ${url}`);
});

interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

interface CdnFileRow {
  path: string;
  sha256: string;
  content_type: string;
  size: number;
  uploader_id: string | null;
  created_at: string;
  updated_at: string;
}

const objects = new Map<string, StoredObject>();
const files = new Map<string, CdnFileRow>();

const env = {
  AUTH_URL,
  INTERNAL_API_SECRET,
  CDN_BASE_URL: 'https://cdn.example.test',
  CLOUDFLARE_IMAGES: {
    head: async (path: string) => (objects.has(path) ? {} : null),
    put: async (path: string, body: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => {
      objects.set(path, {
        body: body instanceof Uint8Array ? body : new Uint8Array(body),
        contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream',
      });
    },
    delete: async (path: string) => {
      objects.delete(path);
    },
  },
  CDN_DB: {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.startsWith('SELECT * FROM cdn_files')) return files.get(args[0] as string) ?? null;
          return null;
        },
        run: async () => {
          if (sql.startsWith('INSERT INTO cdn_files')) {
            const [path, sha256, contentType, size, uploaderId, createdAt, updatedAt] = args as [string, string, string, number, string, string, string];
            files.set(path, {
              path,
              sha256,
              content_type: contentType,
              size,
              uploader_id: uploaderId,
              created_at: files.get(path)?.created_at ?? createdAt,
              updated_at: updatedAt,
            });
          }
          if (sql.startsWith('DELETE FROM cdn_files')) files.delete(args[0] as string);
          return { success: true };
        },
      }),
    }),
  },
} as unknown as Env;

const app = new Elysia()
  .use(errorHandler())
  .use(userAvatarPost(env))
  .use(userAvatarDelete(env))
  .use(userAvatarProviderPost(env))
  .use(userAvatarProviderDelete(env));

const PNG_SOURCE = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;
const PROVIDER_AVATAR_PATH = `u/profiles/${USER_ID}/avatars/github/avatar.png`;
const USER_AVATAR_PATH = `u/profiles/${USER_ID}/avatars/default/avatar.png`;

function request(path: string, method: string, authorization?: string, body?: unknown): Promise<Response> {
  return app.handle(
    new Request(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        ...(authorization ? { authorization } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

async function seedProviderAvatar(): Promise<void> {
  const response = await request(`/users/${USER_ID}/avatars/github`, 'POST', `Bearer ${INTERNAL_API_SECRET}`, { source: PNG_SOURCE });
  expect(response.status).toBe(200);
  expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
}

async function oauthToken(scopes: string[], userId: string = USER_ID): Promise<string> {
  return new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(userId)
    .setIssuer(`${AUTH_URL}/api/auth`)
    .setAudience(`${AUTH_URL}/api/auth`)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(jwksState.privateKey as CryptoKey);
}

describe('avatar endpoints permission handling', () => {
  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    jwksState.privateKey = pair.privateKey;
    jwksState.jwks = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    apiKeys.set('key-with-delete', { userId: USER_ID, keyId: 'key-id-delete' });
    keyPermissions.set('key-id-delete', ['users:avatar.delete']);
    apiKeys.set('key-with-write', { userId: USER_ID, keyId: 'key-id-write' });
    keyPermissions.set('key-id-write', ['users:profile.write']);
    apiKeys.set('key-without-permissions', { userId: USER_ID, keyId: 'key-id-none' });
    keyPermissions.set('key-id-none', []);
    apiKeys.set('key-of-other-user', { userId: OTHER_USER_ID, keyId: 'key-id-other' });
    keyPermissions.set('key-id-other', ['users:avatar.delete', 'users:profile.write']);
  });

  beforeEach(() => {
    objects.clear();
    files.clear();
  });

  it('accepts the existing internal client for provider avatar updates and deletion', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', `Bearer ${INTERNAL_API_SECRET}`);

    expect(response.status).toBe(204);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(false);
    expect(files.has(PROVIDER_AVATAR_PATH)).toBe(false);
  });

  it('deletes the provider avatar for an API key granted the avatar delete permission', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', 'Bearer key-with-delete');

    expect(response.status).toBe(204);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(false);
    expect(files.has(PROVIDER_AVATAR_PATH)).toBe(false);
  });

  it('rejects an API key without the avatar delete permission', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', 'Bearer key-without-permissions');

    expect(response.status).toBe(403);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
  });

  it('rejects an API key granted the delete permission when it belongs to another user', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', 'Bearer key-of-other-user');

    expect(response.status).toBe(403);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
  });

  it('deletes the provider avatar for an OAuth app granted the avatar delete scope', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', `Bearer ${await oauthToken(['delete:users.avatar'])}`);

    expect(response.status).toBe(204);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(false);
    expect(files.has(PROVIDER_AVATAR_PATH)).toBe(false);
  });

  it('rejects an OAuth app without the avatar delete scope', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE', `Bearer ${await oauthToken(['read:users.profile'])}`);

    expect(response.status).toBe(403);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
  });

  it('stores the provider avatar for an API key granted the profile write permission', async () => {
    const response = await request(`/users/${USER_ID}/avatars/github`, 'POST', 'Bearer key-with-write', { source: PNG_SOURCE });

    expect(response.status).toBe(200);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
    expect(files.has(PROVIDER_AVATAR_PATH)).toBe(true);
  });

  it('rejects provider avatar updates from an API key without the profile write permission', async () => {
    const response = await request(`/users/${USER_ID}/avatars/github`, 'POST', 'Bearer key-without-permissions', { source: PNG_SOURCE });

    expect(response.status).toBe(403);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(false);
  });

  it('deletes the user avatar for an API key granted the avatar delete permission', async () => {
    const stored = await request(`/users/${USER_ID}/avatar`, 'POST', `Bearer ${INTERNAL_API_SECRET}`, { source: PNG_SOURCE });
    expect(stored.status).toBe(200);
    expect(objects.has(USER_AVATAR_PATH)).toBe(true);

    const response = await request(`/users/${USER_ID}/avatar`, 'DELETE', 'Bearer key-with-delete');

    expect(response.status).toBe(204);
    expect(objects.has(USER_AVATAR_PATH)).toBe(false);
    expect(files.has(USER_AVATAR_PATH)).toBe(false);
  });

  it('deletes the user avatar for an OAuth app granted the avatar delete scope', async () => {
    const stored = await request(`/users/${USER_ID}/avatar`, 'POST', `Bearer ${INTERNAL_API_SECRET}`, { source: PNG_SOURCE });
    expect(stored.status).toBe(200);

    const response = await request(`/users/${USER_ID}/avatar`, 'DELETE', `Bearer ${await oauthToken(['delete:users.avatar'])}`);

    expect(response.status).toBe(204);
    expect(objects.has(USER_AVATAR_PATH)).toBe(false);
  });

  it('rejects avatar deletion without any credentials', async () => {
    await seedProviderAvatar();

    const response = await request(`/users/${USER_ID}/avatars/github`, 'DELETE');

    expect(response.status).toBe(401);
    expect(objects.has(PROVIDER_AVATAR_PATH)).toBe(true);
  });
});
