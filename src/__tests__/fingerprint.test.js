// Tests for src/lib/fingerprint.js — parseUserAgent only. The rest of the
// module needs a real browser environment (canvas, navigator, permission
// prompts), so the pure UA parser is the unit-testable surface.

import { describe, it, expect } from "vitest";
import { parseUserAgent } from "@/lib/fingerprint";

describe("parseUserAgent", () => {
  it("identifies Chrome with the Chrome token version", () => {
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(browser).toBe("Chrome 124");
  });

  it("identifies Firefox with the Firefox token version", () => {
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    );
    expect(browser).toBe("Firefox 128");
  });

  it("reports Edge's version from Edg/, not the embedded Chromium version", () => {
    // Chrome/125 appears earlier in the string; the shared-alternation bug
    // reported the engine version. Real product is the Edg token.
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/124.0.0.0",
    );
    expect(browser).toBe("Microsoft Edge 124");
  });

  it("reports Opera's version from OPR/, not the embedded Chromium version", () => {
    // Chromium version (124) and Opera's own version (109) diverge widely.
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/109.0.0.0",
    );
    expect(browser).toBe("Opera 109");
  });

  it("reports legacy Presto Opera's version from Version/", () => {
    const { browser } = parseUserAgent(
      "Opera/9.80 (Windows NT 6.1) Presto/2.12.388 Version/12.18",
    );
    expect(browser).toBe("Opera 12");
  });

  it("reports Samsung Internet's version from SamsungBrowser/", () => {
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 SamsungBrowser/23.0",
    );
    expect(browser).toBe("Samsung Internet 23");
  });

  it("reports Safari's version from Version/, not the WebKit build", () => {
    const { browser } = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    );
    expect(browser).toBe("Safari 17");
  });

  it("returns Unknown browser for unrecognised UAs", () => {
    const { browser } = parseUserAgent("FooBar/1.0 CustomAgent/2.0");
    expect(browser).toBe("Unknown browser");
  });

  it("parses the OS alongside the browser", () => {
    const { os } = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(os).toBe("Windows 10/11");
  });
});