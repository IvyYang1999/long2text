import assert from 'node:assert/strict';

// Read-only checks against a running build or the deployed site; no OCR or payments.
const base = new URL(process.argv[2] ?? 'http://localhost:3123');
const site = 'https://long2text.com';
const guides = ['chat-screenshot-to-text', 'screenshot-to-markdown'];
const comparison = 'long-screenshot-to-markdown-test';
const routes = ['', 'zh', 'privacy', 'terms', 'zh/privacy', 'zh/terms', ...guides, comparison];
const descriptions = new Set();
const htmlByRoute = new Map();
for (const route of routes) {
  const response = await fetch(new URL(`/${route}`, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, route);
  const html = await response.text();
  htmlByRoute.set(route, html);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${route}: one H1`);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonical?.replace(/\/$/, ''), `${site}${route ? `/${route}` : ''}`, `${route}: canonical`);
  assert.match(html, /<meta name="robots" content="index, follow"/);
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(description, `${route}: description`);
  assert.ok(!descriptions.has(description), `${route}: unique description`);
  descriptions.add(description);
  const languages = [...html.matchAll(/<link rel="alternate"[^>]*hrefLang="([^"]+)"/gi)].map(m => m[1]);
  assert.deepEqual(languages.sort(), ([...guides, comparison].includes(route) ? ['en', 'x-default'] : ['en', 'zh-CN', 'x-default']).sort(), `${route}: actual translations only`);
  console.log(`PASS /${route}: status, H1, canonical, description, hreflang, robots`);
}
for (const slug of guides) {
  assert.ok(htmlByRoute.get('').includes(`href="/${slug}"`), `home links to ${slug}`);
  const html = htmlByRoute.get(slug);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /<details>/);
  assert.match(html, /href="\/#pricing"/);
  assert.match(html, /<pre[^>]*><code>/);
}
for (const resource of ['samples/en-chat.jpg', 'samples/en-article.jpg']) {
  const response = await fetch(new URL(`/${resource}`, base), { method: 'HEAD', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, resource);
  assert.match(response.headers.get('content-type'), /^image\//);
}
const sitemapResponse = await fetch(new URL('/sitemap.xml', base));
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
assert.equal((sitemap.match(/<loc>/g) ?? []).length, 9);
assert.ok(sitemap.includes(`<loc>${site}/${comparison}</loc>`));
for (const route of ['', ...guides]) assert.ok(htmlByRoute.get(route).includes(`href="/${comparison}"`));
const article = htmlByRoute.get(comparison);
assert.match(article, /BreadcrumbList/);
assert.match(article, /not an independent review/);
assert.match(article, /No speed ranking/);
for (const file of ['keep-en-chat.raw.md', 'keep-en-article.raw.md', 'long2text-en-chat.preview.md', 'long2text-en-article.preview.md']) {
  const resource = `/research/screenshot-markdown-2026-09-12/${file}`;
  assert.ok(article.includes(`href="${resource}"`));
  const response = await fetch(new URL(resource, base), {signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, resource);
  assert.ok((await response.text()).length > 100);
}
for (const slug of guides) assert.ok(sitemap.includes(`<loc>${site}/${slug}</loc>`));
assert.ok(!sitemap.includes('<lastmod>'));
const robots = await (await fetch(new URL('/robots.txt', base))).text();
assert.ok(robots.includes(`Sitemap: ${site}/sitemap.xml`));
assert.ok(robots.includes('Disallow: /api/'));
assert.ok(robots.includes('Disallow: /history'));
const missing = await fetch(new URL('/seo-not-found-check', base));
assert.equal(missing.status, 404);
assert.match(await missing.text(), /<meta name="robots" content="noindex/);
const history = await fetch(new URL('/history', base));
assert.equal(history.status, 200);
assert.match(await history.text(), /<meta name="robots" content="noindex, nofollow"/);
console.log('PASS: guide discovery, examples, breadcrumbs, sitemap, robots, 404 and private history');
