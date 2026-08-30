"use client";

import { useState, useEffect, useId } from "react";
import CompanionLinks from "@/components/CompanionLinks";
import {
  ScanEye,
  MapPin,
  Smartphone,
  Clock,
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";
import ModulePage from "@/components/ModulePage";
import FileInput from "@/components/FileInput";
import CodeBlock from "@/components/CodeBlock";
import CopyButton from "@/components/CopyButton";
import Disclosure from "@/components/Disclosure";
import InlineError from "@/components/InlineError";
import { Button } from "@/components/Button";
import { parseExif, privacySummary } from "@/lib/exif";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";

// ─── Severity config ──────────────────────────────────────────────────────────

// exifr reads the whole file into memory to scan metadata — cap it so a
// multi-gigabyte video doesn't stall or crash the tab.
const MAX_EXIF_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const SEVERITY = {
  high:   { label: "High privacy risk",   dot: "bg-mismatch",  text: "text-mismatch-chip",  chipBg: "bg-mismatch-light" },
  medium: { label: "Medium privacy risk", dot: "bg-fallback",  text: "text-fallback",  chipBg: "bg-fallback-light" },
  low:    { label: "Low privacy risk",    dot: "bg-teal",      text: "text-teal-chip",  chipBg: "bg-teal-light"     },
  info:   { label: "Technical info",      dot: "bg-slate",     text: "text-slate",     chipBg: "bg-slate-light"    },
};


// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ label, value, mono, copyable }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate/10 last:border-0">
        <span className="text-xs text-slate">{label}</span>
        <span className="text-xs text-slate italic">Not found</span>
      </div>
    );
  }

  const display = String(value);

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate/10 last:border-0">
      <span className="text-xs text-slate shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs text-ink text-right break-all ${mono ? "font-mono" : ""}`}>
          {display}
        </span>
        {copyable && <CopyButton value={display} label={label} />}
      </div>
    </div>
  );
}

// ─── MetadataGroup ────────────────────────────────────────────────────────────

function MetadataGroup({ icon: Icon, title, severity, found, explanation, children }) {
  const [open, setOpen] = useState(found);
  const sev = SEVERITY[severity];
  const contentId = useId();

  return (
    <div className="rounded-xl bg-surface shadow-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate/5 transition"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className={`inline-flex p-2 rounded-full ${sev.chipBg} ${sev.text}`}>
          <Icon size={16} />
        </span>
        <span className="font-display font-semibold text-sm text-ink flex-1">{title}</span>
        <span className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${sev.text}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${sev.dot}`} />
            {found ? sev.label : "Not found"}
          </span>
          {open
            ? <ChevronUp size={15} className="text-slate" />
            : <ChevronDown size={15} className="text-slate" />}
        </span>
      </button>

      {open && (
        <div id={contentId} className="px-5 pb-5">
          <div className={`flex gap-2.5 rounded-lg px-3 py-2.5 mb-4 ${found ? sev.chipBg : "bg-slate-light"}`}>
            <Info size={14} className={`shrink-0 mt-0.5 ${found ? sev.text : "text-slate"}`} />
            <p className={`text-xs leading-relaxed ${found ? sev.text : "text-slate"}`}>
              {explanation}
            </p>
          </div>
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── GPS actions ──────────────────────────────────────────────────────────────

function GPSActions({ lat, lng }) {
  const coordString = `${lat}, ${lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`;
  const [copied, copy] = useCopyToClipboard();

  function handleCopy() {
    copy(coordString);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-mismatch-light text-mismatch-chip hover:opacity-80 transition font-medium"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy coordinates"}
      </button>
      <a
        href={osmUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-light text-slate hover:text-teal hover:bg-teal-light transition font-medium"
      >
        <ExternalLink size={12} />
        View on OpenStreetMap
      </a>
    </div>
  );
}

// ─── Removal guide ────────────────────────────────────────────────────────────

// Each step is either a plain string or { text, code } where `code` is rendered
// as a terminal CodeBlock beneath the step text.
function RemovalGuide({ platform, steps }) {
  const [open, setOpen] = useState(false);

  return (
    <Disclosure
      label={platform}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      chevron="chevron-up"
      className="rounded-lg border border-slate/15 overflow-hidden"
      buttonClassName="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate/5 transition"
      labelClassName="text-sm font-medium text-ink"
      chevronClassName="text-slate"
    >
      <ol className="px-3.5 pb-3.5 space-y-2.5 border-t border-slate/10 pt-3">
        {steps.map((step, i) => {
          const text = typeof step === "string" ? step : step.text;
          const code = typeof step === "string" ? null : step.code;
          return (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 w-4 h-4 rounded-full bg-slate-light text-slate text-xs flex items-center justify-center mt-0.5 font-medium">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1.5">
                <span className="text-sm text-ink">{text}</span>
                {code && <CodeBlock code={code} label={`${platform} command`} />}
              </div>
            </li>
          );
        })}
      </ol>
    </Disclosure>
  );
}

// ─── Action block ─────────────────────────────────────────────────────────────

function ActionBlock({ result }) {
  const { hasCoordinates } = result.location;
  const hasDevice  = result.device.Make !== null || result.device.Model !== null || result.device.Software !== null;
  const hasSerial  = result.device.BodySerialNumber !== null || result.device.LensSerialNumber !== null;
  const hasTimestamps = result.timestamps.DateTimeOriginal !== null;

  const riskFields = [];
  if (hasCoordinates) riskFields.push("GPS location");
  if (hasSerial) riskFields.push("device serial number");
  else if (hasDevice) riskFields.push("device information");
  if (hasTimestamps) riskFields.push("timestamps");

  const hasSensitiveData = riskFields.length > 0;

  return (
    <div className="rounded-xl bg-surface shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate/10 flex items-center gap-3">
        <span className={`inline-flex p-2 rounded-full ${hasSensitiveData ? "bg-mismatch-light text-mismatch-chip" : "bg-teal-light text-teal-chip"}`}>
          {hasSensitiveData ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
        </span>
        <h3 className="font-display font-semibold text-sm text-ink">
          {hasSensitiveData ? "What to do before sharing this image" : "This image looks safe to share"}
        </h3>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-ink">
          {hasSensitiveData
            ? <><strong>{riskFields.join(", ")}</strong> {riskFields.length === 1 ? "was" : "were"} found in this image. Anyone you share it with — or any platform you upload it to — can read this data from the file.</>
            : "No location, serial number, or timestamp data was found. This image appears to be safe to share as-is."}
        </p>

        {hasSensitiveData && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate mb-1.5">
                Recommended action
              </p>
              <p className="text-sm text-ink">
                Strip the metadata before sharing. The safest method depends on your device:
              </p>
            </div>

            <div className="space-y-2">
              <RemovalGuide
                platform="iPhone / iPad"
                steps={[
                  'Open the photo in the Photos app.',
                  'Tap Share → scroll down to "Options".',
                  'Turn off "Location" (and optionally all metadata).',
                  'Share from that sheet — the sent copy has no EXIF.',
                ]}
              />
              <RemovalGuide
                platform="Android"
                steps={[
                  'Open the photo in Google Photos.',
                  'Tap the three-dot menu → "Edit location" → remove it.',
                  { text: 'For full metadata removal, use Scrambled Exif (available on F-Droid) before sharing.' },
                ]}
              />
              <RemovalGuide
                platform="Mac"
                steps={[
                  'Open the image in Preview.',
                  'Go to Tools → Location → Remove Location Info.',
                  { text: 'To strip all EXIF fields at once, use ExifTool in the Terminal:', code: 'exiftool -all= photo.jpg' },
                ]}
              />
              <RemovalGuide
                platform="Windows"
                steps={[
                  'Right-click the file → Properties → Details tab.',
                  'Click "Remove Properties and Personal Information" at the bottom.',
                  'Choose "Remove the following properties from this file" and select what you want removed.',
                ]}
              />
              <RemovalGuide
                platform="Linux"
                steps={[
                  'Install ExifTool via your package manager (e.g. exiftool or libimage-exiftool-perl).',
                  { text: 'Remove all metadata:', code: 'exiftool -all= photo.jpg' },
                  { text: 'Or remove only GPS data:', code: 'exiftool -gps:all= photo.jpg' },
                ]}
              />
            </div>

            <p className="text-xs text-slate leading-relaxed border-t border-slate/10 pt-3">
              <strong className="text-ink">Note:</strong> Most social platforms (Instagram, Twitter/X, WhatsApp) strip EXIF automatically on upload. Direct transfers — email, AirDrop, USB, cloud storage links — preserve all metadata exactly as-is.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Image preview ────────────────────────────────────────────────────────────

function ImagePreview({ file }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const timer = setTimeout(() => setUrl(objectUrl), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) return null;

  const sizeLabel =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="rounded-xl bg-surface shadow-card overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate/10">
        <Camera size={14} className="text-slate shrink-0" />
        <span className="text-sm font-medium text-ink truncate flex-1">{file.name}</span>
        <span className="text-xs text-slate shrink-0">{sizeLabel}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={file.name}
        className="w-full max-h-72 object-contain bg-slate-light/30"
      />
    </div>
  );
}

// ─── No metadata state ────────────────────────────────────────────────────────

function NoMetadataCard() {
  return (
    <div className="rounded-xl bg-surface shadow-card px-5 py-5 flex gap-3">
      <span className="inline-flex p-2 rounded-full bg-teal-light text-teal-chip shrink-0 h-fit">
        <ShieldCheck size={16} />
      </span>
      <div>
        <p className="font-display font-semibold text-sm text-ink mb-1">No metadata found</p>
        <p className="text-xs text-slate leading-relaxed">
          This image contains no readable EXIF metadata. Location services were likely off
          when it was taken, or the metadata was already stripped — by a messaging app,
          social platform, or a previous privacy tool.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExifPage() {
  const moduleId = useModuleId();
  const [file, setFile] = useState(null);
  // `result` has three states:
  //   undefined  — not yet inspected
  //   null       — inspected, no metadata found
  //   object     — inspected, metadata found
  const [result, setResult] = useState(undefined);
  const [error, setError] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);

  function handleFileChange(f) {
    setFile(f);
    setResult(undefined);
    setError(null);
  }

  function handleReset() {
    setFile(null);
    setResult(undefined);
    setError(null);
  }

  async function handleInspect() {
    if (!file) return;
    if (file.size > MAX_EXIF_FILE_SIZE) {
      setResult(null);
      setError("This file is too large to inspect. Keep it under 50 MB.");
      return;
    }
    setError(null);
    setResult(null);
    setIsInspecting(true);

    try {
      const parsed = await parseExif(file);
      setResult(parsed);

      const summary = parsed ? privacySummary(parsed) : {};
      saveActivity({
        moduleType: moduleId,
        summary: parsed
          ? `Inspected an image${summary.hasGPS ? " — GPS data found" : ""}`
          : "Inspected an image — no metadata found",
        details: {
          fileSize: file.size,
          mimeType: file.type,
          hasGPS:          summary.hasGPS          ?? false,
          hasDeviceSerial: summary.hasDeviceSerial  ?? false,
          hasTimestamps:   summary.hasTimestamps    ?? false,
        },
      });
    } catch (err) {
      console.error("EXIF parse error:", err);
      setError("This file couldn't be read. It may be corrupted, or in a format that isn't supported.");
    } finally {
      setIsInspecting(false);
    }
  }

  const hasResult = result !== undefined;

  return (
    <ModulePage
      icon={ScanEye}
      title="EXIF Metadata Inspection"
      description="Photos taken on a phone or camera embed hidden data — your location, device model, and more. Inspect what's inside before you share."
    >

        {/* File picker */}
        <div className="mb-4">
          <FileInput
            label="Image file"
            file={file}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp,image/tiff"
          />
          <p className="text-xs text-slate mt-1.5">
            Supports JPEG, PNG, WebP, and TIFF. Your file never leaves your device.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={handleInspect}
            disabled={!file || isInspecting}
            loading={isInspecting}
            loadingLabel="Inspecting…"
          >
            Inspect image
          </Button>

          {(file || hasResult || error) && (
            <Button variant="ghost" resetIcon onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex gap-2.5 rounded-xl bg-mismatch-light px-4 py-3.5 mb-6">
            <AlertTriangle size={15} className="text-mismatch-chip shrink-0 mt-0.5" />
            <InlineError>{error}</InlineError>
          </div>
        )}

        {/* Results */}
        {hasResult && (
          <>
            <ImagePreview file={file} />

            {result === null ? (
              <NoMetadataCard />
            ) : (
              <div className="space-y-3">

                {/* Location */}
                <MetadataGroup
                  icon={MapPin}
                  title="Location"
                  severity="high"
                  found={result.location.hasCoordinates}
                  explanation={
                    result.location.hasCoordinates
                      ? "This image contains GPS coordinates accurate to within a few metres. Anyone who receives this file can determine exactly where it was taken — your home, workplace, or wherever you were."
                      : "No GPS data was found. Location services were likely off when this photo was taken, or coordinates were stripped at some point before now."
                  }
                >
                  <FieldRow label="Latitude"  value={result.location.GPSLatitude}  mono copyable />
                  <FieldRow label="Longitude" value={result.location.GPSLongitude} mono copyable />
                  <FieldRow label="Altitude" value={
                    result.location.GPSAltitude !== null && result.location.GPSAltitude !== 0
                      ? `${result.location.GPSAltitude.toFixed(1)} m` : null
                  } mono />
                  <FieldRow label="Speed" value={
                    result.location.GPSSpeed !== null && result.location.GPSSpeed !== 0
                      ? `${result.location.GPSSpeed} km/h` : null
                  } />
                  <FieldRow label="Image direction" value={
                    result.location.GPSImgDirection !== null && result.location.GPSImgDirection !== 0
                      ? `${result.location.GPSImgDirection.toFixed(1)}°` : null
                  } />
                  <FieldRow label="GPS date" value={
                    result.location.GPSDateStamp && result.location.GPSDateStamp !== "0"
                      ? result.location.GPSDateStamp : null
                  } />
                  {result.location.hasCoordinates && (
                    <GPSActions lat={result.location.GPSLatitude} lng={result.location.GPSLongitude} />
                  )}
                </MetadataGroup>

                {/* Device identity */}
                <MetadataGroup
                  icon={Smartphone}
                  title="Device identity"
                  severity="medium"
                  found={result.device.Make !== null || result.device.Model !== null || result.device.BodySerialNumber !== null}
                  explanation={
                    result.device.BodySerialNumber !== null || result.device.LensSerialNumber !== null
                      ? "This image contains your device's unique serial number. Combined with other images, this could be used to link photos back to your specific camera or phone, even across different accounts."
                      : result.device.Make !== null
                      ? "Your camera or phone make and model are embedded in this image. This narrows down the device used, though without a serial number it can't uniquely identify yours."
                      : "No device information was found in this image."
                  }
                >
                  <FieldRow label="Make"   value={result.device.Make} />
                  <FieldRow label="Model"  value={result.device.Model} />
                  <FieldRow label="Software" value={result.device.Software} />
                  <FieldRow label="Body serial number" value={result.device.BodySerialNumber} mono copyable />
                  <FieldRow label="Lens make"          value={result.device.LensMake} />
                  <FieldRow label="Lens model"         value={result.device.LensModel} />
                  <FieldRow label="Lens serial number" value={result.device.LensSerialNumber} mono copyable />
                </MetadataGroup>

                {/* Timestamps */}
                <MetadataGroup
                  icon={Clock}
                  title="Timestamps"
                  severity="low"
                  found={result.timestamps.DateTimeOriginal !== null}
                  explanation={
                    result.timestamps.DateTimeOriginal !== null
                      ? result.location.hasCoordinates
                        ? "Timestamps record when this photo was taken and processed. Combined with the GPS coordinates above, they establish where you were and when — which can reveal daily routines or movements over time."
                        : "Timestamps record when this photo was taken and processed. If shared alongside location data, they can reveal daily routines or movements over time."
                      : "No timestamps were found in this image."
                  }
                >
                  <FieldRow label="Taken"         value={result.timestamps.DateTimeOriginal} />
                  <FieldRow label="Digitised"     value={result.timestamps.DateTimeDigitized} />
                  <FieldRow label="Last modified" value={result.timestamps.DateTime} />
                </MetadataGroup>

                {/* Technical */}
                <MetadataGroup
                  icon={Camera}
                  title="Technical details"
                  severity="info"
                  found={result.technical.ImageWidth !== null}
                  explanation="Camera settings and image dimensions. These don't directly identify you, but they add to the overall fingerprint of an image and confirm the type of device used."
                >
                  <FieldRow label="Dimensions" value={
                    result.technical.ImageWidth && result.technical.ImageHeight
                      ? `${result.technical.ImageWidth} × ${result.technical.ImageHeight} px` : null
                  } />
                  <FieldRow label="Orientation" value={result.technical.OrientationLabel} />
                  <FieldRow label="Exposure"     value={result.technical.ExposureTimeFormatted} mono />
                  <FieldRow label="Aperture"     value={result.technical.FNumberFormatted}      mono />
                  <FieldRow label="ISO"          value={result.technical.ISO}                   mono />
                  <FieldRow label="Focal length" value={result.technical.FocalLengthFormatted}  mono />
                </MetadataGroup>

                {/* Act */}
                <ActionBlock result={result} />

                <CompanionLinks
                  links={[
                    {
                      href: "/modules/fingerprint",
                      label: "See what your browser reveals too",
                    },
                  ]}
                />

              </div>
            )}
          </>
        )}
    </ModulePage>
  );
}
