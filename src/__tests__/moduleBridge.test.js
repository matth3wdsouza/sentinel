// Tests for the same-tab module payload bridge (src/lib/moduleBridge.js).
//
// The invariants that carry the feature's privacy posture:
//   • consumption is single-use (read-and-clear),
//   • the last stored value wins,
//   • slots are isolated per target module path,
//   • the store is module-scope memory only — nothing persists.
//
// Each test uses its own path so tests are order-independent (the map is a
// module singleton and there is deliberately no "clear all").

import { describe, it, expect } from "vitest";
import {
  MAX_FROM_LENGTH,
  MAX_PAYLOAD_LENGTH,
  clearPendingPayload,
  consumePendingPayload,
  hasPendingPayload,
  peekPendingPayload,
  storePendingPayload,
} from "@/lib/moduleBridge";

describe("moduleBridge", () => {
  it("returns null for an empty slot", () => {
    const path = "/modules/empty-slot";
    expect(hasPendingPayload(path)).toBe(false);
    expect(consumePendingPayload(path)).toBeNull();
  });

  it("peeks without consuming", () => {
    const path = "/modules/peek-only";
    storePendingPayload(path, "https://example.com", "QR Decode");

    expect(peekPendingPayload(path)).toEqual({
      value: "https://example.com",
      from: "QR Decode",
    });
    // Peeking must not consume: the payload is still there for the reader.
    expect(hasPendingPayload(path)).toBe(true);
    expect(consumePendingPayload(path)).toEqual({
      value: "https://example.com",
      from: "QR Decode",
    });
    expect(peekPendingPayload(path)).toBeNull();
  });

  it("stores and consumes a payload exactly once", () => {
    const path = "/modules/single-use";
    storePendingPayload(path, "https://example.com", "QR Decode");

    expect(hasPendingPayload(path)).toBe(true);
    expect(consumePendingPayload(path)).toEqual({
      value: "https://example.com",
      from: "QR Decode",
    });
    expect(hasPendingPayload(path)).toBe(false);
    expect(consumePendingPayload(path)).toBeNull();
  });

  it("defaults `from` to null", () => {
    const path = "/modules/no-source";
    storePendingPayload(path, "otpauth://totp/Example?secret=abc");

    expect(consumePendingPayload(path)).toEqual({
      value: "otpauth://totp/Example?secret=abc",
      from: null,
    });
  });

  it("keeps only the last stored payload for a path", () => {
    const path = "/modules/overwrite";
    storePendingPayload(path, "first", "one");
    storePendingPayload(path, "second", "two");

    expect(consumePendingPayload(path)).toEqual({
      value: "second",
      from: "two",
    });
  });

  it("overwriting drops the previous source", () => {
    const path = "/modules/overwrite-source";
    storePendingPayload(path, "value", "one");
    storePendingPayload(path, "value");

    expect(consumePendingPayload(path)).toEqual({ value: "value", from: null });
  });

  it("isolates slots by target path", () => {
    storePendingPayload("/modules/path-a", "for-a", "src-a");

    expect(hasPendingPayload("/modules/path-b")).toBe(false);
    expect(consumePendingPayload("/modules/path-b")).toBeNull();
    expect(consumePendingPayload("/modules/path-a")).toEqual({
      value: "for-a",
      from: "src-a",
    });
  });

  it("clearPendingPayload discards without consuming", () => {
    const path = "/modules/cleared";
    storePendingPayload(path, "https://example.com", "QR Decode");
    clearPendingPayload(path);

    expect(hasPendingPayload(path)).toBe(false);
    expect(consumePendingPayload(path)).toBeNull();
  });

  it("returns a success boolean from storePendingPayload", () => {
    expect(storePendingPayload("/modules/return-true", "ok")).toBe(true);
    expect(storePendingPayload("/modules/return-false", "")).toBe(false);
  });

  it("refuses non-string payloads", () => {
    const path = "/modules/refuse-non-string";
    expect(storePendingPayload(path, { url: "https://example.com" })).toBe(false);
    expect(storePendingPayload(path, 42)).toBe(false);
    expect(storePendingPayload(path, null)).toBe(false);

    expect(hasPendingPayload(path)).toBe(false);
    expect(consumePendingPayload(path)).toBeNull();
  });

  it("refuses empty payloads", () => {
    const path = "/modules/refuse-empty";
    expect(storePendingPayload(path, "")).toBe(false);
    expect(hasPendingPayload(path)).toBe(false);
  });

  it("refuses oversized payloads but accepts the boundary", () => {
    const path = "/modules/refuse-oversized";
    expect(storePendingPayload(path, "x".repeat(MAX_PAYLOAD_LENGTH + 1))).toBe(false);
    expect(hasPendingPayload(path)).toBe(false);

    expect(storePendingPayload(path, "x".repeat(MAX_PAYLOAD_LENGTH))).toBe(true);
    expect(consumePendingPayload(path)).toEqual({ value: "x".repeat(MAX_PAYLOAD_LENGTH), from: null });
  });

  it("normalises `from` to null unless it is a short string", () => {
    const path = "/modules/normalise-from";
    expect(storePendingPayload(path, "value", 123)).toBe(true);
    expect(consumePendingPayload(path)).toEqual({ value: "value", from: null });

    expect(storePendingPayload(path, "value2", "y".repeat(MAX_FROM_LENGTH + 1))).toBe(true);
    expect(consumePendingPayload(path)).toEqual({ value: "value2", from: null });

    expect(storePendingPayload(path, "value3", "QR Decode")).toBe(true);
    expect(consumePendingPayload(path)).toEqual({ value: "value3", from: "QR Decode" });
  });
});