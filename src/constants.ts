import { z } from 'zod';

/**
 * The configurable values that point at the Karasu Lab domains. Their
 * production values are the defaults here, so the worker needs no URL
 * configuration in its wrangler vars — only secrets are provisioned from
 * outside. An environment variable of the same name still overrides the
 * default, and the defaults branch on APP_ENV so local and preview runs
 * resolve their own domains.
 */
const PRODUCTION_DEFAULTS = {
  AUTH_URL: 'https://api-auth.karasu256.com',
  CDN_BASE_URL: 'https://cdn.karasu256.com',
};

const PREVIEW_DEFAULTS = {
  AUTH_URL: 'https://dev-api-auth.karasu256.com',
  CDN_BASE_URL: 'https://dev.cdn.karasu256.com',
};

const LOCAL_DEFAULTS = {
  AUTH_URL: 'http://localhost:8790',
  CDN_BASE_URL: 'http://localhost:8788',
};

type DomainDefaults = {
  AUTH_URL: string;
  CDN_BASE_URL: string;
};

function domainEnvSchema(defaults: DomainDefaults) {
  return z.object({
    AUTH_URL: z.url().default(defaults.AUTH_URL),
    CDN_BASE_URL: z.url().default(defaults.CDN_BASE_URL),
  });
}

/**
 * Materializes the worker's environment: every domain value the worker
 * was not explicitly given is filled in from the constants above,
 * branched on APP_ENV (local / preview / production). Called once where
 * the worker materializes its env, before any handler reads it.
 */
export function resolveEnv(raw: Env): Env {
  const defaults =
    raw.APP_ENV === 'local' ? LOCAL_DEFAULTS : raw.APP_ENV === 'preview' ? PREVIEW_DEFAULTS : PRODUCTION_DEFAULTS;
  return { ...raw, ...domainEnvSchema(defaults).parse(raw) };
}
