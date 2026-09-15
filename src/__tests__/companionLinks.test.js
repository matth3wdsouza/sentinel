// Tests for the standalone companion-link graph in src/lib/companionLinks.js.
//
// This is a data-integrity suite: the registry exists so the cross-module
// link graph is auditable in one place, so the test enforces the two
// invariants that would otherwise rot silently — every key and every href
// must resolve to a real module, and no module links to itself.

import { describe, it, expect } from "vitest";
import { COMPANION_LINKS, companionLinksFor } from "@/lib/companionLinks";
import { ALL_MODULES } from "@/lib/modules";

const PATH_SET = new Set(ALL_MODULES.map((m) => m.path));

describe("companionLinks registry", () => {
  it("has at least one entry", () => {
    expect(Object.keys(COMPANION_LINKS).length).toBeGreaterThan(0);
  });

  it("keys every source module by a real module path", () => {
    for (const source of Object.keys(COMPANION_LINKS)) {
      expect(PATH_SET.has(source), `source ${source} is not a module path`).toBe(true);
    }
  });

  it("points every link at a real module path", () => {
    for (const [source, links] of Object.entries(COMPANION_LINKS)) {
      for (const { href } of links) {
        expect(PATH_SET.has(href), `${source} → ${href}: not a module path`).toBe(true);
      }
    }
  });

  it("never links a module to itself", () => {
    for (const [source, links] of Object.entries(COMPANION_LINKS)) {
      for (const { href } of links) {
        expect(href, `${source} links to itself`).not.toBe(source);
      }
    }
  });

  it("gives every link a non-empty label", () => {
    for (const [source, links] of Object.entries(COMPANION_LINKS)) {
      for (const { label } of links) {
        expect(typeof label, `${source} has a link without a label`).toBe("string");
        expect(label.trim().length, `${source} label is blank`).toBeGreaterThan(0);
      }
    }
  });
});

describe("companionLinksFor", () => {
  it("returns the registered links for a known path", () => {
    expect(companionLinksFor("/modules/totp")).toEqual(COMPANION_LINKS["/modules/totp"]);
  });

  it("returns [] for a module without links", () => {
    expect(companionLinksFor("/modules/guessability")).toEqual([]);
  });

  it("returns [] for an unregistered path", () => {
    expect(companionLinksFor("/modules/not-a-module")).toEqual([]);
  });
});

describe("file-inspection cluster reciprocity", () => {
  const hrefs = (source) => COMPANION_LINKS[source].map((l) => l.href);

  it("file-integrity links to both file analysis peers", () => {
    expect(hrefs("/modules/file-integrity")).toEqual(
      expect.arrayContaining(["/modules/text-hash", "/modules/file-signature"])
    );
  });

  it("text-hash and file-signature link back to file-integrity", () => {
    expect(hrefs("/modules/text-hash")).toContain("/modules/file-integrity");
    expect(hrefs("/modules/file-signature")).toContain("/modules/file-integrity");
  });
});