"use client";

import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import InlineError from "@/components/InlineError";
import { usePreference } from "@/lib/usePreference";
import {
  Activity as ActivityIcon,
  Inbox,
  Trash2,
  ChevronDown,
  ChevronLeft,
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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Returns an array of page indices and "…" ellipsis strings for the
// pagination bar. Always shows first/last page; adds current ± 1 when
// they'd otherwise be separated from the ends.
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages = new Set([0, totalPages - 1, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages - 2) pages.add(currentPage + 1);
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

// Small, local to this tab rather than a shared lib helper — this is
// display formatting for one page, not domain logic like the rest of
// src/lib. `nowMs` is passed in (rather than reading Date.now() directly)
// so the relative labels refresh on the tab's ticking clock instead of
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

function ActivityRow({ entry, expanded, confirming, onToggleExpand, onDelete, now }) {
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
          aria-label={
            confirming ? "Click again to confirm deleting this entry" : "Delete this entry"
          }
          title={confirming ? "Click again to confirm" : "Delete this entry"}
          className={`shrink-0 rounded-full border size-7 flex items-center justify-center transition ${
            confirming
              ? "border-mismatch bg-mismatch-light text-mismatch-chip"
              : "border-slate/30 text-slate hover:text-mismatch hover:border-mismatch"
          }`}
        >
          {confirming ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
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

export default function LogTab({ activity, loadError, actionError, onRetry, onDelete }) {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [pageSize, setPageSize] = usePreference("activity.pageSize", 50);
  const [page, setPage] = useState(0);
  // Tick every 30s so the relative "…s/m/h/d ago" labels stay current while
  // the tab is open instead of freezing at first render — same pattern as
  // the JWT inspector's expiry clock.
  const [now, setNow] = useState(() => Date.now());

  // Accidental-delete guard: the first click arms the row's trash button,
  // the second confirms. Auto-cancels after 3s, when another row is armed,
  // or when the row is expanded — mirroring the confirm-before-act pattern
  // Settings uses for its destructive actions.
  const [confirmingId, setConfirmingId] = useState(null);
  const confirmTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimerRef.current), []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  function handleFilterChange(value) {
    setModuleFilter(value);
    setPage(0);
  }

  function handlePageSizeChange(size) {
    setPageSize(size);
    setPage(0);
  }

  function armDelete(id) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingId(null), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    setConfirmingId(null);
    onDelete(id);
  }

  function toggleExpanded(id) {
    setConfirmingId(null);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const startIdx = safePage * pageSize;
  const displayed = filtered.slice(startIdx, startIdx + pageSize);

  // Resolved once so the JSX below can render the active-filter chip without
  // re-calling metaFor twice. Null when no filter is applied.
  const activeFilterMeta = moduleFilter === "all" ? null : metaFor(moduleFilter);

  return (
    <>
      {activity && activity.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <select
            value={moduleFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            aria-label="Filter activity by module"
            className="border border-slate/30 rounded-lg px-3 py-1.5 text-sm bg-surface focus:border-teal transition"
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
                  onClick={() => handleFilterChange("all")}
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
            <button onClick={onRetry} className="text-sm text-teal">
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
            <Link href="/" className="text-sm text-teal font-medium hover:underline">
              Explore modules →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate py-6">
            No activity for {metaFor(moduleFilter).label} yet.
          </p>
        ) : (
          displayed.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              confirming={confirmingId === entry.id}
              onToggleExpand={toggleExpanded}
              onDelete={armDelete}
              now={now}
            />
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Page size">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                aria-pressed={pageSize === size}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  pageSize === size
                    ? "bg-teal-light text-teal-chip"
                    : "text-slate hover:text-ink hover:bg-slate/10"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <nav className="flex items-center gap-1" aria-label="Activity log pages">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="size-7 rounded-lg flex items-center justify-center text-slate hover:text-ink hover:bg-slate/10 transition disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={14} />
            </button>
            {getPageNumbers(safePage, totalPages).map((item, i) =>
              item === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  aria-label={`Page ${item + 1}`}
                  aria-current={item === safePage ? "page" : undefined}
                  className={`size-7 rounded-lg text-xs font-medium flex items-center justify-center transition ${
                    item === safePage
                      ? "bg-teal-light text-teal-chip"
                      : "text-slate hover:text-ink hover:bg-slate/10"
                  }`}
                >
                  {item + 1}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={safePage >= totalPages - 1}
              aria-label="Next page"
              className="size-7 rounded-lg flex items-center justify-center text-slate hover:text-ink hover:bg-slate/10 transition disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={14} />
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
