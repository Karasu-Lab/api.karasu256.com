import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins/jwt';
import { createHash, createHmac, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyAppToken } from '../src/lib/app-auth';
import { verifySessionJwt } from '../src/lib/auth';

vi.mock('../src/db/data-source', () => ({
  withDataSource: async () => {
    throw new Error('database is not available in this test');
  },
}));

vi.mock('@karasu-lab/api-permissions', () => ({
  PermissionService: class {
    async resolve() {
      return [];
    }
  },
}));

const AUTH_URL = 'https://api-auth.karasu256.com';
const API_ORIGIN = 'https://api.karasu256.com';
const MCP_APP_ID = 'mcp.karasu256.com';
const SECRET = 'test-better-auth-secret';

const issuerState = vi.hoisted(() => ({
  jwksJson: null as { keys: Record<string, unknown>[] } | null,
  mcpPublicKey: null as string | null,
  mcpRegistered: true,
}));

vi.stubGlobal('fetch', async (input: string | URL | Request): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url === `${AUTH_URL}/api/auth/jwks`) {
    return Response.json(issuerState.jwksJson ?? { keys: [] });
  }
  if (url === `https://${MCP_APP_ID}/.well-known/app-public-key`) {
    if (!issuerState.mcpRegistered || !issuerState.mcpPublicKey) return new Response('Not Found', { status: 404 });
    return Response.json({ appId: MCP_APP_ID, publicKey: issuerState.mcpPublicKey });
  }
  throw new Error(`unexpected fetch: ${url}`);
});

function buildAuth() {
  return betterAuth({
    secret: SECRET,
    baseURL: AUTH_URL,
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], jwks: [] }),
    emailAndPassword: { enabled: true },
    plugins: [jwt()],
  });
}

function sessionCookieHeader(token: string): string {
  const signature = createHmac('sha256', SECRET).update(token).digest('base64');
  return `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

function base64Url(data: string | Buffer): string {
  return Buffer.from(data).toString('base64url');
}

describe('internal user endpoint authentication', () => {
  let userId: string;
  let sessionJwtFromExchange: string;
  let sessionJwtFromTokenEndpoint: string;
  let mcpPrivateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];

  beforeAll(async () => {
    issuerState.mcpRegistered = true;
    const auth = buildAuth();
    const authContext = await auth.$context;
    const user = await authContext.internalAdapter.createUser({
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    });
    userId = user.id;
    const session = await authContext.internalAdapter.createSession(user.id, false);

    const jwksResponse = await auth.handler(new Request(`${AUTH_URL}/api/auth/jwks`));
    issuerState.jwksJson = (await jwksResponse.json()) as { keys: Record<string, unknown>[] };

    const exchanged = await auth.api.signJWT({
      body: { payload: { ...user, iat: Math.floor(Date.now() / 1000), sub: user.id } },
    });
    sessionJwtFromExchange = (exchanged as { token: string }).token;

    const tokenResponse = await auth.api.getToken({ headers: new Headers({ cookie: sessionCookieHeader(session.token) }) });
    sessionJwtFromTokenEndpoint = (tokenResponse as { token: string }).token;

    const pair = generateKeyPairSync('ed25519');
    mcpPrivateKey = pair.privateKey;
    issuerState.mcpPublicKey = (pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const env = { AUTH_URL } as unknown as Env;

  it('verifies the session JWT minted by the MCP session token exchange', async () => {
    const session = await verifySessionJwt(sessionJwtFromExchange, env);
    expect(session?.userId).toBe(userId);
  });

  it('verifies the session JWT issued by the token endpoint', async () => {
    const session = await verifySessionJwt(sessionJwtFromTokenEndpoint, env);
    expect(session?.userId).toBe(userId);
  });

  function mcpAppToken(body: string): string {
    const url = new URL(`${API_ORIGIN}/internal/users/${userId}/image`);
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
    const payload = base64Url(
      JSON.stringify({
        iss: MCP_APP_ID,
        aud: url.origin,
        sub: userId,
        iat: now,
        exp: now + 120,
        jti: randomUUID(),
        method: 'POST',
        path: url.pathname,
        bodySha256: createHash('sha256').update(body).digest('hex'),
      })
    );
    const signingInput = `${header}.${payload}`;
    const signature = sign(null, Buffer.from(signingInput), mcpPrivateKey);
    return `${signingInput}.${base64Url(signature)}`;
  }

  it('accepts the MCP app token without any env-registered app entry', async () => {
    const body = JSON.stringify({ image: 'https://cdn.karasu256.com/u/profiles/avatar.png' });
    const request = new Request(`${API_ORIGIN}/internal/users/${userId}/image`, {
      method: 'POST',
      headers: { 'x-app-token': mcpAppToken(body), authorization: `Bearer ${sessionJwtFromExchange}` },
      body,
    });
    await expect(verifyAppToken(request, body)).resolves.toBe(true);
  });

  it('rejects the app token once the app registration is gone', async () => {
    const body = JSON.stringify({ image: 'https://cdn.karasu256.com/u/profiles/avatar.png' });
    const buildRequest = () =>
      new Request(`${API_ORIGIN}/internal/users/${userId}/image`, {
        method: 'POST',
        headers: { 'x-app-token': mcpAppToken(body) },
        body,
      });
    await expect(verifyAppToken(buildRequest(), body)).resolves.toBe(true);

    issuerState.mcpRegistered = false;
    vi.useFakeTimers();
    vi.advanceTimersByTime(10 * 60 * 1000);

    await expect(verifyAppToken(buildRequest(), body)).resolves.toBe(false);
  });
});
