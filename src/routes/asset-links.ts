import { Elysia } from 'elysia';

/** Digital Asset Links statements that karasu256.com publishes, delegating its passkeys and links to the Android app's debug and release signing certificates. */
const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
    target: {
      namespace: 'android_app',
      package_name: 'com.karasu256.karasulab',
      sha256_cert_fingerprints: [
        '6D:F2:A9:61:19:57:34:E9:1E:45:82:42:A0:C6:92:42:2F:64:48:0E:88:29:7E:13:62:3B:82:1E:0D:F9:9B:0B',
        'BA:8E:FD:E5:6E:4F:4E:C7:C8:AF:34:62:6A:16:E1:6C:13:2A:AA:F7:B9:E4:03:C7:18:9D:C7:E7:9A:8F:94:39',
      ],
    },
  },
];

/** Lets karasu256.com serve its `/.well-known/assetlinks.json` from this worker instead of a static file. */
export const assetLinkRoutes = () => new Elysia().get('/asset-links', () => ASSET_LINKS);
