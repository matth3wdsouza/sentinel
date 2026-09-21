// Tests for the content-analysis heuristics in src/lib/qr.js and src/lib/clipboard.js.
//
// What we're checking:
//   - analyzeQRContent: URL classification (tracking params, shortener flags,
//     https/http, cleanUrl), WiFi credential extraction, vCard/mailto/SMS,
//     plain text, and empty input
//   - analyzeContent: URL, card-number, token, password, email, phone, and
//     text classification, plus empty input

import { describe, it, expect } from "vitest";
import { analyzeQRContent } from "@/lib/qr";
import { analyzeContent } from "@/lib/clipboard";

describe("analyzeQRContent — empty", () => {
  it("classifies empty input", () => {
    expect(analyzeQRContent("")).toEqual({ type: "empty", detail: null });
    expect(analyzeQRContent("   ")).toEqual({ type: "empty", detail: null });
    expect(analyzeQRContent(null)).toEqual({ type: "empty", detail: null });
  });
});

describe("analyzeQRContent — URLs", () => {
  it("classifies a plain https URL", () => {
    const result = analyzeQRContent("https://example.com/path");
    expect(result.type).toBe("url");
    expect(result.detail.domain).toBe("example.com");
    expect(result.detail.isHttps).toBe(true);
    expect(result.detail.isHttp).toBe(false);
    expect(result.detail.protocol).toBe("https:");
    expect(result.detail.isShortener).toBe(false);
    expect(result.detail.trackingParams).toEqual([]);
    expect(result.detail.cleanUrl).toBe("https://example.com/path");
  });

  it("flags tracking parameters and strips them in cleanUrl", () => {
    const result = analyzeQRContent("https://example.com/path?utm_source=x&utm_campaign=win&id=42");
    expect(result.detail.trackingParams.sort()).toEqual(["utm_campaign", "utm_source"]);
    expect(result.detail.cleanUrl).toBe("https://example.com/path?id=42");
  });

  it("keeps non-tracking parameters in cleanUrl", () => {
    const result = analyzeQRContent("https://example.com/?fbclid=abc&q=keep");
    expect(result.detail.trackingParams).toEqual(["fbclid"]);
    expect(result.detail.cleanUrl).toBe("https://example.com/?q=keep");
  });

  it("decomposes the URL into copyable parts", () => {
    const result = analyzeQRContent("https://user:pass@example.com:8080/path?q=1#frag");
    expect(result.detail.parts).toEqual({
      protocol: "https:",
      username: "user",
      password: "pass",
      hostname: "example.com",
      port: "8080",
      pathname: "/path",
      search: "?q=1",
      hash: "#frag",
    });
  });

  it("flags URL shorteners and http URLs", () => {
    const result = analyzeQRContent("http://bit.ly/abc123");
    expect(result.type).toBe("url");
    expect(result.detail.isShortener).toBe(true);
    expect(result.detail.isHttp).toBe(true);
    expect(result.detail.isHttps).toBe(false);
  });

  it("does not flag a normal domain as a shortener", () => {
    const result = analyzeQRContent("https://example.com/redirect?ref=x");
    expect(result.detail.isShortener).toBe(false);
  });

  it("does not classify non-web schemes as URLs", () => {
    // Only http/https are navigable links; anything else (javascript:,
    // data:, file:, …) must fall through to plain text so the Decode tab
    // never renders a clickable "Open" link for it.
    expect(analyzeQRContent("javascript:alert(1)").type).toBe("text");
    expect(analyzeQRContent("data:text/plain,hi").type).toBe("text");
    expect(analyzeQRContent("file:///etc/passwd").type).toBe("text");
  });
});

describe("analyzeQRContent — WiFi", () => {
  it("extracts ssid, password, and security type", () => {
    const result = analyzeQRContent("WIFI:T:WPA;S:MyNetwork;P:s3cret;;");
    expect(result.type).toBe("wifi");
    expect(result.detail).toEqual({
      ssid: "MyNetwork",
      password: "s3cret",
      securityType: "WPA",
    });
  });

  it("leaves password null when absent", () => {
    const result = analyzeQRContent("WIFI:T:WPA;S:OpenNet;;");
    expect(result.detail.ssid).toBe("OpenNet");
    expect(result.detail.password).toBe(null);
  });

  it("round-trips escaped semicolons in ssid and password", () => {
    // This is the exact payload the app's own WiFi QR generator produces
    // for SSID "Café;Wifi" / password "p@ss;word".
    const result = analyzeQRContent("WIFI:T:WPA;S:Café\\;Wifi;P:p@ss\\;word;;");
    expect(result.detail).toEqual({
      ssid: "Café;Wifi",
      password: "p@ss;word",
      securityType: "WPA",
    });
  });

  it("unescapes commas, colons, quotes, and backslashes", () => {
    // Generator output for SSID `My,Net:"R1"\`, password `pa"ss;`.
    const result = analyzeQRContent('WIFI:T:WPA;S:My\\,Net\\:\\"R1\\"\\\\;P:pa\\"ss\\;;;');
    expect(result.detail).toEqual({
      ssid: 'My,Net:"R1"\\',
      password: 'pa"ss;',
      securityType: "WPA",
    });
  });

  it("parses a non-WPA payload (open network)", () => {
    const result = analyzeQRContent("WIFI:T:nopass;S:OpenNet;;");
    expect(result.detail.ssid).toBe("OpenNet");
    expect(result.detail.password).toBe(null);
    expect(result.detail.securityType).toBe("nopass");
  });
});

describe("analyzeQRContent — vCard / mailto / SMS", () => {
  it("extracts the name from a vCard", () => {
    const vcard = "BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD";
    expect(analyzeQRContent(vcard)).toEqual({
      type: "vcard",
      detail: { name: "John Doe" },
    });
  });

  it("classifies mailto", () => {
    const result = analyzeQRContent("mailto:user@example.com");
    expect(result.type).toBe("mailto");
    expect(result.detail.value).toBe("user@example.com");
  });

  it("classifies sms / smsto", () => {
    expect(analyzeQRContent("smsto:12345").type).toBe("sms");
    expect(analyzeQRContent("sms:+15551234567").type).toBe("sms");
  });

  it("does not treat smst: as an SMS scheme", () => {
    // "smst:" isn't a real URI scheme — it must not match the SMS branch and
    // falls through to plain text (the URL branch rejects its non-web scheme).
    expect(analyzeQRContent("smst:12345").type).toBe("text");
  });
});

describe("analyzeQRContent — otpauth (2FA setup)", () => {
  it("classifies an otpauth://totp URI with coarse fields only", () => {
    const uri = "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&digits=8";
    const result = analyzeQRContent(uri);
    expect(result.type).toBe("otpauth");
    expect(result.detail).toEqual({
      issuer: "Example",
      account: "alice@example.com",
      period: 30,
      digits: 8,
    });
  });

  it("never surfaces the secret in the detail", () => {
    const uri = "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";
    const result = analyzeQRContent(uri);
    expect(JSON.stringify(result)).not.toContain("JBSWY3DPEHPK3PXP");
  });

  it("falls through to text for a non-TOTP otpauth scheme", () => {
    expect(analyzeQRContent("otpauth://hotp/Example?secret=JBSWY3DPEHPK3PXP&counter=0").type).toBe("text");
  });
});

describe("analyzeQRContent — UPI payment request", () => {
  it("parses a static UPI payload (no amount)", () => {
    const result = analyzeQRContent("upi://pay?pa=merchant@okhdfcbank&pn=Raj%20Stores");
    expect(result.type).toBe("upi");
    expect(result.detail).toMatchObject({
      payeeVpa: "merchant@okhdfcbank",
      payeeName: "Raj Stores",
      amount: null,
      hasAmount: false,
      hasSignature: false,
      malformed: false,
    });
  });

  it("extracts the full optional field set from a dynamic payload", () => {
    const result = analyzeQRContent(
      "upi://pay?pa=merchant@okhdfcbank&pn=Raj%20Stores&am=150.00&cu=INR&tn=Invoice%20001&tr=TXN001&mc=5411&mode=02"
    );
    expect(result.type).toBe("upi");
    expect(result.detail).toMatchObject({
      payeeVpa: "merchant@okhdfcbank",
      payeeName: "Raj Stores",
      amount: "150.00",
      currency: "INR",
      note: "Invoice 001",
      reference: "TXN001",
      merchantCode: "5411",
      mode: "02",
      hasAmount: true,
      malformed: false,
    });
  });

  it("accepts an uppercase UPI://PAY prefix", () => {
    expect(analyzeQRContent("UPI://PAY?pa=x@upi&pn=Y").type).toBe("upi");
  });

  it("decodes plus-encoded values like payment apps do", () => {
    const result = analyzeQRContent("upi://pay?pa=shop@axisbank&pn=Chai+Point&tn=Table+7");
    expect(result.detail.payeeName).toBe("Chai Point");
    expect(result.detail.note).toBe("Table 7");
  });

  it("falls through to text when the payee address is missing", () => {
    expect(analyzeQRContent("upi://pay?pn=OnlyName").type).toBe("text");
    expect(analyzeQRContent("upi://pay").type).toBe("text");
  });

  it("flags an empty or blank payee address as malformed", () => {
    expect(analyzeQRContent("upi://pay?pa=&pn=Y").type).toBe("upi");
    expect(analyzeQRContent("upi://pay?pa=&pn=Y").detail.malformed).toBe(true);
  });

  it("never surfaces the PSP sign signature", () => {
    const result = analyzeQRContent("upi://pay?pa=x@upi&pn=Y&sign=VERYSECRETSIG");
    expect(result.type).toBe("upi");
    expect(JSON.stringify(result)).not.toContain("VERYSECRETSIG");
    expect(result.detail.hasSignature).toBe(true);
  });

  it("flags a malformed VPA or amount", () => {
    expect(analyzeQRContent("upi://pay?pa=not-a-vpa&pn=Y").detail.malformed).toBe(true);
    expect(analyzeQRContent("upi://pay?pa=x@upi&pn=Y&am=abc").detail.malformed).toBe(true);
    expect(analyzeQRContent("upi://pay?pa=x@upi&pn=Y&am=12.345").detail.malformed).toBe(true);
  });
});

describe("analyzeQRContent — text", () => {
  it("falls through to plain text", () => {
    expect(analyzeQRContent("just some text")).toEqual({
      type: "text",
      detail: { length: 14 },
    });
  });
});

describe("analyzeContent — empty", () => {
  it("classifies empty input", () => {
    expect(analyzeContent("")).toEqual({ type: "empty", detail: null });
    expect(analyzeContent(null)).toEqual({ type: "empty", detail: null });
  });
});

describe("analyzeContent — URLs", () => {
  it("classifies a URL with tracking params", () => {
    const result = analyzeContent("https://news.example.com/story?utm_medium=email&fbclid=xyz");
    expect(result.type).toBe("url");
    expect(result.detail.domain).toBe("news.example.com");
    expect(result.detail.trackingParams.sort()).toEqual(["fbclid", "utm_medium"]);
    expect(result.detail.isHttps).toBe(true);
  });

  it("marks non-https URLs", () => {
    const result = analyzeContent("http://example.com");
    expect(result.type).toBe("url");
    expect(result.detail.isHttps).toBe(false);
  });
});

describe("analyzeContent — card, token, password, email, phone", () => {
  it("detects a card number (plain and formatted)", () => {
    expect(analyzeContent("4111111111111111")).toEqual({
      type: "card",
      detail: { digits: 16 },
    });
    expect(analyzeContent("4111 1111 1111 1111")).toEqual({
      type: "card",
      detail: { digits: 16 },
    });
  });

  it("detects a long token", () => {
    const token = "A".repeat(50);
    expect(analyzeContent(token)).toEqual({
      type: "token",
      detail: { length: 50 },
    });
  });

  it("detects a password-like string", () => {
    expect(analyzeContent("P@ssw0rd123")).toEqual({
      type: "password",
      detail: { length: 11 },
    });
  });

  it("detects an email address", () => {
    expect(analyzeContent("user@example.com")).toEqual({
      type: "email",
      detail: { value: "user@example.com" },
    });
  });

  it("detects a phone number with formatting", () => {
    expect(analyzeContent("555-123-4567")).toEqual({ type: "phone", detail: null });
  });
});

describe("analyzeContent — text", () => {
  it("classifies short text", () => {
    expect(analyzeContent("hi")).toEqual({
      type: "text",
      detail: { lines: 1, length: 2 },
    });
  });

  it("classifies multiline text", () => {
    expect(analyzeContent("line one\nline two")).toEqual({
      type: "text",
      detail: { lines: 2, length: 17 },
    });
  });

  it("classifies long single-line text", () => {
    const long = `${"word ".repeat(60)}end`; // 244 chars, contains spaces
    const result = analyzeContent(long);
    expect(result.type).toBe("text");
    expect(result.detail.lines).toBe(1);
    expect(result.detail.length).toBeGreaterThan(200);
  });
});
