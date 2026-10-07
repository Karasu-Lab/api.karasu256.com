import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8789',
  },
  webServer: [
    {
      command: 'pnpm --filter api-auth.karasu256.com dev',
      url: 'http://localhost:8790/api/auth/ok',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter auth.karasu256.com dev',
      url: 'http://localhost:3004/sign-in',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter accounts.karasu256.com dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:8789/permissions/scopes',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
