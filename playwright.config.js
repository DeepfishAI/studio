// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for DeepFish
 * 
 * Run tests with: npm run test:e2e
 * Run mobile tests: npm run test:e2e -- --project="iPhone 14"
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
        // Base URL - use PROD for stress testing, LOCAL for dev
        baseURL: process.env.TEST_URL || 'https://deepfish.app',

        // Capture screenshot ALWAYS for mobile debugging
        screenshot: 'on',

        // Record video on failure
        video: 'on-first-retry',

        // Trace on failure (for debugging)
        trace: 'on-first-retry',
    },

    // Configure projects for browsers AND mobile devices
    projects: [
        // Desktop Chrome
        {
            name: 'Desktop Chrome',
            use: { ...devices['Desktop Chrome'] },
        },
        // iPhone 14
        {
            name: 'iPhone 14',
            use: { ...devices['iPhone 14'] },
        },
        // iPhone 14 Pro Max (larger screen)
        {
            name: 'iPhone 14 Pro Max',
            use: { ...devices['iPhone 14 Pro Max'] },
        },
        // Android - Pixel 7
        {
            name: 'Pixel 7',
            use: { ...devices['Pixel 7'] },
        },
        // Android - Galaxy S8 (older/smaller)
        {
            name: 'Galaxy S8',
            use: { ...devices['Galaxy S8'] },
        },
    ],
});
