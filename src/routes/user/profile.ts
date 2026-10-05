import { Elysia, t } from 'elysia';
import { Permissions, isPermitted, type AbstractPermission, type RouteAuthContext } from '@Hashibutogarasu/api-permissions';
import { withDataSource } from '../../db/data-source';
import { User } from '../../db/entities/user';
import { authenticate } from '../../lib/auth';
import { ALLOWED_TYPES, MAX_FILE_BYTES, avatarKey } from '../../lib/images';

type Guarded = { auth: RouteAuthContext | null; set: { status?: number | string } };

function requirePermission(permission: AbstractPermission) {
  return ({ auth, set }: Guarded) => {
    if (!auth) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    if (!isPermitted(auth, permission)) {
      set.status = 403;
      return { error: 'insufficient_scope' };
    }
  };
}

export const profileRoutes = (env: Env) =>
  new Elysia()
    .derive(async ({ request }) => ({ auth: await authenticate(request, env) }))
    .get(
      '/profile',
      async ({ auth, set }) => {
        const user = await withDataSource(env, (dataSource) => dataSource.getRepository(User).findOneBy({ id: auth!.userId }));
        if (!user) {
          set.status = 404;
          return { error: 'not_found' };
        }
        return { id: user.id, name: user.name, image: user.image };
      },
      { beforeHandle: requirePermission(Permissions.profile.read) }
    )
    .patch(
      '/profile',
      async ({ auth, body, set }) => {
        const user = await withDataSource(env, async (dataSource) => {
          const repository = dataSource.getRepository(User);
          const result = await repository.update({ id: auth!.userId }, { name: body.name, updatedAt: new Date() });
          if (!result.affected) return null;
          return repository.findOneBy({ id: auth!.userId });
        });
        if (!user) {
          set.status = 404;
          return { error: 'not_found' };
        }
        return { id: user.id, name: user.name, image: user.image };
      },
      { beforeHandle: requirePermission(Permissions.profile.write), body: t.Object({ name: t.Nullable(t.String()) }) }
    )
    .post(
      '/profile/image',
      async ({ auth, body, set }) => {
        if (!ALLOWED_TYPES.has(body.file.type)) {
          set.status = 400;
          return { error: 'Unsupported image type. Allowed: jpeg, png, webp.' };
        }
        if (body.file.size > MAX_FILE_BYTES) {
          set.status = 413;
          return { error: 'File exceeds 5 MB limit' };
        }

        const key = avatarKey(auth!.userId);
        await env.IMAGES.put(key, await body.file.arrayBuffer(), { httpMetadata: { contentType: body.file.type } });

        const image = `${env.CDN_BASE_URL}/${key}`;
        const updated = await withDataSource(env, (dataSource) =>
          dataSource.getRepository(User).update({ id: auth!.userId }, { image, updatedAt: new Date() })
        );
        if (!updated.affected) {
          set.status = 404;
          return { error: 'not_found' };
        }
        return { image };
      },
      { beforeHandle: requirePermission(Permissions.profile.write), body: t.Object({ file: t.File() }) }
    )
    .get(
      '/profile/image',
      async ({ auth, set }) => {
        const object = await env.IMAGES.get(avatarKey(auth!.userId));
        if (!object) {
          set.status = 404;
          return { error: 'not_found' };
        }
        return new Response(object.body, {
          headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
        });
      },
      { beforeHandle: requirePermission(Permissions.profile.read) }
    );
