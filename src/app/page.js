"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { CATEGORIES, ALL_MODULES } from "@/lib/modules";
import { usePreference } from "@/lib/usePreference";
import { ACCENTS } from "@/lib/moduleAccents";
import ModuleCard from "@/components/ModuleCard";

function ComingSoonRow({ module }) {
  const Icon = module.icon;

  return (
    <div className="flex items-start gap-3 py-3.5">
      <span className="inline-flex p-1.5 rounded-full bg-slate-light text-slate shrink-0 mt-0.5">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{module.title}</p>
        <p className="text-sm text-slate">{module.description}</p>
      </div>
      <span className="ml-auto shrink-0 text-xs uppercase tracking-wide text-slate font-medium mt-1">
        Soon
      </span>
    </div>
  );
}

// Three animated dots that pulse in sequence — used in the hero to show
// "active but quiet" processing happening locally.
function TrustDots() {
  return (
    <span className="inline-flex items-center gap-1 text-white/60" aria-hidden="true">
      <span className="trust-dot" />
      <span className="trust-dot" />
      <span className="trust-dot" />
    </span>
  );
}

// First-use welcome banner — shown when the activity log is empty and the
// user hasn't dismissed it. Suggests four approachable starting modules.
const WELCOME_SUGGESTED = ["password-generator", "hibp", "exif", "qr"];

function WelcomeBanner({ onDismiss }) {
  const suggested = WELCOME_SUGGESTED
    .map((id) => ALL_MODULES.find((m) => m.id === id))
    .filter(Boolean);

  return (
    <div className="relative rounded-2xl bg-surface shadow-card overflow-hidden mb-8 sm:mb-10 animate-welcome-appear">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal" />
      <div className="pl-6 pr-4 py-5 sm:pl-7 sm:pr-5 sm:py-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="font-display text-lg font-semibold text-ink">
            Welcome to Sentinel
          </h2>
          <button
            onClick={onDismiss}
            className="text-xs text-slate hover:text-ink transition shrink-0 mt-0.5"
          >
            Dismiss
          </button>
        </div>
        <p className="text-sm text-slate mb-4">
          Here are some things you can try to get started.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggested.map((mod) => {
            const Icon = mod.icon;
            const { chipBg, chipText } = ACCENTS[mod.accent];
            return (
              <Link
                key={mod.id}
                href={mod.path}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-teal-light/40 transition group"
              >
                <span
                  className={`inline-flex p-1.5 rounded-full shrink-0 ${chipBg} ${chipText}`}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink group-hover:text-teal transition">
                    {mod.title}
                  </p>
                  <p className="text-xs text-slate leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [disabledModules] = usePreference("disabled-modules", []);
  const [welcomeDismissed, setWelcomeDismissed, isLoading] = usePreference(
    "welcome-dismissed",
    false
  );

  const showWelcome = !isLoading && !welcomeDismissed;

  function dismissWelcome() {
    setWelcomeDismissed(true);
  }

  const isLoaded = !isLoading;
  const disabledSet = new Set(disabledModules);

  const isVisible = (m) => !disabledSet.has(m.id);

  const visibleCategories = CATEGORIES.map((cat) => ({
    ...cat,
    available: cat.modules.filter(
      (m) => m.status === "available" && isVisible(m)
    ),
    comingSoon: cat.modules.filter(
      (m) => m.status === "coming-soon" && isVisible(m)
    ),
  })).filter((cat) => cat.available.length > 0 || cat.comingSoon.length > 0);

  const hasNoResults = visibleCategories.length === 0;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-10 sm:py-10">
      <div className="max-w-6xl mx-auto">

        {/* Hero */}
        <div className="hero-panel rounded-2xl sm:rounded-3xl px-6 py-7 sm:px-10 sm:py-9 mb-8 sm:mb-10 overflow-hidden relative">
          {/* Decorative lock watermark — inline SVG avoids emoji font override */}
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden sm:block absolute right-8 top-1/2 -translate-y-1/2 text-white/[0.07] pointer-events-none select-none w-44 h-44"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>

          <div className="relative">
            {/* Wordmark */}
            <div className="flex items-center gap-2.5 mb-3">
              <span className="inline-flex p-2 rounded-full bg-white/15">
                <ShieldCheck className="text-white" size={22} />
              </span>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
                Sentinel
              </h1>
            </div>

            {/* Tagline */}
            <p className="text-sm sm:text-base text-white/80 mb-2 max-w-sm sm:max-w-lg leading-relaxed">
              Privacy tools that run entirely in your browser.
            </p>

            {/* Trust signal — the key differentiator, shown not just stated */}
            <div className="flex items-center gap-2 mb-7">
              <TrustDots />
              <span className="text-xs text-white/55 font-medium tracking-wide">
                Passwords and files never leave your device — one anonymous
                hash check is the only exception
              </span>
            </div>
          </div>
        </div>

        {/* Welcome banner — first-use only */}
        {isLoaded && showWelcome && (
          <WelcomeBanner onDismiss={dismissWelcome} />
        )}

        {/* Default view — grouped by category */}
        {isLoaded &&
          visibleCategories.map((cat, i) => (
            <div key={cat.id} className={i < visibleCategories.length - 1 ? "mb-10" : ""}>
              {/* Category heading — more presence than a dot + tiny caps */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate">
                  {cat.label}
                </span>
                <span className="flex-1 h-px bg-slate/15" />
              </div>

              {cat.available.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {cat.available.map((module) => (
                    <ModuleCard key={module.id} module={module} />
                  ))}
                </div>
              )}

              {cat.comingSoon.length > 0 && (
                <div className={`max-w-2xl ${cat.available.length > 0 ? "mt-6" : ""}`}>
                  <div className="divide-y divide-slate/15">
                    {cat.comingSoon.map((module) => (
                      <ComingSoonRow key={module.id} module={module} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

        {isLoaded && hasNoResults && (
          <div className="text-center py-16">
            <p className="text-sm text-ink font-medium mb-1">No modules enabled</p>
            <p className="text-sm text-slate mb-4">
              Go to Settings to choose which modules appear here.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/settings/modules"
                className="text-sm text-teal font-medium hover:underline"
              >
                Manage modules →
              </Link>
              <Link
                href="/settings"
                className="text-sm text-slate hover:underline"
              >
                ← Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
