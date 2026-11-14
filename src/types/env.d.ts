export {};

declare global {
  interface Env {
    APP_ENV: 'local' | 'preview' | 'production';
    CDN_DB: D1Database;
    AUTH_URL: string;
    CDN_BASE_URL: string;
    STORAGE_ENDPOINT: string;
    STORAGE_BUCKET: string;
    STORAGE_ACCESS_KEY_ID: string;
    STORAGE_SECRET_ACCESS_KEY: string;
    DATABASE_URL: string;
    INTERNAL_API_SECRET: string;
    VERCEL_PROTECTION_BYPASS_SECRET?: string;
    FIREBASE_ADMIN_PROJECT_ID: string;
    FIREBASE_ADMIN_CLIENT_EMAIL: string;
    FIREBASE_ADMIN_PRIVATE_KEY: string;
  }
}
