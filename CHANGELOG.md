# Changelog

All notable changes to Sentinel. Format loosely follows [Keep a Changelog](https://keepachangelog.com/); the log is maintained by hand.

## [Unreleased]

### Changed — three-way theme toggle (Light / System / Dark)

- **The binary light/dark toggle is replaced with a three-segment control:**
  Light, System, and Dark. "System" follows the OS `prefers-color-scheme`
  preference live via a `matchMedia` change listener — when the user switches
  their OS theme, the app updates immediately without a page reload. New users
  default to System. The init script (`layout.js`) was rewritten to handle
  three stored values: `"light"`, `"dark"`, and `"auto"` (or missing). The
  previous invisible-text bugs that caused OS-preference detection to be removed
  were fixed by the Phase 7 WCAG pass (darkened `--color-slate`, added
  `--color-teal-chip` / `--color-mismatch-chip` tokens), making auto-detection
  safe again. (`ThemeToggle.js`, `layout.js`)
- Settings label updated from "Dark mode" to "Theme" with description "Choose a
  theme or follow your system setting."
  (`src/app/(shell)/settings/page.js`)

### Changed — active TopBar state

- **Activity and Settings icons in the TopBar now show a teal highlight when
  on their respective pages**, replacing the identical appearance of all nav
  icons regardless of current route. The Home icon (visible only on module
  pages) stays neutral — it's a navigation action, not an indicator.
  (`src/components/TopBar.js`)

### Added — first-use welcome banner

- **A welcome banner appears on the home page for first-time users.** Shown
  only when the activity log is empty and the user hasn't dismissed it. Suggests
  four approachable starting modules (Password Generator, HIBP Breach Check,
  EXIF Metadata, QR Code) as clickable card rows with accent-colored icon
  chips. Dismissible via `preferences["welcome-dismissed"]` in IndexedDB — the
  banner won't reappear after dismissal even if the activity log is cleared.
  (`src/app/page.js`)

### Changed — micro-animations (targeted Phase 4)

- **Page content fades in on route change** via a `page-enter` CSS keyframe
  applied to the `PageShell` content column. The TopBar stays stable while
  content transitions.
  (`src/components/PageShell.js`, `src/app/globals.css`)
- **Result cards fade in when they appear** after a check, hash, or decode via
  a `result-reveal` keyframe on the root div of `ResultCard` and
  `GeneratorResultCard`.
  (`src/components/ResultCard.js`, `src/components/GeneratorResultCard.js`)
- **Welcome banner has a delayed entrance** (`welcome-appear` keyframe with
  0.1s delay) for a cascading effect after the page content.
  (`src/app/globals.css`)
- All animations are killed by the existing `prefers-reduced-motion` rule.
  Collapse/expand animation is intentionally avoided (the bugs that killed the
  original Phase 4).

### Changed — shared GuidedCard component

- **The guided empty-state card pattern (icon + heading + description) is
  extracted into `src/components/GuidedCard.js`**, replacing ~10 inline copies
  across clipboard, fingerprint, Base64, JWT Inspector, File Integrity, and QR
  Decode. The component accepts `icon`, `accent` (blue/rose/indigo/teal),
  `heading`, `description`, and optional `children` for action buttons.
  (`src/components/GuidedCard.js`)

### Added — cross-module links

- **Six modules now suggest companion tools** via inline teal links,
  following the pattern established by HIBP → Password Generator:
  - Guessability: "Generate a stronger password →" (shown when score ≤ 1)
  - Text Hash: "Need to hash a file instead? →"
  - File Integrity (Generate Hash): "Need to hash text instead? →"
  - Text Encryptor: "Generate a strong passphrase →"
  - EXIF: "See what your browser reveals too →"
  (`guessability/page.js`, `text-hash/page.js`,
  `file-integrity/GenerateHashTab.js`, `encryptor/page.js`, `exif/page.js`)

### Added — guided empty state cards

- **Base64, JWT Inspector, File Integrity (all three tabs), and QR Decode
  now show a guided card** when the user first lands on the page, explaining
  what the tool does and that everything runs client-side. This closes the
  gap where these modules presented raw inputs with no context. All 14
  modules now have either a rich guided idle state or a functional one.
  (`base64/page.js`, `jwt-inspector/page.js`,
  `file-integrity/GenerateHashTab.js`, `CompareHashTab.js`,
  `CompareFilesTab.js`, `qr/DecodeTab.js`)

### Fixed — welcome banner reappearing after clearing activity

- **Welcome banner no longer reappears after the activity log is cleared.**
  The previous implementation checked two independent async sources
  (`disabled-modules` isLoading + `fetchActivity()` result), creating a
  race condition where the banner could flash even after dismissal. The
  banner visibility is now derived directly from the `welcome-dismissed`
  preference — no activity fetch needed. (`page.js`)

### Added — activity log pagination

- **Activity log now paginates with configurable page sizes (25 / 50 /
  100) and numbered page navigation.** The pagination bar — page size
  selector, prev/next arrows, numbered page buttons, and ellipsis for
  large counts — is always visible when entries exist. The selected page
  size is persisted in IndexedDB via `usePreference` (key
  `activity.pageSize`, default: 50). Page resets automatically when the
  module filter or page size changes.
  (`activity/LogTab.js`)

### Added — command palette

- **Quick module navigation via a command palette** (⌘K / Ctrl+K or
  search icon in TopBar). A modal overlay with a search input and a
  filterable list of all available modules plus quick actions (Home,
  Activity, Settings). Keyboard navigable: arrow keys to move, Enter to
  go, Escape to close. Search matches module titles and descriptions
  with highlighted matches. The search icon in the TopBar provides a
  click/tap trigger for mobile users. The search input suppresses the
  browser focus ring (matching cmdk/shadcn/Linear/Raycast convention) —
  the modal backdrop + blinking caret communicate focus. (`CommandPalette.js`,
  `TopBar.js`, `layout.js`)

### Fixed — Global :focus-visible ring could not be overridden by Tailwind utilities

- **The global `:focus-visible` rule in `globals.css` was unlayered, which
  meant Tailwind utility classes like `focus:outline-none` had no effect** (CSS
  Cascade Layers: unlayered styles always beat `@layer utilities`). The
  command palette input's `focus:outline-none` was silently ignored, leaving
  a teal outline that clipped against `overflow-hidden` on the panel. Moved
  the global rule into `@layer base` so Tailwind utilities can override it
  where needed (command palette input). All other interactive elements are
  unaffected — no other component suppresses focus rings. (`globals.css`)

### Changed — removed home page hero search bar

- **The search bar embedded in the hero panel is removed.** The command
  palette (⌘K / Ctrl+K or TopBar search icon) is now the single search
  surface — it works from every page, not just home. Removing the hero
  search eliminates duplicate functionality and simplifies the landing
  page to: logo, tagline, and trust signal. (`src/app/page.js`)

### Changed — replaced decorative trust dots with trust badges

- **The animated pulsing dots in the hero are replaced with three compact
  trust badges**: "No server", "No account", "No tracking". The dots were
  decorative — they pulsed to suggest activity but conveyed no information.
  The badges are scannable, communicate the privacy model at a glance, and
  replace the verbose sentence that previously accompanied the dots. The
  `sentinel-pulse` keyframe, `.trust-dot` rules, and `TrustDots` component
  are removed. (`src/app/page.js`, `globals.css`)

### Changed — hero trust badges entrance animation and floating lock

- **Trust badges stagger in on page load** (fade + slide up, 50ms apart)
  to give the hero a moment of arrival. The existing lock watermark SVG
  now drifts gently (8s cycle, 3px amplitude) to keep the hero from
  feeling dead. Both animations are killed by `prefers-reduced-motion`.
  (`src/app/page.js`, `globals.css`)

### Changed — cursor-following hero spotlight

- **The hero panel reacts to the cursor** with a subtle radial gradient
  spotlight (600px radius, 7% white opacity). A throttled `mousemove`
  listener sets CSS custom properties `--mx`/`--my` that position the
  gradient center. Defaults to 50%/50% (center) before the mouse enters.
  Skipped entirely when `prefers-reduced-motion: reduce` matches.
  (`src/app/page.js`, `globals.css`)

### Fixed — File hashing blocked by the production CSP (hash-wasm WASM compilation)

- **File integrity / text hash worked in dev but failed on Vercel with
  `WebAssembly.compile()` rejected by `script-src`.** hash-wasm instantiates
  its WASM by decoding base64-inlined bytes and calling
  `WebAssembly.compile`/`instantiate` (`hash-wasm/dist/index.esm.js`) — no
  `wasm-src` involved, but CSP gates WASM compilation on `script-src`.
  Dev mode only had `'unsafe-eval'` (React's dev-mode eval), so it worked
  locally while production (`script-src 'self' 'unsafe-inline'`) had neither
  grant. `script-src` now includes `'wasm-unsafe-eval'` — the minimal source
  for compiling WASM bytes — in both modes; broad `'unsafe-eval'` stays
  dev-only. (`next.config.mjs`)

### Fixed — Activity daily chart bucketed by UTC instead of the user's local day

- **The 14-day chart (and the "Active days" stat) counted UTC calendar days,
  not the days the user actually experiences.** Bucketing sliced the UTC ISO
  string (`toISOString().slice(0,10)`) and anchored the window / "today" at
  UTC midnight, so in any timezone east of UTC an action taken between local
  midnight and the UTC rollover landed in **yesterday's** bar, and the chart's
  "today" bar was itself labeled a day behind until late morning. The day
  boundary is now the user's **local** midnight: `buildDailySeries` and
  `activeDays` convert each record to a local day key
  (`toLocalDayKey`, via the runtime's `getFullYear`/`getMonth`/`getDate`), and
  `SummaryTab`'s day labels are built from a local-midnight `Date` instead of
  `T00:00:00Z` (which renders the previous date in timezones west of UTC).
  (`src/lib/activityStats.js`, `src/app/(shell)/activity/SummaryTab.js`)
- **The tests now pin `process.env.TZ` (Asia/Kolkata) and carry a regression
  case** for the reported symptom: an action at 00:30 IST must land on the
  "today" bar while one at 23:30 IST the same UTC day lands on yesterday —
  both previously collapsed into one UTC bucket. (17 → 18 tests.)
  (`src/__tests__/activityStats.test.js`)
- This is aggregation logic, not a rendering bug — a chart library would not
  have changed the bucketing (and Recharts remains fragile on React 19.2.x).

### Added — Activity Summary tab (feature work)

- **The Activity page is now two tabs: Log + Summary.** The page is a thin
  shell (`src/app/(shell)/activity/page.js`) that fetches the activity
  records once and owns the shared error/retry/delete state; the panels are
  co-located `LogTab.js` (the existing log panel, moved verbatim) and
  `SummaryTab.js` (presentational). Deleting an entry just filters the
  in-memory array — the Summary recomputes automatically, so the two tabs
  can never disagree. (`src/app/(shell)/activity/`)

- **Stats are derived from the log records — one source of truth, no DB
  changes.** `recordsToStats()` in `src/lib/activityStats.js` maps the same
  `getAllActivity()` records the Log tab renders into the `{ moduleTypes,
  createdAts, total }` shape that `computeActivityStats()` and
  `buildDailySeries()` aggregate. This deliberately replaces an earlier
  design that added IndexedDB v3 indexes for key-only queries: the indexes
  introduced a migration surface (and a wrong-keyed-index bug) for a store
  holding dozens of records, so the whole approach was scrapped and rebuilt
  without touching `db.js` at all (still v2). `toISOKey` normalization is
  kept — legacy records may hold `Date`/timestamp `created_at` values.

- **Summary shows lifetime totals and two hand-rolled charts — no chart
  library.** Recharts is still fragile on React 19.2.x and a canvas library
  is poor for this app's dark-mode/a11y needs, so the bars and donut are
  plain divs and SVG (inline `var(--color-accent-*)` styles, permitted by
  the existing CSP; donut via `stroke-dasharray` on a `r=15.9155` circle so
  the circumference is exactly 100). Bars grow in via a `stats-bar-grow`
  keyframe, auto-disabled by the existing `prefers-reduced-motion` rule. The
  daily chart shows a "No activity in the last 14 days" note instead of a
  blank row when the window has no counts. (`SummaryTab.js`, `globals.css`)

- **Deterministic, unit-tested stats math.** `recordsToStats`,
  `computeActivityStats`, and `buildDailySeries` are pure functions with an
  injected `now`, so date boundaries are testable regardless of when the
  suite runs. Unknown/retired modules with activity stay counted in the
  total but are excluded from the per-module breakdown; the
  available-modules denominator counts `status === "available"` only. 17
  tests. (`src/__tests__/activityStats.test.js`)

### Fixed — Summary chart tracks invisible in dark mode

- **The donut's empty-section track blended into the card in dark mode.**
  The track used `slate-light`, which is `#1e2730` in dark mode — nearly
  identical to the `#1d2733` surface it sits on. All three track visuals
  (donut stroke, per-module bar tracks, daily-chart zero-day marks) now use
  translucent `slate/30`, which reads clearly against the dark surface
  while staying subtly grey in light mode. (`SummaryTab.js`)

### Changed — Activity Summary is the default tab

- **The Activity page now opens on the Summary tab**, with Log second — the
  aggregate overview leads, matching the app's explain-first ethos; the
  detailed Log stays one click away. Tab order, the default `activeTab`,
  and the panel DOM order all move together (the Tabs component roves
  `tabIndex`/arrow-keys by array order). The page header was retitled
  "Activity Log" → "Activity" so the title matches the new primary view.
  (`src/app/(shell)/activity/page.js`)

### Fixed — Fingerprint activity double-logged on page open

- **Passive collection now runs on a button press, not on mount.** The
  Passive tab auto-collected (and auto-logged) browser data from a mount
  `useEffect`; under React StrictMode (on by default in `next dev`) the
  effect runs twice, so simply opening the module logged **two** activity
  entries. The tab now uses the same `idle → loading → done | error` state
  machine as the Permission-Gated sections — the user clicks "Collect
  browser data", and each press logs exactly once. It was the only
  `saveActivity` call site in the app firing from an effect; all others are
  click handlers. (`src/app/modules/fingerprint/page.js`)
- **Geolocation and Media sections now log outcome-only.** The two
  Permission-Gated sections previously logged nothing at all. Each now
  records a coarse entry on button press: `{ granted, highAccuracy,
  errorType }` for geolocation and `{ granted, errorType, deviceCount }` for
  media — never coordinates or device labels, consistent with the privacy
  invariants. (`src/app/modules/fingerprint/page.js`)

### Fixed — Clipboard Inspector "Read again"

- **"Read again" now actually re-reads the clipboard** — the button called
  `handleReset()`, which reset to the idle state and showed the initial "Read
  clipboard" button again instead of performing a second read. It now calls
  `handleRead()` directly; the dead `handleReset` was removed.
  (`src/app/modules/clipboard/page.js`)

  Re-reads happen in place: the result card stays mounted and the button is
  disabled with a "Reading…" label while the clipboard is being read again,
  avoiding the flash that a `loading`-state transition caused (the result card
  briefly unmounted/remounted and `TextOutput`'s internal state reset).

### Changed — UI/UX audit pass follow-up

- **`--color-teal-chip` / `--color-mismatch-chip` are now real utilities** —
  the two contrast tokens were declared in `:root`/`.dark` but never mirrored
  into the `@theme inline` block, so Tailwind v4 never generated
  `text-teal-chip`/`text-mismatch-chip` and every element using them was
  silently inheriting instead of using the computed-contrast value. Caught in
  the code review that followed the refactor pass; the mirror lines were added
  alongside the other tokens and confirmed in the emitted CSS.
  (`src/app/globals.css`)

### Changed — shared component refactor pass

- **`AlgorithmPicker` extracts the duplicated algorithm selector** — the
  byte-identical standard-list + legacy-toggle block (constants + ~45 lines of
  JSX each) that lived in both the file-integrity and text-hash modules now
  lives once in `src/components/AlgorithmPicker.js`, driven by the existing
  controlled `selected`/`onToggle` props plus `open`/`onOpenChange` so the
  file-integrity form can still collapse the legacy section on reset. The
  toggle also gained `aria-expanded`/`aria-controls` (previously missing).
  (`src/components/AlgorithmPicker.js`, `file-integrity/GenerateHashTab.js`,
  `text-hash/page.js`)
- **`TextOutput` unifies the three readable-output boxes** — the encryptor's
  `DecryptedOutput`, base64's `DecodedOutput`, and the clipboard's
  `ContentPreview` were the same bordered label + Copy button + surface box;
  they now share `src/components/TextOutput.js` (`label`, `mono`, `maxChars`
  for the clipboard's truncation/show-more, plus class overrides). Each module
  dropped its now-unused lucide `Copy`/`Check` and `useCopyToClipboard`
  imports. (`src/components/TextOutput.js`, `encryptor`, `base64`, `clipboard`)
- **Hand-rolled copy buttons replaced with `CopyButton`** — ResultCard's
  `DetailRow` and text-hash's `HashRow` each carried a near-identical icon
  copy button; `CopyButton` gained optional `className` and `onCopy` props so
  both now reuse it. (`src/components/CopyButton.js`, `src/components/ResultCard.js`,
  `text-hash/page.js`)
- **`InlineError` standardises the error paragraphs** — the roughly dozen
  hand-repeated `<p className="text-mismatch text-sm">` sites (with drifting
  margins) now render `src/components/InlineError.js`, keeping their per-site
  `className` override for spacing. (`src/components/InlineError.js`, across
  file-integrity, text-hash, totp, base64, hibp, encryptor, qr, passphrase,
  clipboard, activity pages)
- **`Disclosure` centralises the accordion pattern** — guessability's "More
  detail", the password generator's "Advanced options", and the EXIF removal
  guides now share `src/components/Disclosure.js`, which centralises the
  `aria-expanded`/`aria-controls`/`useId` wiring (and adds the missing
  `aria-controls` to guessability and the password generator). The Activity
  row expand button keeps its bespoke layout but gained `aria-controls` via
  `useId` to match. Bespoke toggles (EXIF metadata headers, fingerprint
  full-card collapse, info buttons, QR show/hide) were left alone.
  (`src/components/Disclosure.js`, `guessability`, `password-generator`,
  `exif`, `activity` pages)
- **PasswordField show/hide now announces its state** — the mask toggle gained
  `aria-pressed`, matching the Wi-Fi tab's toggle fixed in the earlier NIT
  pass. (`src/components/PasswordField.js`)
- The five label/value row components (ResultCard `DetailRow`, text-hash
  `HashRow`, EXIF `FieldRow`, fingerprint `DataTable`, JWT `Field`) remain
  separate by design — their padding, borders, and placeholder handling differ
  in ways a merged `KeyValueRow` would risk in the dense tables.

### Changed — UI/UX audit pass

- **`--color-slate` now clears WCAG AA for normal text** — light mode darkened
  `#7a8899` → `#58687a` (≈5.3:1 on paper, 4.6:1 on slate-light) and dark mode
  lightened `#576878` → `#8a9bb0` (≈5.4:1 on surface). This lifts the app's
  dominant secondary-text color above the 4.5:1 threshold. (`src/app/globals.css`)
- **New `--color-teal-chip` token for small text on teal-light surfaces** —
  light `#256b6e` (≈4.98:1 on teal-light), dark reuses the interactive teal
  value. Applied to strength/verdict chips, EXIF severity + icon chips, the
  fingerprint selected-toggle labels, the Activity filter chip, and the teal
  fallback accent. Interactive teal is unchanged. (`src/app/globals.css`,
  `src/components/GeneratorResultCard.js`, `src/components/ResultCard.js`,
  `src/lib/moduleAccents.js`, EXIF/fingerprint/activity pages)
- **Light-mode `--color-fallback` darkened** `#b08030` → `#7f5c1a` — the "Fair"
  strength / medium-risk chip text was 2.99:1; now ≈5.1:1 on fallback-light
  and ≈4.9:1 on the generator output surface. (`src/app/globals.css`)
- **"Soon" chip uses full slate** — dropped the `text-slate/70` opacity on the
  home-page coming-soon label. (`src/app/page.js`)
- **Tabs are now real WAI-ARIA tabs** — `role="tablist"`/`role="tab"`,
  `aria-selected`, `id`/`aria-controls` pairs, roving `tabIndex`, and
  Left/Right/Home/End keyboard navigation; each page's panels gained matching
  `id`/`role="tabpanel"`. (`src/components/Tabs.js` + encryptor, file-integrity,
  fingerprint, qr, base64 pages)
- **ResultCard explanation id is unique per card** — the hardcoded
  `result-card-explanation` (duplicated 6× on the Fingerprint passive tab) is
  now `useId()`, so `aria-controls` points at a real, unique element.
  (`src/components/ResultCard.js`)
- **Generator sliders debounce their IndexedDB writes** — password and
  passphrase generators pass `{ debounceMs: 300 }` to `usePreference`, matching
  the hook's documented guidance for sliders. (`src/app/modules/password-generator/page.js`,
  `src/app/modules/passphrase-generator/page.js`)
- **Missing `aria-expanded` added** to the fingerprint CollapsibleCards, EXIF
  RemovalGuide accordions, TOTP show/hide QR, and the password generator's
  "Advanced options" disclosure (with `aria-controls` + `useId` where the
  component renders multiple instances). (`fingerprint`, `exif`, `totp`,
  `password-generator` pages)
- **Larger tap targets** — icon-only copy buttons (CopyButton, ResultCard
  DetailRow, text-hash HashRow) gained `p-2` padding, help toggles grew from
  `size-5` to `size-7`, and the TopBar nav icons went `p-2` → `p-3`.
  (`src/components/CopyButton.js`, `src/components/ResultCard.js`,
  `src/app/modules/text-hash/page.js`, `src/components/TopBar.js`)
- **Faint secondary labels bumped to `text-slate`** — TOTP's non-hero "Copy"
  link (`slate/60`) and EXIF's "Not found" (`slate/50`) no longer sit below
  usable contrast. (`totp`, `exif` pages)
- **New `--color-mismatch-chip` token for text on mismatch-light surfaces** —
  light `#ae4040` (≈4.80:1 on the tint vs 4.46:1 before), dark reuses the
  mismatch value. Applied to the strength chip, verdict chip, passphrase
  error banner, EXIF high-risk label/icon chips + "Copy coordinates" button
  + error block, the Activity error banner, and the guessability worker
  error. Plain `text-mismatch` on white/paper verdicts is unchanged and
  still passes. (`src/app/globals.css`, `ResultCard`, `GeneratorResultCard`,
  `passphrase-generator`, `exif`, `activity`, `guessability`)
- **`prefers-reduced-motion` now covers all decorative motion** — the reduce
  block kills transitions and one-shot hover lifts/active scales (card rise,
  button shrink) in addition to the trust-dot pulse. (`src/app/globals.css`)
- **Settings "Reset" buttons disambiguated** — the preference-reset and the
  nuke-everything actions are now labelled "Reset settings" and "Reset
  everything" instead of two identical "Reset" buttons with different blast
  radius. (`src/app/(shell)/settings/page.js`)
- **Hero trust line is now precisely scoped** — "Passwords and files never
  leave your device — one anonymous hash check is the only exception",
  surfacing the HIBP k-anonymity call on the home screen instead of letting
  it sit adjacent to an absolute claim. (`src/app/page.js`)
- **PageHeader comment drift fixed** — the note now says TopBar renders the
  Home link, not a "back-chevron". (`src/components/PageHeader.js`)

### Changed — review NIT cleanup

- **GeneratorResultCard JSDoc completed** — the dangling "see original for full
  JSDoc" reference is replaced with real prop documentation. (`src/components/GeneratorResultCard.js`)
- **Card shadow now uses the shared utility** — settings pages replaced the
  inline `style={{ boxShadow: "var(--shadow-card)" }}` with the `shadow-card`
  class used everywhere else. (`src/app/(shell)/settings/page.js`,
  `src/app/(shell)/settings/modules/page.js`)
- **Wi-Fi password toggle is properly announced** — the Show/Hide button in the
  QR Wi-Fi tab now has `aria-label` and `aria-pressed`. (`src/app/modules/qr/WiFiTab.js`)
- **Activity filter is labelled** — the module filter `<select>` on the Activity
  page has an accessible name. (`src/app/(shell)/activity/page.js`)
- **Relative timestamps clamp negative deltas** — a backwards system clock can
  no longer render future-dated entries as "-5m ago"; anything past-or-future
  within rounding shows "just now". (`src/app/(shell)/activity/page.js`)
- **CSP `font-src` tightened** — dropped the unused `https://fonts.gstatic.com`
  grant; `next/font` self-hosts at build time, so `font-src 'self'` suffices.
  (`next.config.mjs`)
- **Activity page indentation** — the page fragment's JSX re-indented from an
  8-space to the standard 6-space depth. (`src/app/(shell)/activity/page.js`)

### Changed — first-commit baseline review

- **QR decode hardening** — `analyzeQRContent` now classifies only `http:`/
  `https:` as URLs; anything else that parses as a URL (`javascript:`, `data:`,
  `file:`, …) falls through to plain text, so the Decode tab never renders a
  clickable "Open" link for a non-web scheme. (`src/lib/qr.js`)
- **CSP hardening** — added `object-src 'none'`, `base-uri 'none'`, and
  `form-action 'none'` to the Content-Security-Policy. (`next.config.mjs`)
- **Fingerprint activity count derived, not hardcoded** — `passiveDataPoints`
  is now computed from the collected data via a shared `countDataPoints()`
  helper used by both the summary banner and the activity log, so the two
  can't drift apart (previously a hardcoded `18`). (`src/app/modules/fingerprint/page.js`)
- **Guessability worker error handling** — the worker now catches analysis
  failures and posts a structured `{ error }` message, and the page surfaces it
  cleanly instead of relying solely on `worker.onerror`.
  (`src/app/modules/guessability/guessability.worker.js`, `…/guessability/page.js`)
- **Naming/consistency** — Base64 decode-error sentinel renamed `invalid` →
  `INVALID_BASE64` (matches the encryptor's `MALFORMED`/`DECRYPT_FAILED`
  convention); package renamed `frontend` → `sentinel`; README's File
  Integrity blurb now lists all five algorithms (MD5, SHA-1, SHA-256,
  SHA-384, SHA-512).
- **Tests** — new `exif` suite (privacy flags + display formatters) and a
  `contentAnalysis` case pinning the non-web-scheme fallthrough; **173 tests
  total** (was 159 before this review round). The exif suite also caught and
  fixed a latent `privacySummary` gap: `!== null` treated an `undefined` field
  as present, so an empty device/timestamp group would have been logged as
  having a serial or timestamps.
- **Fingerprint activity log no longer stores a canvas-hash prefix** — removed
  `canvasHashPrefix` (first 8 hex chars of the canvas fingerprint hash) from
  the `saveActivity` details; a truncated digest of a device-identifying signal
  is still a digest, which the privacy invariant bans. The full hash is still
  shown and copyable on screen, just never persisted.
  (`src/app/modules/fingerprint/page.js`)
- **CSP `worker-src` tightened** — dropped the unused `blob:` grant; both
  workers load as same-origin script files (`new URL(..., import.meta.url)`),
  so `worker-src 'self'` suffices. (`next.config.mjs`)
- **SMS classification narrowed** — `/^sms(t|to)?:/i` also matched the
  nonexistent `smst:` scheme; now `/^(sms|smsto):/i` with a regression case.
  (`src/lib/qr.js`, `src/__tests__/contentAnalysis.test.js`)
- **Docs reconciled with code** — per-module `Accent:` lines in
  `PROJECT_OVERVIEW.md` corrected to the canonical `modules.js` values (EXIF/QR
  `amber`, Encryptor/Fingerprint/Clipboard `violet`); settings paths fixed for
  the `(shell)` route group; the Reset section now documents all three
  affordances. Node minimum in README raised to **20.9+** (Next 16 requires
  it) with a matching `engines` field in `package.json`.
- **Tests** — `smst:` regression case added to `contentAnalysis.test.js` for
  the SMS-regex fix above; **174 tests total** across 12 files.

### Changed — baseline hardening (Round 5)

- **TOTP logs at the meaningful actions only** — no longer logs when a pasted
  secret first parses; it logs on copy ("Copied a TOTP code") and on random
  secret generation, with coarse `source` metadata only (`otpauth`/`raw`/
  `random`) — never the secret, code, or issuer. Matches the Password
  generator's "log at copy" convention. (`src/app/modules/totp/page.js`,
  `src/lib/totp.js`)
- **Pure logic extracted from three module pages** for unit testing:
  `src/lib/base64.js` (`toBase64`/`fromBase64`), `src/lib/jwt.js`
  (`decodeSegment`/`parseJWT`/`formatTimestamp`/`relativeTime`), and
  `src/lib/totp.js` (`parseTOTP`/`generateRandomSecret`). Pages otherwise
  unchanged.
- **TOTP random secrets are now genuinely 160-bit** — `generateRandomSecret`
  previously produced a 20-char (100-bit) secret despite its comment claiming
  160; it now draws 32 bytes → 32-char Base32, bias-free. (`src/lib/totp.js`)
- **QR content analysis fixed: prefix formats beat the URL branch** —
  `analyzeQRContent` checked the URL case first, and WiFi / vCard / mailto /
  SMS payloads all parse as URLs, so those branches were dead code — a WiFi QR
  was classified as a URL. Prefix checks now run first; the SMS regex also
  accepts plain `sms:` in addition to `smsto:`. (`src/lib/qr.js`)
- **Tests** — `base64`, `jwt`, `totp`, and `contentAnalysis` suites added;
  **152 tests total** (was 95). The contentAnalysis fixtures surfaced the QR
  prefix bug above. (`src/__tests__/`)
- **Fingerprint geolocation copy escaped** — an unescaped apostrophe
  (`react/no-unescaped-entities`) fixed; lint is now **7 errors / 0
  warnings**, all pre-existing `react-hooks/set-state-in-effect`.
  (`src/app/modules/fingerprint/page.js`)

### Changed — pre-commit scan follow-ups

- **Fingerprint passive collection no longer hangs the tab** — a rejected
  `collectPassive()` now clears the loading state and shows "Could not collect
  browser data." instead of spinning forever. (`src/app/modules/fingerprint/page.js`)
- **Reset no longer surfaces unhandled IDB rejections** — `deletePreference`
  is caught in the Password and Passphrase generators' reset handlers.
  (`src/app/modules/password-generator/page.js`,
  `src/app/modules/passphrase-generator/page.js`)
- **Theme toggle tolerates unavailable storage** — `localStorage.setItem` is
  guarded, matching the init script; the theme still applies for the session.
  (`src/components/ThemeToggle.js`)
- **Docs/tree accuracy** — `PROJECT_OVERVIEW.md`'s frontend tree corrected for
  the `(shell)` route group, missing components (`ModuleCard`, `PageShell`,
  `ScrollToTop`) and module files (`HashProgress.js`, QR tabs +
  `generateOptions.js`); stale "nine hues" comment in `moduleAccents.js`
  corrected to eight.

### Changed — lint baseline reduced (7 → 2)

The five low-risk `react-hooks/set-state-in-effect` errors are fixed by
deferring the synchronous `setState` into a 0ms callback — behavior-identical,
no UI change:

- **TOTP ticking clock** — the first `refresh()` now fires via
  `setTimeout(refresh, 0)` beside the `setInterval`; both are cleaned up on
  unmount. (`src/app/modules/totp/page.js`)
- **Password generator** — the recompute-on-options effect body runs in a
  `setTimeout(0)` with cleanup; the mount result and per-option regeneration
  are unchanged. (`src/app/modules/password-generator/page.js`)
- **Text hash** — clearing the input invalidates any in-flight compute
  (`requestRef`) before deferring the `setResults(null)` / `setError(null)`,
  which also removes a latent stale-result race. (`src/app/modules/text-hash/page.js`)
- **QR generator** — the reset-to-idle `setState` is deferred by 0ms; the
  imperative canvas clear stays synchronous. (`src/app/modules/qr/generateOptions.js`)
- **EXIF preview** — `setUrl` is deferred by 0ms after `URL.createObjectURL`;
  the revoke-on-cleanup is unchanged. (`src/app/modules/exif/page.js`)

The remaining baseline is **2 errors / 0 warnings**, both
`react-hooks/set-state-in-effect`: `usePreference.js` (the core persistence
hook — the derived-`isLoading` refactor is deferred until it can be
unit-tested) and `settings/page.js` (the post-hydration `?reset=` banner — a
synchronous read of a URL param, the correct shape there).

### Changed — guessability clarity (score unchanged)

- **Guessability explains a zxcvbn blind spot instead of silently inheriting
  it** — the score still comes straight from zxcvbn-ts (verified identical to
  the reference dropbox zxcvbn on a shared sample set), but the result now
  surfaces the dictionary words zxcvbn actually matched (`matchedWords`,
  shown in the detail section) and, when the password is a short (2-3 word)
  all-lowercase phrase of common words, shows a note that the estimate can
  overstate how long a well-known phrase takes to guess. This is the
  growing-sequence floor in zxcvbn's search (`10000^(submatchCount - 1)`)
  pushing e.g. "hello world" onto the score-3 "Good" band even though its
  words rank ~50-100. (`src/lib/guessability.js`,
  `src/app/modules/guessability/page.js`)
- **Tests** — `guessability.test.js` added (7 tests): matched-word surfacing,
  phrase-note flagging (and non-flagging of four-word passphrases, single
  words, and mixed-case), and the reference-behavior scores. **159 tests
  total** (was 152). (`src/__tests__/guessability.test.js`)

### Docs — git-readiness

- `AGENTS.md` gains a "Version control" section (conventional-style commit
  messages, commit only when asked, never commit secrets) and the module-set
  note (14 modules / 4 categories). The "no git repo" claim is gone from
  `AGENTS.md`, and the "Git repository (deliberately deferred)" item is
  removed from `docs/PROJECT_OVERVIEW.md`.
- `docs/PROJECT_OVERVIEW.md` adds detailed status sections for the four
  Developer Tools modules (text-hash, base64, JWT inspector, TOTP), fixes the
  Guessability status (button-triggered, 128-char cap, Web Worker), fills the
  missing `lib/` and module entries in the frontend tree, and records a
  documentation policy: review-pass documents (`CODE_REVIEW.md`,
  `CLAUDE_REVIEW_00.md`, `CLAUDE_REVIEW_01.md`) and the module-ideas
  backlog (`MODULE_IDEAS.md`) stay in `docs/internal/` (gitignored, never
  committed); UI/component tests are deliberately not implemented.

### Changed — review follow-ups (third review pass)

- **QR activity logging coalesced** — `useQRGenerator` (`src/app/modules/qr/generateOptions.js`) now logs using the same pattern text-hash does: keyed on `subType` + an 8-char length bucket + a 30s window. Colour/error-correction tweaks and same-bucket keystrokes no longer spam the activity feed; `contentLength` stays exact, matching text-hash's `charCount`.
- **QR decode now distinguishes corrupt files** — `decodeQR` (`src/lib/qr.js`) pre-validates the upload with `createImageBitmap` and returns `IMAGE_ERROR` (mapped to the existing "Couldn't read image" message). Previously a corrupt upload sat in @zxing/browser's 10s image-load timeout and surfaced as the misleading "Decoder unavailable" (`LIBRARY_ERROR`).
- **Home screen no longer flashes disabled modules** — `src/app/page.js` gates the search-results, category-grid, and no-results blocks behind `isLoaded`, so disabled modules don't flash visible for a tick while `disabled-modules` resolves from IndexedDB (the flag was dead code; the gate was already documented in `PROJECT_OVERVIEW.md`).
- **FileInput re-selection works** — the hidden `<input type="file">` clears its value after each selection, so re-picking the *same* file re-fires `change` instead of silently doing nothing (e.g. re-verifying a file after Reset). (`src/components/FileInput.js`)
- **DragGuard no longer blocks text drag-and-drop** — `preventDefault()` now only fires when the drag carries files (`dataTransfer.types` includes `Files`), so dragging text into inputs/textareas keeps the browser's native insert behaviour while stray file drops still can't navigate away. (`src/components/DragGuard.js`)
- **Password-generator dead mount effect removed** — the `[]`-deps effect was immediately overwritten by the `[options]` effect's initial run (both deferred post-hydration), so it was deleted. This also dropped one pre-existing `set-state-in-effect` lint error — baseline is now **8 errors / 0 warnings**. (`src/app/modules/password-generator/page.js`)

### Changed — file-integrity

- **Primary buttons now use `<Button loading>`** — the raw inline-class Compute/Compare buttons in `GenerateHashTab.js`, `CompareHashTab.js`, and `CompareFilesTab.js` are replaced with the shared component, so they get the same accessible loading label (`"Computing..."/"Comparing..."`) HIBP/EXIF already have. Completes Round 2's "all module pages use `<Button>`" claim; the QR Download PNG button remains the documented exception.
- **Fallback commands stay visible while hashing** — the terminal-command suggestion used to unmount the moment hashing started (gated on `!isComputing`/`!isComparing`) and reappear only when it finished. The gate is removed; the commands now persist next to the progress bar for the whole compute — exactly when the alternative is most useful.

### Added — passwordGen + wordlist test coverage

- `src/__tests__/passwordGen.test.js` — charset building (ambiguous/custom exclusions), `secureRandomInt` rejection-sampling boundary (deterministic via a mocked `crypto.getRandomValues`), Fisher–Yates permutation determinism, unconstrained + inclusion-exclusion entropy (hand-verified small cases), generator invariants and error paths.
- `src/__tests__/wordlist.test.js` — `parseWordlist` contract (blank lines, CRLF, case-insensitive dedup keeping first casing), `validateWordlist` thresholds (128/1024) + duplicate-ratio escalation, entropy math, `strengthLabel` boundaries, `generatePassphrase` (deterministic draws, separators, case transforms, error paths).
- 95 tests total (was 51 at the last review).

### Changed — activity filter affordance

- The Activity page toolbar now always shows an entry count ("12 entries", or "Showing 3 of 12 entries" when a filter is active), and a filtered view gets a persistent teal chip with the module's icon + label and an × button to clear it — making it explicit that a subset is being viewed. (`src/app/(shell)/activity/page.js`)

### Added — HIBP request transparency

- The HIBP page now shows the exact 5-character SHA-1 prefix (and the resolved `api.pwnedpasswords.com/range/<prefix>` URL, which is also clickable to open the queried range in a new tab) that will be sent, updating live as the password is typed — before "Check password" is clicked. Display-only by design: the prefix is never written to the activity log (the "never even a hash of it" invariant still applies to what's stored). (`src/app/modules/hibp/page.js`)

### Fixed — review follow-ups (second review pass)

- **Settings "clear activity" success banner leaked its 4s timer** — `return () => clearTimeout(timer)` inside an async handler was a no-op. The timer now lives in a ref and is cleared on unmount. (`src/app/(shell)/settings/page.js`)
- **Progress bar could stop short of 100%**: `hashSource` posts at most every 150ms, so the last chunk could land between intervals. It now posts a final `{done: total, total}` once the stream ends. (`src/lib/hashingCore.js`)
- **HIBP request now sends `Add-Padding: true`** so the response size can't be correlated back to the queried 5-char prefix by a network observer. Covered by a new regression test (51 total). (`src/lib/hibp.js`, `src/__tests__/hibp.test.js`)
- **Settings Confirm buttons use the `text-danger` semantic** instead of the `text-mismatch` result-verdict colour. (`src/app/(shell)/settings/page.js`)
- **`saveActivity` warns in the console when `moduleType` is nullish**, catching modules that forget to thread their id through. (`src/lib/api.js`)
- **`FallbackCommands` guards against a null command** (unknown OS/algorithm combo) instead of passing null to `CodeBlock`. (`src/app/modules/file-integrity/FallbackCommands.js`)
- **`moduleType` indentation normalised** across every remaining `saveActivity` call (base64, clipboard, exif, fingerprint, jwt-inspector, passphrase-generator, password-generator, hibp, file-integrity).

### Changed — docs directory

- `PROJECT_OVERVIEW.md`, `CODE_REVIEW.md`, and `MODULE_IDEAS.md` moved into `docs/`. `README.md`, `AGENTS.md`, and `CHANGELOG.md` stay at root (tool/agent discovery conventions). Cross-references in `AGENTS.md` and this file updated.

### Fixed — QR (WiFi)

- **WEP networks generated an invalid QR**: `security === "WEP" ? "WEB" : ...` emitted `WIFI:T:WEB;`, which scanners don't recognize. Now correctly emits `WIFI:T:WEP;`. (`src/app/modules/qr/WiFiTab.js:21`)
- **Wi-Fi escape set incomplete**: the WIFI: spec requires escaping `\ ; , " :`; the regex was missing the comma (and over-escaped `{}`). An SSID/password containing a comma now encodes correctly. (`src/app/modules/qr/WiFiTab.js:22`)

### Fixed — clipboard (unhandled rejections + timer leaks)

- `useCopyToClipboard` now `await`s/`catch`es `navigator.clipboard.writeText`, only flips `copied` on success, returns a success boolean, and clears its reset timer on unmount. (`src/lib/useCopyToClipboard.js`)
- `CopyButton`, `CodeBlock`, `ResultCard.DetailRow`, and `text-hash.HashRow` now all route through the shared hook instead of duplicating the broken `writeText` + `setTimeout` pattern. (`src/components/CopyButton.js`, `src/components/CodeBlock.js`, `src/components/ResultCard.js`, `src/app/modules/text-hash/page.js`)

### Fixed — guessability worker

- Added a worker `onerror` handler: if the zxcvbn worker crashes, the page now clears the "Analyzing…" state and shows an error banner instead of hanging forever. (`src/app/modules/guessability/page.js`)

### Fixed — QR decode

- Error copy no longer references the old "jsQR" library (the app uses `@zxing/browser`). (`src/app/modules/qr/DecodeTab.js`)
- The preview `createObjectURL` is now also revoked on unmount (previously only on reset) via a ref. (`src/app/modules/qr/DecodeTab.js`)

### Fixed — fallback command quoting (security)

- Filenames in generated terminal commands were double-quoted but unescaped, so a name containing `"`, `$`, backticks, etc. could inject arbitrary shell. All filenames are now single-quoted with per-shell escaping of embedded quotes: `'\''` for POSIX (bash/zsh), `''` doubling for PowerShell. (`src/lib/fallbackCommands.js`)
- Added `src/__tests__/fallbackCommands.test.js` (9 tests: quoting, per-OS templates, null for unknown OS/algorithm, OS detection).

### Fixed — JWT inspector

- Expiry/validity status was computed once at render from `Date.now()`, so leaving the page open past `exp` never updated. Added a ticking `now` state (refreshes every 30s). This also resolved the pre-existing `react-hooks/purity` lint error. (`src/app/modules/jwt-inspector/page.js`)
- `formatTimestamp`/`relativeTime` now return "n/a" for non-finite timestamps instead of "Invalid Date". (`src/app/modules/jwt-inspector/page.js`)

### Fixed — EXIF module

- `exifr.parse` had no size cap; a huge file could stall or crash the tab. Inspection now rejects files > 50MB with a friendly message. (`src/app/modules/exif/page.js`)

### Fixed — TOTP QR

- The QR effect wasn't awaited, so a rapid toggle-on/off (or secret change) could leave a stale QR visible. The canvas is now cleared at the start of each draw, so the last draw to complete wins. (`src/app/modules/totp/page.js`)

### Changed — activity-logging privacy invariants

Decision: the activity log never persists **digests or filenames** — it records *what you did*, not *what you did it to*.

- **File integrity** no longer logs `hashes`/`computed`/`pasted`/`hashA`/`hashB` or filenames; it logs coarse metadata only (`algorithms`, `fileSize`, `matches`, `sizesMatch`). (`src/app/modules/file-integrity/GenerateHashTab.js`, `CompareHashTab.js`, `CompareFilesTab.js`)
- **Text hash** no longer logs digest values, and entries are coalesced (same length bucket + algorithms within 30s skips), so one document no longer floods the feed with near-identical rows. (`src/app/modules/text-hash/page.js`)
- **EXIF** dropped the filename from its activity entry (was the last filename in the log). (`src/app/modules/exif/page.js`)
- Docs updated: `AGENTS.md` invariant rewritten; `docs/PROJECT_OVERVIEW.md` file-integrity + EXIF sections reflect the new rule.

### Docs

- Added `docs/CODE_REVIEW.md` — full review of the repo (bugs, privacy invariant violations, robustness findings, state), kept up to date with fix status.

### Fixed — activity page timestamps

- Relative times ("5s ago", "3h ago") were computed once at render and froze while the page sat open. Added a page-level ticking `now` state (refreshes every 30s) and threaded it through `formatRelativeTime`/`ActivityRow`, same pattern as the JWT inspector clock. (`src/app/(shell)/activity/page.js`)

### Changed — chunked/streamed hashing

The whole-file memory problem is gone: hashing no longer loads the file into a single buffer.

- `computeHashes` (`src/lib/hashing.js`) is now a thin facade that spawns `src/lib/hashing.worker.js`, which reads the Blob/File in ~64KB stream chunks and feeds them to incremental **hash-wasm** hashers (`src/lib/hashingCore.js`). Memory is bounded to the chunk size regardless of file size; the main thread never blocks. Accepts an `onProgress({done,total})` callback.
- **`js-md5` removed** — hash-wasm has a streaming MD5, so one library covers MD5 + SHA-1/256/384/512 with a consistent API (and MD5 throughput jumps from ~171 MB/s to ~850 MB/s).
- All three file-integrity tabs show a progress bar while hashing (`HashProgress.js`; the compare-files tab aggregates progress across both parallel hashes). text-hash rides the same worker path and now ignores stale in-flight results when the text changes mid-hash.
- The dead `MAX_FILE_SIZE_BYTES = 1GB` constant is deleted — the per-module `maxFileSizeMb` preference (256MB–4GB, with fallback commands over the limit) is now the real gate, and it's safe to raise it because memory no longer scales with file size.
- New `src/__tests__/hashing.test.js` (23 tests: known vectors, chunked-vs-one-shot equality, chunk-boundary independence, empty input, unsupported-algorithm rejection). Tests cover the pure core (`hashingCore.js`); the worker only marshals bytes in/out.

### Changed — no more file-size limit; terminal commands are optional

The streaming rework removed the memory risk, so the whole size-limit UX was rethought:

- **`file-integrity.maxFileSizeMb` preference removed** (Settings row, the `usePreference` calls in all three tabs, and the `maxFileSizeMb` prop on `FallbackCommands`). Any file can now be hashed in-browser; there is no size cap.
- **Terminal commands are now an advisory, not a gate.** Instead of replacing the hash with commands ("too large to process in-browser"), files over a hardcoded 2 GB (`BIG_FILE_SUGGESTION_BYTES` in `src/lib/hashing.js`) show the commands *alongside* the normal button as a faster-for-big-files alternative — nobody is forced to use a terminal. (`FallbackCommands.js` copy updated accordingly.)

### Changed — lint cleanup (safe fixes only)

- All non-`set-state-in-effect` findings are resolved: `react/no-unescaped-entities` escaped to entities across clipboard, encryptor, JWT inspector, QR WiFi, and text-hash; the unused `eslint-disable` in password-generator removed; `exhaustive-deps` fixed by adding the genuinely stable deps (`moduleId`, `canvasRef`, `subType` in `generateOptions.js`); the QR decode preview `<img>` (blob URL, not optimizable by next/image) now has a documented disable.
- Lint baseline is now **9 errors / 0 warnings**, all pre-existing `react-hooks/set-state-in-effect` (restructuring those risks behavior changes — left as-is).

### Known remaining items

- **Existing IndexedDB entries** written before the logging change may still contain digests/filenames; clearing activity in Settings scrubs them (app is still in dev — migration not a priority).
- **Lint baseline**: 2 errors / 0 warnings, both pre-existing `react-hooks/set-state-in-effect` per AGENTS.md (`usePreference.js`, `settings/page.js`).
