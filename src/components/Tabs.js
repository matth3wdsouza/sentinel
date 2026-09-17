"use client";

import { useRef } from "react";

// Tab bar used by Encryptor, File Integrity, Fingerprint, QR, and Activity.
//
// Also exports TabPanel — the standard panel wrapper matching the tab/wrapper
// convention described below, so pages don't re-type the association markup.
//
// Props for Tabs:
//   tabs       — array of { id, label }
//   activeTab  — the currently active tab id
//   onChange   — called with the new tab id when a tab is selected
//   ariaLabel  — accessible name for the tablist (e.g. "Hash method"). Always
//                pass one — without it the tablist has no accessible name.
//
// Renders only the bar itself — each page is still responsible for
// rendering its own panel content (conditionally shown via the
// `activeTab === x ? "" : "hidden"` pattern, or however the page prefers).
// Keeping panel rendering in the page avoids this component needing to
// know about children ordering, which would make it harder to use.
//
// Panels are associated via convention: the panel for a tab with id "foo"
// must carry `id="panel-foo"`, `role="tabpanel"`, `aria-labelledby="tab-foo"`,
// and `tabIndex={-1}` (so the active panel is programmatically focusable per
// the WAI-ARIA tabs pattern). The bar exposes the tablist/tab roles,
// aria-selected state, and arrow-key navigation from the WAI-ARIA tabs pattern.
export default function Tabs({ tabs, activeTab, onChange, ariaLabel }) {
  const tabListRef = useRef(null);

  function handleKeyDown(e) {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = null;

    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === null) return;

    e.preventDefault();
    if (nextIndex === index) return;

    const next = tabs[nextIndex];
    onChange(next.id);
    tabListRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="flex gap-2 border-b border-slate/20 mb-6 overflow-x-auto whitespace-nowrap"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 px-4 py-2 text-sm font-medium transition ${
            activeTab === tab.id
              ? "border-b-2 border-teal text-teal"
              : "text-slate hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// TabPanel — renders a panel for `id`, hidden unless it's the activeTab. Handles
// the id/role/aria/tabIndex association from the WAI-ARIA convention above.
export function TabPanel({ id, activeTab, children }) {
  return (
    <div
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      tabIndex={-1}
      className={activeTab === id ? "" : "hidden"}
    >
      {children}
    </div>
  );
}
