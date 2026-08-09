// Tests for src/lib/activityStats.js
//
// What we're checking:
//   - recordsToStats turns the activity records the Log tab loads into the
//     { moduleTypes, createdAts, total } shape the aggregations consume
//   - computeActivityStats turns that shape into the Summary tab's numbers
//     (totals, per-module counts, dates, denominators)
//   - buildDailySeries buckets created_at values into deterministic LOCAL-day
//     buckets for the 14-day chart — the day boundary is the user's local
//     midnight, not UTC (see the regression test below for why)
//
// The functions bucket by the runtime's local timezone, so this file pins
// `process.env.TZ` to a fixed non-UTC zone (Asia/Kolkata, UTC+5:30) at the
// top — before any Date math — to make the assertions deterministic on any
// machine. Vitest isolates each test file, so the pin doesn't leak.
// `now` is always injected into buildDailySeries so the date math is
// deterministic regardless of when the suite runs.

process.env.TZ = "Asia/Kolkata";

import { describe, it, expect } from "vitest";
import { recordsToStats, computeActivityStats, buildDailySeries } from "@/lib/activityStats";

// Mirrors the shape of ALL_MODULES (only the fields these functions read).
const ALL_MODULES = [
  { id: "pass", title: "Password Generator", status: "available" },
  { id: "hibp", title: "HIBP Breach Check", status: "available" },
  { id: "hash", title: "Text Hash Generator", status: "available" },
  { id: "old", title: "Retired Module", status: "retired" },
  { id: "soon", title: "Coming Soon Module", status: "coming-soon" },
];

const NOW = new Date(Date.UTC(2026, 7, 9, 12, 0, 0)); // 2026-08-09 UTC

describe("recordsToStats", () => {
  it("maps records to key arrays and counts by length", () => {
    const stats = recordsToStats([
      { module_type: "pass", created_at: "2026-08-09T10:00:00.000Z" },
      { module_type: "hash", created_at: "2026-08-08T10:00:00.000Z" },
    ]);
    expect(stats).toEqual({
      moduleTypes: ["pass", "hash"],
      createdAts: ["2026-08-09T10:00:00.000Z", "2026-08-08T10:00:00.000Z"],
      total: 2,
    });
  });

  it("counts records with a missing module_type in the total", () => {
    const stats = recordsToStats([
      { summary: "orphan", details: {} },
      { module_type: "pass", created_at: "2026-08-09T10:00:00.000Z" },
    ]);
    expect(stats.total).toBe(2);
    expect(stats.moduleTypes).toEqual([undefined, "pass"]);
  });

  it("returns empty values for no records", () => {
    expect(recordsToStats([])).toEqual({ moduleTypes: [], createdAts: [], total: 0 });
  });
});

describe("computeActivityStats", () => {
  it("returns empty values for no activity", () => {
    const stats = computeActivityStats(
      { moduleTypes: [], createdAts: [], total: 0 },
      ALL_MODULES
    );
    expect(stats.total).toBe(0);
    expect(stats.firstActivityAt).toBeNull();
    expect(stats.activeDays).toBe(0);
    expect(stats.perModule).toEqual([]);
    expect(stats.modulesUsed).toBe(0);
    expect(stats.modulesAvailable).toBe(3);
    expect(stats.maxModuleCount).toBe(0);
  });

  it("counts uses per known module, most-used first", () => {
    const stats = computeActivityStats(
      {
        moduleTypes: ["pass", "hash", "pass", "hibp", "pass", "hibp"],
        createdAts: [],
        total: 6,
      },
      ALL_MODULES
    );
    expect(stats.perModule).toEqual([
      { id: "pass", label: "Password Generator", count: 3 },
      { id: "hibp", label: "HIBP Breach Check", count: 2 },
      { id: "hash", label: "Text Hash Generator", count: 1 },
    ]);
    expect(stats.modulesUsed).toBe(3);
    expect(stats.maxModuleCount).toBe(3);
  });

  it("breaks count ties alphabetically by label", () => {
    const stats = computeActivityStats(
      { moduleTypes: ["hash", "hibp"], createdAts: [], total: 2 },
      ALL_MODULES
    );
    expect(stats.perModule.map((m) => m.id)).toEqual(["hibp", "hash"]);
  });

  it("excludes unknown module types from the breakdown but keeps them in the total", () => {
    const stats = computeActivityStats(
      {
        moduleTypes: ["pass", "some-old-module", "pass", null],
        createdAts: [],
        total: 4,
      },
      ALL_MODULES
    );
    expect(stats.total).toBe(4);
    expect(stats.perModule).toEqual([{ id: "pass", label: "Password Generator", count: 2 }]);
    expect(stats.modulesUsed).toBe(1);
  });

  it("resolves the earliest activity from the ascending created_at keys", () => {
    const stats = computeActivityStats(
      {
        moduleTypes: ["pass"],
        createdAts: ["2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z"],
        total: 2,
      },
      ALL_MODULES
    );
    expect(stats.firstActivityAt).toBe("2026-07-01T10:00:00.000Z");
  });

  it("normalizes legacy non-string created_at values (Date objects and timestamps)", () => {
    const dateKey = new Date("2026-08-07T10:00:00.000Z");
    const epochKey = new Date("2026-08-09T00:00:00.000Z").getTime();
    const stats = computeActivityStats(
      { moduleTypes: ["pass"], createdAts: [dateKey, epochKey], total: 2 },
      ALL_MODULES
    );
    expect(stats.firstActivityAt).toBe("2026-08-07T10:00:00.000Z");
    expect(stats.activeDays).toBe(2);
  });

  it("drops unparseable created_at values instead of crashing", () => {
    const stats = computeActivityStats(
      {
        moduleTypes: [],
        createdAts: ["not-a-date", {}, "2026-07-01T10:00:00.000Z"],
        total: 1,
      },
      ALL_MODULES
    );
    expect(stats.firstActivityAt).toBe("2026-07-01T10:00:00.000Z");
    expect(stats.activeDays).toBe(1);
  });

  it("counts active days by unique local day", () => {
    // In Asia/Kolkata: 23:59:59Z on Jul 1 is already 05:29 IST on Jul 2, so
    // it counts as Jul 2 — the day boundary is local midnight, not UTC's.
    const stats = computeActivityStats(
      {
        moduleTypes: [],
        createdAts: [
          "2026-07-01T10:00:00.000Z",
          "2026-07-01T23:59:59.000Z",
          "2026-07-02T00:00:01.000Z",
        ],
        total: 3,
      },
      ALL_MODULES
    );
    expect(stats.activeDays).toBe(2);
  });

  it("excludes retired and coming-soon modules from the denominator", () => {
    const stats = computeActivityStats(
      { moduleTypes: ["old"], createdAts: [], total: 1 },
      ALL_MODULES
    );
    expect(stats.modulesAvailable).toBe(3);
    // a retired module with activity still resolves its label
    expect(stats.perModule).toEqual([{ id: "old", label: "Retired Module", count: 1 }]);
    expect(stats.modulesUsed).toBe(1);
  });
});

describe("buildDailySeries", () => {
  it("produces one bucket per day ending today, oldest first", () => {
    const { series, max } = buildDailySeries([], { days: 3, now: NOW });
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ date: "2026-08-07", count: 0, isToday: false });
    expect(series[2]).toEqual({ date: "2026-08-09", count: 0, isToday: true });
    expect(max).toBe(0);
  });

  it("buckets counts into their local day and ignores entries before the window", () => {
    // In Asia/Kolkata (UTC+5:30), 23:00Z on Aug 7 is 04:30 IST on Aug 8, so
    // it lands on the Aug 8 bar — a UTC-day bucket would have shown it under
    // Aug 7 (yesterday, from the user's perspective).
    const createdAts = [
      "2026-08-07T10:00:00.000Z",
      "2026-08-07T23:00:00.000Z",
      "2026-08-09T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z", // before the 3-day window
    ];
    const { series, max } = buildDailySeries(createdAts, { days: 3, now: NOW });
    expect(series).toEqual([
      { date: "2026-08-07", count: 1, isToday: false },
      { date: "2026-08-08", count: 1, isToday: false },
      { date: "2026-08-09", count: 1, isToday: true },
    ]);
    expect(max).toBe(1);
  });

  it("regression: an action just after local midnight is TODAY, not yesterday", () => {
    // Asia/Kolkata: `now` at 18:30Z is 00:00 IST on Aug 11, so the user's
    // local "today" is Aug 11 even though UTC is still Aug 10. An action at
    // 19:00Z (00:30 IST) must land on the Aug 11 (today) bar, while one at
    // 18:00Z (23:30 IST on Aug 10) lands on Aug 10. Under UTC-day bucketing
    // all four records collapse into a single Aug 10 bucket and the chart's
    // last bar is labeled a day behind.
    const now = new Date("2026-08-10T18:30:00.000Z");
    const createdAts = [
      "2026-08-10T18:00:00.000Z", // 23:30 IST Aug 10 — yesterday
      "2026-08-10T18:29:59.000Z", // 23:59 IST Aug 10 — yesterday
      "2026-08-10T18:30:00.000Z", // 00:00 IST Aug 11 — today
      "2026-08-10T19:00:00.000Z", // 00:30 IST Aug 11 — today
    ];
    const { series, max } = buildDailySeries(createdAts, { days: 3, now });
    expect(series).toEqual([
      { date: "2026-08-09", count: 0, isToday: false },
      { date: "2026-08-10", count: 2, isToday: false },
      { date: "2026-08-11", count: 2, isToday: true },
    ]);
    expect(max).toBe(2);
  });

  it("defaults to a 14-day window", () => {
    const { series } = buildDailySeries([], { now: NOW });
    expect(series).toHaveLength(14);
    expect(series[0].date).toBe("2026-07-27");
    expect(series[13].date).toBe("2026-08-09");
  });

  it("buckets legacy Date-object and numeric-timestamp values into their local day", () => {
    const { series, max } = buildDailySeries(
      [new Date("2026-08-07T10:00:00.000Z"), new Date("2026-08-09T00:00:00.000Z").getTime()],
      { days: 3, now: NOW }
    );
    expect(series).toEqual([
      { date: "2026-08-07", count: 1, isToday: false },
      { date: "2026-08-08", count: 0, isToday: false },
      { date: "2026-08-09", count: 1, isToday: true },
    ]);
    expect(max).toBe(1);
  });

  it("ignores unparseable values rather than throwing", () => {
    const { series } = buildDailySeries(["garbage", {}], { days: 3, now: NOW });
    expect(series.every((day) => day.count === 0)).toBe(true);
  });
});
