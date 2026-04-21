const { test, expect } = require('@playwright/test');

test('app loads and renders the React root shell', async ({ page }) => {
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('body')).not.toHaveText(/cannot compile|compiled with errors/i);

  await page.screenshot({
    path: 'test-results/app-smoke.png',
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
});
