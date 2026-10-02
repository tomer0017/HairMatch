# Mobile UI refactor verification — 2026-10-02

## Restore point

Annotated tag `restore/pre-mobile-ui-2026-10-02` points to
`56d788bbe89affaf5cbc4d53dca6243289a8960f`. The working tree was clean before changes.

## Scope

Warm cream / black palette, Heebo headings and controls, compact preparation
checklist with outline icons, unchanged logo artwork, illustrated hair-length
choices, photographic angle references in place of the old cartoon instruction
icons, subtle per-angle camera outlines, confirmation controls below the photo,
and a two-column review with a full-width fifth card. Review actions remain in
normal flow and cannot cover cards. Safe-area padding and small viewport heights
are accommodated; pages scroll when necessary.

The back-photo example animation now waits until the additional-person popup is
dismissed, so the normal back guidance remains visible after that popup.

`src/App.tsx`, hooks, utilities, configuration, types, ShareActions, package files,
and Vite configuration are byte-for-byte unchanged from the restore tag. Capture
order, values, thresholds, storage, compression, camera handling, and native
sharing remain unchanged. No delivery-success screen was added.

## Checks

- Original and final `npm run build`: pass.
- `npm run lint` (TypeScript): pass. No existing test script/suite is configured.
- `git diff --check`: pass.
- Production output served through `npm run preview`.
- Chromium: entire five-photo flow with a synthetic canvas camera stream, real
  image-quality / face / lighting analysis, five separate review retakes, and
  native-share interception. Five expected file names and original Hebrew hair
  length reach the share call. No real photos were sent.
- Dark and overexposed synthetic frames disable capture. Valid detailed frames
  pass; an insufficiently detailed fixture was rejected as blurry.
- Back assistance dialog appears at photo 5 only; normal example animation plays
  after dismissal. Five review cards and their explicit retake buttons work.
- Refresh returns to onboarding, matching the original in-memory-only behavior.
- No uncaught page errors during the successful flow.
- WebKit and Chromium: 320×568, 375×667, 390×844, 430×932; RTL, no horizontal
  overflow, camera-denied error UI and return navigation pass.
- Visual review of production screenshots: intro, length selection, capture,
  confirmation, and review.

## Device-only checks

Desktop WebKit is not a physical iPhone. Real Safari camera permissions, front /
rear hardware behavior, browser chrome and safe-area interaction, and the native
WhatsApp share sheet must still be checked on the user's iPhone. Automated share
interception verifies the handoff payload, not delivery or native sheet behavior.

## Changed files

- `index.html`, `src/styles/global.css`
- `src/components/CameraCapture.{tsx,css}`, `FramingGuide.tsx`
- `src/components/LandingPage.{tsx,css}`, `PreparationIcon.tsx`
- `src/components/Questionnaire.{tsx,css}`
- `src/components/PhotoInstructions.{tsx,css}`
- `src/components/FinalReview.css`, `StepCard.css`, `ProgressBar.css`, `LightingStatus.css`
- `src/pages/CaptureFlow.{tsx,css}`, `src/pages/Review.{tsx,css}`
- `src/assets/hair-lengths/comparison.jpg` and its generation README
- This verification report

Deployment uses the existing `npm run deploy` / `gh-pages -d dist` workflow.
Expected URL: https://tomer0017.github.io/HairMatch/
