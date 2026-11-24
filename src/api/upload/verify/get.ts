import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { cdnUrl, getCdnFile, inspectObject, isSafePath } from '../../../lib/cdn-files';
import { deriveSession, requireSession } from '../../../lib/guards';

const verifyQuerySchema = z.object({
  path: z.string(),
  uploaderId: z.string().optional(),
});

export const uploadVerifyGet = (env: Env) =>
  new Elysia()
    .derive(deriveSession(env))
    .onBeforeHandle(requireSession)
    .get('/upload/verify', async ({ query }) => {
      const parsed = verifyQuerySchema.safeParse(query);
      if (!parsed.success) throw parsed.error;
      const data = parsed.data;
      if (!isSafePath(data.path)) throw status(422, 'invalid_path');
      const file = await getCdnFile(env, data.path);
      if (!file) throw status(404, 'not_found');
      if (data.uploaderId !== undefined && file.uploaderId !== data.uploaderId) throw status(422, 'verification_failed');
      const object = await inspectObject(env, data.path);
      if (!object || object.sha256 !== file.sha256 || object.contentType !== file.contentType || object.size !== file.size) {
        throw status(422, 'verification_failed');
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
