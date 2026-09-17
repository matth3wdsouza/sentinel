"use client";

import { useState, useId } from "react";
import {
  Fingerprint,
  MapPin,
  Camera,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ModulePage from "@/components/ModulePage";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import CopyButton from "@/components/CopyButton";
import KeyValueRow from "@/components/KeyValueRow";
import { Button } from "@/components/Button";
import Tabs, { TabPanel } from "@/components/Tabs";
import CompanionLinks from "@/components/CompanionLinks";
import { collectPassive, collectGeo, collectMedia } from "@/lib/fingerprint";
import { osmLink } from "@/lib/geo";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { companionLinksFor } from "@/lib/companionLinks";

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
        <KeyValueRow
          key={label}
          label={label}
          value={value}
          mono
          variant="row"
          emptyText="Not available"
          className="py-2"
        />
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
        Every website receives this automatically just by loading the page —
        no pop-up, no prompt, no opt-in. Below is what any site, including
        this one, can read right now.
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
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [data, setData] = useState(null);

  async function handleCollect() {
    setState("loading");
    try {
      const result = await collectPassive();
      setData(result);
      setState("done");

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
    } catch {
      setState("error");
    }
  }

  if (state === "error") {
    return (
      <ResultCard
        verdict="mismatch"
        heading="Could not collect browser data"
        explanation={{
          means:
            "An unexpected error prevented your browser data from being collected.",
          action:
            "Collection runs entirely in your browser — try again.",
        }}
      >
        <Button onClick={() => setState("idle")}>Try again</Button>
      </ResultCard>
    );
  }

  return (
    <div className="space-y-5">
      <GuidedCard
        icon={Fingerprint}
        heading="Passive exposure"
        description={
          "Every website receives dozens of browser details automatically — " +
          "no permission prompt required. Clicking below collects yours so " +
          "you can see what any site already reads. Nothing is sent anywhere."
        }
      >
        <Button
          onClick={handleCollect}
          disabled={state === "loading"}
          loading={state === "loading"}
          loadingLabel="Collecting…"
        >
          Collect browser data
        </Button>
      </GuidedCard>

      {state === "done" && <PassiveResults data={data} />}
    </div>
  );
}

// ─── PassiveResults ──────────────────────────────────────────────────────────

// Renders the collected fingerprint tables. Kept as its own component so the
// intake card above stays on screen (and lets the user re-collect) while the
// results render underneath — matching the inline Button loading pattern used
// in the other modules.
function PassiveResults({ data }) {
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
            "Your browser sends a User-Agent string — browser, version, and OS — with every HTTP request. It's not a cookie, and can't be blocked without changing browser settings.",
          doesntMean:
            "Alone, it doesn't identify you as an individual — but combined with the other signals on this page, it contributes to a fingerprint that can.",
          action:
            "Firefox and Brave let you spoof or genericise the User-Agent string.",
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
            "Your timezone narrows down your region — often to a single city. Combined with locale and language, it can place you geographically without GPS or a location permission.",
          doesntMean:
            "Unlike IP-based location, this comes from your device's clock and system settings, not your network.",
          action:
            "VPNs don't hide your timezone — changing it means altering your OS clock or using a browser that spoofs the Intl API.",
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
            "Screen resolution and pixel ratio narrow down your physical display — a MacBook Pro's 2× pixel ratio looks different from a Windows laptop or Android phone. 'Available' resolution excludes taskbars and docks, which hints at your OS.",
          doesntMean:
            "Resolution alone doesn't identify you, but it's one of the most stable fingerprint signals — screen size rarely changes.",
          action:
            "Tor Browser reports a uniform, generic resolution to all sites instead of your real one.",
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
            "CPU core count and device memory are coarse, rounded values — but still distinguish a high-end desktop from a mid-range phone. Connection type reveals Wi-Fi vs. 4G vs. a slow connection, useful for ad targeting by purchase intent.",
          doesntMean:
            "These are intentionally imprecise — browsers report memory in power-of-two buckets (0.25, 0.5, 1, 2, 4, 8 GB) rather than the exact figure, to limit fingerprinting.",
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
            "Do Not Track was meant to tell websites you didn't want to be tracked. It was never legally binding, most sites ignored it, and most browsers have since deprecated it — 'Not set' or 'Disabled' here is normal.",
          doesntMean:
            "Having DNT enabled doesn't actually prevent tracking. It's a request, not a control.",
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
            "Your GPU vendor and model are exposed via the WebGL API — no permission required. The canvas fingerprint is subtler: a hidden drawing is rendered using your GPU and fonts, then hashed. Because GPUs, drivers, and OSes render pixels slightly differently, this hash is often unique to your machine.",
          doesntMean:
            "A canvas fingerprint alone isn't enough to track you site-to-site — but combined with the rest of this page, it forms a stable ID that survives clearing cookies.",
          action:
            "Brave randomises canvas output per site to defeat this. Firefox's privacy.resistFingerprinting blocks it too, and can also hide the WebGL vendor/renderer strings.",
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

function GeoSection({ moduleId }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [highAccuracy, setHighAccuracy] = useState(false);

  async function handleRequest() {
    setState("loading");
    const geo = await collectGeo(highAccuracy);
    setResult(geo);
    setState(geo.error ? "error" : "done");

    // Log outcome only — never the coordinates, which are identifying. Whether
    // the user granted access is coarse metadata; the position stays on screen.
    saveActivity({
      moduleType: moduleId,
      summary: "Geolocation requested",
      details: {
        granted: !geo.error,
        highAccuracy,
        errorType: geo.error ?? null,
      },
    });
  }

  const errorMessages = {
    DENIED:
      "You denied the permission — a reasonable default. Sites can still ask, and if you've granted it elsewhere before, that site already has your location.",
    UNAVAILABLE:
      "Your device couldn't determine a location. This can happen on desktops without GPS that are on VPNs or networks with ambiguous IP geolocation.",
    TIMEOUT:
      "Location request timed out. Try again with a stable network connection.",
    NOT_SUPPORTED:
      "Geolocation is not supported in this browser.",
  };

  return (
    <div className="space-y-4">
      <GuidedCard
        icon={MapPin}
        heading="Geolocation"
        description={
          "Websites can request your location via the Geolocation API. " +
          "Clicking below triggers your browser\u2019s real permission prompt. " +
          "If you grant it, your coordinates will be shown below. " +
          "Nothing is sent anywhere."
        }
      >
        {state === "idle" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHighAccuracy(false)}
                aria-pressed={!highAccuracy}
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
                aria-pressed={highAccuracy}
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
      </GuidedCard>

      {state === "done" && result && !result.error && (
        <ResultCard
          verdict="neutral"
          heading="Location granted"
          explanation={{
            means:
              highAccuracy
                ? "Any site you grant this to receives these exact coordinates. GPS-level accuracy on a phone can place you within a few metres — enough to identify your street or building."
                : "Any site you grant this to receives these coordinates. Standard accuracy uses Wi-Fi or network location, typically within 20–300 metres — enough to place you in a neighbourhood.",
            doesntMean:
              "This grant doesn't persist — it's a one-time request. But permissions you've granted to other sites in the past may still be active.",
            action:
              "Review which sites have location access under Privacy → Site Permissions → Location in your browser settings.",
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
                href={osmLink(result.latitude, result.longitude, 14)}
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

function MediaSection({ moduleId }) {
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);

  async function handleRequest() {
    setState("loading");
    const media = await collectMedia();
    setResult(media);
    setState(media.error ? "error" : "done");

    // Log outcome only — granted/denied and a coarse device count. Device
    // labels (manufacturer/model strings) are identifying and stay on screen.
    saveActivity({
      moduleType: moduleId,
      summary: "Media device access requested",
      details: {
        granted: !media.error,
        errorType: media.error ?? null,
        deviceCount: media.devices.length,
      },
    });
  }

  const errorMessages = {
    DENIED:
      "You denied the permission. This demonstrates that device labels — manufacturer and model strings — stay hidden until camera/mic access is granted; once granted, a site can read them.",
    NOT_FOUND:
      "No camera or microphone was found on this device.",
    NOT_SUPPORTED:
      "Media device access is not supported in this browser.",
    ERROR:
      "An unexpected error occurred while requesting media access.",
  };

  return (
    <div className="space-y-4">
      <GuidedCard
        icon={Camera}
        heading="Camera & Microphone Devices"
        description={
          "Browsers hide device labels (camera and microphone names) until " +
          "you grant camera/microphone permission. Once granted, the " +
          "full device list — with manufacturer and model names — is " +
          "exposed. Clicking below will trigger the real permission " +
          "prompt. The camera and microphone are stopped immediately " +
          "after the permission is read; no video or audio is captured " +
          "or stored."
        }
      >
        {state === "idle" && (
          <Button onClick={handleRequest}>
            Request camera & mic access
          </Button>
        )}
        {state === "loading" && (
          <p className="text-sm text-slate">Waiting for permission…</p>
        )}
      </GuidedCard>

      {state === "done" && result && (
        <ResultCard
          verdict="neutral"
          heading="Device list exposed"
          explanation={{
            means:
              "With permission granted, sites can enumerate every camera, microphone, and speaker on your device — including manufacturer and model. This is another fingerprinting vector: 'Logitech C920' + 'MacBook Pro Microphone' + 'AirPods Pro' is fairly unique.",
            doesntMean:
              "This doesn't mean a site can silently record you — the stream was stopped immediately. But any site with camera/mic permission can read these labels.",
            action:
              "Review which sites have camera and microphone access under Privacy → Site Permissions in your browser settings.",
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

function GatedTab({ moduleId }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-accent-indigo-light border border-accent-indigo/20 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={15} className="text-accent-indigo shrink-0 mt-0.5" />
          <p className="text-xs text-slate leading-relaxed">
            Each item below needs an explicit browser permission before it
            reveals anything — the same real prompt any website would
            trigger. Click or dismiss it; either way is informative. Nothing
            is sent anywhere.
          </p>
        </div>
      </div>

      <GeoSection moduleId={moduleId} />
      <MediaSection moduleId={moduleId} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("passive");

  return (
    <ModulePage>

        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} ariaLabel="Fingerprint data category" />

        <TabPanel id="passive" activeTab={activeTab}>
          <PassiveTab moduleId={moduleId} />
        </TabPanel>
        <TabPanel id="gated" activeTab={activeTab}>
          <GatedTab moduleId={moduleId} />
        </TabPanel>

        <CompanionLinks links={companionLinksFor("/modules/fingerprint")} />
    </ModulePage>
  );
}
