export {};

declare global {
  interface Env {
    /** Provisioned with `wrangler secret put` so it is never committed; must match accounts' `INTERNAL_API_SECRET`. */
    INTERNAL_API_SECRET: string;
    /** Only set where the accounts deployment this worker calls has Vercel Deployment Protection enabled. */
    VERCEL_PROTECTION_BYPASS_SECRET?: string;
  }
}
