# Growth analysis — acceptance envelope (2026-09-12)

This batch measures the **consenting visitor sample**, never all visitors or revenue.
No new consent banner, fingerprint, identity, screenshot text, filename, order ID,
raw error, arbitrary URL/query or full referrer may enter analytics. Respect prior
refusal, DNT/GPC, unavailable storage, private routes and explicit revocation.

## Required / owner / check

| Requirement | Implementation | Gate |
| --- | --- | --- |
| Nine public pages, no history/API | dc-analytics.js allowlist | VM negative tests + live browser |
| Fixed source/campaign enums, no arbitrary query values | consent-gated session attribution | injection, expiry, revoked-consent tests |
| Upload method, OCR outcome/duration band/failure stage | Converter + transmission allowlist | real component with controlled endpoints |
| Pricing/paywall visibility, login attempt/success | GrowthView + login marker | visibility, duplicate render, signed-out/in tests |
| Checkout attempt/start/failure; verified return distinct from revenue | Converter | failed API, successful redirect, existing payment gates |
| Copy success vs download initiated, preview/free/paid distinction | export events | clipboard/download checks |
| GA stream + event dimensions + reporting instructions | Long2Text-only configuration | UI readback and bounded diagnostic receipt |
| Preserve conversion, privacy, localization, SEO | existing application | unit/build/browser regression |

No OCR, price, database, Stripe/webhook or other-site tracking changes. No new
analytics vendor/account/API credential, no purchases. Do not invent all-user
conversion rates, historic attribution or real revenue from browser returns.

Only data loss, privacy leaks, wrong writes, core regressions and violations of
the table above block this batch. No speculative architecture extensions.
Freeze candidate, run a bounded full sweep, aggregate blockers before editing;
two rejection rounds trigger a root-cause review. Deploy via existing Git flow,
verify actual production assets and UI, leave reporting latency explicit.

GA baseline: stream Long2Text / G-CH4WNME765, enhanced measurement OFF;
no data in past 48h. Property is shared with other sites: no property-wide
tracking toggles or generic key-event changes that affect those sites.

## Event dictionary (measurement_version = 2)

| Event | Actual meaning | Extra dimensions |
| --- | --- | --- |
| page_view | An allowlisted public path was visited after consent | common context |
| pricing_view / paywall_view | Existing section became visible, once per mount/result | paywall: result_access=preview |
| upload_started | An image entered processing; not an HTTP upload receipt | input_method |
| ocr_completed / ocr_partial | Result assembled, with no failed / some failed slices | input_method, duration_bucket, result_access |
| ocr_failed | Processing failed | input_method, duration_bucket, failure_stage |
| login_started | Header/paywall initiated Google sign-in | entry_point |
| login_success | Authenticated return with a valid same-tab attempt marker, once | entry_point |
| login_failed | Client sign-in initiation rejected; NOT every OAuth cancellation | entry_point, failure_stage=login |
| checkout_clicked | Unlock was clicked, including before sign-in | common context |
| begin_checkout | Checkout API returned a redirect URL | common context |
| checkout_failed | Save/checkout initiation threw or returned an error | failure_stage=checkout |
| payment_verified | Existing server verification accepted a browser return | common context; NOT a purchase ledger |
| export_completed | Clipboard write completed | export_method=copy, result_access |
| download_started | Browser download initiated, NOT disk-save confirmation | export_method, result_access |

Common context: fixed site/product `long2text`, sanitized public path, page language,
`l2t_source`, `l2t_campaign`, `measurement_version=2`. No business/user IDs.
Duration is prepare → recognition → assembly, before optional background AI work:
`under_3s`, `3_10s`, `10_30s`, `30s_plus`. Access: `preview`, `free`, `paid`.
Input: `file`, `paste`, `drop`, `sample`. Failure: `prepare`, `recognize`, `assemble`,
`checkout`, `login`. Export: `copy`, `markdown`, `html`, `markdown_zip`.

## GA configuration and analysis recipes

Account Dark Constant / property Dark Constant Websites (553546602) is shared.
Long2Text stream ID: `15754313417`. Enhanced measurement stays OFF.
Nine event-scoped definitions were saved and read back in Admin → Custom definitions:
L2T source/campaign/result access/OCR duration/failure stage/input method/login
entry/export method/measurement version. Their parameters are the snake_case
names above. The existing twelve definitions were preserved.

Every business exploration must filter Stream ID = `15754313417` (or `site`
exactly `long2text`), L2T measurement version = `2`, and exclude L2T source = `qa`.
Use data from this release onward; custom definitions do not reconstruct history.
Do not treat the property's aggregate traffic as Long2Text traffic.

Recommended saved views (configuration recipes, not claims of available data):

1. **Activation, closed funnel:** `page_view` → `upload_started` →
   (`ocr_completed` OR `ocr_partial`) → (`export_completed` OR `download_started`).
   Indirectly followed steps; breakdown by L2T source, then device category.
   This is observable use, including preview exports, not successful full delivery.
2. **Paywall conversion, closed funnel:** `paywall_view` → `checkout_clicked` →
   `begin_checkout` → `payment_verified`. Do not force login as a mandatory step:
   already-signed-in users skip it. Separately inspect login_started → login_success.
   Payment return loss is possible even after actual payment; compare Stripe separately.
3. **Quality, free form:** rows Event name + L2T OCR duration, values Event count;
   filter OCR outcome events, split by input method. Inspect failure stage separately.
   Partial results are not failures or full successes. Duration bands do not yield P95.
4. **Output usefulness, free form:** rows L2T result access + L2T export method,
   values Total users and Event count, filter copy/download events. Full output means
   free or paid, never preview. Do not call download_started a completed disk save.
5. **Acquisition, free form:** rows L2T source + L2T campaign; values Total users,
   Event count; inspect activation funnel for the same source rather than dividing
   unrelated event counts. Use GSC separately for search impressions/clicks/pages.

Funnel users are browser-based consenting users, not people or accounts; this batch
does not join multiple devices or uploads by identifier. Never divide all-site GSC
clicks by opt-in GA conversions. Always show sample count alongside a rate.

## Campaign links

Only these exact source values are supported: `google`, `bing`, `reddit`, `discord`,
`telegram`, `x`, `github`, `newsletter`, `qa`, `direct_or_unknown`.
Campaign values: `launch`, `markdown_test`, `obsidian_guide`, `whatsapp_guide`, `none`.
Examples:

- `https://long2text.com/long-screenshot-to-markdown-test?utm_source=reddit&utm_campaign=markdown_test`
- `https://long2text.com/screenshot-to-markdown?utm_source=discord&utm_campaign=obsidian_guide`
- `https://long2text.com/chat-screenshot-to-text?utm_source=telegram&utm_campaign=whatsapp_guide`

Unknown, duplicated or arbitrary UTM values are discarded. Labels persist only after
consent within the tab, with a 30-minute validity period. Fixed Google/Bing and social
referrer hosts provide a fallback; unmapped regions/apps become direct_or_unknown.
No pre-consent session reconstruction. Diagnostic source `qa` also sets debug_mode.

## Weekly decision loop

Review the latest complete seven days against the previous seven, excluding QA.
First check volume and consent-sample limitations. Then ask:

- Search clicks but little measured activation: inspect landing relevance and sample bias.
- Uploads but few results: inspect failure stage and >30s bucket before changing pricing.
- Results but few full exports: inspect formatting/product usefulness and preview mix.
- Paywall views but little checkout: inspect price/value clarity and login friction.
- Checkout starts but few verified returns: compare actual Stripe payments before
  concluding payment failed. This batch cannot diagnose payment-provider declines.

Revenue, refunds, fees, chargebacks and repeat-paying-customer counts come from Stripe
or the first-party business ledger, never GA payment_verified. No revenue dashboard,
server purchase event, account cohort, API usage metering or cost ledger is added here.
Those are follow-ups requiring explicit data design, not hidden extensions of this batch.

## Verification and known limits

Local candidate: growth 12 tests, conversion 9, SEO 6, OCR 12 all pass; production
build and changed-file ESLint pass. Real built browser checks cover consent, DNT/GPC,
both privacy locales, article-to-converter navigation, input methods, duration/access,
visibility, login return, checkout failure/redirect, export semantics, verified payment
true/false, revocation, 320/390 px and desktop interactions. External endpoints are
controlled fixtures in these tests; they prove frontend wiring, not provider settlement.

Analytics is intentionally OFF for visitors who have not opted in. Therefore a quiet
GA report is not evidence of zero real visitors. No automatic consent UI was added.
Long sessions retain the existing 100-command cap; cold private-route entry may require
a full public-page load to initialize tracking. No exact latency or business-job IDs,
no account retention or user-level revenue attribution. New GA dimensions/reporting
need processing time. Production asset/transport receipt is recorded in the handoff.
