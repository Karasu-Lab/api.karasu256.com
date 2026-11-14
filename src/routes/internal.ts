import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';
import { withDataSource } from '../db/data-source';
import { Account } from '../db/entities/account';
import { FirebaseUser } from '../db/entities/firebase-user';
import { User } from '../db/entities/user';
import { internalUserId, verifyAppToken } from '../lib/app-auth';
import { verifySessionJwt } from '../lib/auth';
import { listActiveSessions, revokeActiveSession } from '../lib/sessions';
import { getFirebasePhotoURL, setFirebasePhotoURL } from '../lib/firebase';
import { avatarPath, signedAvatarUploadUrl } from '../lib/avatars';
import { ALLOWED_TYPES } from '../lib/images';

const rawBodies = new WeakMap<Request, string>();

const imageBodySchema = z.object({ image: z.string().max(2048).nullable() });

const photoBodySchema = z.object({ photoURL: z.string().nullable() });

const avatarUploadUrlBodySchema = z.object({ contentType: z.string().min(1) });

const sessionsQuerySchema = z.object({ sessionId: z.string().min(1).optional() });

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
      if (!userId || session?.userId !== userId || !(await verifyAppToken(request, bodyText))) {
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
    .get('/users/:userId/sessions', async ({ params, query }) => {
      const parsed = sessionsQuerySchema.safeParse(query);
      if (!parsed.success) throw parsed.error;
      return listActiveSessions(env, params.userId, parsed.data.sessionId);
    })
    .delete('/users/:userId/sessions/:sessionId', async ({ params, set }) => {
      const revoked = await revokeActiveSession(env, params.userId, params.sessionId);
      if (!revoked) {
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
    .post('/users/:userId/image', async ({ params, body }) => {
      const parsed = imageBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const result = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(User).update({ id: params.userId }, { image: parsed.data.image, updatedAt: new Date() })
      );
      if (!result.affected) throw new NotFoundError();
      return { image: parsed.data.image };
    })
    .post('/users/:userId/avatar-upload-url', async ({ params, body, request, set }) => {
      const parsed = avatarUploadUrlBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      if (!ALLOWED_TYPES.has(parsed.data.contentType)) {
        set.status = 415;
        return { error: 'unsupported_media_type' };
      }
      const path = avatarPath(params.userId, 'default');
      const sessionJwt = request.headers.get('authorization')?.slice('Bearer '.length) ?? '';
      return { uploadUrl: await signedAvatarUploadUrl(env, sessionJwt, path), path };
    })
    .post('/users/:userId/firebase-photo', async ({ params, body }) => {
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
