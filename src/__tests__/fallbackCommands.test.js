// Tests for src/lib/fallbackCommands.js
//
// What we're checking:
//   - buildCommand single-quotes every filename so shell metacharacters
//     (spaces, $, backticks, quotes, ;, &) are never interpreted
//   - a filename containing a single quote is escaped correctly for both
//     POSIX shells ('\'' sequence) and PowerShell ('' doubling)
//   - the right tool/flag template is picked per OS and algorithm
//   - unknown OS/algorithm combos return null rather than throwing
//   - detectLikelyOS falls back to linux for unrecognised user agents

import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCommand, detectLikelyOS } from "@/lib/fallbackCommands";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildCommand — quoting", () => {
  it("wraps a plain filename in single quotes", () => {
    expect(buildCommand("linux", "SHA-256", ["notes.txt"])).toBe(
      "sha256sum 'notes.txt'"
    );
  });

  it("keeps spaces inside the quotes", () => {
    expect(buildCommand("macos", "SHA-256", ["my file.txt"])).toBe(
      "shasum -a 256 'my file.txt'"
    );
  });

  it("quotes a filename that would break an unquoted command", () => {
    expect(buildCommand("linux", "MD5", ["a; rm -rf ~"])).toBe(
      "md5sum 'a; rm -rf ~'"
    );
  });

  it("escapes a single quote for POSIX shells", () => {
    expect(buildCommand("linux", "MD5", ["it's a file.txt"])).toBe(
      "md5sum 'it'\\''s a file.txt'"
    );
  });

  it("escapes a single quote for PowerShell by doubling", () => {
    expect(buildCommand("windows", "SHA-256", ["it's a file.txt"])).toBe(
      "Get-FileHash 'it''s a file.txt' -Algorithm SHA256"
    );
  });
});

describe("buildCommand — template selection", () => {
  it("returns the md5 tool per OS", () => {
    expect(buildCommand("linux", "MD5", ["a"])).toBe("md5sum 'a'");
    expect(buildCommand("macos", "MD5", ["a"])).toBe("md5 'a'");
    expect(buildCommand("windows", "MD5", ["a"])).toBe(
      "Get-FileHash 'a' -Algorithm MD5"
    );
  });

  it("returns null for an unknown algorithm", () => {
    expect(buildCommand("linux", "SHA-3", ["a"])).toBeNull();
  });

  it("returns null for an unknown OS", () => {
    expect(buildCommand("plan9", "MD5", ["a"])).toBeNull();
  });
});

describe("detectLikelyOS", () => {
  it("detects Windows, macOS, and defaults to Linux", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(detectLikelyOS()).toBe("windows");

    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" });
    expect(detectLikelyOS()).toBe("macos");

    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" });
    expect(detectLikelyOS()).toBe("linux");

    vi.stubGlobal("navigator", { userAgent: "Toaster/1.0" });
    expect(detectLikelyOS()).toBe("linux");
  });
});
