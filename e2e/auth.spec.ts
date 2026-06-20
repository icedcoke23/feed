import { test, expect } from '@playwright/test';

test.describe('认证页面', () => {
  test('登录页面可以加载并包含登录文案', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toContainText(/登录|Login/);
  });

  test('未登录访问 /admin 会被重定向到登录页', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/login');
  });
});
