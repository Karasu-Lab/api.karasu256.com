import { Elysia } from 'elysia';
import { NotFoundError } from '../../../../../../lib/errors';
import { renderOAuthProviderSvg } from '../../../../../../lib/oauth-providers';

export const apiAssetsOauthProvidersGet = () =>
  new Elysia().get('/api/assets/oauth/providers/:providersId', ({ params, query }) => {
    const svg = renderOAuthProviderSvg(params.providersId, typeof query.color === 'string' ? query.color : undefined);
    if (!svg) throw new NotFoundError();
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=86400',
        'access-control-allow-origin': '*',
      },
    });
  });
