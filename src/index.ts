import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { env as cfEnv } from 'cloudflare:workers';
import { resolveEnv } from './constants';
import { errorHandler } from './lib/error-handler';
import { runStartupMigrations } from './lib/startup-migration';
import { operationPermissionsGet } from './api/[operation]/permissions/get';
import { apiAssetsOauthProvidersGet } from './api/api/assets/oauth/providers/[providersId]/get';
import { apiOauthProvidersGet } from './api/api/oauth/providers/get';
import { apiPreviewsGet } from './api/api/previews/[domain]/get';
import { apiProxyGithubGet } from './api/api/proxy/github/[...path]/get';
import { apiProxyMojangGet } from './api/api/proxy/mojang/[...path]/get';
import { apiKeysVerifyPost } from './api/api-keys/verify/post';
import { assetLinksGet } from './api/asset-links/get';
import { githubAvatarGet } from './api/github/avatar/get';
import { githubRepositoriesGet } from './api/github/repositories/get';
import { githubUserGet } from './api/github/user/get';
import { internalApiKeyPermissionsGet } from './api/internal/api-keys/permissions/get';
import { internalApiKeyPermissionsPut } from './api/internal/api-keys/[id]/permissions/put';
import { userAvatarProviderPost } from './api/users/[userId]/avatars/[providerId]/post';
import { userAvatarProviderDelete } from './api/users/[userId]/avatars/[providerId]/delete';
import { userAvatarPost } from './api/users/[userId]/avatar/post';
import { userAvatarDelete } from './api/users/[userId]/avatar/delete';
import { internalUserAvatarUploadUrlPost } from './api/internal/users/[userId]/avatar-upload-url/post';
import { internalUserFirebasePhotoPost } from './api/internal/users/[userId]/firebase-photo/post';
import { internalUserFirebaseUidGet } from './api/internal/users/[userId]/firebase-uid/get';
import { internalUserImagePost } from './api/internal/users/[userId]/image/post';
import { internalUserLinkedProvidersGet } from './api/internal/users/[userId]/linked-providers/get';
import { internalUserLinkedProviderDelete } from './api/internal/users/[userId]/linked-providers/[providerId]/delete';
import { internalUserSessionsGet } from './api/internal/users/[userId]/sessions/get';
import { internalUserSessionDelete } from './api/internal/users/[userId]/sessions/[sessionId]/delete';
import { metaGet } from './api/meta/get';
import { permissionsGet } from './api/permissions/get';
import { permissionScopesGet } from './api/permissions/scopes/get';
import { uploadVerifyGet } from './api/upload/verify/get';
import { uploadVerifyPost } from './api/upload/verify/post';
import { userProfileGet } from './api/user/profile/get';
import { userProfilePatch } from './api/user/profile/patch';
import { userProfileImageGet } from './api/user/profile/image/get';
import { userProfileImagePost } from './api/user/profile/image/post';

const env = resolveEnv(cfEnv as Env);

const app = new Elysia({ adapter: CloudflareAdapter, aot: false, normalize: 'typebox' })
  .use(errorHandler())
  .use(userProfileGet(env))
  .use(userProfilePatch(env))
  .use(userProfileImageGet(env))
  .use(userProfileImagePost(env))
  .use(githubUserGet(env))
  .use(githubAvatarGet(env))
  .use(githubRepositoriesGet(env))
  .use(userAvatarProviderPost(env))
  .use(userAvatarProviderDelete(env))
  .use(userAvatarPost(env))
  .use(userAvatarDelete(env))
  .use(internalUserLinkedProvidersGet(env))
  .use(internalUserLinkedProviderDelete(env))
  .use(internalUserSessionsGet(env))
  .use(internalUserSessionDelete(env))
  .use(internalUserFirebaseUidGet(env))
  .use(internalUserImagePost(env))
  .use(internalUserAvatarUploadUrlPost(env))
  .use(internalUserFirebasePhotoPost(env))
  .use(permissionsGet(env))
  .use(permissionScopesGet(env))
  .use(operationPermissionsGet(env))
  .use(internalApiKeyPermissionsPut(env))
  .use(internalApiKeyPermissionsGet(env))
  .use(apiKeysVerifyPost(env))
  .use(uploadVerifyPost(env))
  .use(uploadVerifyGet(env))
  .use(metaGet(env))
  .use(assetLinksGet(env))
  .use(apiProxyMojangGet())
  .use(apiProxyGithubGet())
  .use(apiPreviewsGet(env))
  .use(apiOauthProvidersGet(env))
  .use(apiAssetsOauthProvidersGet());

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
