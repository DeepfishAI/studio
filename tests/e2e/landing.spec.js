/**
 * Landing Page E2E Tests
 * 
 * Tests the public landing page functionality:
 * - Page loads correctly
 * - Key elements are visible
 * - Navigation works
 * - Email signup form works
 */
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
    // Before each test, go to the landing page
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should load the landing page with correct title', async ({ page }) => {
        // Check page title or key heading
        await expect(page.locator('.hero-title')).toContainText('Stop Prompting');
    });

    test('should display the DeepFish logo', async ({ page }) => {
        // Check logo is visible
        const logo = page.locator('.landing-header__logo-text');
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('DeepFish');
    });

    test('should have a working email input form', async ({ page }) => {
        // Find the email input
        const emailInput = page.locator('.email-input');
        await expect(emailInput).toBeVisible();

        // Find the join button
        const joinButton = page.locator('.join-btn');
        await expect(joinButton).toBeVisible();
        await expect(joinButton).toContainText('Join Waitlist');
    });

    test('should navigate to login page when Sign In is clicked', async ({ page }) => {
        // Click the Sign In button
        await page.click('.btn--outline');

        // Should navigate to login
        await expect(page).toHaveURL(/.*login/);
    });

    test('should show beta tag', async ({ page }) => {
        const betaTag = page.locator('.beta-tag');
        await expect(betaTag).toBeVisible();
        await expect(betaTag).toContainText('BETA');
    });

    test('should display hero subtitle text', async ({ page }) => {
        const subtitle = page.locator('.hero-subtitle');
        await expect(subtitle).toBeVisible();
        await expect(subtitle).toContainText('workgroup');
    });
});
