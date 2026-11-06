import { Elysia } from 'elysia';
import { z } from 'zod';
import { uploadVerifyRequestSchema } from '@karasu-lab/types/shared';
import { verifySessionJwt } from '../lib/auth';
import { cdnUrl, getCdnFile, inspectObject, isAllowedUpload, isSafePath, upsertCdnFile } from '../lib/cdn-files';

const verifyQuerySchema = z.object({
  path: z.string(),
  uploaderId: z.string().optional(),
});

export const uploadRoutes = (env: Env) =>
  new Elysia({ prefix: '/upload' })
    .derive(async ({ request }) => {
      const header = request.headers.get('authorization');
      return { session: header?.startsWith('Bearer ') ? await verifySessionJwt(header.slice(7), env) : null };
    })
    .onBeforeHandle(({ session, set }) => {
      if (!session) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
    })
    .post('/verify', async ({ session, body, set }) => {
      const parsed = uploadVerifyRequestSchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const data = parsed.data;
      if (data.uploaderId !== undefined && data.uploaderId !== session!.userId) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (!isSafePath(data.path) || !isAllowedUpload(data.contentType, data.size)) {
        set.status = 422;
        return { error: 'invalid_upload' };
      }
      const object = await inspectObject(env, data.path);
      if (
        !object ||
        object.sha256 !== data.sha256.toLowerCase() ||
        object.contentType !== data.contentType ||
        object.size !== data.size
      ) {
        set.status = 422;
        return { error: 'verification_failed' };
      }
      await upsertCdnFile(env, {
        path: data.path,
        sha256: object.sha256,
        contentType: object.contentType,
        size: object.size,
        uploaderId: data.uploaderId ?? null,
      });
      return { url: cdnUrl(env, data.path), sha256: object.sha256, contentType: object.contentType, size: object.size };
    })
    .get('/verify', async ({ query, set }) => {
      const parsed = verifyQuerySchema.safeParse(query);
      if (!parsed.success) throw parsed.error;
      const data = parsed.data;
      if (!isSafePath(data.path)) {
        set.status = 422;
        return { error: 'invalid_path' };
      }
      const file = await getCdnFile(env, data.path);
      if (!file) {
        set.status = 404;
        return { error: 'not_found' };
      }
      if (data.uploaderId !== undefined && file.uploaderId !== data.uploaderId) {
        set.status = 422;
        return { error: 'verification_failed' };
      }
      const object = await inspectObject(env, data.path);
      if (!object || object.sha256 !== file.sha256 || object.contentType !== file.contentType || object.size !== file.size) {
        set.status = 422;
        return { error: 'verification_failed' };
      }
      return {
        valid: true,
        url: cdnUrl(env, file.path),
        sha256: file.sha256,
        contentType: file.contentType,
        size: file.size,
        uploaderId: file.uploaderId,
        updatedAt: file.updatedAt,
      };
    });
