import { z } from 'zod';

const androidAssetLinksSchema = z
  .array(
    z.object({
      relation: z.array(z.string().min(1)).min(1),
      target: z.object({
        namespace: z.literal('android_app'),
        package_name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/),
        sha256_cert_fingerprints: z
          .array(z.string().regex(/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/))
          .min(1),
      }),
    }),
  )
  .min(1);

function configurationError(reason: string): Response {
  return Response.json(
    { error: 'android_deeplink_info_invalid', reason },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

export function handleAndroidAssetLinks(rawConfig: string | undefined): Response {
  if (!rawConfig) {
    return configurationError('The ANDROID_DEEPLINK_INFO GitHub Actions variable is not configured.');
  }

  let config: unknown;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid JSON.';
    return configurationError(`ANDROID_DEEPLINK_INFO must contain valid JSON: ${detail}`);
  }

  const parsed = androidAssetLinksSchema.safeParse(config);
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    return configurationError(`ANDROID_DEEPLINK_INFO has an invalid shape: ${reason}`);
  }

  return Response.json(parsed.data, { headers: { 'cache-control': 'public, max-age=300' } });
}
