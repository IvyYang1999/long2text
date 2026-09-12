# SEO conversion batch — 2026-09-12

## Frozen acceptance envelope

- Inspect the existing Search Console property, sitemap and three public URLs. Submit missing sitemap/indexing requests when available; report Google's pending state honestly. Google indexing itself is not a release gate.
- Both English guides reuse the real converter in place: upload, drag/drop, paste, processing, errors and exports. Keep one H1, static guide content and existing canonical/hreflang. Existing homepage, login and payment return behavior remain compatible.
- Show two complete existing public sample outputs with rendered preview, source Markdown and downloadable Markdown + images. Preserve recorded output; never pretend manual edits or cached timing are fresh OCR results. Do not publish user samples.
- Add an allowlisted, content-free conversion funnel to the existing GA stream. No screenshot text, file names, account/result/payment IDs or raw query strings. DNT/GPC and prior refusal override consent. No popup. Default off; an inline, voluntary preference on the bilingual privacy page is the only opt-in mechanism. The user's instruction to continue is not visitor consent.

## Not in this batch

New pricing, payment-method activation, OCR/model changes, new keyword pages, bulk content, paid links, a new analytics vendor, database migrations, or a promise of indexing/rankings. Analytics events are diagnostic, not a financial ledger.

## Gates and closeout

Only explicit acceptance failures, core regressions, data loss, secret/privacy leaks, unauthorized writes or unbounded resource use block release. First slice gets focused tests before adding the next capability. Freeze candidate, run unit/SEO tests + lint/typecheck/build + desktop/mobile browser checks. Deploy that candidate through the existing Git integration, then run final public smoke and verify deployment identity. Payment tests use controlled responses, not a live charge; real public-sample OCR verifies the new entry point.

## Evidence / known limits

- Candidate local acceptance: 5 existing SEO tests and 5 new conversion/analytics tests passed; changed-file ESLint and production build/typecheck passed. Production-server SEO smoke passed all 8 public routes, metadata, sitemap, resources and private-history noindex.
- Browser verification passed both guides at 1280/390/320px, keyboard focus, scrollable examples, complete Markdown/ZIP bytes, upload, clipboard, drag/drop, output copying/downloading and bounded errors. Bilingual inline preference toggles persist across reload, existing refusal and DNT/GPC remain off. Actual screenshots were visually reviewed, not committed.
- Controlled payment responses prove false does not emit success and confirmed true emits once per mounted result. No live charge or webhook verification was performed. The existing payment return goes to the homepage; attribution is therefore not a cross-page financial funnel. Reloads can count again; exports mean initiated export, not a confirmed disk write.
- Search Console showed sitemap submission success for https://long2text.com/sitemap.xml. The existing report had 6 discovered pages; the current sitemap has 8. Overview says processing; URL inspection attempts did not return a usable result. Submission is not proof of crawling/indexing. No repeated resubmission loop.
- The existing Long2Text GA stream's Enhanced measurement is off and it has zero connected site tags. Default-off analytics excludes non-consenting visits, so it cannot estimate total conversion rate. Events are allowlisted and bounded at 100 commands/document. No query/UTM or arbitrary referral collection.
- Sample output is the complete existing public recorded baseline, including recognition imperfections. Recorded 4s/5s OCR timings are not fresh measurements. Markdown/images were verified together; no actual Obsidian import was performed.
- An orphaned local dev server stopped responding during preference reload testing; it was stopped and the isolated production build passed the full browser sweep. Existing workspace-root and fallback metadataBase build warnings did not fail route metadata tests; they remain follow-up items.
- Deployment and unmocked public-sample production OCR are final gates; run `tests/public-ocr-smoke.mjs` with an explicit TEST_BASE_URL. It uses only existing public images in a fresh anonymous context and never checks out or enables analytics. Optional AI proofreading is disabled to isolate OCR. No personal screenshots or credentials belong in this document.
