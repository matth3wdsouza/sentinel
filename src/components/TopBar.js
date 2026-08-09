"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Settings } from "lucide-react";

export default function TopBar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-2 bg-paper/80 backdrop-blur-sm border-b border-slate/10">
      <div className="min-w-[40px]">
        {!isHome && (
          <Link
            href="/"
            aria-label="Back to modules"
            className="inline-flex p-3 rounded-full text-slate hover:text-teal hover:bg-slate-light transition"
          >
            <Home size={18} />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Link
          href="/activity"
          aria-label="Activity log"
          className="inline-flex p-3 rounded-full text-slate hover:text-teal hover:bg-slate-light transition"
        >
          <History size={18} />
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="inline-flex p-3 rounded-full text-slate hover:text-teal hover:bg-slate-light transition"
        >
          <Settings size={18} />
        </Link>
      </div>
    </div>
  );
}
