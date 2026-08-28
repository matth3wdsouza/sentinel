"use client";

import { usePathname } from "next/navigation";
import { ALL_MODULES } from "@/lib/modules";
import { ACCENTS } from "@/lib/moduleAccents";

// GuidedCard lives only on module pages, so it derives its accent from the
// current pathname the same way ModulePage does — one colour per page, in
// lock-step with the home-grid card the user clicked. Modules never pass an
// accent prop here, so a manually-typed accent can't drift out of sync with
// the registry.
export default function GuidedCard({ icon: Icon, heading, description, children }) {
  const pathname = usePathname();
  const accent = ALL_MODULES.find((m) => m.path === pathname)?.accent ?? "teal";
  const tokens = ACCENTS[accent];

  return (
    <div className="rounded-xl bg-surface shadow-card p-5 mb-5">
      <div className="flex items-start gap-3 mb-3">
        <span className={`inline-flex p-2 rounded-full ${tokens.chipBg} ${tokens.chipText} shrink-0`}>
          <Icon size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">{heading}</p>
          <p className="text-xs text-slate leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
