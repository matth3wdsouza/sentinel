import { describe, it, expect } from "vitest";
import {
  parseCommonPasswordList,
  matchCommonPassword,
} from "@/lib/commonPasswords";

function listFromLines(lines) {
  return parseCommonPasswordList(lines.join("\n"));
}

describe("parseCommonPasswordList", () => {
  it("ranks lines in order, most common first (1-indexed)", () => {
    const list = listFromLines(["123456", "password", "qwerty"]);
    expect(list.get("123456")).toBe(1);
    expect(list.get("password")).toBe(2);
    expect(list.get("qwerty")).toBe(3);
  });

  it("skips blank lines without shifting ranks", () => {
    const list = listFromLines(["123456", "", "password", "\n", "qwerty"]);
    expect(list.size).toBe(3);
    expect(list.get("password")).toBe(2);
    expect(list.get("qwerty")).toBe(3);
  });

  it("trims surrounding whitespace from entries", () => {
    const list = listFromLines(["  123456  ", "\tpassword\n"]);
    expect(list.get("123456")).toBe(1);
    expect(list.get("password")).toBe(2);
  });

  it("normalizes keys to lowercase", () => {
    const list = listFromLines(["Password", "Qwerty123"]);
    expect(list.has("password")).toBe(true);
    expect(list.has("qwerty123")).toBe(true);
  });

  it("keeps the most-common rank when case variants collapse to one key", () => {
    const list = listFromLines(["password", "Password"]);
    expect(list.size).toBe(1);
    expect(list.get("password")).toBe(1);
    expect(list.has("Password")).toBe(false);
  });

  it("handles CRLF line endings", () => {
    const list = parseCommonPasswordList("123456\r\npassword\r\nqwerty");
    expect(list.size).toBe(3);
    expect(list.get("password")).toBe(2);
  });

  it("returns an empty map for empty or null input", () => {
    expect(parseCommonPasswordList("")).toEqual(new Map());
    expect(parseCommonPasswordList(null).size).toBe(0);
    expect(parseCommonPasswordList(undefined).size).toBe(0);
  });

  it("parses the real bundled list shape (99k+ lines, one per line)", () => {
    const lines = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`password${i}`);
    }
    const list = listFromLines(lines);
    expect(list.size).toBe(100);
    expect(list.get("password1")).toBe(1);
    expect(list.get("password100")).toBe(100);
  });
});

describe("matchCommonPassword", () => {
  const list = listFromLines(["123456", "password", "qwerty123"]);

  it("finds an exact match with its rank", () => {
    expect(matchCommonPassword("password", list)).toEqual({
      found: true,
      rank: 2,
    });
  });

  it("matches case-insensitively", () => {
    expect(matchCommonPassword("PASSWORD", list)).toEqual({
      found: true,
      rank: 2,
    });
    expect(matchCommonPassword("QwErTy123", list)).toEqual({
      found: true,
      rank: 3,
    });
  });

  it("trims surrounding whitespace before matching", () => {
    expect(matchCommonPassword("  password  ", list)).toEqual({
      found: true,
      rank: 2,
    });
  });

  it("reports a miss with a null rank", () => {
    expect(matchCommonPassword("correct horse battery staple", list)).toEqual({
      found: false,
      rank: null,
    });
  });

  it("treats empty input as a miss", () => {
    expect(matchCommonPassword("", list)).toEqual({ found: false, rank: null });
    expect(matchCommonPassword("   ", list)).toEqual({
      found: false,
      rank: null,
    });
    expect(matchCommonPassword(null, list)).toEqual({
      found: false,
      rank: null,
    });
  });
});