"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, RotateCcw, Layers, ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";
import SchemePicker from "@/components/SchemePicker";
import Switch from "@/components/Switch";
import { clearPreferences } from "@/lib/db";
import { clearAllActivity } from "@/lib/api";
import { usePreference } from "@/lib/usePreference";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingsSection({ title, children, danger = false }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-slate mb-3">
        {title}
      </h2>
      {danger ? (
        <div className="bg-surface rounded-2xl divide-y divide-slate/10 border border-danger/60 shadow-card">
          {children}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl divide-y divide-slate/10 shadow-card">
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Row wrapper ──────────────────────────────────────────────────────────────

function SettingsRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && (
          <p className="text-xs text-slate mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tryExamples, setTryExamples] = usePreference("ui.tryExamples", true);
  const [companionLinks, setCompanionLinks] = usePreference("ui.companionLinks", true);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetType, setResetType] = useState(null);
  const [clearActivityConfirming, setClearActivityConfirming] = useState(false);
  const [clearActivitySuccess, setClearActivitySuccess] = useState(false);
  const [resetAllConfirming, setResetAllConfirming] = useState(false);
  // The clear-activity success banner hides itself after 4s; the timer is
  // held in a ref and cleared on unmount (see handleClearActivity — a
  // `return () => clearTimeout` inside that async handler would be a no-op).
  const clearBannerTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(clearBannerTimerRef.current), []);

  // Show a success banner when returning from a reset reload.
  // Reads the param directly from window.location and cleans the URL via
  // history.replaceState — avoiding Next.js router hooks which would add
  // the URL to the dependency array and re-trigger the effect, cancelling
  // the dismiss timer before it fires.
  useEffect(() => {
    const resetParam = new URLSearchParams(window.location.search).get("reset");
    if (resetParam === "1" || resetParam === "everything") {
      setResetSuccess(true);
      setResetType(resetParam);
      window.history.replaceState(null, "", "/settings");
      const timer = setTimeout(() => setResetSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  async function handleResetAll() {
    await clearPreferences();
    window.location.href = "/settings?reset=1";
  }

  async function handleClearActivity() {
    await clearAllActivity();
    setClearActivityConfirming(false);
    setClearActivitySuccess(true);
    clearTimeout(clearBannerTimerRef.current);
    clearBannerTimerRef.current = setTimeout(() => setClearActivitySuccess(false), 4000);
  }

  async function handleResetEverything() {
    await Promise.all([clearPreferences(), clearAllActivity()]);
    window.location.href = "/settings?reset=everything";
  }

  return (
    <>
      <PageHeader
        icon={Settings}
        accent="blue"
        title="Settings"
        description="Appearance and tool preferences. Everything is stored locally on your device."
      />

      {resetSuccess && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-match-light text-match text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          {resetType === "everything"
            ? "All preferences and activity have been reset."
            : "All preferences have been reset to their defaults."}
        </div>
      )}
      {clearActivitySuccess && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-match-light text-match text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          Activity log cleared.
        </div>
      )}

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <SettingsSection title="Appearance">
        <SettingsRow
          label="Theme"
          description="Choose a theme or follow your system setting."
        >
          <ThemeToggle />
        </SettingsRow>
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-ink">Color scheme</p>
          <p className="text-xs text-slate mt-0.5 leading-relaxed mb-3">
            Palette applied in both light and dark mode.
          </p>
          <SchemePicker />
        </div>
      </SettingsSection>

      {/* ── File Integrity ───────────────────────────────────────────────── */}
      {/* No size-limit setting here anymore: hashing streams files in chunks
          (memory stays bounded regardless of size), and the modules show an
          optional terminal command for files over ~2 GB. */}

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <SettingsSection title="Modules">
        <SettingsRow
          label="Show examples"
          description="Load sample inputs into module pages so a tool's effect can be seen in one click. Turn this off to hide them everywhere."
        >
          <Switch
            checked={tryExamples}
            onChange={setTryExamples}
            ariaLabel="Show examples"
          />
        </SettingsRow>
        <SettingsRow
          label="Show companion links"
          description="Show 'next step' links at the end of module results. Turn this off to hide them everywhere."
        >
          <Switch
            checked={companionLinks}
            onChange={setCompanionLinks}
            ariaLabel="Show companion links"
          />
        </SettingsRow>
        <Link
          href="/settings/modules"
          className="flex items-center justify-between gap-6 px-5 py-4 hover:bg-slate/5 transition rounded-2xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Layers size={16} className="text-slate shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Manage modules</p>
              <p className="text-xs text-slate mt-0.5">
                Choose which modules appear on the home screen.
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate shrink-0" />
        </Link>
      </SettingsSection>

      {/* ── Reset ────────────────────────────────────────────────────────── */}
      <SettingsSection title="Reset" danger>
        <SettingsRow
          label="Reset all preferences to defaults"
          description="Resets all tool settings to defaults. Theme is not affected."
        >
          {!resetConfirming ? (
            <button
              onClick={() => setResetConfirming(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate/30 text-slate hover:text-ink hover:border-slate/60 transition"
            >
              <RotateCcw size={14} />
              Reset settings
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate">Are you sure?</span>
              <button
                onClick={handleResetAll}
                className="text-sm text-danger font-medium hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setResetConfirming(false)}
                className="text-sm text-slate hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </SettingsRow>
        <SettingsRow
          label="Clear activity log"
          description="Permanently deletes your local activity history. This cannot be undone."
        >
          {!clearActivityConfirming ? (
            <button
              onClick={() => setClearActivityConfirming(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate/30 text-slate hover:text-ink hover:border-slate/60 transition"
            >
              <RotateCcw size={14} />
              Clear
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate">Are you sure?</span>
              <button
                onClick={handleClearActivity}
                className="text-sm text-danger font-medium hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setClearActivityConfirming(false)}
                className="text-sm text-slate hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </SettingsRow>
        <SettingsRow
          label="Reset everything"
          description="Clears all preferences and your entire activity log in one go. The app will reload. This cannot be undone."
        >
          {!resetAllConfirming ? (
            <button
              onClick={() => setResetAllConfirming(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-danger/50 text-danger hover:border-danger hover:bg-danger-light transition"
            >
              <RotateCcw size={14} />
              Reset everything
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate">Are you sure?</span>
              <button
                onClick={handleResetEverything}
                className="text-sm text-danger font-medium hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setResetAllConfirming(false)}
                className="text-sm text-slate hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
