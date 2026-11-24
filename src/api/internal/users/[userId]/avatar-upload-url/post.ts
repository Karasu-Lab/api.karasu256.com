import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { avatarPath, signedAvatarUploadUrl } from '../../../../../lib/avatars';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';

const avatarUploadUrlBodySchema = z.object({ contentType: z.string().min(1) });

export const internalUserAvatarUploadUrlPost = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .post('/internal/users/:userId/avatar-upload-url', async ({ params, body, request }) => {
      const parsed = avatarUploadUrlBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(parsed.data.contentType)) throw status(415, 'unsupported_media_type');
      const path = avatarPath(params.userId, 'default');
      const sessionJwt = request.headers.get('authorization')?.slice('Bearer '.length) ?? '';
      return { uploadUrl: await signedAvatarUploadUrl(env, sessionJwt, path), path };
    });
