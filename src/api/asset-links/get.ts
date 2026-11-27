import { Elysia } from 'elysia';
import { handleAndroidAssetLinks } from '../../lib/asset-links';

/** Lets karasu256.com serve its `/.well-known/assetlinks.json` from this worker instead of a static file. */
export const assetLinksGet = (env: Env) =>
  new Elysia().get('/asset-links', () => handleAndroidAssetLinks(env.ANDROID_DEEPLINK_INFO));
