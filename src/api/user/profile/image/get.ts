import { Elysia } from 'elysia';
import { deriveAuth, requirePermission } from '../../../../lib/guards';
import { avatarKey } from '../../../../lib/images';
import { NotFoundError } from '../../../../lib/errors';

export const userProfileImageGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/user/profile/image',
    async ({ auth }) => {
      const object = await env.CLOUDFLARE_IMAGES.get(avatarKey(auth!.userId));
      if (!object) throw new NotFoundError();
      return new Response(object.body, {
        headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
      });
    },
    { beforeHandle: requirePermission('users:profile.read') }
  );
