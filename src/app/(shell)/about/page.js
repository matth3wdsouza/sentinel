import {
  Info,
  Boxes,
  LayoutGrid,
  Lock,
  Globe,
  CloudOff,
  UserX,
  Database,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { CATEGORIES } from "@/lib/modules";
import { ACCENTS } from "@/lib/moduleAccents";
import pkg from "../../../../package.json";

// ─── Section heading ─────────────────────────────────────────────────────────
// Matches SettingsSection's title style so the About page reads as part of the
// shell.

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-slate mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── "At a glance" stat tile ─────────────────────────────────────────────────

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="bg-surface rounded-2xl shadow-card px-4 py-4">
      <span className="inline-flex p-1.5 rounded-lg bg-accent-indigo-light text-accent-indigo mb-2.5">
        <Icon size={15} />
      </span>
      <p className="font-display text-2xl font-bold text-ink leading-none">{value}</p>
      <p className="text-xs text-slate mt-1.5 leading-snug">{label}</p>
    </div>
  );
}

// ─── Compact module tile for the directory ───────────────────────────────────
// Same accent-chip + card language as the home grid's ModuleCard, condensed to
// icon + title so the directory stays scannable.

function DirectoryTile({ module }) {
  const Icon = module.icon;
  const { chipBg, chipText } = ACCENTS[module.accent];

  return (
    <Link
      href={module.path}
      className="flex items-center gap-2.5 p-3 rounded-xl bg-surface shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
    >
      <span className={`inline-flex p-1.5 rounded-lg shrink-0 ${chipBg} ${chipText}`}>
        <Icon size={15} />
      </span>
      <span className="text-sm font-medium text-ink">{module.title}</span>
    </Link>
  );
}

// ─── Privacy feature row ─────────────────────────────────────────────────────
// Divided-row layout lifted from SettingsSection's rows, with an icon chip in
// the About accent (indigo).

function PrivacyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="inline-flex p-1.5 rounded-lg bg-accent-indigo-light text-accent-indigo shrink-0 mt-0.5">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-slate mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const allModules = CATEGORIES.flatMap((cat) => cat.modules);
  const availableCount = allModules.filter((mod) => mod.status === "available").length;
  const categoriesCount = CATEGORIES.length;

  return (
    <>
      <PageHeader
        icon={Info}
        accent="indigo"
        title="About"
        description="What Sentinel is, and how it handles your data."
      />

      <Section title="What this is">
        <div className="text-sm text-ink leading-relaxed space-y-3">
          <p>
            Sentinel is a browser-based toolkit for password, file, and message
            security checks — password strength and breach checks, file
            integrity and metadata inspection, QR and URL safety checks, and a
            handful of developer-facing decoders (JWT, Base64, TOTP).
          </p>
          <p>
            Every module runs standalone, but many are cross-linked: a URL
            flagged as risky links to the Unicode Inspector, a common password
            links to the Password Generator, and so on. You can turn these
            links off in{" "}
            <Link href="/settings" className="text-teal hover:underline">
              Settings
            </Link>{" "}
            if you&apos;d rather each module stood on its own.
          </p>
        </div>
      </Section>

      <Section title="At a glance">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Boxes} value={availableCount} label="modules — all running locally" />
          <StatTile icon={LayoutGrid} value={categoriesCount} label="categories of tools" />
          <StatTile icon={Lock} value="100%" label="runs in your browser" />
          <StatTile icon={Globe} value="1" label="external call — HIBP breach check only" />
        </div>
      </Section>

      <Section title="Every module">
        {CATEGORIES.map((cat) => {
          const available = cat.modules.filter((mod) => mod.status === "available");
          if (available.length === 0) return null;
          return (
            <div key={cat.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate">
                  {cat.label}
                </span>
                <span className="flex-1 h-px bg-slate/15" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {available.map((mod) => (
                  <DirectoryTile key={mod.id} module={mod} />
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Privacy">
        <div className="bg-surface rounded-2xl divide-y divide-slate/10 shadow-card">
          <PrivacyRow icon={Lock} label="Locally processed">
            All computation happens in your browser. Nothing you type, paste,
            or upload is sent anywhere by default.
          </PrivacyRow>
          <PrivacyRow icon={CloudOff} label="No server">
            Sentinel is static files served to your browser — no backend, no
            account, no analytics, no telemetry.
          </PrivacyRow>
          <PrivacyRow icon={Globe} label="One exception: HIBP">
            The breach check sends only the first 5 characters of your
            password&apos;s SHA-1 hash to{" "}
            <a
              href="https://haveibeenpwned.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal hover:underline"
            >
              Have I Been Pwned
            </a>{" "}
            — a k-anonymity lookup that never transmits your actual password.
          </PrivacyRow>
          <PrivacyRow icon={UserX} label="No user data collected">
            Nothing leaves this device for identification, syncing, or
            marketing.
          </PrivacyRow>
          <PrivacyRow icon={Database} label="History stays on-device">
            Your activity log is stored in IndexedDB, on this device only. You
            can clear individual entries from the Activity page, or wipe
            everything from{" "}
            <Link href="/settings" className="text-teal hover:underline">
              Settings
            </Link>
            .
          </PrivacyRow>
        </div>
      </Section>

      <footer className="text-center mt-10">
        <p className="text-xs text-slate">
          Sentinel v{pkg.version} — a local-first privacy toolkit.
        </p>
      </footer>
    </>
  );
}