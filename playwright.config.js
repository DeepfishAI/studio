// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for DeepFish
 * 
 * Run tests with: npm run test:e2e
 * View report: npx playwright show-report
 */
export default defineConfig({
    // Look for tests in the tests/e2e directory
    testDir: './tests/e2e',

    // Run tests in parallel
    fullyParallel: true,

    // Fail the build on CI if test.only is accidentally left in
    forbidOnly: !!process.env.CI,

    // Retry failed tests (helps with flaky tests)
    retries: process.env.CI ? 2 : 0,

    // Limit workers on CI
    workers: process.env.CI ? 1 : undefined,

    // Reporter: HTML report for detailed results
    reporter: [
        ['html', { open: 'never' }],
        ['list']
    ],

    // Shared settings for all projects
    use: {
        // Base URL for all tests - point to your dev server
        baseURL: 'http://localhost:3001',

        // Capture screenshot on failure
        screenshot: 'only-on-failure',

        // Record video on failure
        video: 'on-first-retry',

        // Trace on failure (for debugging)
        trace: 'on-first-retry',
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Run your local dev server before starting the tests
    // Uncomment if you want Playwright to auto-start the server
    // webServer: {
    //     command: 'npm run start',
    //     url: 'http://localhost:3000',
    //     reuseExistingServer: !process.env.CI,
    //     timeout: 120 * 1000,
    // },
});
