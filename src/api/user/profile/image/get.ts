import { Elysia, status } from 'elysia';
import { deriveAuth, requirePermission } from '../../../../lib/guards';
import { avatarKey } from '../../../../lib/images';

export const userProfileImageGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/user/profile/image',
    async ({ auth }) => {
      const object = await env.CLOUDFLARE_IMAGES.get(avatarKey(auth!.userId));
      if (!object) throw status(404, 'not_found');
      return new Response(object.body, {
        headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
      });
    },
    { beforeHandle: requirePermission('users:profile.read') }
  );
