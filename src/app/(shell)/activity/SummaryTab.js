"use client";

import { useMemo } from "react";
import InlineError from "@/components/InlineError";
import { ACCENTS } from "@/lib/moduleAccents";
import { ALL_MODULES } from "@/lib/modules";
import { recordsToStats, computeActivityStats, buildDailySeries } from "@/lib/activityStats";
import { Inbox } from "lucide-react";

// Everything the Summary tab renders is derived from the same `activity`
// records the Log tab shows — `recordsToStats` feeds the pure aggregation
// functions in activityStats.js, and nothing here fetches its own data. One
// source of truth, so the two tabs can never disagree.

const MODULE_BY_ID = Object.fromEntries(ALL_MODULES.map((m) => [m.id, m]));

function formatFullDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// The series keys are LOCAL calendar dates (YYYY-MM-DD, see activityStats.js),
// so build the label from a local-midnight Date — never from a `T00:00:00Z`
// string, which renders the previous date in timezones west of UTC.
function formatDayLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ label, children }) {
  return (
    <div className="bg-surface rounded-xl shadow-card px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-slate font-semibold mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatValue({ children }) {
  return <p className="text-2xl font-display font-bold text-ink leading-none">{children}</p>;
}

// ─── Donut — modules used vs available ───────────────────────────────────────

function ModulesDonut({ value, total }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  // r = 15.9155 gives circumference ≈ 100, so strokeDasharray reads as a
  // plain percentage. The ring rotates -90° so it starts at the top.
  return (
    <div className="relative size-16" role="img" aria-label={`${value} of ${total} modules used`}>
      <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="21"
          cy="21"
          r="15.9155"
          fill="none"
          strokeWidth="4.5"
          className="stroke-slate/30"
        />
        <circle
          cx="21"
          cy="21"
          r="15.9155"
          fill="none"
          strokeWidth="4.5"
          className="stroke-teal"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
        {value}/{total}
      </span>
    </div>
  );
}

// ─── Per-module bars ─────────────────────────────────────────────────────────

function ModuleBars({ perModule, maxModuleCount }) {
  if (perModule.length === 0) {
    return (
      <p className="text-sm text-slate">
        Activity exists, but none of it maps to a known module.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {perModule.map(({ id, label, count }) => {
        const mod = MODULE_BY_ID[id];
        const { chipBg, chipText } = ACCENTS[mod.accent] ?? ACCENTS.teal;
        const Icon = mod.icon;
        const width = maxModuleCount === 0 ? 0 : (count / maxModuleCount) * 100;

        return (
          <li key={id} className="flex items-center gap-3">
            <span className={`inline-flex p-2 rounded-full shrink-0 ${chipBg} ${chipText}`}>
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-sm text-ink truncate">{label}</p>
                <p className="text-xs text-slate tabular-nums shrink-0">
                  {count} {count === 1 ? "use" : "uses"}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-slate/30 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: `var(--color-accent-${mod.accent})`,
                    transformOrigin: "left",
                    animation: "stats-bar-grow 0.5s ease-out",
                  }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── 14-day activity chart ───────────────────────────────────────────────────

function DailyChart({ series, max, hasActivity }) {
  if (!hasActivity) {
    return (
      <p className="text-sm text-slate">
        No activity in the last {series.length} days.
      </p>
    );
  }

  return (
    <div
      role="img"
      aria-label="Activity over the last 14 days"
      className="pt-4 border-t border-slate/10"
    >
      <div className="flex items-end gap-1 h-20">
        {series.map((day) => {
          const pct = max === 0 ? 0 : (day.count / max) * 100;
          const label = `${formatDayLabel(day.date)} — ${day.count} ${
            day.count === 1 ? "action" : "actions"
          }`;
          return (
            <div key={day.date} className="flex-1 h-full min-w-0 flex items-end" title={label}>
              <div
                className={`w-full rounded-t-sm ${
                  day.count === 0 ? "bg-slate/30" : "bg-teal"
                } ${day.isToday ? "" : "opacity-75"}`}
                style={{ height: day.count === 0 ? "3px" : `${Math.max(pct, 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate mt-1.5">
        <span>{formatDayLabel(series[0].date)}</span>
        <span>Last {series.length} days</span>
        <span>{formatDayLabel(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ─── SummaryTab ──────────────────────────────────────────────────────────────

export default function SummaryTab({ activity, loadError, onRetry }) {
  const { computed, daily } = useMemo(() => {
    if (activity === null) return { computed: null, daily: null };
    const stats = recordsToStats(activity);
    return {
      computed: computeActivityStats(stats, ALL_MODULES),
      daily: buildDailySeries(stats.createdAts),
    };
  }, [activity]);

  if (loadError) {
    return (
      <div className="py-6">
        <InlineError className="mb-2">{loadError}</InlineError>
        <button onClick={onRetry} className="text-sm text-teal">
          Try again
        </button>
      </div>
    );
  }

  if (!computed) {
    return <p className="text-sm text-slate py-6">Loading your activity…</p>;
  }

  if (computed.total === 0) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-2">
        <Inbox size={24} className="text-slate" />
        <p className="text-sm text-slate max-w-xs">
          No activity yet — actions you take across Sentinel&apos;s tools will
          show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total actions">
          <StatValue>{computed.total}</StatValue>
        </StatTile>
        <StatTile label="First activity">
          <StatValue>
            {computed.firstActivityAt ? formatFullDate(computed.firstActivityAt) : "—"}
          </StatValue>
        </StatTile>
        <StatTile label="Active days">
          <StatValue>{computed.activeDays}</StatValue>
        </StatTile>
        <StatTile label="Modules used">
          <ModulesDonut value={computed.modulesUsed} total={computed.modulesAvailable} />
        </StatTile>
      </div>

      {/* Per-module breakdown */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-slate font-semibold mb-3">
          By module
        </h3>
        <div className="bg-surface rounded-xl shadow-card px-5 py-4">
          <ModuleBars perModule={computed.perModule} maxModuleCount={computed.maxModuleCount} />
        </div>
      </div>

      {/* Activity over time */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-slate font-semibold mb-3">
          Activity over time
        </h3>
        <div className="bg-surface rounded-xl shadow-card px-5 py-4">
          <DailyChart
            series={daily.series}
            max={daily.max}
            hasActivity={computed.total > 0 && daily.max > 0}
          />
        </div>
      </div>
    </div>
  );
}
