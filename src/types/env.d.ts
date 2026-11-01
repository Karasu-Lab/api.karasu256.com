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
    /** The app ID whose signed calls the internal user-data endpoints trust (accounts.karasu256.com). */
    ACCOUNTS_APP_ID: string;
    /** Base64-encoded SPKI public key for the trusted app ID's signing key; the private half never leaves the accounts deployment. */
    ACCOUNTS_APP_PUBLIC_KEY: string;
    /** Firebase service account for the proxied Firebase access; this worker is the only holder. */
    FIREBASE_ADMIN_PROJECT_ID: string;
    FIREBASE_ADMIN_CLIENT_EMAIL: string;
    FIREBASE_ADMIN_PRIVATE_KEY: string;
  }
}
