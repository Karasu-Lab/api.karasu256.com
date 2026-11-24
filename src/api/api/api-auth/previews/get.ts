import { Elysia } from 'elysia';
import { listPreviews } from '../../../../lib/previews';

export const apiApiAuthPreviewsGet = (env: Env) => new Elysia().get('/api/api-auth/previews', () => listPreviews(env));
