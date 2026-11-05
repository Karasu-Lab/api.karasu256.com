import { Elysia, t } from 'elysia';
import { verifySessionJwt } from '../lib/auth';
import { cdnUrl, getCdnFile, inspectObject, isAllowedUpload, isSafePath, upsertCdnFile } from '../lib/cdn-files';

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
    .post(
      '/verify',
      async ({ session, body, set }) => {
        if (body.uploaderId !== undefined && body.uploaderId !== session!.userId) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (!isSafePath(body.path) || !isAllowedUpload(body.contentType, body.size)) {
          set.status = 422;
          return { error: 'invalid_upload' };
        }
        const object = await inspectObject(env, body.path);
        if (
          !object ||
          object.sha256 !== body.sha256.toLowerCase() ||
          object.contentType !== body.contentType ||
          object.size !== body.size
        ) {
          set.status = 422;
          return { error: 'verification_failed' };
        }
        await upsertCdnFile(env, {
          path: body.path,
          sha256: object.sha256,
          contentType: object.contentType,
          size: object.size,
          uploaderId: body.uploaderId ?? null,
        });
        return { url: cdnUrl(env, body.path), sha256: object.sha256, contentType: object.contentType, size: object.size };
      },
      {
        body: t.Object({
          path: t.String(),
          sha256: t.String(),
          contentType: t.String(),
          size: t.Number(),
          uploaderId: t.Optional(t.String()),
        }),
      }
    )
    .get(
      '/verify',
      async ({ query, set }) => {
        if (!isSafePath(query.path)) {
          set.status = 422;
          return { error: 'invalid_path' };
        }
        const file = await getCdnFile(env, query.path);
        if (!file) {
          set.status = 404;
          return { error: 'not_found' };
        }
        if (query.uploaderId !== undefined && file.uploaderId !== query.uploaderId) {
          set.status = 422;
          return { error: 'verification_failed' };
        }
        const object = await inspectObject(env, query.path);
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
      },
      { query: t.Object({ path: t.String(), uploaderId: t.Optional(t.String()) }) }
    );
