import { Elysia } from 'elysia';
import { withDataSource } from '../../../../../db/data-source';
import { FirebaseUser } from '../../../../../db/entities/firebase-user';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';

export const internalUserFirebaseUidGet = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .get('/internal/users/:userId/firebase-uid', async ({ params }) => {
      const link = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(FirebaseUser).findOne({ where: { userId: params.userId }, select: { firebaseUid: true } })
      );
      return { firebaseUid: link?.firebaseUid ?? null };
    });
