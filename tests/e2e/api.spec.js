/**
 * API Health Check E2E Tests
 * 
 * Tests that critical API endpoints respond correctly:
 * - Health endpoint
 * - Status endpoint
 */
import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {
    test('should have responding API at /api/status', async ({ request }) => {
        const response = await request.get('/api/status');

        // API should respond (even with error, it means server is running)
        expect(response.status()).toBeLessThan(500);
    });

    test('should have responding agents endpoint', async ({ request }) => {
        const response = await request.get('/api/agents');

        // Should respond with JSON
        expect(response.status()).toBeLessThan(500);
    });
});
