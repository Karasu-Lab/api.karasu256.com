import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { env as cfEnv } from 'cloudflare:workers';
import { apiKeyRoutes } from './routes/api-keys';
import { metaRoutes } from './routes/meta';
import { permissionRoutes } from './routes/permissions';
import { userRoutes } from './routes/user';

const env = cfEnv as Env;

/** Workers do not allow generating code at runtime. */
export default new Elysia({ adapter: CloudflareAdapter, aot: false, normalize: 'typebox' })
  .use(userRoutes(env))
  .use(permissionRoutes(env))
  .use(apiKeyRoutes(env))
  .use(metaRoutes(env));
