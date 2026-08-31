"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Home, History, Settings, CornerDownLeft, Clock } from "lucide-react";
import { ALL_MODULES } from "@/lib/modules";
import { fetchActivity } from "@/lib/api";

const QUICK_ACTIONS = [
  { id: "home", title: "Home", icon: Home, href: "/" },
  { id: "activity", title: "Activity", icon: History, href: "/activity" },
  { id: "settings", title: "Settings", icon: Settings, href: "/settings" },
];

const ALL_ITEMS = [
  ...QUICK_ACTIONS,
  ...ALL_MODULES.filter((m) => m.status === "available").map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    icon: m.icon,
    href: `/modules/${m.id}`,
  })),
];

// Build a lookup so recent-modules can resolve module_type → module metadata
// without scanning ALL_MODULES on every render.
const MODULE_BY_ID = Object.fromEntries(ALL_MODULES.map((m) => [m.id, m]));

// Detect macOS once at module load. During SSR navigator is undefined (returns
// false), which is fine — the palette is invisible until after hydration.
const IS_MAC =
  typeof navigator !== "undefined" &&
  (navigator.platform?.includes("Mac") || navigator.userAgent?.includes("Mac"));

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-teal/20 text-ink rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentModules, setRecentModules] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);

  // Fetch recent modules when palette opens (only needed when query is empty)
  useEffect(() => {
    if (!isOpen) return;
    fetchActivity()
      .then((records) => {
        const sorted = [...records].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const seen = new Set();
        const recent = [];
        for (const r of sorted) {
          if (!seen.has(r.module_type) && recent.length < 3) {
            seen.add(r.module_type);
            const mod = MODULE_BY_ID[r.module_type];
            if (mod && mod.status === "available") {
              recent.push({
                id: `recent-${mod.id}`,
                title: mod.title,
                description: "Recently used",
                icon: mod.icon,
                href: `/modules/${mod.id}`,
                isRecent: true,
              });
            }
          }
        }
        setRecentModules(recent);
      })
      .catch(() => {});
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // When query is empty, show recent modules first (if any), then all items
      if (recentModules.length > 0) {
        const recentIds = new Set(recentModules.map((r) => r.id.replace("recent-", "")));
        const rest = ALL_ITEMS.filter((item) => !recentIds.has(item.id));
        return [...recentModules, { id: "separator", isSeparator: true }, ...rest];
      }
      return ALL_ITEMS;
    }
    return ALL_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [query, recentModules]);

  // Exclude separators from selectable items
  const selectableItems = useMemo(
    () => filtered.filter((item) => !item.isSeparator),
    [filtered]
  );

  function handleQueryChange(e) {
    setQuery(e.target.value);
    setSelectedIndex(0);
  }

  const open = useCallback(() => {
    // Remember what had focus so we can put it back when the palette closes.
    // Pinning at open time (not close) is important because Cmd+K toggles open
    // and close, and by the time we close the page may have re-rendered.
    if (document.activeElement) triggerRef.current = document.activeElement;
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    // Return focus to whatever opened the palette (called via Escape/backdrop/
    // result selection). rAF defers until the "No results" branch updates.
    if (trigger?.isConnected) {
      requestAnimationFrame(() => {
        if (trigger.isConnected) trigger.focus();
      });
    }
  }, []);

  function navigate(href) {
    close();
    router.push(href);
  }

  // Global keyboard shortcut: Cmd+K / Ctrl+K. Route through open()/close() so
  // the side effects (capturing the trigger, restoring focus) run on every
  // open AND close — toggling off with Cmd+K is a natural way to close.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) close();
        else open();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open, close]);

  // Custom event from TopBar search icon
  useEffect(() => {
    function handleOpen() {
      open();
    }
    window.addEventListener("command-palette:open", handleOpen);
    return () => window.removeEventListener("command-palette:open", handleOpen);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleItemKeyDown(e) {
    if (e.key === "Tab") {
      // Result items are arrow-key navigated, not individually tabbable, so
      // pin focus to the search input for the dialog's lifetime rather than
      // building a multi-element trap. This stops Tab escaping to the page
      // behind the modal overlay.
      e.preventDefault();
      inputRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % selectableItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + selectableItems.length) % selectableItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectableItems[selectedIndex]) navigate(selectableItems[selectedIndex].href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  // Map selectable index back to full filtered index (skipping separators)
  function selectableToFiltered(si) {
    let count = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].isSeparator) continue;
      if (count === si) return i;
      count++;
    }
    return -1;
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={close} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl bg-surface shadow-2xl border border-slate/20 animate-palette-enter overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b border-slate/20">
          <Search size={16} className="shrink-0 text-slate" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleItemKeyDown}
            placeholder="Search modules…"
            className="w-full py-4 text-sm bg-transparent text-ink placeholder:text-slate focus:outline-none focus:[box-shadow:none]"
            aria-label="Search modules"
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              selectableItems[selectedIndex]
                ? `palette-option-${selectableItems[selectedIndex].id}`
                : undefined
            }
            autoComplete="off"
          />
          <div className="shrink-0 flex items-center gap-1">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate/30 text-[10px] text-slate font-mono">
              {IS_MAC ? "⌘" : "Ctrl+"}K
            </kbd>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate/30 text-[10px] text-slate font-mono">
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate text-center">
            No results for &ldquo;{query}&rdquo;
          </p>
        ) : (
          <ul
            ref={listRef}
            id="command-palette-listbox"
            role="listbox"
            aria-label="Modules"
            className="max-h-80 overflow-y-auto py-1"
          >
            {filtered.map((item, i) => {
              // Separator between recent and all modules
              if (item.isSeparator) {
                return (
                  <li key="separator" className="px-4 py-1.5" aria-hidden="true">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-slate/20" />
                      <span className="text-[10px] uppercase tracking-wider text-slate font-medium">
                        All modules
                      </span>
                      <div className="h-px flex-1 bg-slate/20" />
                    </div>
                  </li>
                );
              }

              const Icon = item.icon;
              const fi = selectableToFiltered(selectedIndex);
              const isSelected = i === fi;
              return (
                <li
                  key={item.id}
                  id={`palette-option-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => {
                    // Map click index back to selectable index
                    let count = 0;
                    for (let j = 0; j <= i; j++) {
                      if (!filtered[j].isSeparator) count++;
                    }
                    setSelectedIndex(count - 1);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                    isSelected ? "bg-teal-light/40 text-ink" : "text-ink hover:bg-slate-light"
                  }`}
                >
                  <Icon size={16} className="shrink-0 text-slate" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {highlightMatch(item.title, query)}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate truncate">
                        {item.isRecent ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} className="inline" />
                            Recently used
                          </span>
                        ) : (
                          highlightMatch(item.description, query)
                        )}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <CornerDownLeft size={12} className="shrink-0 text-slate" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
