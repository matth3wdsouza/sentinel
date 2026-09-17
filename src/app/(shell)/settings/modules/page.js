"use client";

import { Layers } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Switch from "@/components/Switch";
import { ACCENTS } from "@/lib/moduleAccents";
import { CATEGORIES, ALL_MODULES } from "@/lib/modules";
import { usePreference } from "@/lib/usePreference";

// ─── Module toggle row ────────────────────────────────────────────────────────

function ModuleRow({ module, disabled, onToggle }) {
  const Icon = module.icon;
  const { chipBg, chipText } = ACCENTS[module.accent];

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className={`inline-flex p-2 rounded-full shrink-0 ${chipBg} ${chipText}`}>
        <Icon size={16} />
      </span>
      <p className={`text-sm font-medium flex-1 min-w-0 ${disabled ? "text-slate" : "text-ink"}`}>
        {module.title}
      </p>
      <Switch
        checked={!disabled}
        onChange={() => onToggle(module.id)}
        ariaLabel={module.title}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulesSettingsPage() {
  // disabled is a set of module ids stored as an array in preferences.
  const [disabled, setDisabled] = usePreference("disabled-modules", []);

  const disabledSet = new Set(disabled);
  const allIds = ALL_MODULES.map((m) => m.id);
  const allDisabled = allIds.every((id) => disabledSet.has(id));
  const allEnabled = disabledSet.size === 0;

  function toggle(id) {
    setDisabled((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return [...set];
    });
  }

  function enableAll() {
    setDisabled([]);
  }

  function disableAll() {
    setDisabled(allIds);
  }

  return (
    <>
      <PageHeader
        icon={Layers}
        accent="teal"
        title="Modules"
        description="Choose which modules appear on the home screen."
      />
      {/* ── Enable / disable all ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-slate">
          {allEnabled
            ? "All modules visible"
            : allDisabled
            ? "All modules hidden"
            : `${disabledSet.size} module${disabledSet.size === 1 ? "" : "s"} hidden`}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={enableAll}
            disabled={allEnabled}
            className="text-xs text-teal font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:underline"
          >
            Enable all
          </button>
          <span className="text-slate/30 text-xs">·</span>
          <button
            onClick={disableAll}
            disabled={allDisabled}
            className="text-xs text-slate font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:underline"
          >
            Disable all
          </button>
        </div>
      </div>

      {/* ── Module list grouped by category ──────────────────────────────── */}
      <div className="space-y-6">
        {CATEGORIES.map((cat) => (
          <section key={cat.id}>
            <h2 className="text-xs uppercase tracking-widest font-semibold text-slate mb-3">
              {cat.label}
            </h2>
            <div className="bg-surface rounded-2xl divide-y divide-slate/10 shadow-card">
              {cat.modules
                .filter((m) => m.status === "available")
                .map((module) => (
                  <ModuleRow
                    key={module.id}
                    module={module}
                    disabled={disabledSet.has(module.id)}
                    onToggle={toggle}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── Empty state warning ───────────────────────────────────────────── */}
      {allDisabled && (
        <p className="text-xs text-slate text-center mt-6">
          All modules are hidden. The home screen will be empty until you enable at least one.
        </p>
      )}
    </>
  );
}
