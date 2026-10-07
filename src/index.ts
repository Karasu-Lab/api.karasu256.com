import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { env as cfEnv } from 'cloudflare:workers';
import { apiKeyRoutes } from './routes/api-keys';
import { assetLinkRoutes } from './routes/asset-links';
import { metaRoutes } from './routes/meta';
import { permissionRoutes } from './routes/permissions';
import { userRoutes } from './routes/user';

const env = cfEnv as Env;

/** Workers do not allow generating code at runtime. */
const app = new Elysia({ adapter: CloudflareAdapter, aot: false, normalize: 'typebox' })
  .use(userRoutes(env))
  .use(permissionRoutes(env))
  .use(apiKeyRoutes(env))
  .use(metaRoutes(env))
  .use(assetLinkRoutes());

/** Collapses repeated slashes so a caller's base URL with a trailing slash still reaches the route. */
function normalizePath(request: Request): Request {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (pathname === url.pathname) return request;
  url.pathname = pathname;
  return new Request(url, request);
}

export default {
  fetch: (request: Request) => app.fetch(normalizePath(request)),
};
