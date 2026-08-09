"use client";

import { useState, useEffect, useId } from "react";
import { fetchActivity, removeActivity } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import InlineError from "@/components/InlineError";
import {
  Activity as ActivityIcon,
  Inbox,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { ALL_MODULES } from "@/lib/modules";

// Derived from the canonical module registry — automatically stays in sync
// when modules are added, removed, or renamed.
const MODULE_TYPE_META = Object.fromEntries(
  ALL_MODULES.map((m) => [m.id, { label: m.title, icon: m.icon }])
);

function metaFor(moduleType) {
  return (
    MODULE_TYPE_META[moduleType] ?? {
      label: moduleType,
      icon: ActivityIcon,
    }
  );
}

// Small, local to this page rather than a shared lib helper — this is
// display formatting for one page, not domain logic like the rest of
// src/lib. `nowMs` is passed in (rather than reading Date.now() directly)
// so the relative labels refresh on the page's ticking clock instead of
// freezing at the last render.
function formatRelativeTime(isoString, nowMs) {
  const then = new Date(isoString).getTime();
  const diffSeconds = Math.max(0, Math.round((nowMs - then) / 1000));

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Deliberately not a hand-built label/value grid. An earlier version tried
// to generically lay out arbitrary nested objects (module details differ
// completely from one module to the next) as aligned columns, and every
// bug that came out of this page — "[object Object]" on nested values, text
// overflowing the entire page — traced back to that renderer, not to the
// data itself. A plain formatted JSON block can't misalign or truncate
// unpredictably: whatever's actually stored is exactly what's shown, and
// `overflow-x-auto` keeps any single unbroken token (like a raw hash)
// contained within this block even in the worst case, instead of pushing
// against the page.
function DetailsBlock({ details }) {
  const hasDetails = details && Object.keys(details).length > 0;
  if (!hasDetails) {
    return <p className="text-sm text-slate">No additional details.</p>;
  }
  return (
    <pre className="text-xs font-mono text-ink whitespace-pre-wrap break-words bg-code border border-slate/20 rounded-md p-3 overflow-x-auto">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

function ActivityRow({ entry, expanded, onToggleExpand, onDelete, now }) {
  const { label, icon: Icon } = metaFor(entry.module_type);
  const detailsId = useId();

  return (
    <div className="border-b border-slate/20 last:border-b-0">
      <div className="flex items-center gap-3 py-3">
        <Icon size={16} className="shrink-0 text-slate" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm text-ink ${expanded ? "" : "truncate"}`}
            title={entry.summary}
          >
            {entry.summary}
          </p>
          <p className="text-xs text-slate">
            {label} ·{" "}
            <time
              dateTime={entry.created_at}
              title={new Date(entry.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              className="cursor-default"
            >
              {formatRelativeTime(entry.created_at, now)}
            </time>
          </p>
        </div>
        <button
          onClick={() => onToggleExpand(entry.id)}
          aria-label={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="shrink-0 rounded-full border border-slate/30 size-7 flex items-center justify-center text-slate hover:text-teal hover:border-teal transition"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label="Delete this entry"
          className="shrink-0 rounded-full border border-slate/30 size-7 flex items-center justify-center text-slate hover:text-mismatch hover:border-mismatch transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div id={detailsId} className="pb-3 pl-7">
          <DetailsBlock details={entry.details} />
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const [activity, setActivity] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  // Tick every 30s so the relative "…s/m/h/d ago" labels stay current while
  // the page is open instead of freezing at first render — same pattern as
  // the JWT inspector's expiry clock.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // IndexedDB is a browser-only API — this can only ever run client-side,
  // so it's fetched in an effect rather than during render, the same
  // reasoning as the wordlist fetches elsewhere in the app. The page
  // simply shows a loading state until this resolves; there's no
  // server-rendered version of this data to mismatch against.
  useEffect(() => {
    let cancelled = false;
    fetchActivity()
      .then((records) => {
        if (!cancelled) setActivity(records);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message || "Couldn't load your activity.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadAttempt]);

  function retryLoad() {
    setActivity(null);
    setLoadError(null);
    setReloadAttempt((n) => n + 1);
  }

  async function handleDelete(id) {
    setActionError(null);
    try {
      await removeActivity(id);
      setActivity((prev) => (prev ? prev.filter((entry) => entry.id !== id) : prev));
    } catch (err) {
      setActionError(err.message || "Couldn't delete that entry — try again.");
    }
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const sorted = activity
    ? [...activity].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : [];

  // Filter options are whatever module types are actually present in the
  // data — not a hardcoded list — so a new module's entries show up in the
  // filter automatically the first time it logs anything. This filter only
  // affects which rows are displayed — it has no effect on "Clear all".
  const moduleTypesPresent = Array.from(new Set(sorted.map((e) => e.module_type))).sort(
    (a, b) => metaFor(a).label.localeCompare(metaFor(b).label)
  );

  const filtered =
    moduleFilter === "all" ? sorted : sorted.filter((e) => e.module_type === moduleFilter);

  // Resolved once so the JSX below can render the active-filter chip without
  // re-calling metaFor twice. Null when no filter is applied.
  const activeFilterMeta =
    moduleFilter === "all" ? null : metaFor(moduleFilter);

  return (
    <>
      <PageHeader
        icon={ActivityIcon}
        accent="teal"
        title="Activity Log"
        description="A local history of actions taken across Sentinel's tools. This never leaves your device — it lives only in this browser, and you can delete any of it at any time."
      />

      {activity && activity.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filter activity by module"
            className="border border-slate/30 rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:border-teal transition"
          >
            <option value="all">All activity</option>
            {moduleTypesPresent.map((type) => (
              <option key={type} value={type}>
                {metaFor(type).label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate">
              {activeFilterMeta
                ? `Showing ${filtered.length} of ${sorted.length} ${
                    sorted.length === 1 ? "entry" : "entries"
                  }`
                : `${sorted.length} ${sorted.length === 1 ? "entry" : "entries"}`}
            </span>
            {activeFilterMeta && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-light text-teal-chip pl-2.5 pr-1.5 py-1 text-xs font-medium">
                <activeFilterMeta.icon size={13} />
                {activeFilterMeta.label}
                <button
                  onClick={() => setModuleFilter("all")}
                  aria-label="Clear module filter"
                  className="shrink-0 rounded-full p-0.5 hover:bg-teal/10 transition"
                >
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-mismatch/40 bg-mismatch-light text-mismatch-chip px-4 py-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-sm">{actionError}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface shadow-card overflow-hidden px-5">
        {loadError ? (
          <div className="py-6">
            <InlineError className="mb-2">{loadError}</InlineError>
            <button onClick={retryLoad} className="text-sm text-teal">
              Try again
            </button>
          </div>
        ) : activity === null ? (
          <p className="text-sm text-slate py-6">Loading your activity…</p>
        ) : activity.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-2">
            <Inbox size={24} className="text-slate" />
            <p className="text-sm text-slate max-w-xs">
              No activity yet — actions you take across Sentinel&apos;s
              tools will show up here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate py-6">
            No activity for {metaFor(moduleFilter).label} yet.
          </p>
        ) : (
          filtered.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              onToggleExpand={toggleExpanded}
              onDelete={handleDelete}
              now={now}
            />
          ))
        )}
      </div>
    </>
  );
}
