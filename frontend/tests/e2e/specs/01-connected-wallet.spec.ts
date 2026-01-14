import { test, expect } from '../fixtures/headless‑wallet.fixture';

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should display connect button initially', async ({ page }) => {
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i })).toHaveCount(1);
  });

  test('should show wallet address after connection', async ({ page }) => {
    await page.getByRole('button', { name: /Connect MetaMask/i }).click();
    
    await page.waitForSelector('.bg-green-100', { timeout: 5000 });
    await expect(page.locator('.bg-green-100')).toBeVisible();
    await expect(page.locator('.bg-green-100')).toContainText('0x');
  });

  test('should show disconnect button after connection', async ({ page }) => {
    await page.getByRole('button', { name: /Connect/i }).click();
    
    await page.waitForSelector('[class*="bg-red"]');
    await expect(page.getByRole('button', { name: /Disconnect/i })).toBeVisible();
  });

  test('should disconnect wallet successfully', async ({ page }) => {
    await page.getByRole('button', { name: /Connect/i }).click();
    
    await page.waitForSelector('.bg-green-100');
    await page.getByRole('button', { name: /Disconnect/i }).click();
    
    await expect(page.getByRole('button', { name: /Connect/i })).toBeVisible();
    await expect(page.locator('.bg-green-100')).not.toBeVisible();
  });

  test('should handle connection error gracefully', async ({ page }) => {
    await page.route('**/ethereum.isConnected', route => route.fulfill({ status: 403 }));
    await page.getByRole('button', { name: /Connect/i }).click();
    
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 3000 });
  });
});
