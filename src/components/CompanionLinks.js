"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ALL_MODULES } from "@/lib/modules";
import { usePreference } from "@/lib/usePreference";
import { storePendingPayload } from "@/lib/moduleBridge";

const COMPANION_LINKS_PREFERENCE = "ui.companionLinks";

// Target modules resolved once by path so each link can pick up the
// destination module's own icon from the registry without callers having
// to import it (unregistered paths just render without an icon).
const MODULES_BY_PATH = new Map(ALL_MODULES.map((m) => [m.path, m]));

// Cross-module "next step" links that live at the end of a result flow. Each
// link renders as a pill-style button with the target module's icon, the
// callers' plain-language action label, and an arrow that nudges on hover —
// so the Recommend → Act step reads as an action, not body text.
//
// Placement convention (kept consistent across modules):
//   • Inside the ResultCard (as a child) when the suggestion is a direct
//     consequence of the result outcome — the outcome determines which link
//     (or whether any) shows: "your password is breached → generate a new
//     one" (HIBP, Common Password), or a risk this module surfaced (EXIF →
//     Fingerprint).
//   • As a standalone row below the results when the suggestion is
//     independent of the specific outcome (a "you might also want this"
//     cross-link) — e.g. "need to hash a file too?" (Text Hash ↔ File
//     Integrity) or "generate a strong passphrase" (Encryptor) — or when the
//     module renders its result with a custom component that isn't a
//     ResultCard, so there's nowhere to nest it (Guessability's score≤1 link).
// Links always sit at the end of their flow, never interrupting a form.
export default function CompanionLinks({ links = [], className = "" }) {
  const router = useRouter();
  const [showLinks] = usePreference(COMPANION_LINKS_PREFERENCE, true);
  if (!showLinks || links.length === 0) return null;
  return (
    <div
      role="group"
      aria-label="Companion tools"
      className={`mt-1 flex flex-wrap gap-2 ${className}`}
    >
      {links.map(({ href, label, icon: Icon, payload, payloadFrom }, index) => {
        const resolved = MODULES_BY_PATH.get(href);
        const LinkIcon = Icon ?? resolved?.icon ?? null;

        // A link carrying a `payload` becomes a send-with-data button: it
        // stores the value in the module bridge (see moduleBridge.js) and
        // navigates client-side, so the destination module can pick it up on
        // mount — the value never touches the URL. Links without a payload
        // stay plain <Link>s, unchanged. Keys include the index so a page can
        // send several payloads to the same target (e.g. one per extracted
        // link) without React key collisions.
        if (payload !== undefined) {
          return (
            <button
              key={`${href}-${index}`}
              type="button"
              onClick={() => {
                storePendingPayload(href, payload, payloadFrom);
                router.push(href);
              }}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-surface px-3 py-1.5 text-sm font-medium text-teal transition hover:border-teal hover:bg-teal hover:text-on-teal"
            >
              {LinkIcon && <LinkIcon size={15} />}
              {label}
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          );
        }

        return (
          <Link
            key={`${href}-${index}`}
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