"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, ShieldCheck, QrCode } from "lucide-react";
import FileInput from "@/components/FileInput";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import CompanionLinks from "@/components/CompanionLinks";
import URLPartsTable from "@/components/URLPartsTable";
import KeyValueRow from "@/components/KeyValueRow";
import { Button } from "@/components/Button";
import { decodeQR, analyzeQRContent } from "@/lib/qr";
import { saveActivity } from "@/lib/api";

// ─── analysisResult ───────────────────────────────────────────────────────────
// Maps content analysis to ResultCard props.

function analysisResult(analysis) {
  const { type, detail } = analysis;

  switch (type) {
    case "url": {
      const risks = [];
      if (detail.isShortener) risks.push("URL shortener — the real destination is hidden");
      if (!detail.isHttps) risks.push("Not HTTPS — connection to this site is unencrypted");
      if (detail.trackingParams.length > 0)
        risks.push(`${detail.trackingParams.length} tracking parameter${detail.trackingParams.length > 1 ? "s" : ""} (${detail.trackingParams.join(", ")})`);

      const verdict = risks.length >= 2 ? "mismatch" : risks.length === 1 ? "neutral" : "success";

      return {
        verdict,
        heading: risks.length > 0 ? "URL — review before opening" : "URL looks clean",
        explanation: {
          means:
            risks.length > 0
              ? `This QR code links to ${detail.domain}. ${risks.map((r, i) => (i === 0 ? r[0].toUpperCase() + r.slice(1) : r)).join(". ")}.`
              : `This QR code links to ${detail.domain} over HTTPS with no tracking parameters detected.`,
          doesntMean:
            detail.isShortener
              ? "A URL shortener isn't automatically malicious — but it hides the real destination, which is exactly what phishing QR codes rely on. Preview the destination before opening."
              : risks.length === 0
              ? "A clean URL doesn't guarantee the destination site is safe — it only means the link itself has no obvious red flags."
              : null,
          action:
            risks.length > 0
              ? "Check the full URL carefully before opening. If it uses a shortener, use a link expander to preview the real destination first."
              : "You can open this link — but always verify you recognise the destination site before entering any information.",
        },
      };
    }

    case "wifi":
      return {
        verdict: "neutral",
        heading: "Wi-Fi credentials",
        explanation: {
          means: `This QR code contains Wi-Fi login details for the network "${detail.ssid ?? "unknown"}" (${detail.securityType ?? "unknown"} security)${detail.password ? " including the password" : ""}.`,
          doesntMean:
            "This is common and legitimate — cafés and hotels often share Wi-Fi this way. The risk is an unknown-source QR code connecting you to a network you didn't intend to join.",
          action:
            "Only scan Wi-Fi QR codes from sources you trust — an unknown network could expose your traffic to its operator.",
        },
      };

    case "vcard":
      return {
        verdict: "neutral",
        heading: "Contact card (vCard)",
        explanation: {
          means: `This QR code contains contact information${detail.name ? ` for ${detail.name}` : ""}. Scanning it would add these details to your contacts.`,
          doesntMean: null,
          action: "Verify the contact details match who you expect before saving.",
        },
      };

    case "mailto":
      return {
        verdict: "neutral",
        heading: "Email link",
        explanation: {
          means: `This QR code opens a new email to ${detail.value}. It doesn't send anything automatically — it just pre-fills your email client.`,
          doesntMean: null,
          action: "Check the email address matches who you intended to contact.",
        },
      };

    case "sms":
      return {
        verdict: "neutral",
        heading: "SMS link",
        explanation: {
          means: "This QR code opens a pre-filled SMS message. It doesn't send anything automatically.",
          doesntMean: null,
          action: "Check the number and message content before sending.",
        },
      };

    case "otpauth":
      return {
        verdict: "neutral",
        heading: "Two-factor (TOTP) setup code",
        explanation: {
          means: `This QR code is a time-based one-time-password (TOTP) setup URI — the kind authenticator apps scan for 2FA.${detail.issuer ? ` Issued by ${detail.issuer},` : ""} for account "${detail.account ?? "unknown"}". Generates a new ${detail.digits}-digit code every ${detail.period}s.`,
          doesntMean:
            "Scanning this in an authenticator app would link it to your account — but this tool doesn't scan it. The shared secret is not displayed here, and nothing is stored or sent anywhere.",
          action:
            "Use an authenticator app to scan the same QR code, or paste the original code into the TOTP module to see the codes it produces.",
        },
      };

    case "text":
      return {
        verdict: "neutral",
        heading: "Plain text",
        explanation: {
          means: `This QR code contains ${detail.length} characters of plain text — not a URL or recognised format.`,
          doesntMean: null,
          action: null,
        },
      };

    default:
      return {
        verdict: "neutral",
        heading: "QR code decoded",
        explanation: { means: "The QR code was read successfully.", doesntMean: null, action: null },
      };
  }
}

// ─── URLPreview ───────────────────────────────────────────────────────────────
// Safe preview for URL-type QR codes — decomposes the link into the same
// copyable parts table the URL Inspector uses, highlights any tracking
// parameters, and shows an explicit open button rather than auto-navigating.

function URLPreview({ detail }) {
  return (
    <div className="mt-1 mb-2 space-y-2">
      <URLPartsTable parts={detail.parts} />

      <div className="divide-y divide-slate/10">
        {detail.trackingParams.length > 0 && (
          <KeyValueRow
            label="Tracking params"
            value={detail.trackingParams.join(", ")}
            mono
            tone="mismatch"
            className="py-2"
          />
        )}
        <KeyValueRow
          label="Full URL"
          value={detail.href}
          mono
          copyable
          copyLabel="full URL"
          className="py-2"
        />
        {detail.trackingParams.length > 0 && (
        <KeyValueRow
          label="Cleaned URL"
          value={detail.cleanUrl}
          mono
          copyable
          copyLabel="cleaned URL"
          tone="match"
          className="py-2"
        />
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={detail.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-teal text-on-teal px-3 py-1.5 rounded-lg text-xs hover:bg-teal/90 active:scale-[0.98] transition"
        >
          <ExternalLink size={12} />
          Open original URL
        </a>
        {detail.trackingParams.length > 0 && (
          <a
            href={detail.cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-match text-match px-3 py-1.5 rounded-lg text-xs hover:bg-match-light transition"
          >
            <ShieldCheck size={12} />
            Open without tracking
          </a>
        )}
      </div>
    </div>
  );
}

// ─── WiFiPreview ──────────────────────────────────────────────────────────────

function WiFiPreview({ detail }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mt-1 mb-2 divide-y divide-slate/10">
      <div className="py-2 flex items-start justify-between gap-4">
        <span className="text-xs text-slate shrink-0 w-28">Network (SSID)</span>
        <span className="text-xs text-ink font-mono text-right">{detail.ssid ?? "—"}</span>
      </div>
      <div className="py-2 flex items-start justify-between gap-4">
        <span className="text-xs text-slate shrink-0 w-28">Security</span>
        <span className="text-xs text-ink font-mono text-right">{detail.securityType ?? "—"}</span>
      </div>
      {detail.password && (
        <div className="py-2 flex items-start justify-between gap-4">
          <span className="text-xs text-slate shrink-0 w-28">Password</span>
          <div className="flex items-center gap-2 text-right">
            <span className="text-xs text-ink font-mono break-all">
              {showPassword ? detail.password : "•".repeat(Math.min(detail.password.length, 12))}
            </span>
            <button
              onClick={() => setShowPassword((v) => !v)}
              className="text-xs text-slate hover:text-teal transition shrink-0"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OtpAuthPreview ──────────────────────────────────────────────────────────
// Coarse preview for otpauth TOTP QR codes — shows account and configuration
// fields. The shared secret is never displayed here.

function OtpAuthPreview({ detail }) {
  return (
    <div className="mt-1 mb-2 divide-y divide-slate/10">
      {detail.issuer && (
        <div className="py-2 flex items-start justify-between gap-4">
          <span className="text-xs text-slate shrink-0 w-28">Issuer</span>
          <span className="text-xs text-ink font-mono text-right">{detail.issuer}</span>
        </div>
      )}
      <div className="py-2 flex items-start justify-between gap-4">
        <span className="text-xs text-slate shrink-0 w-28">Account</span>
        <span className="text-xs text-ink font-mono text-right">{detail.account ?? "—"}</span>
      </div>
      <div className="py-2 flex items-start justify-between gap-4">
        <span className="text-xs text-slate shrink-0 w-28">Digits</span>
        <span className="text-xs text-ink font-mono text-right">{detail.digits}</span>
      </div>
      <div className="py-2 flex items-start justify-between gap-4">
        <span className="text-xs text-slate shrink-0 w-28">Period</span>
        <span className="text-xs text-ink font-mono text-right">{detail.period}s</span>
      </div>
    </div>
  );
}

// ─── GenericPreview ───────────────────────────────────────────────────────────

function GenericPreview({ text }) {
  return (
    <div className="mt-1 mb-2">
      <p className="text-xs uppercase tracking-wide text-slate mb-1.5">Content</p>
      <div className="border border-slate/20 rounded-xl px-4 py-3 text-xs text-ink bg-surface font-mono break-words whitespace-pre-wrap leading-relaxed">
        {text}
      </div>
    </div>
  );
}

// ─── DecodeTab ────────────────────────────────────────────────────────────────

export default function DecodeTab({ moduleId }) {
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [decoded, setDecoded] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function handleFile(f) {
    setFile(f);
    setState("idle");
    setDecoded(null);
    setAnalysis(null);
    setErrorCode(null);
    if (preview) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setPreview(url);
  }

  async function handleDecode() {
    if (!file) return;
    setState("loading");

    const result = await decodeQR(file);

    if (result.error) {
      setErrorCode(result.error);
      setState("error");
      return;
    }

    const analyzed = analyzeQRContent(result.data);
    setDecoded(result.data);
    setAnalysis(analyzed);
    setState("done");

    saveActivity({
      moduleType: moduleId,
      summary: "QR code decoded",
      details: { contentType: analyzed.type },
    });
  }

  function handleReset() {
    setFile(null);
    setState("idle");
    setDecoded(null);
    setAnalysis(null);
    setErrorCode(null);
    if (preview) URL.revokeObjectURL(preview);
    previewRef.current = null;
    setPreview(null);
  }

  const errorMessages = {
    NOT_FOUND: {
      heading: "No QR code found",
      means: "No QR code was detected in this image. The image may be blurry, too small, or cropped too tightly around the code.",
      action: "Try a clearer image with some white border around the QR code, or a higher-resolution scan.",
    },
    IMAGE_ERROR: {
      heading: "Couldn't read image",
      means: "The file couldn't be loaded as an image. Make sure it's a valid PNG, JPG, GIF, or WebP file.",
      action: null,
    },
    LIBRARY_ERROR: {
      heading: "Decoder unavailable",
      means: "The QR decoding library failed to load. Check your network connection and try again.",
      action: null,
    },
  };

  const resultProps = analysis ? analysisResult(analysis) : null;

  return (
    <div className="space-y-5">
      <GuidedCard
        icon={QrCode}
        heading="Decode a QR code"
        description={
          "Upload an image containing a QR code to reveal the hidden URL, Wi-Fi " +
          "credentials, or text. Useful for checking a QR code before you " +
          "follow a link — especially from unknown sources."
        }
      />

      <FileInput
        onChange={handleFile}
        file={file}
        accept="image/*"
        label="Upload an image containing a QR code"
      />

      {preview && (
        <div className="rounded-xl overflow-hidden border border-slate/20 bg-surface shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not optimizable by next/image */}
          <img
            src={preview}
            alt="QR code preview"
            className="w-full max-h-64 object-contain p-4"
          />
        </div>
      )}

      {file && state !== "done" && (
        <div className="flex items-center gap-4">
          <Button
            onClick={handleDecode}
            disabled={state === "loading"}
            loading={state === "loading"}
            loadingLabel="Decoding…"
          >
            Decode QR code
          </Button>
          <Button variant="ghost" resetIcon onClick={handleReset}>
            Reset
          </Button>
        </div>
      )}

      {state === "done" && resultProps && (
        <>
          <ResultCard
            verdict={resultProps.verdict}
            heading={resultProps.heading}
            explanation={resultProps.explanation}
          >
            {analysis.type === "url" && analysis.detail && (
              <>
                <URLPreview detail={analysis.detail} />
                <CompanionLinks
                  links={[
                    {
                      href: "/modules/url-inspector",
                      label: "Inspect this URL for phishing",
                    },
                  ]}
                />
              </>
            )}
            {analysis.type === "wifi" && analysis.detail && (
              <WiFiPreview detail={analysis.detail} />
            )}
            {analysis.type === "otpauth" && analysis.detail && (
              <>
                <OtpAuthPreview detail={analysis.detail} />
                <CompanionLinks
                  links={[
                    {
                      href: "/modules/totp",
                      label: "Set up two-factor using this code",
                    },
                  ]}
                />
              </>
            )}
            {analysis.type !== "url" && analysis.type !== "wifi" && analysis.type !== "otpauth" && decoded && (
              <GenericPreview text={decoded} />
            )}
          </ResultCard>
          <Button variant="ghost" resetIcon onClick={handleReset}>
            Decode another
          </Button>
        </>
      )}

      {state === "error" && errorCode && (
        <>
          <ResultCard
            verdict="mismatch"
            heading={errorMessages[errorCode]?.heading ?? "Error"}
            explanation={{
              means: errorMessages[errorCode]?.means,
              action: errorMessages[errorCode]?.action,
            }}
          />
          <Button variant="ghost" resetIcon onClick={handleReset}>
            Try another image
          </Button>
        </>
      )}
    </div>
  );
}
