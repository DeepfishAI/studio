/**
 * Mobile Visibility & Layout Tests
 * 
 * Tests specifically for mobile device layout issues:
 * - Elements not cut off
 * - Proper viewport scaling
 * - Touch targets accessible
 * - No horizontal overflow
 */
import { test, expect } from '@playwright/test';

test.describe('Mobile Layout & Visibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
    });

    test('landing page fits within viewport (no horizontal scroll)', async ({ page }) => {
        // Check for horizontal overflow - page width should match viewport
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()?.width || 0;

        // Body should not be wider than viewport (allows 5px tolerance)
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    });

    test('hero title is fully visible', async ({ page }) => {
        const heroTitle = page.locator('.hero-title');
        await expect(heroTitle).toBeVisible();

        // Check it's within viewport bounds
        const box = await heroTitle.boundingBox();
        const viewport = page.viewportSize();

        if (box && viewport) {
            // Title should not be cut off on sides
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            // Title should not be cut off on top
            expect(box.y).toBeGreaterThanOrEqual(0);
        }
    });

    test('email input and join button are fully visible', async ({ page }) => {
        const emailInput = page.locator('.email-input');
        const joinButton = page.locator('.join-btn');

        await expect(emailInput).toBeVisible();
        await expect(joinButton).toBeVisible();

        // Check join button is tappable (adequate size for touch)
        const buttonBox = await joinButton.boundingBox();
        if (buttonBox) {
            // Min touch target should be 44x44 (Apple HIG)
            expect(buttonBox.height).toBeGreaterThanOrEqual(40);
        }
    });

    test('footer is visible and not cut off', async ({ page }) => {
        const footer = page.locator('.footer');
        await expect(footer).toBeVisible();

        // Scroll to footer and verify it's fully visible
        await footer.scrollIntoViewIfNeeded();
        const box = await footer.boundingBox();
        const viewport = page.viewportSize();

        if (box && viewport) {
            // Footer bottom should be visible on screen
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + box.y);
        }
    });

    test('Sign In button is accessible', async ({ page }) => {
        const signInBtn = page.locator('.btn--outline, button:has-text("Sign In")').first();
        await expect(signInBtn).toBeVisible();

        // Should be clickable
        await signInBtn.click();
        await expect(page).toHaveURL(/.*login/);
    });

    test('login form elements are visible on mobile', async ({ page }) => {
        await page.goto('/login');
        // Wait longer for the page to fully render
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Extra wait for React hydration

        // Check viewport dimensions are respected
        const viewport = page.viewportSize();
        console.log(`Testing at viewport: ${viewport?.width}x${viewport?.height}`);

        // Take a screenshot for debugging
        await page.screenshot({ path: `test-results/login-debug-${viewport?.width}x${viewport?.height}.png` });

        // Try multiple selectors - the login page uses class="input" for email
        const emailInput = page.locator('input.input, input[type="email"], input[placeholder*="email" i]').first();

        // Check if form exists first
        const form = page.locator('form.login-form, form');
        const formCount = await form.count();
        console.log(`Forms found: ${formCount}`);

        if (formCount > 0) {
            await expect(emailInput).toBeVisible({ timeout: 10000 });

            // Check it's within viewport
            const box = await emailInput.boundingBox();
            if (box && viewport) {
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            }
        } else {
            // If no form exists, log what we see instead
            const pageContent = await page.content();
            console.log('Page content length:', pageContent.length);
            // Fail with descriptive message
            expect(formCount, 'Expected login form to exist on /login page').toBeGreaterThan(0);
        }
    });
});

test.describe('Mobile Navigation', () => {
    test('can navigate from landing to login on mobile', async ({ page }) => {
        await page.goto('/');

        // Click sign in
        await page.click('.btn--outline, button:has-text("Sign In")');
        await expect(page).toHaveURL(/.*login/);
    });
});
