import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

// Compile only the pure metadata/config modules; no application or credentials loaded.
function load(relative) {
  const file = resolve(import.meta.dirname, '..', relative);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (name) => name.startsWith('@/')
    ? load(`src/${name.slice(2)}.ts`)
    : name.startsWith('.') ? load(`${resolve(dirname(file), name)}.ts`)
    : (() => { throw new Error(`Unexpected runtime dependency: ${name}`); })();
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}

const { pageMetadata, SITE } = load('src/lib/seo.ts');
const { dicts } = load('src/lib/i18n.ts');

test('existing locale pages retain reciprocal canonicals and alternates', () => {
  for (const path of ['', 'privacy', 'terms']) {
    const en = pageMetadata(dicts.en, path);
    const zh = pageMetadata(dicts.zh, path);
    assert.equal(en.alternates.canonical, path ? `/${path}` : '/');
    assert.equal(zh.alternates.canonical, `/zh${path ? `/${path}` : ''}`);
    assert.deepEqual(en.alternates.languages, zh.alternates.languages);
  }
});

test('English-only guides never advertise nonexistent Chinese translations', () => {
  const result = pageMetadata(dicts.en, 'screenshot-to-markdown', { locales: ['en'] });
  assert.equal(result.alternates.canonical, '/screenshot-to-markdown');
  assert.deepEqual(result.alternates.languages, {
    en: '/screenshot-to-markdown', 'x-default': '/screenshot-to-markdown',
  });
});

test('private metadata remains noindex', () => {
  assert.equal(pageMetadata(dicts.en, 'history', { index: false }).robots.index, false);
});

test('sitemap includes both guides without inventing translations or modification dates', () => {
  const items = load('src/app/sitemap.ts').default();
  assert.equal(items.length, 9);
  assert.equal(new Set(items.map(item => item.url)).size, 9);
  for (const slug of ['chat-screenshot-to-text', 'screenshot-to-markdown']) {
    const item = items.find(item => item.url === `${SITE}/${slug}`);
    assert.ok(item, `missing ${slug}`);
    assert.equal(item.alternates?.languages?.['zh-CN'], undefined);
  }
  assert.ok(items.every(item => item.lastModified === undefined), 'omit lastmod unless tied to a content update');
  assert.ok(items.every(item => !item.url.includes('history') && !item.url.includes('/api/')));
});

test('comparison article is discoverable and honest about its evidence boundary', () => {
  const { comparison } = load('src/lib/seo-comparison.ts');
  const items = load('src/app/sitemap.ts').default();
  assert.ok(items.some(item => item.url === `${SITE}/${comparison.slug}`));
  const page = readFileSync(resolve(import.meta.dirname, `../src/app/(en)/${comparison.slug}/page.tsx`), 'utf8');
  assert.match(page, /not an independent review/);
  assert.match(page, /preview only/);
  assert.match(page, /not a leaderboard/);
  assert.match(page, /Unable to reach the AI service/);
  assert.match(page, /No speed ranking/);
  for (const name of ['keep-en-chat.raw.md', 'keep-en-article.raw.md', 'long2text-en-chat.preview.md', 'long2text-en-article.preview.md']) {
    assert.ok(readFileSync(resolve(import.meta.dirname, '../public/research/screenshot-markdown-2026-09-12', name), 'utf8').length > 100);
  }
});

test('www redirect is permanent, exact-host scoped and retains the path', async () => {
  const config = load('next.config.ts').default;
  assert.equal(typeof config.redirects, 'function');
  const redirects = await config.redirects();
  const rule = redirects.find(item => item.has?.some(h => h.type === 'host' && h.value === 'www.long2text.com'));
  assert.ok(rule);
  assert.equal(rule.permanent, true);
  assert.equal(rule.source, '/:path*');
  assert.equal(rule.destination, 'https://long2text.com/:path*');
});
