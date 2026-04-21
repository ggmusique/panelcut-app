# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-smoke.spec.js >> app loads and renders the React root shell
- Location: tests\app-smoke.spec.js:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Supabase credentials manquants — vérifie .env",
+ ]
```

# Page snapshot

```yaml
- iframe [ref=e3]:
  - generic [ref=f1e2]:
    - generic [ref=f1e3]: "Uncaught runtime errors:"
    - button "Dismiss" [ref=f1e4] [cursor=pointer]: ×
    - generic [ref=f1e6]:
      - generic [ref=f1e7]: ERROR
      - generic [ref=f1e8]: supabaseUrl is required. at validateSupabaseUrl (http://127.0.0.1:3000/static/js/bundle.js:188789:26) at new SupabaseClient (http://127.0.0.1:3000/static/js/bundle.js:189005:21) at createClient (http://127.0.0.1:3000/static/js/bundle.js:189221:10) at ./src/supabase.js (http://127.0.0.1:3000/static/js/bundle.js:18798:85) at options.factory (http://127.0.0.1:3000/static/js/bundle.js:235405:30) at __webpack_require__ (http://127.0.0.1:3000/static/js/bundle.js:234772:32) at fn (http://127.0.0.1:3000/static/js/bundle.js:235020:21) at hotRequire (http://127.0.0.1:3000/static/js/bundle.js:235388:47) at ./src/App.js (http://127.0.0.1:3000/static/js/bundle.js:21:67) at options.factory (http://127.0.0.1:3000/static/js/bundle.js:235405:30)
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test('app loads and renders the React root shell', async ({ page }) => {
  4  |   const consoleErrors = [];
  5  | 
  6  |   page.on('console', (msg) => {
  7  |     if (msg.type() === 'error') {
  8  |       consoleErrors.push(msg.text());
  9  |     }
  10 |   });
  11 | 
  12 |   await page.goto('/');
  13 |   await page.waitForLoadState('networkidle');
  14 | 
  15 |   await expect(page.locator('#root')).toBeVisible();
  16 |   await expect(page.locator('body')).not.toHaveText(/cannot compile|compiled with errors/i);
  17 | 
  18 |   await page.screenshot({
  19 |     path: 'test-results/app-smoke.png',
  20 |     fullPage: true,
  21 |   });
  22 | 
> 23 |   expect(consoleErrors).toEqual([]);
     |                         ^ Error: expect(received).toEqual(expected) // deep equality
  24 | });
  25 | 
```