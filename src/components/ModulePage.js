"use client";

import { usePathname } from "next/navigation";
import { ALL_MODULES } from "@/lib/modules";
import PageHeader from "@/components/PageHeader";
import PageShell from "@/components/PageShell";

// Outer shell for every module page: PageShell provides the full-height main
// and max-w-2xl column; ModulePage adds the PageHeader and accent lookup.
//
// Accent is derived from the current pathname via ALL_MODULES — module
// pages don't need to pass their own accent. Falls back to "teal" during
// route transitions when the path doesn't yet match a registered module.
export default function ModulePage({ icon, title, description, children }) {
  const pathname = usePathname();
  const accent = ALL_MODULES.find((m) => m.path === pathname)?.accent ?? "teal";

  return (
    <PageShell>
      <PageHeader
        icon={icon}
        accent={accent}
        title={title}
        description={description}
      />
      {children}
    </PageShell>
  );
}
