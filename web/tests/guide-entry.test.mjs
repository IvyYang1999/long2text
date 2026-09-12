import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('guide embeds the shared converter with no second hero or preview paywall', () => {
  const guide = read('components/ConversionGuide.tsx');
  assert.match(guide, /<Converter locale="en" embedded/);
  assert.doesNotMatch(guide, /Open the converter →/);
  assert.equal((guide.match(/<h1\b/g) || []).length, 1);
  const converter = read('components/Converter.tsx');
  assert.match(converter, /if \(embedded\)/);
  assert.match(converter, /aria-label=\{d.upload.button\}/);
});
