/**
 * Login Page E2E Tests
 * 
 * Tests the login page functionality:
 * - Page loads correctly
 * - Form elements present
 * - Navigation back to landing
 */
import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
    });

    test('should load the login page', async ({ page }) => {
        // Check we're on the login page
        await expect(page).toHaveURL(/.*login/);
    });

    test('should have email input field', async ({ page }) => {
        // Look for email input (adjust selector based on actual structure)
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        await expect(emailInput.first()).toBeVisible();
    });

    test('should have a login/submit button', async ({ page }) => {
        // Look for submit button
        const submitButton = page.locator('button[type="submit"], button:has-text("Log"), button:has-text("Sign")');
        await expect(submitButton.first()).toBeVisible();
    });

    test('should have link to go back or sign up', async ({ page }) => {
        // Check for any back/signup link
        const backLink = page.locator('a[href="/"], button:has-text("Back"), a:has-text("Sign up")');
        // At least one of these should exist
        const count = await backLink.count();
        expect(count).toBeGreaterThan(0);
    });
});
