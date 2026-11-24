import { Elysia, t } from 'elysia';
import { listPreviews } from '../../../../lib/previews';
import { BadRequestError } from '../../../../lib/errors';

export const apiApiAuthPreviewsGet = (env: Env) =>
  new Elysia().get(
    '/api/api-auth/previews',
    ({ query }) => {
      if (!query.uuid) throw new BadRequestError('uuid_required');
      return listPreviews(env, query.uuid);
    },
    { query: t.Object({ uuid: t.Optional(t.String({ format: 'uuid' })) }) }
  );
