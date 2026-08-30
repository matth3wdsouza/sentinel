"use client";

import Disclosure from "@/components/Disclosure";

// The expandable findings/flag list shared by the inspector modules. Only the
// severity-chip row differs per module, so `renderLabel` supplies that and
// `getKey` the item key; the heading wrapper, Disclosure chrome, and the body
// (`children(item)`) are shared.
export default function FindingsList({
  heading,
  items,
  getKey = (item, i) => i,
  renderLabel,
  expanded,
  onToggle,
  children,
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-display font-semibold text-ink">{heading}</h3>
      {items.map((item, i) => (
        <Disclosure
          key={getKey(item, i)}
          label={renderLabel(item)}
          open={expanded[i] ?? false}
          onToggle={() => onToggle(i)}
          className="rounded-xl bg-surface shadow-card overflow-hidden"
          buttonClassName="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate/5 transition"
          contentClassName="px-4 pb-4"
        >
          {children(item)}
        </Disclosure>
      ))}
    </div>
  );
}