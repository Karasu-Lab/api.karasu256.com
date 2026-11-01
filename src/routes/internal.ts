import { Elysia, t } from 'elysia';
import { withDataSource } from '../db/data-source';
import { Account } from '../db/entities/account';
import { FirebaseUser } from '../db/entities/firebase-user';
import { internalUserId, verifyAppToken } from '../lib/app-auth';
import { verifySessionJwt } from '../lib/auth';
import { getAdminAuth } from '../lib/firebase-admin';

/**
 * Service-to-service reads and writes over the user data this API owns
 * (accounts.karasu256.com). Every call must present two proofs, and
 * both must name the user in the path:
 *
 * - the calling app's own short-lived token, signed with the app
 *   private key registered here by app ID (see lib/app-auth), and
 * - the user's better-auth session token, verified against the auth
 *   server's JWKS like any other session call to this API.
 *
 * Firebase access is proxied here too, executed with the Firebase
 * Admin credentials only this worker holds, so the caller never talks
 * to Firebase itself and holds no Firebase credentials of its own.
 */
export const internalRoutes = (env: Env) =>
  new Elysia({ prefix: '/internal' })
    .onBeforeHandle(async ({ request, set }) => {
      const userId = internalUserId(new URL(request.url).pathname);
      const header = request.headers.get('authorization');
      const session = header?.startsWith('Bearer ') ? await verifySessionJwt(header.slice(7), env) : null;
      const bodyText = request.method === 'GET' || request.method === 'DELETE' ? '' : await request.clone().text().catch(() => '');
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
