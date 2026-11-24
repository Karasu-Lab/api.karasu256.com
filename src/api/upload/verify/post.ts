import { Elysia } from 'elysia';
import { z } from 'zod';
import { cdnUrl, inspectObject, isAllowedUpload, isSafePath, upsertCdnFile } from '../../../lib/cdn-files';
import { deriveSession, requireSession } from '../../../lib/guards';
import { UnauthorizedError, UnprocessableEntityError } from '../../../lib/errors';

const uploadVerifyRequestSchema = z.object({
  path: z.string(),
  sha256: z.string(),
  contentType: z.string(),
  size: z.number(),
  uploaderId: z.string().optional(),
});

export const uploadVerifyPost = (env: Env) =>
  new Elysia()
    .derive(deriveSession(env))
    .onBeforeHandle(requireSession)
    .post('/upload/verify', async ({ session, body }) => {
      const parsed = uploadVerifyRequestSchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const data = parsed.data;
      if (data.uploaderId !== undefined && data.uploaderId !== session!.userId) throw new UnauthorizedError();
      if (!isSafePath(data.path) || !isAllowedUpload(data.contentType, data.size)) throw new UnprocessableEntityError('invalid_upload');
      const object = await inspectObject(env, data.path);
      if (
        !object ||
        object.sha256 !== data.sha256.toLowerCase() ||
        object.contentType !== data.contentType ||
        object.size !== data.size
      ) {
        throw new UnprocessableEntityError('verification_failed');
      }
      await upsertCdnFile(env, {
        path: data.path,
        sha256: object.sha256,
        contentType: object.contentType,
        size: object.size,
        uploaderId: data.uploaderId ?? null,
      });
      return { url: cdnUrl(env, data.path), sha256: object.sha256, contentType: object.contentType, size: object.size };
    });
