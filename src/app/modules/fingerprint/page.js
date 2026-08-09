"use client";

import { useState, useEffect, useId } from "react";
import {
  Fingerprint,
  MapPin,
  Camera,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ModulePage from "@/components/ModulePage";
import ResultCard from "@/components/ResultCard";
import CopyButton from "@/components/CopyButton";
import { Button } from "@/components/Button";
import Tabs from "@/components/Tabs";
import { collectPassive, collectGeo, collectMedia } from "@/lib/fingerprint";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "passive", label: "Passive Exposure" },
  { id: "gated", label: "Permission-Gated" },
];

// ─── DataTable ────────────────────────────────────────────────────────────────
// Renders a list of { label, value } rows inside a ResultCard's children slot.
// Handles null/undefined values gracefully with a "Not available" fallback.

function DataTable({ rows }) {
  return (
    <div className="mt-1 mb-1 divide-y divide-slate/10">
      {rows.map(({ label, value }) => (
        <div key={label} className="py-2 flex items-start justify-between gap-4">
          <span className="text-xs text-slate shrink-0 w-40">{label}</span>
          <span className="text-xs text-ink font-mono text-right break-all">
            {value ?? (
              <span className="text-slate italic">Not available</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CollapsibleCard ──────────────────────────────────────────────────────────
// A ResultCard whose DataTable is collapsible after initial render.
// Starts expanded so the user sees all data immediately; collapse is available
// to reduce visual noise once they've read a section.

function CollapsibleCard({ heading, explanation, rows, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <ResultCard verdict="neutral" heading={heading} explanation={explanation}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center gap-1 text-xs text-slate hover:text-teal transition mb-1"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? "Collapse" : "Expand"}
      </button>
      <div id={contentId}>{open && <DataTable rows={rows} />}</div>
    </ResultCard>
  );
}

// ─── SummaryBanner ────────────────────────────────────────────────────────────
// The hero card at the top of the Passive tab — shows total count and a
// one-liner framing why this matters.

function SummaryBanner({ count }) {
  return (
    <div className="rounded-xl bg-accent-indigo-light border border-accent-indigo/20 px-5 py-4 mb-6">
      <p className="text-sm font-semibold text-accent-indigo mb-0.5">
        {count} data points exposed — no permission required
      </p>
      <p className="text-xs text-slate leading-relaxed">
        Every website you visit receives this information automatically, just
        by loading a page. No pop-up, no permission prompt, no opt-in. The
        items below are what any site — including this one — can read right
        now.
      </p>
    </div>
  );
}


// ─── PassiveTab ──────────────────────────────────────────────────────────────

// Count of the data points surfaced in the Passive tab's tables. Shared by
// the summary banner and the activity log so the two can't drift apart —
// derived from the collected data, not a hardcoded figure, so adding or
// removing a field is reflected automatically.
function countDataPoints({ identity, locale, display, hardware, tracking, graphics }) {
  const allValues = [
    identity.userAgent, identity.browser, identity.os,
    identity.platform, identity.vendor,
    locale.timezone, locale.locale, locale.language, locale.languages,
    display.screenResolution, display.availableResolution,
    display.colorDepth, display.devicePixelRatio,
    hardware.hardwareConcurrency, hardware.deviceMemory,
    hardware.connectionType, hardware.connectionDownlink,
    tracking.doNotTrack, tracking.cookiesEnabled,
    graphics.webglVendor, graphics.webglRenderer, graphics.canvasHash,
  ];
  return allValues.filter((v) => v != null).length;
}

function PassiveTab({ moduleId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    collectPassive().then((result) => {
      setData(result);
      setLoading(false);

      // Log metadata only — never the actual fingerprint values, which are
      // identifying. That includes hash prefixes: a truncated digest of a
      // near-unique signal is still a digest, so only booleans/counts are
      // persisted here. The full canvas hash stays on screen, not in the log.
      saveActivity({
        moduleType: moduleId,
        summary: "Browser fingerprint collected",
        details: {
          passiveDataPoints: countDataPoints(result),
          webglAvailable: !result.graphics.webglError,
        },
      });
    }).catch(() => setLoading(false));
  }, [moduleId]);

  if (loading) {
    return (
      <p className="text-sm text-slate py-8 text-center">
        Collecting browser data…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-slate py-8 text-center">
        Could not collect browser data.
      </p>
    );
  }

  const { identity, locale, display, hardware, tracking, graphics } = data;

  // Count non-null values for the summary banner (same source as the log)
  const count = countDataPoints(data);

  return (
    <div className="space-y-4">
      <SummaryBanner count={count} />

      {/* ── Identity ── */}
      <CollapsibleCard
        heading="Identity"
        explanation={{
          means:
            "Your browser sends a User-Agent string with every single HTTP request — it identifies your browser name, version, and operating system to every server you connect to. This is not a cookie and cannot be blocked without changing browser settings.",
          doesntMean:
            "This alone doesn't uniquely identify you as an individual, but combined with other signals on this page it contributes to a fingerprint that can.",
          action:
            "If you want to reduce this, some browsers (like Firefox or Brave) let you spoof or genericise the User-Agent string.",
        }}
        rows={[
          { label: "Browser", value: identity.browser },
          { label: "Operating system", value: identity.os },
          { label: "Platform", value: identity.platform },
          { label: "Vendor", value: identity.vendor },
          { label: "Full User-Agent", value: identity.userAgent },
        ]}
      />

      {/* ── Location & locale ── */}
      <CollapsibleCard
        heading="Location & Locale"
        explanation={{
          means:
            "Your timezone reveals your geographic region with surprising precision — often to within a single city. Combined with your locale and language settings, it's enough to narrow down where in the world you are without GPS or any location permission.",
          doesntMean:
            "This is not the same as your IP-address location — it comes from your device's clock and system settings, not your network.",
          action:
            "VPNs don't hide your timezone. To change it, you'd need to alter your OS clock settings or use a browser that spoofs the Intl API.",
        }}
        rows={[
          { label: "Timezone", value: locale.timezone },
          { label: "Language", value: locale.language },
          { label: "All languages", value: locale.languages },
          { label: "Locale", value: locale.locale },
        ]}
      />

      {/* ── Display ── */}
      <CollapsibleCard
        heading="Display"
        explanation={{
          means:
            "Your screen resolution and pixel ratio narrow down the physical display you're using — helpful for distinguishing a MacBook Pro (2× pixel ratio, common resolutions) from a Windows laptop or Android phone. The 'available' resolution excludes taskbars and docks, which hints at your OS.",
          doesntMean:
            "Resolution alone doesn't identify you, but it's one of the most stable signals in a fingerprint — your screen size rarely changes.",
          action:
            "Some browsers (like Tor Browser) report a uniform, generic resolution to all sites instead of your real one.",
        }}
        rows={[
          { label: "Screen resolution", value: display.screenResolution },
          { label: "Available resolution", value: display.availableResolution },
          { label: "Colour depth", value: display.colorDepth },
          { label: "Device pixel ratio", value: String(display.devicePixelRatio) },
        ]}
      />

      {/* ── Hardware ── */}
      <CollapsibleCard
        heading="Hardware"
        explanation={{
          means:
            "CPU core count and device memory are coarse values (browsers deliberately round them), but they still meaningfully distinguish a high-end desktop from a mid-range phone. Connection type reveals whether you're on Wi-Fi, 4G, or a slow connection — useful for advertisers targeting by purchase intent.",
          doesntMean:
            "These values are intentionally imprecise — browsers report memory in power-of-two buckets (0.25, 0.5, 1, 2, 4, 8 GB) rather than the exact figure to limit their fingerprinting usefulness.",
          action:
            "Firefox with resistFingerprinting enabled reports generic values for these fields.",
        }}
        rows={[
          {
            label: "CPU cores",
            value:
              hardware.hardwareConcurrency != null
                ? String(hardware.hardwareConcurrency)
                : null,
          },
          { label: "Device memory", value: hardware.deviceMemory },
          { label: "Connection type", value: hardware.connectionType },
          { label: "Download speed", value: hardware.connectionDownlink },
          { label: "Data saver", value: hardware.dataSaver },
        ]}
      />

      {/* ── Tracking signals ── */}
      <CollapsibleCard
        heading="Tracking Signals"
        explanation={{
          means:
            "Do Not Track was a browser setting that was supposed to tell websites you didn't want to be tracked. It was never legally binding, and the vast majority of websites simply ignored it — so most browsers have now removed or deprecated it. Seeing it here as 'Not set' or 'Disabled' is completely normal.",
          doesntMean:
            "Having DNT enabled does not actually prevent tracking. It is a request, not a control.",
          action:
            "Rather than relying on DNT, use a content blocker (uBlock Origin) or a privacy-focused browser to actually limit tracking.",
        }}
        rows={[
          { label: "Do Not Track", value: tracking.doNotTrack },
          { label: "Cookies enabled", value: tracking.cookiesEnabled },
          { label: "PDF viewer built in", value: tracking.pdfViewerEnabled },
        ]}
      />

      {/* ── Graphics ── */}
      <ResultCard
        verdict="neutral"
        heading="Graphics & Canvas Fingerprint"
        explanation={{
          means:
            "Your GPU vendor and model are exposed to every website via the WebGL API — no permission required. The canvas fingerprint is more subtle: a hidden drawing is rendered using your GPU and system fonts, then hashed. Because every GPU, driver version, and OS renders text and shapes slightly differently at the pixel level, this hash is often unique to your specific machine.",
          doesntMean:
            "A canvas fingerprint alone isn't enough to track you across the entire internet — but combined with the other values on this page, it forms a stable identifier that persists even after clearing cookies.",
          action:
            "Brave Browser randomises the canvas output per site to defeat this. Firefox with privacy.resistFingerprinting also blocks it. The WebGL vendor/renderer strings can be hidden via that same Firefox setting.",
        }}
      >
        <DataTable
          rows={[
            { label: "GPU vendor", value: graphics.webglVendor },
            { label: "GPU model", value: graphics.webglRenderer },
            {
              label: "Canvas hash (SHA-256)",
              value: graphics.canvasHash ?? graphics.canvasError,
            },
          ]}
        />
        {graphics.canvasHashFull && (
          <div className="mt-3 pt-3 border-t border-slate/10 flex items-center justify-between gap-2">
            <p className="text-xs text-slate">Copy full 64-character canvas hash</p>
            <CopyButton value={graphics.canvasHashFull} label="canvas hash" />
          </div>
        )}
      </ResultCard>
    </div>
  );
}

// ─── GeoSection ───────────────────────────────────────────────────────────────

function GeoSection() {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [highAccuracy, setHighAccuracy] = useState(false);

  async function handleRequest() {
    setState("loading");
    const geo = await collectGeo(highAccuracy);
    setResult(geo);
    setState(geo.error ? "error" : "done");
  }

  const errorMessages = {
    DENIED:
      "You denied the permission — which is the right call for most sites. The point is that sites can ask, and if you've previously granted it to any site, that site has your location.",
    UNAVAILABLE:
      "Your device couldn't determine a location. This can happen on desktops without GPS that are on VPNs or networks with ambiguous IP geolocation.",
    TIMEOUT:
      "Location request timed out. Try again with a stable network connection.",
    NOT_SUPPORTED:
      "Geolocation is not supported in this browser.",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface shadow-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex p-2 rounded-full bg-accent-indigo-light text-accent-indigo shrink-0">
            <MapPin size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink mb-1">Geolocation</p>
            <p className="text-xs text-slate leading-relaxed">
              Websites can request your location via the Geolocation API.
              Clicking below triggers your browser&apos;s real permission prompt.
              If you grant it, your coordinates will be shown below.
              Nothing is sent anywhere.
            </p>
          </div>
        </div>

        {state === "idle" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHighAccuracy(false)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition ${
                  !highAccuracy
                    ? "border-teal bg-teal-light text-teal-chip font-medium"
                    : "border-slate/25 text-slate hover:border-teal/50"
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setHighAccuracy(true)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition ${
                  highAccuracy
                    ? "border-teal bg-teal-light text-teal-chip font-medium"
                    : "border-slate/25 text-slate hover:border-teal/50"
                }`}
              >
                Precise (GPS)
              </button>
            </div>
            <p className="text-xs text-slate">
              {highAccuracy
                ? "Requests GPS when available — more accurate on mobile but may take a few seconds longer."
                : "Uses Wi-Fi or network location — faster but less accurate, typically within 20–300 metres."}
            </p>
            <Button onClick={handleRequest}>
              Request location
            </Button>
          </div>
        )}
        {state === "loading" && (
          <p className="text-sm text-slate">
            {highAccuracy
              ? "Waiting for location — GPS may take a few seconds…"
              : "Waiting for location…"}
          </p>
        )}
      </div>

      {state === "done" && result && !result.error && (
        <ResultCard
          verdict="neutral"
          heading="Location granted"
          explanation={{
            means:
              highAccuracy
                ? "Any website you grant this permission to receives these exact coordinates. GPS-level accuracy on a phone can place you within a few metres — enough to identify your street or building."
                : "Any website you grant this permission to receives these coordinates. Standard accuracy uses Wi-Fi or network location, typically within 20–300 metres — enough to place you in a neighbourhood.",
            doesntMean:
              "Granting location permission here doesn't persist — this is a one-time request. But if you've granted location to other sites in the past, those permissions may still be active.",
            action:
              "Review which sites have location access in your browser settings (usually under Privacy → Site Permissions → Location).",
          }}
        >
          <DataTable
            rows={[
              { label: "Latitude", value: result.latitude },
              { label: "Longitude", value: result.longitude },
              { label: "Accuracy", value: result.accuracy },
              { label: "Altitude", value: result.altitude },
            ]}
          />
          {result.latitude && result.longitude && (
            <div className="mt-3 pt-3 border-t border-slate/10">
              <a
                href={`https://www.openstreetmap.org/?mlat=${result.latitude}&mlon=${result.longitude}&zoom=14`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal hover:underline"
              >
                View on OpenStreetMap →
              </a>
            </div>
          )}
        </ResultCard>
      )}

      {state === "error" && result && (
        <ResultCard
          verdict="mismatch"
          heading={result.error === "DENIED" ? "Permission denied" : "Location unavailable"}
          explanation={{
            means: errorMessages[result.error] ?? "An unknown error occurred.",
            action:
              result.error === "DENIED"
                ? "You can manage site location permissions in your browser settings."
                : undefined,
          }}
        />
      )}
    </div>
  );
}

// ─── MediaSection ─────────────────────────────────────────────────────────────

function MediaSection() {
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);

  async function handleRequest() {
    setState("loading");
    const media = await collectMedia();
    setResult(media);
    setState(media.error ? "error" : "done");
  }

  const errorMessages = {
    DENIED:
      "You denied the permission. The important thing this demonstrates is that device labels — which include manufacturer and model strings — are hidden until permission is granted. Once a site has camera/mic access, it can read those labels.",
    NOT_FOUND:
      "No camera or microphone was found on this device.",
    NOT_SUPPORTED:
      "Media device access is not supported in this browser.",
    ERROR:
      "An unexpected error occurred while requesting media access.",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface shadow-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex p-2 rounded-full bg-accent-indigo-light text-accent-indigo shrink-0">
            <Camera size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink mb-1">
              Camera & Microphone Devices
            </p>
            <p className="text-xs text-slate leading-relaxed">
              Browsers hide device labels (camera and microphone names) until
              you grant camera/microphone permission. Once granted, the
              full device list — with manufacturer and model names — is
              exposed. Clicking below will trigger the real permission
              prompt. The camera and microphone are stopped immediately
              after the permission is read; no video or audio is captured
              or stored.
            </p>
          </div>
        </div>

        {state === "idle" && (
          <Button onClick={handleRequest}>
            Request camera & mic access
          </Button>
        )}
        {state === "loading" && (
          <p className="text-sm text-slate">Waiting for permission…</p>
        )}
      </div>

      {state === "done" && result && (
        <ResultCard
          verdict="neutral"
          heading="Device list exposed"
          explanation={{
            means:
              "With permission granted, websites can enumerate every camera, microphone, and speaker connected to your device — including the manufacturer and model string. This is another fingerprinting vector: a specific combination of 'Logitech C920', 'MacBook Pro Microphone', and 'AirPods Pro' is fairly unique.",
            doesntMean:
              "This doesn't mean any site can silently record you — the stream was stopped immediately. But it does mean any site with camera/mic permission can read these labels.",
            action:
              "Review which sites have camera and microphone access in your browser settings under Privacy → Site Permissions.",
          }}
        >
          <DataTable
            rows={
              result.devices.length > 0
                ? result.devices.map((d, i) => ({
                    label: `${d.kind} ${i + 1}`,
                    value: d.label,
                  }))
                : [{ label: "Devices found", value: "None" }]
            }
          />
        </ResultCard>
      )}

      {state === "error" && result && (
        <ResultCard
          verdict="mismatch"
          heading={result.error === "DENIED" ? "Permission denied" : "Access unavailable"}
          explanation={{
            means: errorMessages[result.error] ?? "An unknown error occurred.",
            action:
              result.error === "DENIED"
                ? "You can manage camera and microphone permissions in your browser settings under Privacy → Site Permissions."
                : undefined,
          }}
        />
      )}
    </div>
  );
}

// ─── GatedTab ─────────────────────────────────────────────────────────────────

function GatedTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-accent-indigo-light border border-accent-indigo/20 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={15} className="text-accent-indigo shrink-0 mt-0.5" />
          <p className="text-xs text-slate leading-relaxed">
            The items below require an explicit browser permission prompt
            before any data is revealed. Each button triggers the real
            browser prompt — the same one any website would show. You can
            click or dismiss it; either outcome is informative. Nothing
            is sent anywhere.
          </p>
        </div>
      </div>

      <GeoSection />
      <MediaSection />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("passive");

  return (
    <ModulePage
      icon={Fingerprint}
      title="Browser Fingerprint"
      description="See what your browser silently reveals to every website you visit — no permissions needed for most of it."
    >

        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div id="panel-passive" role="tabpanel" className={activeTab === "passive" ? "" : "hidden"}>
          <PassiveTab moduleId={moduleId} />
        </div>
        <div id="panel-gated" role="tabpanel" className={activeTab === "gated" ? "" : "hidden"}>
          <GatedTab />
        </div>
    </ModulePage>
  );
}
