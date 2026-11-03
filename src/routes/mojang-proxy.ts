import { Elysia } from 'elysia';

const MOJANG_RESOURCES_URL = 'https://resources.download.minecraft.net';

/**
 * Relays Mojang's game resource objects so that browsers can read them.
 * resources.download.minecraft.net sends no CORS headers, so a browser
 * can never read its responses; fetching the same object from this
 * worker — server to server, where CORS does not apply — and answering
 * with `Access-Control-Allow-Origin: *` makes the object readable to
 * the web app that asked for it.
 *
 * The path after the prefix reaches the Mojang host unchanged:
 * /api/proxy/mojang/<prefix>/<hash> serves the object at
 * resources.download.minecraft.net/<prefix>/<hash>. The objects are
 * addressed by their content hash, so a cached copy never goes stale
 * and the responses are marked immutable.
 */
export const mojangProxyRoutes = () =>
  new Elysia({ prefix: '/api/proxy/mojang' }).get('/*', async ({ request, params }) => {
    const upstream = await fetch(`${MOJANG_RESOURCES_URL}/${params['*']}${new URL(request.url).search}`);
    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(upstream.body, { status: upstream.status, headers });
  });
