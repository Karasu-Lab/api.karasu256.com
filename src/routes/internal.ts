import { Elysia, NotFoundError, t } from 'elysia';
import { withDataSource } from '../db/data-source';
import { Account } from '../db/entities/account';
import { FirebaseUser } from '../db/entities/firebase-user';
import { User } from '../db/entities/user';
import { internalUserId, verifyAppToken } from '../lib/app-auth';
import { verifySessionJwt } from '../lib/auth';
import { getAdminAuth } from '../lib/firebase-admin';

const rawBodies = new WeakMap<Request, string>();

export const internalRoutes = (env: Env) =>
  new Elysia({ prefix: '/internal' })
    .onParse(async ({ request }) => {
      const text = await request.text();
      rawBodies.set(request, text);
      return text ? JSON.parse(text) : {};
    })
    .onBeforeHandle(async ({ request, set }) => {
      const userId = internalUserId(new URL(request.url).pathname);
      const header = request.headers.get('authorization');
      const session = header?.startsWith('Bearer ') ? await verifySessionJwt(header.slice(7), env) : null;
      const bodyText = rawBodies.get(request) ?? '';
      if (!userId || session?.userId !== userId || !(await verifyAppToken(request, env, bodyText))) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
    })
    .get('/users/:userId/linked-providers', async ({ params }) => {
      const rows = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(Account).find({ where: { userId: params.userId }, select: { providerId: true } })
      );
      return { providerIds: rows.map((row) => row.providerId) };
    })
    .delete('/users/:userId/linked-providers/:providerId', async ({ params, set }) => {
      const result = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(Account).delete({ userId: params.userId, providerId: params.providerId })
      );
      if (!result.affected) {
        set.status = 404;
        return { error: 'Not found' };
      }
      set.status = 204;
      return null;
    })
    .get('/users/:userId/firebase-uid', async ({ params }) => {
      const link = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(FirebaseUser).findOne({ where: { userId: params.userId }, select: { firebaseUid: true } })
      );
      return { firebaseUid: link?.firebaseUid ?? null };
    })
    .post(
      '/users/:userId/image',
      async ({ params, body }) => {
        const result = await withDataSource(env, (dataSource) =>
          dataSource.getRepository(User).update({ id: params.userId }, { image: body.image, updatedAt: new Date() })
        );
        if (!result.affected) throw new NotFoundError();
        return { image: body.image };
      },
      { body: t.Object({ image: t.Union([t.String({ maxLength: 2048 }), t.Null()]) }) }
    )
    .post(
      '/users/:userId/firebase-photo',
      async ({ params, body }) => {
        const link = await withDataSource(env, (dataSource) =>
          dataSource.getRepository(FirebaseUser).findOne({ where: { userId: params.userId }, select: { firebaseUid: true } })
        );
        if (!link?.firebaseUid) return { linked: false, previousPhotoURL: null };
        const auth = getAdminAuth(env);
        const previous = await auth.getUser(link.firebaseUid);
        await auth.updateUser(link.firebaseUid, { photoURL: body.photoURL });
        return { linked: true, previousPhotoURL: previous.photoURL ?? null };
      },
      { body: t.Object({ photoURL: t.Union([t.String(), t.Null()]) }) }
    );
