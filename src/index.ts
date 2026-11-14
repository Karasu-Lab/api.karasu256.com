import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { env as cfEnv } from 'cloudflare:workers';
import { resolveEnv } from './constants';
import { errorHandler } from './lib/error-handler';
import { runStartupMigrations } from './lib/startup-migration';
import { apiKeyRoutes } from './routes/api-keys';
import { assetLinkRoutes } from './routes/asset-links';
import { avatarRoutes } from './routes/avatars';
import { internalRoutes } from './routes/internal';
import { metaRoutes } from './routes/meta';
import { githubProxyRoutes } from './routes/github-proxy';
import { githubRoutes } from './routes/github';
import { mojangProxyRoutes } from './routes/mojang-proxy';
import { permissionRoutes } from './routes/permissions';
import { uploadRoutes } from './routes/upload';
import { userRoutes } from './routes/user';

const env = resolveEnv(cfEnv as Env);

const app = new Elysia({ adapter: CloudflareAdapter, aot: false, normalize: 'typebox' })
  .use(errorHandler())
  .use(userRoutes(env))
  .use(githubRoutes(env))
  .use(avatarRoutes(env))
  .use(internalRoutes(env))
  .use(permissionRoutes(env))
  .use(apiKeyRoutes(env))
  .use(uploadRoutes(env))
  .use(metaRoutes(env))
  .use(assetLinkRoutes())
  .use(mojangProxyRoutes())
  .use(githubProxyRoutes());

function normalizePath(request: Request): Request {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (pathname === url.pathname) return request;
  url.pathname = pathname;
  return new Request(url, request);
}

let startupMigrations: Promise<void> | undefined;

export default {
  fetch: (request: Request, _env: Env, ctx: ExecutionContext) => {
    if (!startupMigrations) {
      startupMigrations = runStartupMigrations(env).catch((error) => console.error('Startup migrations failed', error));
      ctx.waitUntil(startupMigrations);
    }
    return app.fetch(normalizePath(request));
  },
};
