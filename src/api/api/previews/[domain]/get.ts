import { Elysia } from 'elysia';
import { listPreviews } from '../../../../lib/previews';

export const apiPreviewsGet = (env: Env) =>
  new Elysia().get('/api/previews/:domain', ({ params }) => listPreviews(env, params.domain));
