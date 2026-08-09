// Tests for src/lib/hibp.js
//
// What we're checking:
//   - sha1Hex produces the correct output for a known input (regression anchor)
//   - checkPasswordBreach correctly parses a real-shaped HIBP response and
//     reports a breach when the suffix is present
//   - checkPasswordBreach correctly reports no breach when the suffix is absent
//   - Network failures and non-200 responses produce readable error messages,
//     not raw JavaScript error objects
//
// How mocking works here:
//   hibp.js calls the global `fetch` function. In happy-dom (our test
//   environment) that's window.fetch, which we can swap out with a fake using
//   vi.stubGlobal. The code under test never knows it's talking to a fake —
//   it just calls fetch() and gets a Response back, exactly as in the browser.
//   We restore the real fetch after each test so nothing leaks between tests.
//
// A note on the HIBP response format:
//   The real API returns lines like "SUFFIX:COUNT\r\n" (CRLF line endings).
//   Each suffix is the last 35 hex characters of a SHA-1 hash. We build a
//   fake response body using real pre-computed suffixes so the parser sees
//   exactly what it would see in production.

import { describe, it, expect, vi, afterEach } from "vitest";
import { sha1Hex, checkPasswordBreach } from "@/lib/hibp";

// ─── Pre-computed SHA-1 values ───────────────────────────────────────────────
//
// These were computed with Node's crypto module and are stable constants.
// Having them here as readable constants makes the tests self-documenting.
//
//   "password"  →  5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
//                  prefix: 5BAA6   suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
//
//   "qwerty"    →  B1B3773A05C0ED0176787A4F1574FF0075F7521E
//                  prefix: B1B37   suffix: 73A05C0ED0176787A4F1574FF0075F7521E

const PASSWORD_FULL   = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

const QWERTY_SUFFIX   = "73A05C0ED0176787A4F1574FF0075F7521E";

// ─── Helper: build a fake HIBP response ──────────────────────────────────────
//
// The real API returns plain text — one entry per line, CRLF-terminated,
// in the format  SUFFIX:COUNT
// We build a multi-line body with a few realistic-looking dummy entries and
// optionally our real suffix in the mix.

function makeFakeHibpBody(entries) {
  // entries: array of [suffix, count] pairs
  return entries.map(([s, c]) => `${s}:${c}`).join("\r\n");
}

// Restore fetch after every test so stubs don't bleed across test files.
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── sha1Hex ─────────────────────────────────────────────────────────────────

describe("sha1Hex", () => {
  it('returns the correct SHA-1 hex string for "password"', async () => {
    // This is the canonical SHA-1 of the ASCII string "password". If this
    // ever changes it means the hashing implementation broke, which would
    // cause every breach check to look up the wrong hash prefix.
    const result = await sha1Hex("password");
    expect(result).toBe(PASSWORD_FULL);
  });

  it("returns uppercase hex", async () => {
    const result = await sha1Hex("anything");
    expect(result).toBe(result.toUpperCase());
  });

  it("returns a 40-character string (SHA-1 is 160 bits = 20 bytes = 40 hex chars)", async () => {
    const result = await sha1Hex("test");
    expect(result).toHaveLength(40);
  });
});

// ─── checkPasswordBreach — breached ──────────────────────────────────────────

describe("checkPasswordBreach — password found in breach", () => {
  it("returns { breached: true, count: N } when the suffix matches", async () => {
    // Build a fake response body that contains the suffix for "password"
    // alongside some unrelated entries, as the real API would return.
    const fakeBody = makeFakeHibpBody([
      ["AABBCCDDEEFF00112233445566778899AABB", 42],   // unrelated entry
      [PASSWORD_SUFFIX, 9_605_060],                    // "password" — very common
      ["CCDDEEFF00112233445566778899AABBCCDD", 17],   // unrelated entry
    ]);

    // Swap out global fetch for a function that immediately returns our
    // fake response. new Response() is available because we're in happy-dom.
    vi.stubGlobal("fetch", async () => new Response(fakeBody, { status: 200 }));

    const result = await checkPasswordBreach("password");

    expect(result.breached).toBe(true);
    expect(result.count).toBe(9_605_060);
  });
});

// ─── checkPasswordBreach — not breached ──────────────────────────────────────

describe("checkPasswordBreach — password not found in breach", () => {
  it("returns { breached: false, count: 0 } when the suffix is absent", async () => {
    // A response body that contains entries for other suffixes but NOT
    // the one for "qwerty". The parser should find no match.
    const fakeBody = makeFakeHibpBody([
      ["AABBCCDDEEFF00112233445566778899AABB", 100],
      ["FFEEDDCCBBAA99887766554433221100FFEE", 55],
    ]);

    vi.stubGlobal("fetch", async () => new Response(fakeBody, { status: 200 }));

    const result = await checkPasswordBreach("qwerty");

    expect(result.breached).toBe(false);
    expect(result.count).toBe(0);
  });
});

// ─── checkPasswordBreach — k-anonymity hardening ────────────────────────────

describe("checkPasswordBreach — k-anonymity hardening", () => {
  it("sends the Add-Padding header so response size doesn't reveal the prefix", async () => {
    // Without Add-Padding, the response size scales with how many suffixes
    // match the queried prefix — a network observer could correlate sizes to
    // narrow down which password was checked. The header forces HIBP to pad
    // responses to a constant size. Regression-guard it here.
    let sentRequest;
    vi.stubGlobal("fetch", async (url, init) => {
      sentRequest = { url, init };
      return new Response(makeFakeHibpBody([]), { status: 200 });
    });

    await checkPasswordBreach("password");

    expect(sentRequest.init.headers["Add-Padding"]).toBe("true");
  });
});

// ─── checkPasswordBreach — network failures ──────────────────────────────────
//
// The code has two failure modes we need to cover separately:
//   1. fetch() itself throws (no internet, DNS failure, timeout)
//   2. fetch() succeeds but the server returns a non-200 status

describe("checkPasswordBreach — network failure", () => {
  it("surfaces a user-readable message when fetch throws", async () => {
    // Simulate no internet connection: fetch rejects with a TypeError,
    // which is what browsers throw for network errors.
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    // The function should catch the TypeError and re-throw a friendlier Error.
    await expect(checkPasswordBreach("password")).rejects.toThrow(
      "Couldn't reach the breach-check service"
    );
  });

  it("surfaces a user-readable message when the API returns a non-200 status", async () => {
    // Simulate a server-side error (rate limit, maintenance, etc.)
    vi.stubGlobal(
      "fetch",
      async () => new Response("Service Unavailable", { status: 503 })
    );

    await expect(checkPasswordBreach("password")).rejects.toThrow(
      "unexpected error (503)"
    );
  });

  it("error messages do not expose raw JavaScript error internals", async () => {
    // This test is a belt-and-suspenders check: the message the user sees
    // should be a plain English sentence, not something like
    // "TypeError: Failed to fetch" or "[object Object]".
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    let thrownMessage = "";
    try {
      await checkPasswordBreach("password");
    } catch (e) {
      thrownMessage = e.message;
    }

    expect(thrownMessage).not.toContain("TypeError");
    expect(thrownMessage.length).toBeGreaterThan(10); // not an empty string
  });
});
