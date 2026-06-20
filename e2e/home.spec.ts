import { test, expect } from '@playwright/test';

test('首页可以加载', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
