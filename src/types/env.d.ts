export {};

declare global {
  interface Env {
    APP_ENV: 'local' | 'preview' | 'production';
    /** Resolved by src/constants.ts: carries a zod default branched on APP_ENV, so wrangler vars no longer define it. */
    AUTH_URL: string;
    /** Resolved by src/constants.ts: carries a zod default branched on APP_ENV, so wrangler vars no longer define it. */
    CDN_BASE_URL: string;
    /** Provisioned with `wrangler secret put` so the database credentials are never committed. */
    DATABASE_URL: string;
    /** Provisioned with `wrangler secret put` so it is never committed; must match accounts' `INTERNAL_API_SECRET`. */
    INTERNAL_API_SECRET: string;
    /** Only set where the auth deployment this worker calls has Vercel Deployment Protection enabled. */
    VERCEL_PROTECTION_BYPASS_SECRET?: string;
  }
}
