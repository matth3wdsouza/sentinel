// Pure aggregation for the Activity Summary tab.
//
// Deliberately lives apart from db.js so every aggregation rule (what counts
// as "used", which modules are in the denominator, how days are bucketed) is
// plain, unit-testable logic with no IndexedDB in the way. Both functions
// are deterministic given their inputs — no Date.now() unless the caller
// supplies `now`.
//
// The Summary is always derived from the SAME records the Log tab renders
// (`recordsToStats` → `computeActivityStats`/`buildDailySeries`). There is no
// separate stats fetch, so the two tabs can never disagree about a count.
// This deliberately replaces an earlier design that added IndexedDB indexes
// for key-only stats queries — premature optimization that introduced a
// whole migration surface for a store holding dozens of records.

// IndexedDB records' created_at values are whatever type was written when the
// record was stored, and a browser DB can outlive the current write path —
// early-dev data may hold Date objects or numeric timestamps. Values are
// normalized to ISO strings before any date math rather than assumed to be
// strings; unparseable values are dropped instead of crashing the Summary.
function toISOKey(key) {
  const date = key instanceof Date ? key : new Date(key);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// The raw material for every aggregation, derived straight from the activity
// records the Log tab already holds. `total` is records.length so orphan
// records (a missing or unresolvable module_type) stay counted even though
// they can't be attributed to a known module.
export function recordsToStats(records) {
  return {
    moduleTypes: records.map((r) => r.module_type),
    createdAts: records.map((r) => r.created_at),
    total: records.length,
  };
}

// computeActivityStats turns the { moduleTypes, createdAts, total } shape
// into everything the Summary tab renders. Rules:
//   - perModule lists only known modules, most-used first (ties broken by
//     label so the ordering is stable). Retired modules are "known" — they
//     still resolve a title — but they don't count toward modulesAvailable.
//   - modulesAvailable counts only status === "available" modules.
export function computeActivityStats({ moduleTypes, createdAts, total }, allModules) {
  const byId = new Map(allModules.map((m) => [m.id, m]));
  const times = createdAts.map(toISOKey).filter(Boolean);

  const perModuleCounts = new Map();
  for (const type of moduleTypes) {
    if (byId.has(type)) {
      perModuleCounts.set(type, (perModuleCounts.get(type) ?? 0) + 1);
    }
  }

  const perModule = [...perModuleCounts.entries()]
    .map(([id, count]) => ({ id, label: byId.get(id).title, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    total,
    firstActivityAt: times[0] ?? null,
    activeDays: new Set(times.map((iso) => iso.slice(0, 10))).size,
    perModule,
    modulesUsed: perModuleCounts.size,
    modulesAvailable: allModules.filter((m) => m.status === "available").length,
    maxModuleCount: perModule.length > 0 ? perModule[0].count : 0,
  };
}

// buildDailySeries buckets created_at values into the last `days` UTC days
// (ending today, per the injected `now`). Values are normalized to ISO
// strings first (see toISOKey above), so bucketing slices the canonical UTC
// day regardless of the stored type — deterministic and timezone-independent,
// no local-timezone drift between the chart and its labels. Returns the
// series oldest→newest plus the max count in the window (for bar scaling); a
// day with no activity is present with count 0 so the axis never collapses.
export function buildDailySeries(createdAts, { days = 14, now = new Date() } = {}) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startKey = toUTCDateKey(start);

  const byDay = new Map();
  for (const key of createdAts) {
    const iso = toISOKey(key);
    if (!iso) continue;
    const dayKey = iso.slice(0, 10);
    if (dayKey >= startKey) {
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
    }
  }

  const todayKey = toUTCDateKey(now);
  const series = [];
  let max = 0;
  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const date = toUTCDateKey(day);
    const count = byDay.get(date) ?? 0;
    if (count > max) max = count;
    series.push({ date, count, isToday: date === todayKey });
  }

  return { series, max };
}

function toUTCDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
