# Google Cloud Vision OCR

## Scope and acceptance

This change connects Google whole-image OCR to the existing converter, line
structure, correction and figure export interfaces. Required checks: coordinate
and confidence adapter tests; original-resolution upload and bounded oversized
tiling; provider rollback; sanitized failures and no Google automatic retries;
existing SEO/conversion tests; production build; browser upload to the real API.
No schema, payment, analytics, quota purchase or production credential changes
are part of the implementation. Hundred-user AI throughput is follow-up work.

## Configuration

Set server-only `GOOGLE_VISION_API_KEY` to a Vision-restricted Google Cloud key.
Never use a `NEXT_PUBLIC_` variable. The Google project must have Vision enabled
and billing linked. KeyKeeper supplies the local value to the child process only.

`OCR_PROVIDER=google` explicitly selects Google; `OCR_PROVIDER=tencent` rolls back
to the existing Tencent pipeline. If omitted, the server selects Google when its
key exists, otherwise Tencent. An explicit Google selection with no key fails
without calling Tencent. `GET /api/ocr` exposes only the selected provider, with
no cache. The client pins that choice on each upload; a configuration change
mid-operation returns 409 instead of silently routing to a different provider.

Deploy source only via GitHub master → the existing Vercel Git integration.
Do not run `vercel --prod` from a local worktree. This document does not mean
production environment variables have been configured or the code deployed.

## Image and result contract

- Google receives `DOCUMENT_TEXT_DETECTION` with request and response gzip,
  compact JSON and only `fullTextAnnotation` / error fields. Node fetch performs
  response decompression. Requests have a 45-second timeout and no retries.
- JPEG, PNG and WebP originals up to 4,000,000 bytes and 75 million pixels go
  through unchanged (EXIF orientation is normalized server-side when necessary).
- Larger browser images are divided at original resolution into overlapping
  JPEG parts (quality 0.92), each under 4 MB. This preserves resolution, not
  lossless encoding. Each part is a separate billed OCR unit. No persistent
  image storage is introduced. Unsupported animated/multi-page inputs fail.
- Client Google uploads use at most two concurrent parts per image, a 55-second
  request timeout and no automatic retries or confidence-based zoom passes.
  This is a per-browser bound, not an account-wide distributed rate limiter.
- Google symbols and break hints become visual line blocks. Coordinates remain
  in original pixels, zero omitted axes are restored, confidences are weighted
  by character count and scaled from 0–1 to 0–100. Missing confidence means
  uncertain (0). Unexpected rescaling or unusable geometry fails explicitly.
- Nearby same-row fragments are merged without combining distant columns or
  timestamp cells. Optional source paragraph IDs preserve English wraps when
  glyph bounding heights vary. Original coordinate rectangles remain intact;
  Tencent results have no paragraph hint and retain the existing grouping.
- Existing Tencent enhancement remains available only in Tencent mode. Its
  confidence thresholds have not been calibrated against Google. AI correction
  protections remain unchanged; fewer/more candidates are possible.

## Known limits

The earlier 100-image / 48.465-second result covered direct Google OCR with
fictional images, not website upload, figure analysis, AI or Vercel. No 100-user
end-to-end SLA is claimed. Google's names and punctuation are not guaranteed
better than Tencent. Real private screenshot comparison requires suitable
sample authorization. Provider outages are reported, not automatically sent to
another provider. Very wide/dense images may require user cropping. Package
fees and free AI concurrency remain separate from Google's per-image price.

Official references: [Vision API](https://docs.cloud.google.com/vision/docs/reference/rest/v1/images/annotate),
[annotation structure](https://docs.cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse),
[Vercel limits](https://vercel.com/docs/functions/limitations).

## Local verification — 2026-09-12

12 OCR tests, 5 SEO tests, 5 conversion/analytics tests, ESLint and the production
build passed. Real API browser smoke used the public fictional English chat and
a fictional 1012×36474 image. Each took one Google OCR POST. The final build showed
previews in 2.354 s and 4.990 s respectively on this Mac. The chat's real AI
correction request succeeded (no edit needed), and all five image descriptions
returned nonempty results. Desktop/mobile views, source-image toggle, copy,
output-mode changes, horizontal overflow and the English wrap regression passed.
Earlier public chat/article mobile smoke also passed. These are local production
build measurements, not measurements of deployed Vercel latency.
