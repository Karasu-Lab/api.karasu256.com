import { Elysia, t } from 'elysia';
import { withDataSource } from '../../../../db/data-source';
import { User } from '../../../../db/entities/user';
import { deriveAuth, requirePermission } from '../../../../lib/guards';
import { avatarKey } from '../../../../lib/images';
import { BadRequestError, NotFoundError, PayloadTooLargeError } from '../../../../lib/errors';

export const userProfileImagePost = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).post(
    '/user/profile/image',
    async ({ auth, body }) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(body.file.type)) throw new BadRequestError('Unsupported image type. Allowed: jpeg, png, webp.');
      if (body.file.size > 5 * 1024 * 1024) throw new PayloadTooLargeError('File exceeds 5 MB limit');

      const key = avatarKey(auth!.userId);
      await env.CLOUDFLARE_IMAGES.put(key, await body.file.arrayBuffer(), { httpMetadata: { contentType: body.file.type } });

      const image = `${env.CDN_BASE_URL}/${key}`;
      const updated = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(User).update({ id: auth!.userId }, { image, updatedAt: new Date() })
      );
      if (!updated.affected) throw new NotFoundError();
      return { image };
    },
    { beforeHandle: requirePermission('users:profile.write'), body: t.Object({ file: t.File() }) }
  );
