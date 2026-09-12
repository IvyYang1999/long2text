import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3123';
const out = await mkdtemp(join(tmpdir(), 'l2t-public-ocr-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [route, sample] of [['/chat-screenshot-to-text', 'en-chat'], ['/screenshot-to-markdown', 'en-article']]) {
    // Fresh anonymous context, public demo only. Real OCR, no mocked server routes,
    // no login, checkout, payment, analytics opt-in or private user image.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const responses = [], errors = [], unexpected = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {
      const u = new URL(r.url());
      if (/google-analytics\.com$|googletagmanager\.com$/.test(u.hostname) || u.pathname === '/api/checkout') unexpected.push(u.hostname + u.pathname);
    });
    page.on('response', r => { if (new URL(r.url()).pathname === '/api/ocr') responses.push(r.status()); });
    await page.goto(base + route);
    await page.getByRole('button', { name: 'Upload screenshot', exact: true }).waitFor();
    // Use the product's existing persisted preference to isolate OCR from optional AI.
    await page.evaluate(() => localStorage.setItem('l2t-ai-correct', '0'));
    await page.reload();
    await page.getByRole('button', { name: 'Upload screenshot', exact: true }).waitFor();
    const start = Date.now();
    await page.locator('input[type=file]').setInputFiles(new URL(`../public/samples/${sample}.jpg`, import.meta.url).pathname);
    const copy = page.getByRole('button', { name: 'Copy preview', exact: true });
    await copy.waitFor({ timeout: 90000 });
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    assert.ok(responses.length > 0 && responses.every(s => s === 200), 'real OCR responses');
    await copy.click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(copied.length > 100, 'actual preview text copied');
    await page.getByRole('button', { name: 'Show original image', exact: true }).click();
    await page.getByRole('button', { name: 'Hide original image', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.getByRole('button', { name: /^(Copied|Copy preview)$/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(out, sample + '-live.png') });
    const zip = await page.request.get(base + '/samples/' + sample + '.zip');
    assert.equal(zip.status(), 200);
    assert.equal((await zip.body()).readUInt32LE(0), 0x04034b50);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, [], 'no analytics without opt-in and no payment attempt');
    console.log(JSON.stringify({ route, sample, ocrRequests: responses.length, secondsToPreview: Number(seconds), copiedCharacters: copied.length, publicBundleBytes: (await zip.body()).length, result: 'PASS' }));
    await context.close();
  }
  console.log('Screenshots:', out);
} finally { await browser.close(); }
