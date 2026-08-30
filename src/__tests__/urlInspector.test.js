// Tests for src/lib/urlInspector.js
//
// What we're checking:
//   - analyzeURL returns null for empty/invalid input
//   - parseURL correctly decomposes valid URLs
//   - detectFlags catches all phishing indicators
//   - computeVerdict returns correct severity levels

import { describe, it, expect } from "vitest";
import { analyzeURL, SUSPICIOUS_TLDS, KNOWN_BRANDS } from "@/lib/urlInspector";

describe("analyzeURL", () => {
  it("returns null for empty string", () => {
    expect(analyzeURL("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(analyzeURL("   ")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(analyzeURL("not-a-url")).toBeNull();
    expect(analyzeURL("://missing-scheme")).toBeNull();
  });

  it("parses a clean HTTPS URL as safe", () => {
    const result = analyzeURL("https://example.com");
    expect(result).not.toBeNull();
    expect(result.verdict).toBe("safe");
    expect(result.parsed.hostname).toBe("example.com");
    expect(result.parsed.protocol).toBe("https:");
    expect(result.flags).toHaveLength(0);
  });

  it("parses a URL with all components", () => {
    const result = analyzeURL("https://user:pass@host.com:8080/path?q=1#hash");
    expect(result).not.toBeNull();
    expect(result.parsed.hostname).toBe("host.com");
    expect(result.parsed.port).toBe("8080");
    expect(result.parsed.pathname).toBe("/path");
    expect(result.parsed.searchParams.get("q")).toBe("1");
    expect(result.parsed.hash).toBe("#hash");
  });

  it("trims surrounding whitespace", () => {
    const result = analyzeURL("  https://example.com  ");
    expect(result).not.toBeNull();
    expect(result.verdict).toBe("safe");
  });
});

describe("flags: scheme", () => {
  it("flags HTTP as non-HTTPS", () => {
    const result = analyzeURL("http://example.com");
    expect(result.flags.some((f) => f.type === "no-https")).toBe(true);
    expect(result.verdict).toBe("suspicious");
  });

  it("flags javascript: URI as dangerous", () => {
    const result = analyzeURL("javascript:alert(1)");
    expect(result.flags.some((f) => f.type === "javascript-uri")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("flags data: URI as dangerous", () => {
    const result = analyzeURL("data:text/html,<h1>hi</h1>");
    expect(result.flags.some((f) => f.type === "data-uri")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });
});

describe("flags: hostname", () => {
  it("flags IPv4 literal as dangerous", () => {
    const result = analyzeURL("http://192.168.1.1/login");
    expect(result.flags.some((f) => f.type === "ip-literal")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("flags misleading subdomain", () => {
    const result = analyzeURL("https://google.com.evil.com/login");
    expect(result.flags.some((f) => f.type === "misleading-subdomain")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("flags punycode hostname", () => {
    const result = analyzeURL("https://xn--80ak6aa92e.com");
    expect(result.flags.some((f) => f.type === "punycode-hostname")).toBe(true);
  });

  it("flags suspicious TLD", () => {
    const result = analyzeURL("https://phishing.xyz/login");
    expect(result.flags.some((f) => f.type === "suspicious-tld")).toBe(true);
    expect(result.verdict).toBe("suspicious");
  });

  it("does not flag common legitimate TLDs", () => {
    const result = analyzeURL("https://example.com");
    expect(result.flags.some((f) => f.type === "suspicious-tld")).toBe(false);
  });

  it("flags encoded characters in hostname", () => {
    const result = analyzeURL("https://example%2Ecom.evil.com");
    expect(result.flags.some((f) => f.type === "encoded-hostname")).toBe(true);
  });
});

describe("flags: auth tricks", () => {
  it("flags at-sign auth trick as dangerous", () => {
    const result = analyzeURL("https://google.com@evil.com");
    expect(result.flags.some((f) => f.type === "at-sign-auth")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("flags username in URL", () => {
    const result = analyzeURL("https://admin@evil.com");
    expect(result.flags.some((f) => f.type === "at-sign-auth")).toBe(true);
  });
});

describe("flags: path", () => {
  it("flags deep paths as info", () => {
    const result = analyzeURL("https://example.com/a/b/c/d/e/f/g");
    expect(result.flags.some((f) => f.type === "deep-path")).toBe(true);
  });

  it("flags header injection patterns", () => {
    const result = analyzeURL("https://example.com/path%0d%0aInjected-Header:%20val");
    expect(result.flags.some((f) => f.type === "header-injection")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });
});

describe("flags: query parameters", () => {
  it("flags encoded URL in query param (open redirect)", () => {
    const result = analyzeURL("https://example.com/redirect?url=https%3A%2F%2Fevil.com");
    expect(result.flags.some((f) => f.type === "suspicious-query-params")).toBe(true);
  });

  it("flags javascript: in query param", () => {
    const result = analyzeURL("https://example.com/callback?data=javascript%3Aalert(1)");
    expect(result.flags.some((f) => f.type === "suspicious-query-params")).toBe(true);
  });
});

describe("flags: typosquatting", () => {
  it("flags leet-speak substitution: go0gle → google", () => {
    const result = analyzeURL("https://go0gle.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
    expect(result.flags.find((f) => f.type === "typosquatting").severity).toBe("danger");
  });

  it("flags leet-speak substitution: gmai1 → gmail", () => {
    const result = analyzeURL("https://gmai1.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
    expect(result.flags.find((f) => f.type === "typosquatting").severity).toBe("danger");
  });

  it("flags leet-speak substitution: paypa1 → paypal", () => {
    const result = analyzeURL("https://paypa1.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
    expect(result.flags.find((f) => f.type === "typosquatting").severity).toBe("danger");
  });

  it("flags leet-speak substitution: amaz0n → amazon", () => {
    const result = analyzeURL("https://amaz0n.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });

  it("flags leet-speak substitution: micros0ft → microsoft", () => {
    const result = analyzeURL("https://micros0ft.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });

  it("flags leet-speak substitution: faceb00k → facebook", () => {
    const result = analyzeURL("https://faceb00k.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });

  it("flags near-miss: gmaii (edit distance 1 from gmail)", () => {
    const result = analyzeURL("https://gmaii.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
    expect(result.flags.find((f) => f.type === "typosquatting").severity).toBe("warning");
  });

  it("flags near-miss: gooogle (extra char, distance 1 from google)", () => {
    const result = analyzeURL("https://gooogle.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });

  it("flags near-miss: googl (missing char, distance 1 from google)", () => {
    const result = analyzeURL("https://googl.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });

  it("does not flag exact brand domain: google.com", () => {
    const result = analyzeURL("https://google.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
  });

  it("does not flag completely different words", () => {
    const result = analyzeURL("https://my-apple-store.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
  });

  it("does not flag brands shorter than 3 chars", () => {
    const result = analyzeURL("https://xx.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
  });

  it("flags typosquatting on suspicious TLD as dangerous", () => {
    const result = analyzeURL("https://go0gle.xyz");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
    expect(result.flags.some((f) => f.type === "suspicious-tld")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("flags a brand in a misleading subdomain (HMRC)", () => {
    const result = analyzeURL("https://hmrc.tax-refund-portal.com");
    expect(result.flags.some((f) => f.type === "misleading-subdomain")).toBe(true);
    expect(result.verdict).toBe("dangerous");
  });

  it("does not flag 3-char brand lookalikes as typosquatting (irs)", () => {
    for (const host of ["irk.com", "irr.com", "ires.com"]) {
      const result = analyzeURL(`https://${host}`);
      expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
    }
  });

  it("does not flag 3-char brand lookalikes as typosquatting (ups)", () => {
    const result = analyzeURL("https://ors.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
  });

  it("leaves the real irs.gov unflagged", () => {
    const result = analyzeURL("https://irs.gov");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(false);
  });

  it("still flags leet substitutions of 3-char brands", () => {
    const result = analyzeURL("https://up5.com");
    expect(result.flags.some((f) => f.type === "typosquatting")).toBe(true);
  });
});

describe("verdict", () => {
  it("returns safe for clean URLs", () => {
    expect(analyzeURL("https://example.com").verdict).toBe("safe");
    expect(analyzeURL("https://google.com/search?q=test").verdict).toBe("safe");
  });

  it("returns suspicious for warning-level flags", () => {
    expect(analyzeURL("http://example.com").verdict).toBe("suspicious");
    expect(analyzeURL("https://site.xyz").verdict).toBe("suspicious");
  });

  it("returns dangerous for danger-level flags", () => {
    expect(analyzeURL("javascript:void(0)").verdict).toBe("dangerous");
    expect(analyzeURL("http://10.0.0.1").verdict).toBe("dangerous");
    expect(analyzeURL("https://google.com@evil.com").verdict).toBe("dangerous");
  });
});

describe("constants", () => {
  it("SUSPICIOUS_TLDS contains known phishing TLDs", () => {
    expect(SUSPICIOUS_TLDS.has("xyz")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("top")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("buzz")).toBe(true);
  });

  it("KNOWN_BRANDS contains major brands", () => {
    expect(KNOWN_BRANDS).toContain("google");
    expect(KNOWN_BRANDS).toContain("paypal");
    expect(KNOWN_BRANDS).toContain("apple");
  });
});
