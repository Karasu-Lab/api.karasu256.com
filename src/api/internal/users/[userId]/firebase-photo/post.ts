import { Elysia } from 'elysia';
import { z } from 'zod';
import { withDataSource } from '../../../../../db/data-source';
import { FirebaseUser } from '../../../../../db/entities/firebase-user';
import { getFirebasePhotoURL, setFirebasePhotoURL } from '../../../../../lib/firebase';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';

const photoBodySchema = z.object({ photoURL: z.string().nullable() });

export const internalUserFirebasePhotoPost = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .post('/internal/users/:userId/firebase-photo', async ({ params, body }) => {
      const parsed = photoBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const link = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(FirebaseUser).findOne({ where: { userId: params.userId }, select: { firebaseUid: true } })
      );
      if (!link?.firebaseUid) return { linked: false, previousPhotoURL: null };
      const previousPhotoURL = await getFirebasePhotoURL(env, link.firebaseUid);
      await setFirebasePhotoURL(env, link.firebaseUid, parsed.data.photoURL);
      return { linked: true, previousPhotoURL };
    });
