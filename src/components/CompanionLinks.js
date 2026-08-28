"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ALL_MODULES } from "@/lib/modules";

// Target modules resolved once by path so each link can pick up the
// destination module's own icon from the registry without callers having
// to import it (unregistered paths just render without an icon).
const MODULES_BY_PATH = new Map(ALL_MODULES.map((m) => [m.path, m]));

// Cross-module "next step" links that live inside result cards. Each link
// renders as a pill-style button with the target module's icon, the
// callers' plain-language action label, and an arrow that nudges on hover —
// so the Recommend → Act step reads as an action, not body text.
export default function CompanionLinks({ links = [], className = "" }) {
  if (links.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Companion tools"
      className={`mt-1 flex flex-wrap gap-2 ${className}`}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const resolved = MODULES_BY_PATH.get(href);
        const LinkIcon = Icon ?? resolved?.icon ?? null;
        return (
          <Link
            key={href}
            href={href}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-surface px-3 py-1.5 text-sm font-medium text-teal transition hover:border-teal hover:bg-teal hover:text-on-teal"
          >
            {LinkIcon && <LinkIcon size={15} />}
            {label}
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        );
      })}
    </div>
  );
}