import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 360, height: 780 },
        defaultBrowserType: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'PORT=4174 node build.js --serve',
    env: {
      SUPABASE_URL: 'http://127.0.0.1:55431',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test',
    },
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
