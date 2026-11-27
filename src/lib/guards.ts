import { isPermitted, type RouteAuthContext } from '@karasu-lab/api-permissions';
import { internalUserId, verifyAppToken } from './app-auth';
import { authenticate, isInternalCaller, verifySessionJwt } from './auth';
import { ForbiddenError, UnauthorizedError } from './errors';

const rawBodies = new WeakMap<Request, string>();

export const deriveAuth = (env: Env) => async ({ request }: { request: Request }) => ({
  auth: await authenticate(request, env),
});

export const deriveSession = (env: Env) => async ({ request }: { request: Request }) => {
  const header = request.headers.get('authorization');
  return { session: header?.startsWith('Bearer ') ? await verifySessionJwt(header.slice(7), env) : null };
};

export const requirePermission =
  (permission: string) =>
  ({ auth }: { auth: RouteAuthContext | null }) => {
    if (!auth) throw new UnauthorizedError();
    if (!isPermitted(auth, permission)) throw new ForbiddenError();
  };

export const requireUserPermission =
  (env: Env, permission: string) =>
  async ({ params, request }: { params: Record<string, string>; request: Request }) => {
    if (isInternalCaller(request, env)) return;
    const auth = await authenticate(request, env);
    if (!auth) throw new UnauthorizedError();
    if (auth.userId !== params.userId) throw new ForbiddenError();
    if (!isPermitted(auth, permission)) throw new ForbiddenError();
  };

export function requireSession({ session }: { session: unknown }) {
  if (!session) throw new UnauthorizedError();
}

export const requireInternalCaller =
  (env: Env) =>
  ({ request }: { request: Request }) => {
    if (!isInternalCaller(request, env)) throw new UnauthorizedError();
  };

export async function parseRawJson({ request }: { request: Request }) {
  const text = await request.text();
  rawBodies.set(request, text);
  return text ? JSON.parse(text) : {};
}

export const requireInternalUser =
  (env: Env) =>
  async ({ request }: { request: Request }) => {
    const userId = internalUserId(new URL(request.url).pathname);
    const header = request.headers.get('authorization');
    const session = header?.startsWith('Bearer ') ? await verifySessionJwt(header.slice(7), env) : null;
    const bodyText = rawBodies.get(request) ?? '';
    if (!userId || session?.userId !== userId || !(await verifyAppToken(request, bodyText, { local: env.APP_ENV === 'local' }))) {
      throw new UnauthorizedError();
    }
  };
