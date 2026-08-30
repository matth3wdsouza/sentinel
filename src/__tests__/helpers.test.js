import { describe, it, expect } from "vitest";
import { toggleAlgorithm } from "@/lib/hashing";
import { formatBytes } from "@/lib/format";
import { osmLink } from "@/lib/geo";
import { computeVerdict, DANGER, WARNING, INFO } from "@/lib/severity";
import { SUSPICIOUS_TLDS, TRACKING_PARAMS } from "@/lib/urlSignals";

describe("toggleAlgorithm", () => {
  it("adds an algorithm that is not yet selected", () => {
    expect(toggleAlgorithm("SHA-1", ["SHA-256"])).toEqual(["SHA-256", "SHA-1"]);
  });

  it("removes an algorithm that is already selected", () => {
    expect(toggleAlgorithm("SHA-256", ["SHA-256", "MD5"])).toEqual(["MD5"]);
  });
});

describe("formatBytes", () => {
  it("formats bytes below a kilobyte", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB, MB, and GB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
  });
});

describe("osmLink", () => {
  it("builds an OpenStreetMap deep link with the given zoom", () => {
    expect(osmLink(51.5, -0.1, 14)).toBe(
      "https://www.openstreetmap.org/?mlat=51.5&mlon=-0.1&zoom=14"
    );
  });

  it("defaults to zoom 15", () => {
    expect(osmLink(1, 2)).toContain("zoom=15");
  });
});

describe("computeVerdict", () => {
  it("escalates on any danger-level flag", () => {
    const flags = [
      { severity: INFO },
      { severity: WARNING },
      { severity: DANGER },
    ];
    expect(computeVerdict(flags)).toBe("dangerous");
  });

  it("returns suspicious for warning-only flags", () => {
    expect(computeVerdict([{ severity: WARNING }])).toBe("suspicious");
  });

  it("uses the module's own safe token", () => {
    expect(computeVerdict([{ severity: INFO }])).toBe("safe");
    expect(computeVerdict([{ severity: INFO }], { safeToken: "clean" })).toBe(
      "clean"
    );
  });
});

describe("shared url signals", () => {
  it("has one canonical suspicious-TLD set", () => {
    expect(SUSPICIOUS_TLDS.has("xyz")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("sbs")).toBe(true);
    expect(SUSPICIOUS_TLDS.has("com")).toBe(false);
  });

  it("has one canonical tracking-parameter list", () => {
    expect(TRACKING_PARAMS).toContain("utm_source");
    expect(TRACKING_PARAMS).not.toContain("sessionid");
  });
});