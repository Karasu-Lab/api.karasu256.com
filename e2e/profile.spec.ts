import { test, expect, type APIRequestContext } from '@playwright/test';

const ACCOUNTS_URL = 'http://localhost:3001';
const AUTH_URL = 'http://localhost:3004';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

interface GrantablePermission {
  publicId: string;
  resource: string;
  action: string;
}

async function signUp(request: APIRequestContext): Promise<string> {
  const email = `e2e-api-${Date.now()}-${crypto.randomUUID()}@example.test`;
  const res = await request.post(`${AUTH_URL}/api/auth/sign-up/email`, {
    headers: { Origin: AUTH_URL },
    data: { email, password: `pw-${crypto.randomUUID()}`, name: email },
  });
  expect(res.ok()).toBeTruthy();
  const { user } = (await res.json()) as { user: { id: string } };
  return user.id;
}

async function findPermissions(request: APIRequestContext, wanted: { resource: string; action: string }[]): Promise<string[]> {
  const res = await request.get(`${ACCOUNTS_URL}/api/permissions`);
  expect(res.ok()).toBeTruthy();
  const permissions = (await res.json()) as GrantablePermission[];
  return wanted.map(({ resource, action }) => {
    const permission = permissions.find((p) => p.resource === resource && p.action === action);
    expect(permission, `permission ${resource}:${action} should be grantable`).toBeDefined();
    return permission!.publicId;
  });
}

async function issueApiKey(request: APIRequestContext, permissionPublicIds: string[]): Promise<string> {
  const res = await request.post(`${ACCOUNTS_URL}/api/api-keys`, {
    data: { name: 'e2e', permissions: permissionPublicIds },
  });
  expect(res.status()).toBe(201);
  const { key } = (await res.json()) as { key: string };
  return key;
}

async function issueProfileKey(request: APIRequestContext): Promise<string> {
  const ids = await findPermissions(request, [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'write' },
  ]);
  return issueApiKey(request, ids);
}

test('reads the profile with an API key', async ({ request }) => {
  const userId = await signUp(request);
  const key = await issueProfileKey(request);

  const res = await request.get('/user/profile', { headers: { Authorization: `Bearer ${key}` } });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { id: string }).id).toBe(userId);
});

test('writes the profile name back with an API key', async ({ request }) => {
  await signUp(request);
  const key = await issueProfileKey(request);
  const name = `e2e-${crypto.randomUUID()}`;

  const patch = await request.patch('/user/profile', { headers: { Authorization: `Bearer ${key}` }, data: { name } });
  expect(patch.status()).toBe(200);

  const res = await request.get('/user/profile', { headers: { Authorization: `Bearer ${key}` } });
  expect(((await res.json()) as { name: string | null }).name).toBe(name);
});

test('uploads and reads back the profile image with an API key', async ({ request }) => {
  await signUp(request);
  const key = await issueProfileKey(request);

  const upload = await request.post('/user/profile/image', {
    headers: { Authorization: `Bearer ${key}` },
    multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1X1 } },
  });
  expect(upload.status()).toBe(200);

  const res = await request.get('/user/profile/image', { headers: { Authorization: `Bearer ${key}` } });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  expect(Buffer.from(await res.body()).equals(PNG_1X1)).toBe(true);
});

test('refuses an API key without profile permissions', async ({ request }) => {
  await signUp(request);
  const key = await issueApiKey(request, []);

  const res = await request.get('/user/profile', { headers: { Authorization: `Bearer ${key}` } });
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: 'insufficient_scope' });
});
