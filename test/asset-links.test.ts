import { describe, expect, it } from 'vitest';
import { handleAndroidAssetLinks } from '../src/lib/asset-links';

const packageName = 'com.karasu256.karasulab';
const fingerprint = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
const statements = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: [fingerprint],
    },
  },
];

describe('Android Digital Asset Links', () => {
  it('serves the configured statements in the standard assetlinks shape as-is', async () => {
    const response = handleAndroidAssetLinks(JSON.stringify(statements));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await response.json()).toEqual(statements);
  });

  it('returns a diagnostic when the variable is missing or malformed', async () => {
    const missing = handleAndroidAssetLinks(undefined);
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({
      error: 'android_deeplink_info_invalid',
      reason: expect.stringContaining('ANDROID_DEEPLINK_INFO'),
    });

    const malformed = handleAndroidAssetLinks('{');
    expect(malformed.status).toBe(503);
    expect(await malformed.json()).toMatchObject({
      error: 'android_deeplink_info_invalid',
      reason: expect.stringContaining('valid JSON'),
    });
  });

  it('rejects invalid signing fingerprints with actionable paths', async () => {
    const response = handleAndroidAssetLinks(
      JSON.stringify([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: packageName,
            sha256_cert_fingerprints: ['not-a-fingerprint'],
          },
        },
      ]),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: 'android_deeplink_info_invalid',
      reason: expect.stringContaining('0.target.sha256_cert_fingerprints'),
    });
  });
});
