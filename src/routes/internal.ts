import { Elysia } from 'elysia';
import { withDataSource } from '../db/data-source';
import { Account } from '../db/entities/account';
import { FirebaseUser } from '../db/entities/firebase-user';
import { isInternalCaller } from '../lib/auth';

/**
 * Service-to-service reads and writes over the user data this API owns,
 * for callers that have already established the user's session
 * themselves (accounts.karasu256.com). Guarded by the shared internal
 * secret instead of a user credential; the caller names the user in
 * the path and is trusted to have authenticated them.
 */
export const internalRoutes = (env: Env) =>
  new Elysia({ prefix: '/internal' })
    .onBeforeHandle(({ request, set }) => {
      if (!isInternalCaller(request, env)) {
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
    });
