// moduleBridge.js — same-tab payload hand-off between modules.
//
// The web-analog of an "intent": a module that produces a value (a scanned
// URL, an otpauth URI, …) can hand it to a consumer module so the user
// doesn't copy-paste — and, critically, without ever putting the value in the
// URL, address bar, browser history, storage, or the activity log.
//
// Semantics are deliberately like server-side "flash attributes":
//   • one slot per target module path; the last stored value wins;
//   • reading consumes (single-use);
//   • the backing store is module-scope memory only — a hard reload or a new
//     tab simply has no pending payload, and nothing is written to disk.
//
// Payload contract (defense in depth — module code is same-origin and
// trusted, but modules other than the QR pilot will reuse this primitive, so
// out-of-contract values must fail loudly rather than silently seed a
// textarea or grow memory):
//   • a payload is a non-empty string, bounded in size (MAX_PAYLOAD_LENGTH);
//   • `from` is an optional short display label (string, capped) — shown as
//     text only, never rendered as HTML;
//   • a slot key is the consuming module's path. Keys are intentionally NOT
//     validated against the module registry (the lib stays
//     registry-independent); a mistyped key is a quiet no-op, so callers
//     must pass literal module paths.
// `storePendingPayload` refuses anything outside the contract: it returns
// false and logs a static warning — the payload itself is never logged.

const pending = new Map(); // path -> { value, from }

export const MAX_PAYLOAD_LENGTH = 256 * 1024; // 256 KiB — ample for any module value
export const MAX_FROM_LENGTH = 80;

export function storePendingPayload(path, value, from = null) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_PAYLOAD_LENGTH) {
    // Static message only — never echo the payload.
    console.warn(
      `[moduleBridge] refusing payload for "${path}": expected a non-empty string of at most ${MAX_PAYLOAD_LENGTH} chars`
    );
    return false;
  }
  pending.set(path, {
    value,
    from:
      typeof from === "string" && from.length > 0 && from.length <= MAX_FROM_LENGTH
        ? from
        : null,
  });
  return true;
}

export function peekPendingPayload(path) {
  return pending.get(path) ?? null;
}

export function consumePendingPayload(path) {
  if (!pending.has(path)) return null;
  const data = pending.get(path);
  pending.delete(path);
  return data;
}

export function clearPendingPayload(path) {
  pending.delete(path);
}

export function hasPendingPayload(path) {
  return pending.has(path);
}