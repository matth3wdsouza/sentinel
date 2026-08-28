# AGENTS.md

Sentinel: a privacy-first security toolkit (Next.js App Router, React 19, Tailwind CSS v4). **Plain JavaScript, no TypeScript, no backend.** Everything runs client-side; `docs/PROJECT_OVERVIEW.md` records every architectural decision — read it before changing existing modules. The repo is version-controlled with git (see "Version control" below).

## Commands

- `npm run dev` — dev server (`./dev.sh`)
- `npm test` — vitest run; add `-t <name>` or pass a file path (`npx vitest run src/__tests__/encrypt.test.js`) to focus
- `npm run test:watch` — watch mode
- `npm run lint` — **has 2 pre-existing errors**, both `react-hooks/set-state-in-effect`: `usePreference.js` (the core persistence hook — a derived-`isLoading` refactor is deferred until it can be unit-tested) and `settings/page.js` (the post-hydration `?reset=` banner — a synchronous read of a URL param, which is the correct shape there). Restructuring those risks behavior changes for low gain, so they're left as-is. Don't "fix" them in unrelated work; only keep your own new code clean. (All other baseline findings were cleaned up: `react/no-unescaped-entities` escaped to entities, unused `eslint-disable` removed, `exhaustive-deps` warnings fixed by adding stable deps, `<img>` given a documented disable.)
- `npm run build` — production build. No typecheck step exists.

Tests: vitest uses **happy-dom**, not jsdom. New tests go in `src/__tests__/*.test.js` and import via the `@/*` alias (mirrored in `vitest.config.js`). `crypto.subtle` works because happy-dom ships Web Crypto. The encrypt large-buffer test is intentionally slow (~140ms, 30s timeout) — don't be alarmed.

## Architecture

- **`src/lib/modules.js` is the canonical module registry** (`CATEGORIES` + flat `ALL_MODULES`). Adding a module means adding it here; the home grid, settings, and accent lookup all derive from it. `status` can be `"available"`/`"coming-soon"`/`"retired"`.
- Current module set: **18 modules across 4 categories** — Passwords & Passphrases, Inspect & Analyse, Developer Tools, Miscellaneous. `src/lib/modules.js` is authoritative; `README.md`'s module list mirrors it.
- Module pages live at `src/app/modules/<id>/page.js`, marked `"use client"`, and are wrapped in `<ModulePage>`. **Do not pass an accent prop** — `ModulePage` derives it from the pathname via `ALL_MODULES`. Accent palette is finite (one hue per category: emerald/amber/blue/violet); reuse, don't mint new hues (`src/lib/moduleAccents.js`).
- Pure logic goes in `src/lib/`, shared UI in `src/components/`. Modules follow an Analyze → Explain → Recommend → Act pattern in the UI.
- **Persistence**: IndexedDB only, via `src/lib/db.js` — two stores: `activity` (log entries, key `module_type`) and `preferences` (upserts via `put()`). Use the `usePreference(key, default, { debounceMs })` hook for persisted component state (sliders want `debounceMs ~300`). **Theme lives in `localStorage`, deliberately NOT in preferences** (see `themeInitScript` in `layout.js`).
- Prebuilt sample-input shortcuts use `TryExamples` in `src/components/` (`{ examples, onLoad }`; examples fill the textarea only — the user still presses Analyse). Rendering is gated on the global `ui.tryExamples` preference, toggled in Settings → Modules.
- Wordlists for the passphrase module are plain `.txt` files in `public/wordlists/`, fetched at runtime. The common-password checker's list is a single `.txt.gz` (`public/wordlists/common-passwords.txt.gz`, NCSC "Top 100,000 passwords", OGL v3.0) decompressed client-side with `DecompressionStream` — same-origin, so it stays fully local. `loadCommonPasswords` (`src/lib/commonPasswords.js`) caches the parsed rank map; pure `parseCommonPasswordList`/`matchCommonPassword` are the tested units, the fetch pipeline is untested (like `loadBuiltInWordlist`).

## Gotchas

- **Strict CSP** in `next.config.mjs`. Any new external network request must be added to `connect-src` (currently only `api.pwnedpasswords.com`). HIBP is the app's single allowed external call (k-anonymity SHA-1 prefix, with the `Add-Padding: true` header so response sizes can't be correlated back to the queried prefix).
- **Privacy invariants**: activity logging records *what you did*, never *what you did it to* — no passwords, digests of inspected content, filenames, ciphertext, or breach counts (see `passwordGen.js`, `hibp.js`, `encrypt.js`, `fingerprint.js`, and the file-integrity/text-hash/EXIF tabs). Coarse metadata only: sizes, algorithms, match outcomes, boolean flags (e.g. fingerprint geolocation/media log `granted`/`errorType`/`deviceCount` — never coordinates or device labels). Guessability deliberately logs nothing. Saving to history uses `saveActivity` from `src/lib/api.js`. The HIBP page shows the exact hash prefix it would send live as you type — **display-only, never passed to `saveActivity`**; likewise the Common Password Checker shows a password's position on the list but logs only the `matchFound` boolean, never the rank.
- CSPRNG is `crypto.getRandomValues` with rejection sampling (`secureRandomInt` in `src/lib/passwordGen.js`) — never `Math.random()` for anything security-related.
- Guessability runs zxcvbn in a Web Worker (`src/app/modules/guessability/guessability.worker.js`, instantiated with `new URL(..., import.meta.url)`) — worst case ~11s at the 128-char cap. Keep it off the main thread.
- **File/text hashing is chunked and streamed in a worker**: `computeHashes` (`src/lib/hashing.js`) is a facade that spawns `src/lib/hashing.worker.js`, which reads the Blob/File in ~64KB stream chunks and feeds them to incremental hash-wasm hashers (`src/lib/hashingCore.js`). The whole file is never materialized in one buffer, so hashing memory is bounded regardless of size — but the file still takes seconds, which is why it's off the main thread. It accepts an `onProgress({done,total})` callback (worker throttles to a few posts/sec) for progress bars. `hash-wasm` replaces both `crypto.subtle.digest` (one-shot only, can't stream) and the old `js-md5`. hash-wasm's WASM is base64-inlined, so no `wasm-src` CSP entry is needed — but compiling those inlined bytes (`WebAssembly.compile`) is still gated by `script-src`, so the CSP must include `'wasm-unsafe-eval'` (broad `'unsafe-eval'` stays dev-only; see `next.config.mjs`).
- `src/lib/guessability.js` caps analysis at 128 chars (`MAX_PASSWORD_LENGTH`), matching the password generator's max.
- `@/*` maps to `src/*` (jsconfig.json + vitest alias). No `next-env.d.ts` typechecking.

## Version control

The repo is under git. Keep it clean:

- Commit messages are short and conventional-style (e.g. `fix:`, `feat:`, `docs:`, `test:`) — one logical change per commit.
- Only stage, commit, or push when the user asks. Never commit secrets.
- The review-pass documents (`docs/internal/CODE_REVIEW*.md`) and the module-ideas backlog (`docs/internal/MODULE_IDEAS.md`) are deliberately **not** committed — they live in `docs/internal/`, which is gitignored. Don't recreate or re-add them; record decisions in `PROJECT_OVERVIEW.md` and `CHANGELOG.md` instead.
