import { describe, it, expect } from "vitest";
import {
  analyzeMessage,
  DANGER,
  WARNING,
  INFO,
} from "@/lib/scamAnalyser";

describe("analyzeMessage basics", () => {
  it("returns null for empty, null, or whitespace input", () => {
    expect(analyzeMessage("")).toBeNull();
    expect(analyzeMessage("   \n\t  ")).toBeNull();
    expect(analyzeMessage(null)).toBeNull();
    expect(analyzeMessage(undefined)).toBeNull();
  });

  it("returns clean for plain benign prose", () => {
    const result = analyzeMessage(
      "Hi, hope you're well. Our meeting is moved to Tuesday at 3pm. See you then!"
    );
    expect(result.verdict).toBe("clean");
    expect(result.flags).toHaveLength(0);
    expect(result.counts.urgency).toBe(0);
  });

  it("reports word count", () => {
    const result = analyzeMessage("one two three");
    expect(result.wordCount).toBe(3);
  });
});

describe("credential requests", () => {
  it("flags an OTP request as dangerous", () => {
    const result = analyzeMessage(
      "Your OTP is 482193. Never share this code with anyone."
    );
    expect(result.verdict).toBe("dangerous");
    expect(result.counts.credential).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "credential");
    expect(flag).toMatchObject({ severity: DANGER });
  });

  it("flags account verification language", () => {
    const result = analyzeMessage("Click here to verify your account now.");
    expect(result.verdict).toBe("dangerous");
    expect(result.counts.credential).toBeGreaterThan(0);
  });

  it("matches case-insensitively", () => {
    const result = analyzeMessage("Confirm Your Account details");
    expect(result.counts.credential).toBeGreaterThan(0);
  });
});

describe("financial pressure", () => {
  it("flags a gift-card payment request as dangerous", () => {
    const result = analyzeMessage(
      "Pay the balance with iTunes gift cards or your account is suspended."
    );
    expect(result.verdict).toBe("dangerous");
    expect(result.counts.financial).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "financial");
    expect(flag).toMatchObject({ severity: DANGER });
  });

  it("flags prize / lottery claims", () => {
    const result = analyzeMessage("Congratulations! You have won a prize.");
    expect(result.counts.financial).toBeGreaterThan(0);
  });

  it("flags toll / penalty fees", () => {
    const result = analyzeMessage("Unpaid toll. Pay the late fee immediately.");
    expect(result.counts.financial).toBeGreaterThan(0);
  });
});

describe("secrecy pressure", () => {
  it("flags 'don't tell anyone' as dangerous", () => {
    const result = analyzeMessage(
      "Please keep this between us and don't tell anyone."
    );
    expect(result.verdict).toBe("dangerous");
    expect(result.counts.secrecy).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "secrecy");
    expect(flag).toMatchObject({ severity: DANGER });
  });
});

describe("impersonation", () => {
  it("flags bank impersonation", () => {
    const result = analyzeMessage(
      "We are your bank. There is unusual activity on your account."
    );
    expect(result.counts.impersonation).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "impersonation");
    expect(flag).toMatchObject({ severity: WARNING });
  });

  it("flags courier impersonation", () => {
    const result = analyzeMessage(
      "Your DHL parcel is awaiting a redelivery fee."
    );
    expect(result.counts.impersonation).toBeGreaterThan(0);
  });
});

describe("urgency", () => {
  it("flags urgency language as warning", () => {
    const result = analyzeMessage(
      "Act now — this offer expires within 24 hours."
    );
    expect(result.counts.urgency).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "urgency");
    expect(flag).toMatchObject({ severity: WARNING });
  });
});

describe("links", () => {
  it("flags a shortened URL as suspicious", () => {
    const result = analyzeMessage("Track your package: https://bit.ly/3xYzAbc");
    expect(result.urlCount).toBe(1);
    expect(result.suspiciousUrlCount).toBe(1);
    const flag = result.flags.find((f) => f.category === "links");
    expect(flag).toMatchObject({ severity: WARNING });
  });

  it("flags an unusual-tld domain as suspicious", () => {
    const result = analyzeMessage("Verify here: http://secure-bank.xyz/login");
    expect(result.suspiciousUrlCount).toBe(1);
  });

  it("flags TLDs shared with the URL Inspector (union list)", () => {
    // sbs was previously only in the URL Inspector's list; the shared
    // SUSPICIOUS_TLDS set keeps both modules aligned.
    const result = analyzeMessage("Confirm now: http://secure-bank.site.sbs/verify");
    expect(result.suspiciousUrlCount).toBe(1);
  });

  it("flags a normal-looking link as info only", () => {
    const result = analyzeMessage("More info: https://example.com/help");
    expect(result.urlCount).toBe(1);
    expect(result.suspiciousUrlCount).toBe(0);
    const flag = result.flags.find((f) => f.category === "links");
    expect(flag.severity).toBe(INFO);
  });

  it("counts multiple URLs", () => {
    const result = analyzeMessage(
      "See https://a.com and https://bit.ly/x and http://b.org"
    );
    expect(result.urlCount).toBeLessThanOrEqual(3);
    expect(result.urlCount).toBeGreaterThanOrEqual(2);
  });
});

describe("pressure grammar", () => {
  it("flags all-caps as an info tell", () => {
    const result = analyzeMessage("THIS IS YOUR LAST CHANCE TODAY");
    expect(result.counts.pressure).toBeGreaterThan(0);
    const flag = result.flags.find((f) => f.category === "pressure");
    expect(flag).toMatchObject({ severity: INFO });
  });

  it("flags exclamation overload", () => {
    const result = analyzeMessage("Do it now!!! Don't miss out!!!");
    expect(result.counts.pressure).toBeGreaterThan(0);
  });
});

describe("verdict tiering", () => {
  it("clean when no warnings or dangers", () => {
    const result = analyzeMessage("Dear customer, thank you for your order.");
    expect(result.verdict).toBe("clean");
  });

  it("suspicious when only warnings/info flagged", () => {
    const result = analyzeMessage(
      "Urgent: our parcel service has an issue. Please call us today."
    );
    expect(result.verdict).toBe("suspicious");
  });

  it("dangerous when any danger flag is present", () => {
    const result = analyzeMessage(
      "Verify your account now or it will be locked. Send the code today."
    );
    expect(result.verdict).toBe("dangerous");
  });

  it("flags are ordered with danger categories first", () => {
    const result = analyzeMessage(
      "Urgent bank alert. Send the OTP to verify your account immediately."
    );
    const order = result.flags.map((f) => f.category);
    const credentialIdx = order.indexOf("credential");
    const urgencyIdx = order.indexOf("urgency");
    expect(credentialIdx).toBeGreaterThanOrEqual(0);
    expect(credentialIdx).toBeLessThan(urgencyIdx === -1 ? Infinity : urgencyIdx);
  });
});

describe("privacy-safe output shape", () => {
  it("never exposes the message content, domains, or URLs in the result", () => {
    const secretText = "Our secret password is s3cr3t. Visit https://evil.xyz now!!!";
    const result = analyzeMessage(secretText);
    const serialized = JSON.stringify(result);
    // The analyser may not include the input anywhere in its returned object.
    expect(serialized.includes("s3cr3t")).toBe(false);
    expect(serialized.includes("evil")).toBe(false);
  });
});
