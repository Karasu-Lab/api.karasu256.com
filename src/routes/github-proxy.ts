import { Elysia } from 'elysia';

const GITHUB_URL = 'https://github.com';
const RELEASE_PATH = /^[^/]+\/[^/]+\/releases\/(?:latest\/download|download\/[^/]+)\/.+/;

/**
 * Relays GitHub Release downloads so that browsers can read them.
 * Release downloads send no CORS headers, so a browser can fetch one
 * only as an opaque response whose bytes it cannot read; fetching the
 * same file from this worker — server to server, where CORS does not
 * apply — and answering with `Access-Control-Allow-Origin: *` makes
 * the file readable to the web app that asked for it.
 *
 * The path after the prefix reaches github.com unchanged:
 * /api/proxy/github/<owner>/<repo>/releases/latest/download/<file>
 * serves that release file. Only release download paths are relayed.
 * `latest` moves with every release, so the responses are not cached
 * here; the reader gates freshness on the checksum file it fetches
 * through this same route.
 */
export const githubProxyRoutes = () =>
  new Elysia({ prefix: '/api/proxy/github' }).get('/*', async ({ request, params }) => {
    const path = params['*'];
    if (!RELEASE_PATH.test(path)) {
      return new Response('not found', { status: 404 });
    }
    const upstream = await fetch(`${GITHUB_URL}/${path}${new URL(request.url).search}`);
    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers });
  });
