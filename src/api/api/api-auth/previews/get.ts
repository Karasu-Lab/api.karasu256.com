import { Elysia, t } from 'elysia';
import { listPreviews } from '../../../../lib/previews';

export const apiApiAuthPreviewsGet = (env: Env) =>
  new Elysia().get('/api/api-auth/previews', ({ query }) => listPreviews(env, query.uuid), {
    query: t.Object({ uuid: t.String({ format: 'uuid' }) }),
  });
