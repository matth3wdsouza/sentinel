# Sentinel — Project Overview

## What this is

Sentinel is a cybersecurity and privacy toolkit web app for **non-expert users**,
built as a master's-level computer science research project. Timeline: 4 months.
Developer background: strong Python, limited web dev experience, prior PySide6
desktop app experience. Prefers step-by-step guidance with explanations before
code, small increments, no building ahead of confirmation.

## Core concept: Analyze → Explain → Recommend → Act

Every module in the app follows this pattern. Instead of showing raw technical
output, the app:
1. **Analyze** — runs the actual technical check (hash comparison, EXIF read, etc.)
2. **Explain** — describes what the result means in plain language, and
   explicitly what it *doesn't* mean (avoiding overconfident conclusions)
3. **Recommend** — tells the user what to do next
4. **Act** — gives them a concrete action (copy value, re-download, save to history, etc.)

This pattern is the app's main differentiator and should be present in every
module's UI, not just the technical result.

## Tech stack

- **Frontend**: Next.js (App Router) + React + Tailwind CSS — plain JavaScript,
  not TypeScript
- **Persistence**: `IndexedDB`, entirely client-side — see "Architecture change" below
- **Icons**: Lucide React

## Architecture change: backend removed

Sentinel originally had a FastAPI + SQLite backend whose only job was
persisting scan history and favourites. This was removed: even though file
*contents* never touched the backend, the fact that a scan happened, and its
result, was being stored on a server — which sat awkwardly against the app's
core privacy pitch ("nothing ever leaves your device"). Scan history and
favourites now live entirely in the browser via `IndexedDB`
(`src/lib/db.js`), and there is currently no backend at all.

This is settled rather than provisional: Certificate Inspection — the one
module that would have needed a small stateless server-side call (browsers
can't perform a raw TLS handshake from JS) — has been dropped from the
roadmap, precisely to avoid reintroducing a backend. All current and
planned modules are achievable entirely client-side.

## Key architectural decisions

- **Client-side processing wherever the browser is capable of it.** This is a
  privacy-first principle applied throughout: file hashing, EXIF reading/stripping,
  password generation, and scan/activity history all happen entirely in the
  browser. The one exception is **HIBP Breach Check**, which sends a
  k-anonymity hash-prefix (never the full password) to the HIBP API — everything
  else leaves the device for no currently-built or currently-planned module.

- **Two `IndexedDB` object stores.** `src/lib/db.js` exports both:
  - `activity` (v1) — generic store with a `module_type` field per record,
    covering all modules' history without schema churn. Originally named
    `scans`/`saveScan`; renamed to `activity`/`saveActivity` since "scan"
    didn't fit non-scan modules like Password Generator.
  - `preferences` (v2, added in settings work) — key/value store for user
    preferences. Each record is `{ key: string, value: <any JSON-safe value> }`;
    writes use `put()` (upsert). Accessed via the `usePreference(key, default)`
    hook (`src/lib/usePreference.js`) and raw helpers `getPreference`,
    `setPreference`, `deletePreference`, `clearPreferences`.

- **`usePreference(key, defaultValue)` hook** (`src/lib/usePreference.js`) —
  drop-in replacement for `useState` that loads from IndexedDB on mount and
  writes back on every change. Returns `[value, setValue, isLoading]` — the
  third value is `true` until the initial IndexedDB read settles (whether or
  not a stored value was found), then flips to `false`. Callers that only need
  `[value, setValue]` can ignore the third value; existing call sites are
  unaffected. The `isLoading` flag is used by the home screen to gate the
  module grid render and prevent a flicker where all modules flash visible
  before the stored disabled set is applied. A missing key (fresh install or
  after `clearPreferences()`) resolves to `defaultValue` with `isLoading:
  false` — not a stuck loading state. An internal `isLoadingRef` flag prevents
  the initial loaded value from being written straight back. Accepts a
  `debounceMs` option for sliders. Works on all modern mobile browsers
  (IndexedDB is universally supported; Safari on iOS may evict storage under
  memory pressure, which is acceptable for preferences).

- **Theme stays in `localStorage`, not `preferences`/IndexedDB.** The
  `themeInitScript` in `layout.js` runs synchronously before first paint to
  avoid a flash of the wrong theme — IndexedDB is async so it can't be used
  here. Theme preference is intentionally kept out of the `preferences` store
  and is also excluded from the global "reset all preferences" action.

- **Colour schemes also live in `localStorage`** (`sentinel-scheme`), for the
  same pre-paint reason. The init script reads it and sets `data-scheme` on
  `<html>` so the correct palette applies from first paint. Like the theme,
  schemes are excluded from the `preferences` store and from the global
  "reset all preferences" action. There are five schemes — all Sentinel
  originals (default + Ember, Moss, Dusk, Graphite; no third-party
  palettes, whose canonical values fail WCAG AA). Each scheme overrides
  exactly 13 tokens in BOTH modes via matching `:root[data-scheme]` /
  `.dark[data-scheme]` blocks: the neutral ramp (background/paper/
  foreground/ink/slate/slate-light/code/surface) and the interactive hue
  family (teal/-light/-chip/-deep/-mid). Verdict colours, module accents,
  shadows, and `--color-on-teal` are global. Contrast is asserted by
  `docs/internal/validate-palettes.js`.

- **Favourites** — not yet implemented (deliberately deferred). Will follow
  the same `IndexedDB` pattern as activity when built.

- **Activity Summary is derived from the log records — one source of truth.**
  The Activity page (`src/app/(shell)/activity/page.js`) is a thin two-tab
  shell (Summary + Log, Summary being the default/opening tab) that fetches
  `getAllActivity()` once; `SummaryTab`
  derives its numbers from those same records via the pure functions in
  `src/lib/activityStats.js` (`recordsToStats` → `computeActivityStats` /
  `buildDailySeries`), so the tabs can never disagree and deleting an entry
  updates the Summary automatically. This deliberately replaced an earlier
  design that added IndexedDB v3 indexes on `module_type`/`created_at` for
  key-only stats queries: the indexes forced a schema migration surface
  (and once produced a permanently wrong-keyed index, which surfaced as
  epoch dates in the Summary) for a store that realistically holds dozens of
  records. **`db.js` therefore stays at v2 with no schema changes.** The
  `toISOKey` normalization is kept inside `activityStats.js` because legacy
  records may hold `Date`/timestamp `created_at` values that must not crash
  the summary. The visualizations (module bars, 14-day local-day chart,
  donut) are hand-rolled CSS/SVG — no chart library — using inline
  `var(--color-accent-*)` styles permitted by the existing CSP and a
  `stats-bar-grow` keyframe disabled by the global `prefers-reduced-motion`
  rule. **The chart and the "Active days" count bucket by the user's LOCAL
  calendar day** (`toLocalDayKey`), not UTC — the day boundary is the user's
  local midnight, so an action at 2:00 AM local time is "today". (The initial
  UTC-day bucketing put actions done between local midnight and the UTC
  rollover into yesterday's bar.) The summary's tests pin `process.env.TZ`
  (Asia/Kolkata) so these local-day assertions are deterministic on any
  machine.

- **File-size cap for browser-side hashing.** Hashing is **streamed**, not
  whole-file: `computeHashes` runs in a Web Worker that reads the file in
  ~64KB stream chunks through incremental WASM hashers, so memory stays
  bounded to the chunk size regardless of the file's size and the main
  thread never freezes. Because of that there is **no size cap anymore** —
  any file can be hashed in-browser. For files over a hardcoded 2 GB
  (`BIG_FILE_SUGGESTION_BYTES` in `src/lib/hashing.js`) the file-integrity
  tabs additionally show the equivalent terminal command as a purely
  optional, usually-faster-for-big-files alternative.

- **MD5 support** via `hash-wasm`, since Web Crypto doesn't support MD5
  natively and can't stream anyway (it's deprecated but still relevant for
  legacy compatibility). hash-wasm provides a streaming MD5 alongside the
  SHA family with one consistent `init/update/digest` interface, replacing
  both `crypto.subtle.digest` and the old synchronous `js-md5` (removed).
  MD5/SHA-1 are tucked behind a "show legacy algorithms" toggle in the UI,
  defaulting to modern algorithms (SHA-256 etc.) being visible/selected.

- **Theme — three-way toggle (Light / System / Dark).** An earlier OS-based
  dark-mode media query was removed after it caused invisible-text bugs; dark
  mode was rebuilt as an explicit manual toggle (`ThemeToggle.js`, `.dark` class
  on `<html>`, preference persisted to `localStorage`). The Phase 7 WCAG pass
  fixed the contrast issues that caused the original removal, so a third "System"
  option was added: it follows `prefers-color-scheme` live via a `matchMedia`
  change listener. The init script (`layout.js`) applies the stored choice before
  first paint; when the stored value is `"auto"` or absent (new users), it reads
  the OS preference. Theme is deliberately excluded from the IndexedDB preferences
  store and from the "Reset all preferences" action. The toggle lives in
  Settings → Appearance as a segmented button group (Sun / Monitor / Moon icons).

## Modules (priority order)

1. **File integrity verification** (hash generation and comparison) — ✅ functionally complete
2. **EXIF metadata inspection and removal** — ✅ built (see detailed status below)
3. **Password Generator** — ✅ built (see detailed status below)
4. **Guessability** (zxcvbn-based crack-time/pattern feedback) — ✅ built (see detailed status below)
5. **HIBP Breach Check** — ✅ built (see detailed status below)
6. **Passphrase Generator** — ✅ built (see detailed status below)
7. **Text Encryptor / Decryptor** — ✅ built (see detailed status below)
8. **Browser Fingerprint** — ✅ built (see detailed status below)
9. **Clipboard Inspector** — ✅ built (see detailed status below)
10. **QR Code** — ✅ built (see detailed status below)
11. **Text Hash Generator** — ✅ built (see detailed status below)
12. **Base64 Encoder / Decoder** — ✅ built (see detailed status below)
13. **JWT Inspector** — ✅ built (see detailed status below)
14. **TOTP Generator** — ✅ built (see detailed status below)
15. **URL Inspector** — ✅ built. Client-side URL parsing with phishing
    indicator flags: scheme abuse, IP literals, misleading subdomains,
    at-sign auth tricks, punycode/IDN, suspicious TLDs, encoded characters,
    and a typosquatting detector (leet-speak substitution map + Levenshtein
    edit-distance matching against a known-brand list). Verdict is
    safe/suspicious/dangerous. (`src/lib/urlInspector.js`,
    `src/app/modules/url-inspector/page.js`)
16. **File Signature Verifier** — ✅ built. Streams the first ~4KB of a file
    and matches its magic bytes against a bundled signature table to detect
    spoofed extensions and renamed executables. Verdict is
    match/mismatch/unknown/empty. (`src/lib/fileSignature.js`,
    `src/app/modules/file-signature/page.js`)
17. **Hidden Unicode Inspector** — ✅ built. Scans pasted text for invisible
    or deceptive characters: bidi controls (danger), zero-width characters,
    soft hyphens, control characters, and look-alike homoglyphs (warning),
    combining marks and variation selectors (info). Verdict is
    clean/suspicious/dangerous, with per-code-point breakdown and a
    "make it visible" render view. Prebuilt "Try an example" shortcuts
    (`src/components/TryExamples.js`) let a visitor see the effect without
    crafting an invisible string; they're globally hidden by the
    `ui.tryExamples` preference (Settings → Modules, default on).
    (`src/lib/unicodeInspector.js`,
    `src/app/modules/unicode-inspector/page.js`)
18. **Common Password Checker** — ✅ built. Checks whether a password is
    among the 100,000 most common breached passwords. The NCSC "Top
    100,000 passwords" list (derived from HIBP breach data, Open Government
    Licence v3.0) ships in-repo as
    `public/wordlists/common-passwords.txt.gz` (~100k lines, 816KB raw,
    430KB gzipped) and is fetched same-origin and decompressed client-side
    with `DecompressionStream` on first check — no CSP change (already
    `connect-src 'self'`) and no third-party request. Matching is
    case-insensitive with surrounding whitespace trimmed; rank is the
    line's position (1 = most common; a mid-file blank line in the source
    is skipped without shifting ranks). A found password shows its exact
    position (`#N`) on screen — display-only, never logged; the activity
    entry records just `matchFound`, mirroring HIBP's no-breach-counts
    rule. Result cards cross-link to Password Generator (found) or
    Guessability + HIBP (not found), and the module reuses the TryExamples
    shortcuts. (`src/lib/commonPasswords.js`,
    `src/app/modules/common-password/page.js`)
19. **Scam Message Analyser** — ✅ built. Pastes-in an SMS/email/message and
    scores it against the recurring hallmarks of text-message scams
    (smishing): credential/OTP requests, financial pressure, secrecy
    pressure, impersonation claims, urgency language, suspicious links, and
    pressure grammar. Pure client-side heuristic keyword + pattern matching
    — no network, no worker, no LLM — with the keyword tables kept inline in
    the lib (the same approach as `urlInspector.js`'s
    `SUSPICIOUS_KEYWORDS`/`KNOWN_BRANDS`). Verdict is
    clean/suspicious/dangerous (danger if any high-signal flag fires). Links
    are handled heuristically only (shortened or unusual-TLD domains are
    flagged) and **never followed or resolved**. The UI states the output is
    "indicators, not proof" and cross-links to the URL Inspector when a
    suspicious link is present. Activity logging keeps the privacy invariant:
    it records only per-category counts and the verdict — never the message
    text, the links, or quoted phrases. (`src/lib/scamAnalyser.js`,
    `src/app/modules/scam-message-analyser/page.js`)
20. **PIN & Pattern Analyser** — ✅ built. Pastes-in a numeric PIN/passcode and
    scores how guessable it is by detecting the common "lazy" PIN patterns:
    names from the most-leaked-PIN blacklist (NCSC/HIBP-derived), single
    repeated digits and back-to-back repeats, monotonic ascending/descending
    sequences (`1234`, `654321`), repeating couplet pairs (`1212`), date-like
    values (`19xx`/`20xx`/MMDD/YYMMDD), and keypad walks (`2580`, `147`).
    This is the numeric sibling of Guessability — zxcvbn has no PIN
    heuristics, so it gets its own focused detector. Pure client-side, no
    network/worker. Verdict is weak/fair/strong (weak if any danger-tier
    flag fires), rendered through the standard ResultCard, with each detected
    pattern shown in a Disclosure and a "patterns, not proof" info box. A
    global `MAX_PIN_LENGTH = 12` caps analysis; non-digit input is flagged as
    not-a-PIN. Cross-links to Password Generator (make a random one) and
    Guessability when weak. Activity logging keeps the privacy invariant: it
    records only the verdict and pattern count — never the PIN, nor its length,
    unique-digit count, or which patterns matched (those would narrow the
    actual PIN). This mirrors Guessability's "log nothing" discipline. Input is
    a masked PasswordField. (`src/lib/pinAnalyser.js`,
    `src/app/modules/pin-analyser/page.js`)

Certificate Inspection (formerly Module 3) has been **removed from the
roadmap** — see "Architecture change" above.

A longer list of additional candidate modules was discussed as good
client-side-only fits for later, none yet committed to the roadmap: site
permissions audit.

## UI / design system

The app went through a phased UI redesign (bland/flat → vibrant, teal-forward,
elevated). All phases are complete and stable:

- **Phase 1** — design tokens in `globals.css`: `surface` color (distinct from
  `paper`/`background`), `teal-deep` shade, decorative accent hues
  (blue/violet/rose/amber/green/indigo/orange — kept separate from
  match/mismatch/fallback verdict colors), and shadow tokens (`shadow-card`,
  `shadow-card-hover`, `shadow-hero`).
- **Phase 2** — every module page opens with a `PageHeader` component carrying
  an accent-colored icon chip. Accent map lives in `src/lib/moduleAccents.js`,
  providing color continuity from the home page module card to the page it opens.
- **Phase 3** — shared components (`ResultCard`, `GeneratorResultCard`,
  `FileInput`, `PasswordField`) elevated onto `bg-surface` + `shadow-card`.
  `FallbackCommands.js`'s copy button gives Copy→Check feedback.
- **Phase 4** (motion/animation polish) — attempted twice and reverted both
  times due to CSS collapse-animation bugs. A targeted subset was later landed
  as part of Phase 8: page-enter fade and result-reveal animations (pure CSS
  `@keyframes`, no collapse/expand). Full collapse/expand motion remains
  unattempted.
- **Phase 5** — home page module grid redesigned from a flat list to loose
  category groups (Passwords & Passphrases / Inspect & Analyse / Miscellaneous),
  with Miscellaneous as a catch-all for modules that don't fit neatly elsewhere
  while the module list is still growing. Accent palette rationalised: `tealDeep`
  retired as a module accent (it remains in CSS for the hero gradient), duplicate
  `rose` on Clipboard resolved, and all modules assigned semantically
  motivated hues from the existing 8-key palette. The palette is intentionally
  finite — new modules should reuse the nearest existing hue rather than adding
  new CSS variables. See `src/lib/moduleAccents.js` for the palette constraint
  comment and `src/lib/modules.js` for per-module accent rationale in inline
  comments. The `CATEGORIES` array and derived `ALL_MODULES` flat list live in
  `src/lib/modules.js` (extracted from `src/app/page.js`) so they can be
  shared across the home screen, module management settings page, and any
  future surface that needs the module list.
- **Phase 6** — architecture refactor across all modules (see "Refactor —
  Rounds 1–3" below).
- **Phase 7** — accessibility/UX audit pass (UI/UX review scorecard). No
  structural changes; targeted fixes only:
  - `--color-slate` darkened in light mode and lightened in dark mode so
    secondary text clears WCAG AA (4.5:1) on paper, surface, and slate-light.
  - New `--color-teal-chip` token: a darker teal for small text on teal-light
    chips, so chip labels pass AA without touching the interactive teal (the
    chip-against-tint pairing was 4.08:1; interactive teal on white was
    ~5.0:1 at the time — later nudged to `#286c6d` / 6.08:1 by the
    colour-scheme work). Also darkened light `--color-fallback` (chip-only
    token) from 2.99:1 to ~5.1:1 on its chip background.
  - `--color-mismatch-chip` token for text on mismatch-light chips/banners
    (dark reuses mismatch). Originally light `#ae4040` (4.79:1) propping up
    a failing base; the scheme-work remediation later moved the base
    mismatch itself to `#ad4040` (4.83:1 on the tint), so the chip now
    shares the base value and keeps only its semantic name.
    **Both chip tokens were initially missing their `@theme inline` mirror
    lines, so `text-teal-chip`/`text-mismatch-chip` were inert (no utility
    emitted) — caught in the post-refactor review and fixed by adding the two
    mirror lines; confirmed in the compiled CSS.**
  - `prefers-reduced-motion` extended to kill all decorative transitions and
    one-shot hover lifts.
  - `Tabs` now implements the WAI-ARIA tabs pattern (roles, `aria-selected`,
    `aria-controls`, arrow/Home/End keys); every page's tab panels carry
    matching `id` + `role="tabpanel"`.
  - ResultCard explanation region uses `useId()` (the previous static id
    duplicated 6× on the Fingerprint passive tab).
  - Generator `usePreference` calls now pass `{ debounceMs: 300 }` so slider
    drags don't write IndexedDB on every tick.
  - Added missing `aria-expanded` (+ `useId`-based `aria-controls` where a
    disclosure renders multiple times) and grew icon-only tap targets.
  All 174 tests, 2 accepted lint errors, and the 21-route static build were
  re-verified after the pass.
- **Phase 7 — shared component refactor pass** — second cleanup round, purely
  mechanical deduplication of components that had drifted into multiple
  modules. All of it ships as shared UI in `src/components/`, verified with
  lint/test/build after the round:
  - `AlgorithmPicker` — the standard-list + legacy-toggle algorithm block that
    was byte-identical in `file-integrity/GenerateHashTab.js` and
    `text-hash/page.js` now lives once in `src/components/AlgorithmPicker.js`
    (controlled `selected`/`onToggle`/`open`/`onOpenChange`, preserving the
    reset-collapses-legacy behavior in file integrity). The toggle also gained
    `aria-expanded`/`aria-controls`.
  - `TextOutput` — merged the encryptor's `DecryptedOutput`, base64's
    `DecodedOutput`, and the clipboard's `ContentPreview` (label + copy button
    + bordered surface; `maxChars` handles the clipboard's truncation).
  - `CopyButton` gained optional `className`/`onCopy` so ResultCard's
    `DetailRow` and text-hash's `HashRow` dropped their hand-rolled clones.
  - `InlineError` — standardizes the ~dozen `text-mismatch text-sm` error
    paragraphs (per-site margins via `className`).
  - `Disclosure` — centralizes `aria-expanded`/`aria-controls`/`useId` for the
    accordion subset (guessability "More detail", password "Advanced options",
    EXIF removal guides) and adds the previously missing `aria-controls` to the
    guessability + password toggles; the Activity row expand button keeps its
    bespoke layout but gained `aria-controls` via `useId`. Bespoke toggles
    (EXIF metadata headers, fingerprint full-card collapse, info buttons, QR
    show/hide) intentionally stayed put.
  - `PasswordField`'s show/hide toggle gained `aria-pressed` (the last
    disclosure-style toggle without a pressed state; the Wi-Fi tab got this
    in the earlier NIT pass).
  - The five label/value row components (ResultCard `DetailRow`, text-hash
    `HashRow`, EXIF `FieldRow`, fingerprint `DataTable`, JWT `Field`) were
    **not** merged — their padding, borders, and placeholder handling differ,
    and a `KeyValueRow` with many knobs risked density regressions in the
    dense tables. Revisited only if a future review flags row divergence.
- **Phase 8** — UI/UX polish pass:
  - **Active TopBar state** — Activity and Settings icons now show a teal
    highlight when on their respective pages (`TopBar.js`).
  - **Three-way theme toggle** — Light / System / Dark segmented control
    replaces the binary toggle. "System" follows `prefers-color-scheme` live
    via `matchMedia` change listener; new users default to System.
    (`ThemeToggle.js`, `layout.js`)
  - **Micro-animations** — page-enter fade (`PageShell.js`) and result-reveal
    fade (`ResultCard.js`, `GeneratorResultCard.js`). Pure CSS `@keyframes`,
    all killed by the existing `prefers-reduced-motion` rule. Collapse/expand
    animation is intentionally avoided (the bugs that killed Phase 4).
    Hero-specific: `badge-enter` (staggered fade + slide up for trust
    badges) and `lock-float` (gentle 8s vertical drift for the lock
    watermark). Both killed by `prefers-reduced-motion`.
    Cursor-reactive: the hero panel has a radial-gradient spotlight
    (600px, 7% opacity) that follows the mouse via CSS custom properties
    `--mx`/`--my`. Skipped when `prefers-reduced-motion: reduce` matches.
  - **Named colour schemes** — five palettes, all Sentinel originals
    (default Sentinel, Ember, Moss, Dusk, Graphite — no third-party
    themes: an audit found ten borrowed palettes' canonical values fail
    WCAG AA in dark mode, worst 2.16:1 body text) selectable from
    Settings via a WAI-ARIA radiogroup, active in both light and dark
    mode. Each scheme overrides exactly 13 tokens through matching
    `:root[data-scheme="X"]` / `.dark[data-scheme="X"]` blocks: the
    neutral ramp (background/paper/foreground/ink/slate/slate-light/
    code/surface) and the interactive hue family (teal/-light/-chip/
    -deep/-mid). Verdict colours, module accents, shadows, and
    `--color-on-teal` (white/near-black button labels) are global.
    All overrides propagate through Tailwind's `@theme inline` bridge.
    A `--color-teal-mid` variable (base `#1e6868`) is overridden per
    scheme for the hero gradient midpoint. Every ratio is asserted by
    `docs/internal/validate-palettes.js` (ink/slate/teal >= 4.5:1 on
    paper, surface, AND slate-light per scheme per mode; accent and
    verdict chains on their tints plus paper/surface).
    (`globals.css`, `colorSchemes.js`, `SchemePicker.js`, `layout.js`)
  - **First-use welcome banner** — shown on the home page when the activity
    log is empty and the user hasn't dismissed it. Suggests four approachable
    starting modules (Password Generator, HIBP, EXIF, QR Code). Dismissible
    via `preferences["welcome-dismissed"]`. (`src/app/page.js`)

- **Phase 9** — cross-module navigation and onboarding:
  - **GuidedCard component** — shared empty-state card (`icon`,
    `heading`, `description`, optional `children`) extracted from ~10 inline
    copies across clipboard, fingerprint, and the six new cards. Derives its
    accent from the current pathname via `ALL_MODULES`, exactly like
    `ModulePage`, so a card can never drift out of sync with its module's
    home-grid colour (an earlier manual `accent` prop fell back to blue for
    amber/violet modules). (`src/components/GuidedCard.js`).
  - **CompanionLinks component** — the shared cross-module "next step"
    links inside result cards (`src/components/CompanionLinks.js`). Renders
    each contextual suggestion as a pill-style button: a bordered teal chip
    that resolves the target module's own icon from `ALL_MODULES` by path
    (overridable via `icon`), keeps the page's plain-language action label,
    and nudges an arrow on hover. Grown out of the original HIBP → Password
    Generator teal-text pattern and now adopted by all seven sites: HIBP →
    Password Generator, Guessability → Password Generator (weak result),
    Text Hash → File Integrity, File Integrity (GenerateHash) → Text Hash,
    Encryptor → Passphrase Generator, EXIF → Fingerprint, and Common
    Password Checker (→ Password Generator when common, or Guessability +
    HIBP when not). Links sit at the end of their flow (inside the result
    card or below the results) so a secondary suggestion never interrupts
    a form mid-way; no `next/link` imports remain in module pages. All
    companion links are gated on the global `ui.companionLinks` preference
    (Settings → Modules → "Show companion links", default on) inside the
    component itself, mirroring how `TryExamples` gates on `ui.tryExamples`.
    Standalone, outcome-independent links are declared once in a single
    auditable registry (`src/lib/companionLinks.js`) keyed by source module
    path, and pages render them via `companionLinksFor(path)`; only
    outcome-gated links stay inline in the page next to the result state.
    The pre-existing standalone sites (Text Encryptor, File Integrity
    GenerateHash, Text Hash, File Signature) and the other cross-module
    pairs added in the 2026-09 expansion all render through the registry —
    the hashing/file cluster forms a small mutual-link loop. The one
    outcome-gated exception is URL Inspector → Unicode Inspector: shown
    only when the hostname scan flags punycode, non-ASCII, or percent-
    encoded hostname characters, it stays inline in
    `src/app/modules/url-inspector/page.js`.
    The registry mirrors earlier data-file decisions like `moduleAccents.js`,
    and a data-integrity test (`src/__tests__/companionLinks.test.js`)
    verifies every key and `href` resolves to a real `ALL_MODULES` path.
  - **Guided empty state cards** — added to Base64, JWT Inspector, File
    Integrity (all three tabs), and QR Decode. Icon card with heading,
    2-sentence explanation, and privacy note. Matches the Clipboard/
    Fingerprint idle-state pattern.
  - All 14 modules now have either a rich guided empty state or a functional
    one; no module presents raw inputs without context.
  - **Activity log pagination** — configurable page sizes (25 / 50 / 100)
    with numbered page navigation (prev/next arrows, page buttons, ellipsis
    for large counts). Pagination bar always visible when entries exist.
    Page size persisted via `usePreference` (key `activity.pageSize`,
    default 50). Page resets on filter or size change.
    (`src/app/(shell)/activity/LogTab.js`)
  - **Command palette** — modal overlay for quick module navigation,
    triggered by ⌘K / Ctrl+K (desktop) or search icon in TopBar (all
    devices). Flat filterable list of available modules plus quick actions
    (Home, Activity, Settings). Keyboard navigable (arrow keys, Enter,
    Escape). `preventDefault()` on keydown blocks browser omnibox.
    Input suppresses focus ring (cmdk/shadcn convention — modal context
    + caret communicates focus; global `:focus-visible` lives in `@layer
    base` so Tailwind utilities can override it). (`src/components/CommandPalette.js`,
    `src/components/TopBar.js`, `src/app/layout.js`)

- **Phase 10** — DRY/refactor sweep + accessibility pass (mechanical; rendering and
  wording unchanged):
  - **text-hash Reset now uses the shared `<Button>`** — the last module hand-rolling
    a ghost reset button (raw `<button>` + inline `RotateCcw` SVG) now uses
    `<Button variant="ghost" resetIcon>`, matching the other 21 reset sites.
  - **File-integrity sub-tabs drop redundant `max-w-2xl` wrappers** — the three tab
    components wrapped content in a no-op `<div className="max-w-2xl">` inside a
    `PageShell` that already constrains the column width.
  - **text-hash textarea + label standardised** to the dominant cross-module class
    string (`rounded-xl border-slate/30 px-4 py-3 focus:border-teal`) and the standard
    label (`text-ink mb-1.5`).
  - **file-signature error now uses `<InlineError>`** in place of a raw mismatch div.
  - **PasswordField gained an accessible name** — an `aria-label` (optional `ariaLabel`
    prop defaulting to `placeholder`) fixes screen readers announcing the password
    field by placeholder alone; call sites with visible labels pass the matching text.
  - **FileInput drop-zone button gained an `aria-label`** (`"Choose File A"` / `"Choose
    a file"`).
  - **Tab panels now meet the WAI-ARIA tabs spec** — every `role="tabpanel"` across the
    six tab-using pages gained `aria-labelledby` (pointing at its tab) and
    `tabIndex={-1}`; the `Tabs` `ariaLabel` is documented as required and provided by
    all call sites.
  - **Disclosure toggles gained `aria-controls`** — the TOTP show/hide-QR toggle, EXIF
    `MetadataGroup`, and file-integrity "use a different algorithm" toggle now point at
    their `useId`-derived content ids.
  - **CodeBlock dark-variant copy button contrast fixed** — `text-teal` was 2.92:1 on
    `zinc-900` (below AA); now the fixed `text-teal-400` (9.52:1), matching the dark
    terminal's intentional literal-zinc token bypass. The themed variant already passed.
    The copy button is also now icon-only — the redundant "Copy"/"Copied" text label was
    dropped (the icon reads as copy); `aria-label` + a `title` tooltip still name it.
  - **CompanionLinks placement convention documented** in a comment (nest in
    `ResultCard` when outcome-contingent; render standalone when outcome-independent or
    when a custom result component leaves nowhere to nest).
  - Two audit candidates required no change on inspection: the `SchemePicker`
    radiogroup already carries `aria-label="Colour scheme"`, and the themed
    `CodeBlock` `text-slate`-on-`slate-light` copy is 4.64:1 (passes AA).

- **Phase 11** — Scam Message Analyser module (19th module, Miscellaneous):
  - Added a client-side-only heuristic scorer for pasted SMS/email/message
    text. It flags the recurring hallmarks of text-message scams (smishing)
    across seven severity-weighted categories: credential/OTP requests,
    financial pressure, secrecy pressure, impersonation, urgency language,
    suspicious links, and pressure grammar. Pure sync logic, no network, no
    worker, no LLM — the keyword tables live inline in
    `src/lib/scamAnalyser.js` (mirroring `urlInspector.js`).
  - Verdict is clean/suspicious/dangerous (danger if any high-signal flag
    fires). The UI renders a `ResultCard` verdict, per-category count chips,
    and a per-flag `Disclosure` breakdown, plus a privacy info box stating
    the output is "indicators, not proof". When a suspicious link is present
    it cross-links to the URL Inspector.
  - Links are handled heuristic-only (shortened or unusual-TLD domains are
    flagged) and never followed or resolved — so there's no CSP `connect-src`
    change and no privacy cost.
  - Activity logging honours the privacy invariant: it records only the
    verdict and per-category counts — never the message text, the links, or
    quoted phrases.

- **Phase 12** — PIN & Pattern Analyser module (20th module, Passwords):
  - Added a pure numeric-pattern scorer for pasted PINs/passcodes — the
    numeric sibling of Guessability, since zxcvbn has no PIN heuristics.
    Detects: the most-leaked-PIN blacklist, single repeated digits /
    back-to-back repeats, monotonic sequences (`1234`, `654321`), repeating
    couplet pairs (`1212`), date-like values (`19xx`/`20xx`/MMDD/YYMMDD),
    and keypad walks (`2580`, `147`). Pure sync logic, no network/worker.
  - Verdict is weak/fair/strong (weak if any danger-tier flag fires),
    rendered via `ResultCard` with each detected pattern in a `Disclosure`,
    a "patterns, not proof" info box, and CompanionLinks to Password
    Generator + Guessability when weak. Input is a masked `PasswordField`
    (consistent with HIBP/Guessability/Common-Password) capped at
    `MAX_PIN_LENGTH = 12`; non-digit input is flagged as not-a-PIN.
  - Activity logging honours the privacy invariant: it records only the
    verdict and pattern count — never the PIN, nor its length, unique-digit
    count, or which patterns matched (those would narrow the actual PIN).

- **Phase 13 — privacy-invariant tightening** — a follow-up to the four-way
  audit of the existing modules. Three modules were persisting the *length or
  structural fingerprint of the sensitive input itself* — beyond the "what you
  did, never what you did it to" bar every other module respects (HIBP logs
  only a breached boolean; Guessability logs nothing):
  - **PIN & Pattern Analyser** stopped logging `length`, `uniqueDigits`, and
    the `hasCommon/hasRepeat/hasSequence/hasCouplet/hasDate` booleans — those,
    with a timestamp, narrow the actual PIN. It now logs only the verdict and
    pattern count, mirroring Guessability's "log nothing" discipline.
  - **QR generate** stopped logging `contentLength` — for the Wi-Fi tab the
    text is the full `WIFI:…;P:<password>;` string, so the logged length was
    the length of a string embedding the Wi-Fi password. The length bucket is
    still used internally for coalescing, but never persisted.
  - **text-hash** stopped logging `charCount` and the length-scoped summary
    (the hashed input can be a secret); **base64** stopped logging
    `inputLength`/`outputLength` and length-scoped summaries. Both now record
    only non-secret coarse keys (`algorithms` / `variant`).

- **Phase 14 — inspector modules DRY consolidation** — the four inspect-style
  pages (URL, Unicode, Scam, PIN) had drifted into four parallel
  implementations of the same flow: state + handlers, severity chip styling,
  verdict card, Analyse/Reset row, collapsible findings list, footer info box,
  and the multi-line input. All of it now lives once, either unit-tested or
  pure presentational:
  - **`src/lib/useInspector.js`** — the shared input/result/error/expanded
    state machine + the standard handlers (`handleChange`, `handleAnalyse`,
    `loadExample`, `reset`, `toggle`, `canAnalyse`, `showReset`). Pages supply
    their analysis + activity-logging logic via an `onAnalyse` callback and
    keep their `saveActivity` bodies verbatim; a `trim` option covers URL's
    whitespace handling. Unit-tested (`src/__tests__/useInspector.test.js`,
    12 cases).
  - **`src/lib/severity.js`** — canonical `SEVERITY_STYLE` (dot + badge +
    label) keyed by the shared "danger"/"warning"/"info" severity tokens the
    analyses already return. Chip labels standardised to High signal /
    Warning / Info. Unicode's made-visible highlight tints derive from the
    same badge classes, so the palettes can't drift apart.
  - **`src/components/`** — `VerdictCard` (keeps the page-level `h2` heading
    in one place), `AnalyseActions` (the Analyse/Reset row), `FindingsList`
    (the Disclosure-list chrome with a per-module `renderLabel` prop),
    `InfoCallout` (the closing "indicators, not proof" note), and `TextArea`
    (the shared multi-line field mirroring `PasswordField`, with a `mono`
    variant for URL input).
  - Behavior unchanged other than the standardised severity chip labels and
    url gaining `autoCorrect="off"`. Each page's module-specific sections
    (decomposed URL / query table, made-visible highlight + markers legend,
    indicator-chip cards, CompanionLinks) stay inline where they belong.
- **Phase 15 — URL Inspector & File Signature detector fixes** (changes from
  the uncommitted `docs/internal/CLAUDE_REVIEW_04.md` review, with regression
  tests in the existing suites):
  - **URL Inspector** — the `KNOWN_BRANDS` HMRC entry had a dangling leading
    space (`" hmrc"`), so HMRC impersonation was never detected; fixed. The
    fuzzy typosquat guard was `b.length < 3`, which let 3-char brands
    (`irs`, `ups`, …) match short lookalikes (`irk.com`, `orx.com`) as
    typosquats; raised to `b.length <= 3`. 4-letter brands (`meta`, `live`,
    `usps`, `hmrc`) are additionally capped at edit distance 1 in the fuzzy
    matcher, closing the same class for names like `urs.com`→`usps` while
    keeping genuine 1-edit catches (`usbs.com`). Exact leet-substitution
    matches of short brands (`up5.com` → `ups`) are unaffected. Garbage
    entries in `SUSPICIOUS_TLDS` removed.
  - **File Signature Verifier** — three silent detection bugs fixed: TAR used
    a never-read `extOffset: 257` field (matcher reads `sig.offset`), so TAR
    files verified as `unknown`; the generic RIFF entry shadowed WAV/AVI so
    every `.wav` reported a mismatch; and the ZIP entry (`docx`) won
    first-match, making the apk/jar/epub signatures dead code, so an `.apk`
    verified as an "Office document". The TAR signature now uses `offset`,
    `detectSpecificExtension` reads RIFF form bytes 8–11 (`WAVE`→wav,
    `AVI `/`AVIX`→avi) and scans ZIP entry paths (`mimetype`/epub,
    `AndroidManifest.xml`/`classes.dex`→apk, `META-INF/`→jar) with `docx`
    fallback, and the ZIP signature's type label became the honest "ZIP
    archive (Office/APK/JAR/EPUB)". Dead duplicate/shadowed signature entries
    (RAR v4/v5, duplicate `woff`, unreachable apk/jar/epub) removed.
  - **Left as-is by decision**: `U+3000 IDEOGRAPHIC SPACE` sits under the
    Unicode inspector's `zeroWidth` category (it is not zero-width, but its
    dedicated `SPECIFIC_EXPLANATIONS` entry renders an accurate description).
    Re-bucketing it would churn UI, tests, and severity semantics for a
    single codepoint, so it stays; noted here for future cleanup.
- **Phase 16 — WiFi QR decode escaping & browser version detection** (changes
  from the uncommitted `docs/internal/CLAUDE_REVIEW_05.md` review, second pass
  covering QR/clipboard/fingerprint/EXIF/HIBP/JWT/TOTP/base64/guessability/
  passwordGen/wordlist/hashingCore):
  - **WiFi QR round-trip corruption (`qr.js`)** — the QR generator escapes
    `\` `;` `,` `:` `"` per the WiFi-QR convention, but `analyzeQRContent`
    extracted `S:`/`P:`/`T:` with a `[^;]+` regex and didn't un-escape, so an
    SSID or password containing any of those characters decoded as truncated
    with a stray trailing backslash. `parseWifiPayload` now tokenizes the
    payload, stopping at the first *unescaped* `;` and unescaping the
    result — the app's own generator output round-trips exactly. Regression
    tests added to `contentAnalysis.test.js`.
  - **Fingerprint browser versions (`fingerprint.js`)** — the shared
    leftmost-match version regex grabbed the Chromium engine version for
    Opera/Edge/Samsung Internet (`Chrome/*` sits earlier in the UA string)
    and Safari's WebKit build instead of its real `Version/*` number. Version
    extraction now uses the token matching the already-detected browser.
    `parseUserAgent` is exported for the first time and has a dedicated
    `fingerprint.test.js` (it previously had zero coverage).
  - Everything else in the second pass reviewed clean (encrypt, hibp, jwt,
    totp, base64, guessability, passwordGen, wordlist, hashingCore, exif,
    clipboard, and the non-WiFi parts of qr).

- **Phase 17 — UI consistency pass** (changes from the uncommitted
  `docs/internal/CLAUDE_REVIEW_06-consistency.md` review; no bugs, four
  page-level drifts reconciled with the shared layer):
  - **Error display** — EXIF and Guessability swapped their hand-rolled
    error `<p>` for the shared `InlineError` component (restoring
    `role="alert"`). Guessability's error text adopts the standard `text-sm`.
  - **URL Inspector TryExamples** — added the prebuilt sample shortcuts the
    other inspector modules had, with examples exercising dangerous
    (misleading subdomain), suspicious (punycode/homograph), and safe
    verdicts. Falls under the shared `ui.tryExamples` preference.
  - **Fingerprint Passive tab loading** — no longer swaps the whole tab for
    a static "Collecting…" paragraph; the intake card stays on screen with
    the shared `Button` `loading` state and the tables render under it when
    done (extracted into `PassiveResults`). Geolocation/Media tabs keep the
    full-tab treatment. Privacy logging unchanged (booleans/counts only).
  - **Companion links** — QR Decoder → URL Inspector inside the result card
    for decoded URLs; File Signature ↔ File Integrity cross-link added in
    both directions (both outcome-independent standalone rows, matching the
    Text Hash ↔ File Integrity precedent).
  - No lib logic or tests changed anywhere on this pass.

- **Phase 18 — gitlab/bitbucket typosquat false positive** (found during
  end-to-end testing of the QR → URL Inspector flow added in Phase 17):
  - `gitlab` and `bitbucket` are legitimate code-hosting brands but only
    `github` was in `KNOWN_BRANDS`, so the fuzzy near-miss matcher read
    `gitlab.com`/`gitlab.io` as an edit-distance-2 lookalike of `github` and
    reported them **suspicious**. Both brands added to the list — the real
    domains are now ignored while lookalikes of `gitlab`/`bitbucket`
    (`git1ab.com`, `b1tbucket.com`) are caught. Regression tests added.
  - Known residual class, deliberately not chased: 4-letter brands still
    match legitimate dist-1 domains like `love.com` (→`live`) and
    `mete.com` (→`meta`). No static allowlist can fix this without turning
    into whack-a-mole, and network reputation lookups are off-limits under
    the no-external-calls invariant — the softened verdict framing (see the
    following phase) treats such flags as "verify independently" hints
    rather than accusations, which is the systematic mitigation.

- **Phase 19 — URL Inspector verdict copy softened to signal + verify**:
  the "dangerous"/"suspicious"/"safe" explanations no longer present the
  heuristics as a final judgement ("Do not visit this link") but as trip-wire
  signals with steps to verify a link's destination independently (confirm
  the domain and scheme, type the official address yourself). The module is
  an explain-not-judge tool: it teaches *why* a URL shape is phishable, it
  can't authoritatively clear one. Also the systematic mitigation for the
  Phase 18 residual false-positive class.

- **Phase 20 — shared URL decomposition (QR ↔ URL Inspector)**: the QR
  decoder's URL preview and the URL Inspector's "Decomposed URL" card both
  render the identical label/value/copy rows via a new shared
  `URLPartsTable` component (the Inspector page's local `URL_PARTS` + row
  markup deleted). `analyzeQRContent`'s URL detail gains a `parts` object
  keyed to the URL object's own properties (pure lib, unit-tested), so QR
  never re-parses. The QR preview keeps its URL-safe extras — the
  tracking-parameter warning and cleaned-URL row (both now copyable) and the
  explicit Open buttons.

- **Phase 21 — de-duplication sweep** (the "consolidate, don't mint" pass
  over the drift left from rapid prototyping; the ONLY deliberate behavior
  change is noted at the end):
  - **Single source for URL signals and verdicts.** `SUSPICIOUS_TLDS` (22
    TLDs) and `TRACKING_PARAMS` (12 params) now live once in
    `src/lib/urlSignals.js` — previously the URL Inspector and Scam Message
    Analyser each owned their own TLD copy (the scam list was ~18) and the
    clipboard/QR tracking-parameter lists were separate too. `computeVerdict`
    lives in `src/lib/severity.js` (`DANGER`/`WARNING`/`INFO` severities) and
    is shared by the URL, scam, and Unicode inspectors with a `safeToken`
    override so each keeps its own wording ("safe" vs "clean"); the PIN
    analyser deliberately keeps its own weak/fair/strong vocabulary. This
    makes the *scam analyser* check the full union — it now flags `sbs`,
    `cfd`, `surf`, and `rest` (regression-tested).
  - **Shared `KeyValueRow` component** (`src/components/KeyValueRow.js`)
    replaces six hand-rolled breakdown rows: URLPartsTable, JWT `Field`,
    text-hash `HashRow`, EXIF `FieldRow`, fingerprint `DataTable`, and the QR
    decoder's Tracking/Full/Cleaned URL rows. Variants cover stacked vs.
    row layout, mono/copyable values, and `warning`/`mismatch`/`match` tones.
  - **`TextArea` used everywhere** — all eight remaining raw `<textarea>`s
    (base64 × 2, encryptor × 2, JWT, text-hash, TOTP, QR generate) now use
    `@/components/TextArea`.
  - **Shared `SeverityChips`** component used by the scam and Unicode
    inspectors; small helpers extracted to their own modules:
    `downloadCanvas` (`lib/download.js`), `osmLink` (`lib/geo.js`),
    `formatBytes` (`lib/format.js`), and `toggleAlgorithm` (`lib/hashing.js`)
    shared by text-hash and file-integrity's GenerateHashTab.
  - **Coalesced activity logging lives once** — `useCoalescedActivity`
    (`src/lib/useCoalescedActivity.js`) extracts the copy-pasted 30s/`subType`
    coalescing that text-hash and the QR generator each carried inline.
    (Whether the auto-running text-hash/QR modules should instead log from a
    button press like every other module is an open decision, parked.)
  - Net `-61` lines. No other UI or logging behavior changed.

- **Phase 22 — verdict severity, EXIF failure state, and file-signature
  verification** (a visual pass plus follow-up source checks on the
  file-signature module; all findings addressed in one round):
  - **Verdict banner severity distinction.** `ResultCard`'s `VERDICT_CONFIG`
    gains a `danger` entry — warmer red-orange rail/chip via the existing
    `--color-danger` tokens plus an `AlertTriangle` icon — so the top
    verdict banner of every inspector now distinguishes an active,
    high-signal "Dangerous" result from a single warning-level "Suspicious"
    result. The URL, Unicode, and Scam inspectors' `dangerous` entries point
    at it; `suspicious` stays on `mismatch` (result-red XCircle). Flag-level
    chips were already correct (`SEVERITY_STYLE.danger` vs `.warning`).
  - **EXIF failed-read contradiction.** The non-image/oversized paths set an
    error but left `result` at its "inspected, nothing found" state, so the
    page rendered a reassuring green "No metadata found" card under the
    error. Results (including the preview) are now gated on `!error`.
  - **File Signature "0 bytes".** `page.js` read `result.fileSize`, which
    `analyzeFile()` never returned (`?? 0` fired every time). The page now
    reads `file.size` directly.
  - **ODF/iWork false mismatches (and EPUB mislabel).** `detectSpecificExtension`
    now detects OpenDocument from its `mimetype` entry *content*
    (`application/vnd.oasis.opendocument.<subtype>` → ods/odt/odp/…), Apple
    iWork from its `application/x-iwork-*` mimetype (pages/numbers/key), and
    the EPUB check requires the literal `application/epub+zip` — a bare
    `mimetype` entry is a shared ZIP convention, not an EPUB marker.
    `GENERIC_ZIP_EXTS` (extracted from the old inline list) adds the whole
    ODF subtype family plus pages/numbers/key, so legitimate files of any
    of these families verify cleanly. Regression tests added.

## Refactor — Rounds 1–3

A systematic refactor was completed after the 10th module was built, to
consolidate patterns that had drifted across rapid prototyping. No
behaviour changed — this was purely structural.

**Round 1 — Pure fixes**
- Accent values corrected in 6 module pages to match `page.js` (clipboard
  `rose`→`amber`, encryptor `tealDeep`→`indigo`, fingerprint `indigo`→`orange`,
  guessability `blue`→`violet`, passphrase-generator `violet`→`blue`,
  qr `orange`→`green`).
- Local `OptionRow` in `qr/page.js` renamed to `ControlRow` to avoid
  shadowing the shared `@/components/OptionRow` (which is a checkbox/radio
  component with a completely different shape). A comment explains the
  distinction.
- QR `moduleType` bug fixed: `useQRGenerator` was passing `"text"` and
  `"wifi"` as `moduleType` to `saveActivity`, logging them as separate
  modules in the activity feed. Both now correctly pass `"qr"`.

**Round 2 — New shared components**

Four new components extracted from patterns duplicated across module pages:

- **`src/components/Button.js`** — two variants: `primary` (teal filled,
  replaces 11 inline button strings) and `ghost` (text-only with optional
  `resetIcon` prop that renders `RotateCcw`, replaces 9 inline strings +
  `RotateCcw` imports). All module pages now use `<Button>` and no longer
  import `RotateCcw` from lucide.
- **`src/components/CopyButton.js`** — icon-only copy button (Copy→Check,
  1500ms). Replaces two identical local `function CopyButton` definitions
  in `exif/page.js` and `fingerprint/page.js`.
- **`src/components/ModulePage.js`** — renders the `<main>` shell +
  `max-w-2xl` container + `PageHeader`. Replaces the identical outer
  structure in all 10 module pages. Module pages no longer import
  `PageHeader` directly.
- **`src/components/Tabs.js`** — tab bar (`tabs`, `activeTab`, `onChange`
  props). Replaces the copy-pasted tab bar JSX in encryptor, file-integrity,
  fingerprint, and qr. Panel rendering stays in each page.

All module pages and file-integrity sub-tab components updated to use the
four new components. Stale imports (`PageHeader`, `RotateCcw`, unused lucide
icons) removed throughout.

**Round 3 — Hook and normalisation**

- **`src/lib/useCopyToClipboard.js`** — `useCopyToClipboard(timeout = 1500)`
  hook returning `[copied, copy]`. Replaces the inline
  `[copied, setCopied] + navigator.clipboard.writeText + setTimeout` pattern
  that appeared in 5 module pages (clipboard, encryptor, exif,
  passphrase-generator, password-generator).
- **`moduleType` slugs normalised** across all `saveActivity` calls:
  `password-gen` → `password-generator`, `passphrase-gen` →
  `passphrase-generator`, `hash` → `file-integrity` (was spread across
  the three file-integrity sub-tab components).
- **QR summary redundancy fixed**: `useQRGenerator` previously accepted a
  `moduleType` prop used only for the activity summary string, which always
  produced "QR code generated (qr)" after the Round 1 fix. Renamed to
  `subType`; call sites now pass `"text"` or `"wifi"` so the activity log
  correctly shows "QR code generated (text)" / "QR code generated (wifi)".

**Known intentional exception**

The QR Download PNG button retains its raw inline class string — it uses
`inline-flex` with a `Download` icon and is visually distinct from the
standard action button pattern. It is not a `<Button variant="primary">`
and should stay as-is.

**Round 4 — Review hardening** (follow-up to the third review pass)

- **Home grid gated on `isLoaded`** — `page.js` wraps the search-results,
  category-grid, and no-results blocks behind `isLoaded`, so disabled modules
  no longer flash visible for a tick while `disabled-modules` resolves from
  IndexedDB. Restores the behavior this doc has always claimed.
- **QR activity logging coalesced** — `useQRGenerator` (`generateOptions.js`)
  now logs using the same pattern text-hash does: keyed on `subType` + an
  8-char length bucket + a 30s window, so colour/error-correction tweaks and
  same-bucket keystrokes no longer spam the activity feed. Content length is
  not logged (see Phase 13 — privacy tightening), so no `contentLength`.
- **QR decode distinguishes corrupt files** — `decodeQR` (`qr.js`)
  pre-validates the upload with `createImageBitmap` and returns `IMAGE_ERROR`
  on decode failure (mapped to the existing "Couldn't read image" message).
  Before this, a corrupt upload sat in @zxing/browser's 10s image-load
  timeout and surfaced as the misleading `LIBRARY_ERROR`.
- **File-integrity primary buttons converted to `<Button>`** — the three raw
  inline-class Compute/Compare buttons (GenerateHashTab, CompareHashTab,
  CompareFilesTab) now use `<Button loading loadingLabel>`, completing Round
  2's "all module pages use `<Button>`" claim. The only remaining raw primary
  button is the documented QR Download PNG exception above.
- **FallbackCommands stay visible while hashing** — the terminal-command
  suggestion used to unmount the moment hashing started (gated on
  `!isComputing`/`!isComparing`) and reappear only when it finished. The gate
  is removed; the commands persist through compute next to the progress bar
  (see the module status section).
- **FileInput re-selection** — the hidden `<input type="file">` clears its
  value after each selection, so re-picking the *same* file re-fires `change`
  instead of silently doing nothing (e.g. re-verifying a file after Reset).
- **DragGuard scoped to file drags** — `DragGuard.js` only calls
  `preventDefault()` when `dataTransfer.types` includes `Files`, so dragging
  text into inputs/textareas keeps the browser's native insert behaviour
  while file-drop protection (no navigation away on stray drops) is
  unchanged.
- **Tests** — `src/__tests__/passwordGen.test.js` and
  `src/__tests__/wordlist.test.js` added (rejection-sampling boundary,
  Fisher–Yates determinism, entropy formulas incl. the inclusion-exclusion
  guaranteed case, wordlist parse/validate thresholds, passphrase
  generation). 95 tests total.

**Round 5 — Baseline hardening** (pre-git baseline prep)

- **TOTP logging normalised** — no longer logs when a pasted secret first
  parses; it logs on the meaningful actions: copying a generated code
  ("Copied a TOTP code", coarse `source` only — `otpauth`/`raw`/`random`)
  and generating a random secret. Matches the Password/Passphrase generator
  "log at copy" convention. (`totp/page.js`, `src/lib/totp.js`)
- **Pure logic extracted from three module pages** — `toBase64`/`fromBase64`
  (`src/lib/base64.js`), `decodeSegment`/`parseJWT`/`formatTimestamp`/
  `relativeTime` (`src/lib/jwt.js`), and `parseTOTP`/`generateRandomSecret`
  (`src/lib/totp.js`) moved out of the pages so they're unit-testable. Page
  behaviour otherwise unchanged.
- **TOTP random secrets are now genuinely 160-bit** — `generateRandomSecret`
  previously produced a 20-char secret (100 bits) despite its comment
  claiming 160; it now draws 32 bytes for a 32-char secret (32 divides 256
  evenly, so the `% 32` mapping stays unbiased). (`src/lib/totp.js`)
- **QR content analysis fixed: prefix formats now beat the URL branch** —
  `analyzeQRContent` (`src/lib/qr.js`) checked the URL case first, and WiFi /
  vCard / mailto / SMS payloads all parse as URLs (valid schemes), so those
  branches were dead code — a WiFi QR payload was classified as a URL. The
  prefix checks now run first, and the SMS regex accepts plain `sms:` in
  addition to `smsto:`. These heuristics drive the security framing on the QR
  decode page, which is why they're worth pinning down.
- **Tests** — `base64`, `jwt`, `totp`, and `contentAnalysis` suites added
  (heuristic fixture tables for QR + clipboard analysis). 57 new tests,
  152 total; the contentAnalysis fixtures surfaced the QR prefix bug above.

**Documentation policy**

- Review-pass documents (`docs/internal/CODE_REVIEW.md`,
  `docs/internal/CLAUDE_REVIEW_00.md`, `docs/internal/CLAUDE_REVIEW_01.md`)
  and the module-ideas backlog (`docs/internal/MODULE_IDEAS.md`) contain
  internal audit commentary and are **gitignored** — kept in `docs/internal/`,
  never committed. Their decisions are distilled into this file and the
  `CHANGELOG.md`; don't recreate or re-add them.
- UI/component tests (`useCopyToClipboard`, `usePreference`, `ResultCard`,
  `Button`, text-hash coalescing) are deliberately **not** implemented — they'd
  require a React-render test harness (e.g. `@testing-library/react`), which
  adds complexity the project doesn't need. All automated tests are
  pure-logic unit tests in `src/__tests__/`.

**Round 6 — First-commit baseline review** (post-review cleanup)

- **CSP hardened** (`next.config.mjs`) — added `object-src 'none'`, `base-uri
  'none'`, and `form-action 'none'` so the policy covers plugin/embed, base-tag
  takeover, and in-page form submission vectors.
- **QR classification is http/https-only** (`src/lib/qr.js`) — the URL branch
  now rejects any other scheme that still parses as a URL (`javascript:`,
  `data:`, `file:`, …), which falls through to the plain-text branch. The
  Decode tab therefore never renders a clickable "Open" link or labels a
  non-web scheme a normal URL.
- **Fingerprint data-point count shared** (`src/app/modules/fingerprint/page.js`)
  — the summary banner and the activity log both derive from `countDataPoints()`
  so they can't drift out of sync.
- **Guessability worker reports errors structurally**
  (`src/app/modules/guessability/guessability.worker.js` + `page.js`) — the
  worker wraps analysis in try/catch and posts `{ error }`; the page clears
  `isAnalyzing` and shows the worker error via the shared error banner.
- **Base64 decode-error sentinel renamed** — `"invalid"` → `"INVALID_BASE64"`
  in `src/app/modules/base64/page.js`, matching the app's error-code convention.
- **Naming/consistency** — package renamed `frontend` → `sentinel` in
  `package.json` + lockfile; README's File Integrity algorithm list corrected
  to include all five (MD5, SHA-1, SHA-256, SHA-384, SHA-512).
- **EXIF privacy-summary gap fixed** (`src/lib/exif.js`) — `privacySummary`
  compared with `!== null`, so an `undefined` field on an empty group counted
  as "present" and would have logged a phantom serial/timestamp claim. Now uses
  `!= null`.
- **Tests** — `exif` suite added (`privacySummary` + display formatters, the
  latter also pinning the fix above) and a `contentAnalysis` case for the
  non-web-scheme fallthrough. **173 tests total** (was 159 before this round).
- **Follow-up review remediation** (see `docs/internal/CLAUDE_REVIEW_02.md`,
  gitignored) — the fingerprint activity log dropped its 8-hex
  `canvasHashPrefix` (a truncated digest of a device-identifying signal is
  still a digest; the full hash remains on screen, never persisted); `worker-src`
  tightened to `'self'` (both workers are same-origin script files, no blob
  workers exist); SMS classification tightened to `/^(sms|smsto):/i` so the
  non-scheme `smst:` falls through to plain text; per-module `Accent:` lines
  reconciled with `modules.js`; settings paths corrected for the `(shell)`
  route group; Reset section now documents all three affordances; README's
  Node minimum raised to 20.9+ (Next 16 requires it) with a matching `engines`
  field.

## Settings & preferences

Location: `src/app/(shell)/settings/page.js`, reached via the gear icon in `TopBar`.

Three sections:

- **Appearance** — theme toggle (Light / System / Dark) and colour scheme
  picker (WAI-ARIA radiogroup, roving tabindex + arrow keys). The scheme
  picker stores the selection in `localStorage` and sets `data-scheme` on
  `<html>`. Five schemes available, all Sentinel originals: Sentinel,
  Ember, Moss, Dusk, Graphite.
- **Modules** — a single "Manage modules →" link row that navigates to
  `/settings/modules` (see below). Kept as a link rather than an inline list
  to avoid cluttering the main settings page.
- **Reset** — three danger rows, each with its own confirm/cancel pattern
  (matching the activity page's "Clear all" UX) rather than acting immediately:
  - **Reset all preferences to defaults** — clears the entire `preferences`
    IndexedDB store and reloads the page. Theme is unaffected. Any preferences
    added in future are automatically covered by the store-wide clear.
  - **Clear activity log** — permanently deletes the `activity` store. Cannot
    be undone.
  - **Reset everything** — clears both stores (preferences + activity) in one
    go and reloads the page. The post-reload success banner reads the
    `?reset=1` / `?reset=everything` URL param synchronously in an effect.

## Module management

Location: `src/app/(shell)/settings/modules/page.js`, reached from Settings → Manage modules.

Lets users choose which modules appear on the home screen. Modules are grouped
by category, each with a toggle switch. "Enable all" / "Disable all" controls
at the top with a live count of hidden modules. An empty-state warning appears
when all modules are disabled.

Disabled module ids are stored as an array under `preferences["disabled-modules"]`
via `usePreference`. The home screen (`src/app/page.js`) reads this preference
and filters out disabled modules from both the category grid and the search
results. The module grid is gated on `isLoading === false` (the third value
returned by `usePreference`) to prevent a flicker where all modules flash
visible before the stored disabled set is applied. Disabled modules remain
directly navigable by URL — the preference only affects the home screen grid.

## Module 1: File Integrity — detailed status

Location: `src/app/modules/file-integrity/`

Three tabs, each a separate component, sharing one core hashing utility
(`src/lib/hashing.js` — `computeHashes(file, algorithms, { onProgress })`,
which spawns `src/lib/hashing.worker.js` to stream the file through
incremental **hash-wasm** hashers — see below for the streaming design;
digests verified correct against `sha256sum`/`md5sum` on the command line):

1. **`GenerateHashTab.js`** — user selects a file, picks algorithm(s) via
   checkboxes (SHA-256 default-checked; MD5/SHA-1 behind a legacy toggle),
   computes and displays all selected hashes with copy buttons.
2. **`CompareHashTab.js`** — user selects a file and pastes a known hash;
   algorithm is **auto-detected from the pasted hash's length** (32=MD5,
   40=SHA-1, 64=SHA-256, 96=SHA-384, 128=SHA-512); shows match/mismatch.
3. **`CompareFilesTab.js`** — user selects two files; defaults to SHA-256
   (hidden radio-button toggle to pick a different single algorithm); **short-
   circuits on size mismatch** (skips hashing entirely if sizes already differ,
   since identical files must be the same size) with a "Hash anyway" button to
   force computation and see real values regardless.

**Completed for Module 1:**
- ✅ All three tabs functionally correct, verified against system hash tools
- ✅ Scan history persistence via `saveActivity()` — activity records the
  algorithms used, file sizes, and the match outcome, but **never the digest
  values or filenames** (a hash of a secret is a secret; a filename can be
  equally identifying). Consistent with the app-wide invariant in AGENTS.md.
- ✅ Explain/Recommend language layer on every outcome
- ✅ Large-file terminal commands — for files over ~2 GB the tabs show
  OS-specific terminal commands (`FallbackCommands.js` +
  `src/lib/fallbackCommands.js`) as an optional, usually-faster alternative.
  This is advisory only: hashing in-browser always works (it streams), so
  nobody is forced to use a terminal. The old user-configurable
  `maxFileSizeMb` cap was removed when the streaming rework made memory a
  non-issue — the threshold is now the hardcoded
  `BIG_FILE_SUGGESTION_BYTES` constant (2 GB) in `src/lib/hashing.js`. The
  commands stay visible while the browser hash is running (they used to
  unmount for the duration of the compute — the exact window in which the
  alternative is most useful), so they're always available next to the
  progress bar.
- ✅ **Chunked/streamed hashing** — hashing runs in a Web Worker
  (`src/lib/hashing.worker.js` over the pure core in `src/lib/hashingCore.js`),
  reading the file in ~64KB stream chunks into incremental hash-wasm hashers.
  The whole file is never in memory at once (memory stays bounded to the chunk
  size regardless of the file's size), the main thread never freezes, and the
  UI shows a live progress bar (`HashProgress.js`, throttled by the worker to
  a few updates/sec). **`js-md5` and `crypto.subtle.digest` are both gone from
  this path**: hash-wasm provides a streaming MD5 too, so one WASM library
  covers all five algorithms with a consistent `init/update/digest` interface.
  Output is byte-identical to one-shot hashing (covered by
  `src/__tests__/hashing.test.js`).

## EXIF Metadata Inspection — detailed status

Location: `src/lib/exif.js` + `src/app/modules/exif/page.js`

- `parseExif(file)` wraps `exifr` (dynamically imported), returns
  `{ location, device, timestamps, technical }` with normalised null values.
  GPS ref tags applied manually for correct signed coordinates.
  `normEmpty()` strips empty/dash strings; `normZero()` strips zeroed-out IFD values.
- Single-page module with image preview (`createObjectURL`), four collapsible
  `MetadataGroup` sections (Location / Device / Timestamps / Technical).
- GPS copy button + OpenStreetMap link when coordinates are present.
- `ActionBlock` with per-platform `RemovalGuide` accordions (iOS, Android,
  Mac, Windows, Linux) — uses the shared `CodeBlock` component for terminal
  commands.
- Activity logging: `{ hasLocation, hasDevice }` flags only (plus coarse
  size/mime) — never the actual metadata values or the filename.
- Accent: `amber`.

## Password Generator — detailed status

Location: `src/lib/passwordGen.js` + `src/app/modules/password-generator/page.js`

- Customizable length (8–128), character classes (lowercase/uppercase/digits/
  symbols), exclude-ambiguous-characters toggle, custom exclusion list, and a
  "guarantee one of each selected class" toggle — sane defaults, advanced
  options behind a disclosure.
- Generation uses `crypto.getRandomValues()` with rejection sampling (no
  modulo bias).
- Entropy calculated exactly (not estimated).
- UI is live/continuous: password auto-generates on load and regenerates
  immediately on any settings change.
- Activity logging at **copy-time** only; logs metadata never the password.
- ✅ Settings persisted via `usePreference("password-generator.options",
  DEFAULT_OPTIONS)` — options load from IndexedDB on mount and write back on
  every change. On load, stored options are merged over `DEFAULT_OPTIONS` so
  any new keys added in future always get their defaults. The per-page Reset
  button also clears the persisted value via `deletePreference`.

## Passphrase Generator — detailed status

Location: `src/lib/wordlist.js` + `src/app/modules/passphrase-generator/page.js`

- Diceware-style: random words drawn from a wordlist with `crypto.getRandomValues()`.
- Multiple built-in wordlists (EFF long list and others); custom `.txt` wordlist
  upload (one word per line) with validation and warnings for small lists.
- Configurable word count, separator, and word case (cosmetic only — noted in UI
  as not adding entropy).
- Entropy calculated per-word and total; strength label shown prominently.
- Activity logging at copy-time only.
- ✅ Settings persisted as a single object under
  `usePreference("passphrase-generator.settings", DEFAULT_SETTINGS)` covering
  `selectedListId`, `wordCount`, `separator`, and `wordCase`. Custom wordlist
  file is not persisted (File objects aren't JSON-serializable; re-uploading
  per session is the right UX). Per-page Reset clears the persisted value.

## HIBP Breach Check — detailed status

Location: `src/lib/hibp.js` + `src/app/modules/hibp/page.js`

- Uses HIBP's Pwned Passwords k-anonymity API: only the first 5 hex characters
  of the SHA-1 hash are sent; matching happens locally. Full password and hash
  never leave the device.
- Requests include the `Add-Padding: true` header so response size can't be
  correlated back to the queried prefix.
- Masked-by-default password input with show/hide toggle.
- Explicit "Check password" action (not live/continuous — avoids a network
  request per keystroke).
- A live transparency card shows the exact SHA-1 prefix and resolved
  `api.pwnedpasswords.com/range/<prefix>` URL that a check would send,
  recomputed as the password is typed. The endpoint is a link (opens the queried
  range in a new tab, `rel="noopener noreferrer"`). Display-only: the prefix is
  never written to the activity log.
- Network failures show a clear retry state.
- Activity logging: `{ breached: true/false }` + timestamp only — never the
  password, hash, or breach count.

## Guessability — detailed status

Location: `src/lib/guessability.js` + `src/app/modules/guessability/page.js`

- Uses `zxcvbn-ts` (`@zxcvbn-ts/core` + `@zxcvbn-ts/language-common` +
  `@zxcvbn-ts/language-en`). Note: current API is a factory
  (`new ZxcvbnFactory(options)` + `.check(password)`, camelCase result fields).
- Button-triggered analysis — the user explicitly clicks "Analyze password"
  (no live/debounced re-analysis as they type), capped at 128 characters
  (`MAX_PASSWORD_LENGTH`, matching the password generator).
- No activity logging — a guessability score is too revealing to persist even
  without storing the password.
- Headlines "offline slow hash" crack-time as the primary number.
- Runs in a dedicated Web Worker (`guessability.worker.js`, instantiated with
  `new URL(..., import.meta.url)`) so the main thread stays free — worst case
  ~11s at the 128-char cap.
- **Score fidelity + context** — the score is zxcvbn-ts's own, not
  post-processed (verified identical to the reference dropbox zxcvbn on a
  shared sample set). The result also surfaces the dictionary words zxcvbn
  actually matched (`matchedWords`, in the detail section) and flags short
  (2-3 word) all-lowercase phrases of common words: zxcvbn's growing-sequence
  floor (`10000^(submatchCount - 1)`) can push e.g. "hello world" onto the
  score-3 "Good" band even though its words rank ~50-100, so the page shows a
  plain-language note there instead of silently re-scoring. Four-word
  passphrases (the strong-passphrase shape) are deliberately excluded from
  the note.

## Text Encryptor / Decryptor — detailed status

Location: `src/lib/encrypt.js` + `src/app/modules/encryptor/page.js`

- Key derivation: PBKDF2 (SHA-256, 310,000 iterations — OWASP 2023 recommendation),
  16-byte random salt per encryption.
- Encryption: AES-256-GCM, 12-byte random IV per encryption. Authentication tag
  is appended automatically by Web Crypto and verified on decrypt — any tampering
  causes decryption to fail.
- Output format: `sentinel:v1:<base64(salt)>:<base64(iv)>:<base64(ciphertext+tag)>` —
  self-contained, no separate key management needed. The format is Sentinel-specific
  (the colon-delimited packing) but the underlying primitives are standard; any tool
  supporting AES-256-GCM + PBKDF2 can decrypt by parsing the four fields.
- No user-configurable crypto options — algorithm and iteration count are fixed at
  best-practice values to prevent non-expert users from choosing weak settings.
- Two-tab UI (Encrypt / Decrypt), matching the File Integrity tab pattern.
- Encrypt tab: plaintext textarea, passphrase + confirm fields (mismatch warning
  shown after user types in both), Encrypt button disabled until fields match.
  Output displayed in `CodeBlock` with copy button.
- Decrypt tab: ciphertext textarea, passphrase field. Two distinct error states:
  `MALFORMED` (input doesn't match `sentinel:v1:` format) and `DECRYPT_FAILED`
  (wrong passphrase or tampered ciphertext — AES-GCM does not distinguish these
  by design). Decrypted text shown in a plain `div` with a lightweight copy button.
- Activity logging: `{ action: "encrypt"|"decrypt", success: bool }` only —
  never the plaintext, ciphertext, or passphrase.
- No settings persistence — no user-configurable options to store.
- No new npm dependencies — Web Crypto is native to all modern browsers.
- Accent: `violet`.

## Browser Fingerprint — detailed status

Location: `src/lib/fingerprint.js` + `src/app/modules/fingerprint/page.js`

- Collects browser signals using only standard Web APIs — no external
  requests, nothing leaves the device.
- Two tabs: **Passive Exposure** (no-permission signals) and
  **Permission-Gated** (geolocation, camera/mic device enumeration).
- Passive collection is **button-triggered, not automatic**. The Passive tab
  starts at an `idle → loading → done | error` state machine (the same shape
  the Gated sections use): the user clicks "Collect browser data" before
  anything is gathered or logged. This replaced the old mount `useEffect`,
  which ran twice under React StrictMode in dev and logged a duplicate
  activity entry on every page open.
- Activity logging — all three sections log on button press, metadata only:
  - Passive: `{ passiveDataPoints, webglAvailable }` — never the fingerprint
    values or any canvas-hash prefix.
  - Geolocation: `{ granted, highAccuracy, errorType }` — never coordinates.
  - Media: `{ granted, errorType, deviceCount }` — never device labels.
- Canvas probe scene (`PROBE_COLORS` in `src/lib/fingerprint.js`) — the
  colours, fonts, and glyphs drawn to the hidden canvas are **frozen hash
  input**: distinct hues across the gamut plus one alpha-blended pass,
  following common fingerprinting practice. Deliberately never themed
  (a colour-scheme change must not change a device's reported
  fingerprint); post-release edits here would change every user's hash.
- Accent: `violet`.

## Clipboard Inspector — detailed status

Location: `src/lib/clipboard.js` + `src/app/modules/clipboard/page.js`

- Demonstrates what sites can read from and write to the clipboard via the
  Clipboard API, and how silent clipboard overwrites can happen without the
  user noticing.
- Accent: `violet`.

## QR Code — detailed status

Location: `src/lib/qr.js` + `src/app/modules/qr/page.js`

- Decode: reads a QR code image and reveals the full decoded payload (URL or
  text) before the user follows it.
- URL classification is http/https-only: a payload that parses as a URL with
  any other scheme (`javascript:`, `data:`, `file:`, …) is classified as plain
  text, so the Decode tab never renders a clickable "Open" link for a
  non-navigable scheme. (`src/lib/qr.js`)
- Also recognises `otpauth://` TOTP setup URIs (authenticator-app 2FA codes)
  via `parseTOTP` (`src/lib/totp.js`); the detail carries the coarse
  issuer/account/digits/period fields only — never the shared secret — and the
  Decode tab links into the TOTP Generator. Malformed / `hotp` URIs fall
  through to plain text.
- Generate: produces a QR code from user-supplied text or URL, entirely
  client-side.
- Accent: `amber`.

## Text Hash Generator — detailed status

Location: `src/lib/hashing.js` (facade) + `src/lib/hashing.worker.js` +
`src/lib/hashingCore.js` + `src/app/modules/text-hash/page.js`

- Computes SHA-256, SHA-512, MD5, SHA-1 of any file or typed text. The file is
  read in ~64KB stream chunks and fed to incremental hash-wasm hashers inside
  the worker, so memory stays bounded regardless of file size and the main
  thread stays free (the worker throttles progress posts to a few/sec).
  `hash-wasm`'s WASM is base64-inlined, so no `wasm-src` CSP entry is needed —
  but compiling those inlined bytes (`WebAssembly.compile`) is still gated by
  `script-src`, so the CSP includes `'wasm-unsafe-eval'` (broad `'unsafe-eval'`
  stays dev-only).
- Activity logging is coarse: `subType` + length bucket + a 30s coalescing
  window — never file names, filenames, or digests.
- Accent: `blue`.

## Base64 Encoder / Decoder — detailed status

Location: `src/lib/base64.js` + `src/app/modules/base64/page.js`

- `toBase64`/`fromBase64` with standard and URL-safe variants; tolerant
  decoding and base64-padding repair on input.
- Accent: `blue`.

## JWT Inspector — detailed status

Location: `src/lib/jwt.js` + `src/app/modules/jwt-inspector/page.js`

- Client-side JWT decode: `parseJWT` validates the header and payload JSON and
  exposes `formatTimestamp`/`relativeTime` for the exp/iat/iss claims; the
  page flags dangerous/weak algorithms.
- Activity logging records only that a token was decoded — never the token
  itself.
- Accent: `blue`.

## TOTP Generator — detailed status

Location: `src/lib/totp.js` + `src/app/modules/totp/page.js`

- Generates TOTP codes from otpauth:// URIs or raw Base32 secrets (`parseTOTP`,
  otpauth library) or a CSPRNG-generated random secret (`generateRandomSecret` —
  32 bytes → 32-char Base32, 160-bit, unbiased).
- Logs at the meaningful actions only (copy / random-secret generation) with
  coarse `source` metadata (`otpauth`/`raw`/`random`) — never the secret, code,
  or issuer.
- Accent: `blue`.

## Frontend structure

```
src/
├── lib/
│   ├── hashing.js           # computeHashes(file, algorithms)
│   ├── db.js                # IndexedDB — activity + preferences stores (v2)
│   ├── api.js               # saveActivity()
│   ├── fallbackCommands.js  # buildCommand(os, algorithm, filenames)
│   ├── usePreference.js     # usePreference(key, default, { debounceMs }) hook
│   ├── moduleAccents.js     # accent color map for PageHeader chips
│   ├── colorSchemes.js      # scheme picker registry (id/label/swatch; values live in globals.css)
│   ├── modules.js           # canonical module registry — CATEGORIES array + ALL_MODULES flat list
│   ├── activityStats.js     # recordsToStats()/computeActivityStats()/buildDailySeries() — pure, deterministic
│   ├── passwordGen.js       # generatePassword(), entropy calculations
│   ├── wordlist.js          # passphrase generation, wordlist validation
│   ├── hibp.js              # sha1Hex(), checkPasswordBreach()
│   ├── guessability.js      # analyzePassword() — zxcvbn-ts wrapper
│   ├── pinAnalyser.js       # analyzePIN() — numeric PIN pattern detector
│   ├── exif.js              # parseExif(file) — exifr wrapper, normalised output
│   ├── encrypt.js           # encryptText(), decryptText() — AES-256-GCM via Web Crypto
│   ├── fingerprint.js       # browser fingerprint signal collection
│   ├── clipboard.js         # clipboard read/write inspection helpers
│   ├── qr.js                # QR decode + generate
│   ├── base64.js            # toBase64()/fromBase64() — standard + URL-safe
│   ├── jwt.js               # decodeSegment()/parseJWT()/formatTimestamp()/relativeTime()
│   ├── totp.js              # parseTOTP() (otpauth) + generateRandomSecret() (160-bit)
│   ├── hashingCore.js       # incremental hash-wasm hasher setup
│   ├── hashing.worker.js    # worker — chunked file hashing + progress posts
│   ├── useModuleId.js       # useModuleId() — canonical module id from pathname
│   └── useCopyToClipboard.js  # useCopyToClipboard(timeout) hook → [copied, copy]
├── components/
│   ├── ResultCard.js        # verdict-rail result display w/ collapsible explanation
│   ├── GeneratorResultCard.js  # hero output panel for generators
│   ├── PageHeader.js        # accent icon chip + title + description
│   ├── ModulePage.js        # <main> shell + max-w-2xl + PageHeader — used by all module pages
│   ├── PageShell.js         # shared shell wrapper for top-level (shell) pages
│   ├── ModuleCard.js        # home grid module card (icon, title, accent)
│   ├── Button.js            # primary (teal) and ghost (text + optional RotateCcw) variants
│   ├── CopyButton.js        # icon-only copy button (Copy→Check, 1500ms)
│   ├── Tabs.js              # tab bar (tabs/activeTab/onChange) — used by encryptor, file-integrity, fingerprint, qr
│   ├── OptionRow.js         # shared checkbox/radio row
│   ├── CodeBlock.js         # always-dark terminal block with copy button
│   ├── FileInput.js
│   ├── PasswordField.js
│   ├── TopBar.js            # home/history/settings nav icons
│   ├── ScrollToTop.js       # scroll restore on navigation
│   ├── ThemeToggle.js       # now rendered in Settings, not TopBar
 │   ├── SchemePicker.js     # colour scheme radiogroup (roving tabindex, Settings)
│   └── DragGuard.js
└── app/
    ├── globals.css           # design tokens, manual light/dark theme,
    │                         # 5 original schemes as :root/.dark[data-scheme]
    │                         # overrides (13 tokens each),
    │                         # global :focus-visible in @layer base (overridable by Tailwind utilities)
    ├── layout.js             # fonts + themeInitScript (localStorage + data-scheme, pre-paint)
    ├── page.js               # home screen — reads CATEGORIES from lib/modules.js, filters disabled modules
    ├── (shell)/
    │   ├── layout.js         # shared shell layout (TopBar + PageShell)
    │   ├── activity/
    │   │   ├── page.js          # thin shell — fetches records once, owns tab/error/delete state
    │   │   ├── LogTab.js        # existing log panel (filter, expand, delete) as a tab
    │   │   └── SummaryTab.js    # stats panel — presentational, derives from the same records
    │   └── settings/
    │       ├── page.js       # Appearance / Modules link / Reset sections
    │       └── modules/
    │           └── page.js   # module management — per-module toggles + enable/disable all
    └── modules/
        ├── file-integrity/
        │   ├── page.js
        │   ├── GenerateHashTab.js
        │   ├── CompareHashTab.js
        │   ├── CompareFilesTab.js
        │   ├── HashProgress.js
        │   └── FallbackCommands.js
        ├── exif/
        │   └── page.js
        ├── password-generator/
        │   └── page.js
        ├── passphrase-generator/
        │   └── page.js
        ├── hibp/
        │   └── page.js
        ├── guessability/
        │   └── page.js
        ├── encryptor/
        │   └── page.js
        ├── fingerprint/
        │   └── page.js
        ├── clipboard/
        │   └── page.js
        ├── qr/
        │   ├── page.js
        │   ├── generateOptions.js
        │   ├── DecodeTab.js
        │   ├── GenerateTab.js
        │   └── WiFiTab.js
        ├── text-hash/
        │   └── page.js
        ├── base64/
        │   └── page.js
        ├── jwt-inspector/
        │   └── page.js
        └── totp/
            └── page.js
```

Run manually: `npm run dev`

## Dev convenience scripts (repo root)

- **`dev.sh`** — runs `npm run dev`.
- **`setup.sh`** — runs `npm install`.
- **`backup.sh`** — zips the project (excluding `node_modules`, `.next`, `.git`)
  into `~/sentinel-backups/` with a timestamped filename.

## Not yet started

- Favourites (deferred)
- Full collapse/expand motion animation (Phase 4 scope — needs manual visual
  verification; targeted micro-animations landed in Phase 8)
- Any authentication (intentionally out of scope)
