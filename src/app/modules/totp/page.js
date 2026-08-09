"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Timer, RefreshCw, Download } from "lucide-react";
import * as OTPAuth from "otpauth";
import { generateQR } from "@/lib/qr";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import ModulePage from "@/components/ModulePage";
import { Button } from "@/components/Button";
import InlineError from "@/components/InlineError";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { parseTOTP, generateRandomSecret } from "@/lib/totp";

function formatCode(code) {
  return code.slice(0, 3) + " " + code.slice(3);
}

// ─── Code cell ────────────────────────────────────────────────────────────────

function CodeCell({ label, code, hero, isUrgent, onCopy }) {
  const [copied, copy] = useCopyToClipboard();
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-4 py-4 ${hero ? "" : "opacity-40"}`}>
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
      <p
        className={`font-mono font-bold tracking-widest whitespace-nowrap transition ${
          hero
            ? `text-2xl ${isUrgent ? "text-accent-amber" : "text-ink"}`
            : "text-lg text-slate tracking-widest whitespace-nowrap"
        }`}
      >
        {formatCode(code)}
      </p>
      <button
        onClick={() => {
          onCopy?.();
          copy(code);
        }}
        aria-label={`Copy ${label} code`}
        className={`text-xs transition ${hero ? "text-slate hover:text-teal" : "text-slate hover:text-slate/70"}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// ─── TOTP display ─────────────────────────────────────────────────────────────

function TOTPDisplay({ totp, onCopy }) {
  const [codes, setCodes] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [showQR, setShowQR] = useState(false);
  const canvasRef = useRef(null);

  const refresh = useCallback(() => {
    const now = Date.now();
    const period = totp.period ?? 30;
    const sLeft = period - Math.floor((now / 1000) % period);
    try {
      // otpauth generates the code for a given timestamp.
      const prev = totp.generate({ timestamp: now - period * 1000 });
      const current = totp.generate({ timestamp: now });
      const next = totp.generate({ timestamp: now + period * 1000 });
      setCodes({ prev, current, next });
      setSecondsLeft(sLeft);
    } catch {
      setCodes(null);
    }
  }, [totp]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [refresh]);

  // Render QR when toggle opens. generateQR paints asynchronously, so clear
  // the canvas at the start of each run — the last draw to complete wins,
  // which keeps a rapid toggle-on/off (or a secret change) from leaving a
  // stale QR visible.
  useEffect(() => {
    if (!showQR || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    const uri = OTPAuth.URI.stringify(totp);
    generateQR(canvas, uri, {
      darkColor: "#223142",
      lightColor: "#ffffff",
      errorCorrectionLevel: "M",
    });
  }, [showQR, totp]);

  function handleDownloadQR() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "totp-qr.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  if (!codes) return <InlineError className="mt-4">Failed to compute codes.</InlineError>;

  const isUrgent = secondsLeft <= 5;
  const period = totp.period ?? 30;
  const progressPct = (secondsLeft / period) * 100;
  const issuer = totp.issuer || null;
  const label = (totp.label && totp.label !== "OTPAuth") ? totp.label : null;

  return (
    <div className="mt-6 space-y-4">
      {/* Code card */}
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        {(issuer || label) && (
          <div className="px-5 pt-4">
            <p className="text-sm font-medium text-ink">{issuer ?? label}</p>
            {issuer && label && <p className="text-xs text-slate">{label}</p>}
          </div>
        )}

        <div className="grid grid-cols-3 divide-x divide-slate/10 pt-3">
          <CodeCell label="Previous" code={codes.prev} hero={false} onCopy={onCopy} />
          <CodeCell label="Current" code={codes.current} hero isUrgent={isUrgent} onCopy={onCopy} />
          <CodeCell label="Next" code={codes.next} hero={false} onCopy={onCopy} />
        </div>

        <div className="px-5 pb-5 pt-2">
          <div
            role="progressbar"
            aria-label={`Code expires in ${secondsLeft} seconds`}
            aria-valuenow={secondsLeft}
            aria-valuemin={0}
            aria-valuemax={period}
            className="w-full h-1.5 bg-slate/10 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-accent-amber" : "bg-teal"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className={`text-xs mt-1.5 text-center ${isUrgent ? "text-accent-amber" : "text-slate"}`}>
            Next code in {secondsLeft}s
          </p>
        </div>
      </div>

      {/* QR code */}
      <div>
        <button
          onClick={() => setShowQR((v) => !v)}
          aria-expanded={showQR}
          className="text-sm text-teal hover:underline"
        >
          {showQR ? "Hide" : "Show"} QR code for authenticator apps
        </button>
        {showQR && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate">
              Scan with any TOTP app (Google Authenticator, Authy, 1Password…) to add this secret.
            </p>
            <div className="flex justify-center bg-white rounded-xl p-4 shadow-card border border-slate/10 w-fit">
              <canvas ref={canvasRef} />
            </div>
            <button
              onClick={handleDownloadQR}
              className="inline-flex items-center gap-2 text-sm text-slate hover:text-teal transition"
            >
              <Download size={14} />
              Download QR code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TOTPPage() {
  const moduleId = useModuleId();
  const [input, setInput] = useState("");
  const [totp, setTotp] = useState(null);
  const [error, setError] = useState(null);
  // What produced the current secret: "otpauth" | "raw" | "random". Logged in
  // coarse form only — never the secret itself.
  const [source, setSource] = useState(null);

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);
    if (!val.trim()) {
      setTotp(null);
      setSource(null);
      setError(null);
      return;
    }
    try {
      setTotp(parseTOTP(val));
      setSource(val.trim().startsWith("otpauth://") ? "otpauth" : "raw");
      setError(null);
    } catch {
      setTotp(null);
      setSource(null);
      // Only show error once input looks complete (length > 8 chars).
      if (val.trim().length > 8) setError("Invalid Base32 secret or otpauth:// URI.");
      else setError(null);
    }
  }

  // The meaningful action is copying a generated code (matching the
  // Password/Passphrase Generator convention) — pasting or typing a secret is
  // not logged. issuer/label are intentionally omitted — they identify which
  // service the secret belongs to and shouldn't be stored in the activity log.
  function handleCopy() {
    if (!source) return;
    saveActivity({
      moduleType: moduleId,
      summary: "Copied a TOTP code",
      details: { source },
    });
  }

  function handleRandomSecret() {
    const secret = generateRandomSecret();
    setInput(secret);
    try {
      setTotp(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }));
      setSource("random");
      setError(null);
      saveActivity({
        moduleType: moduleId,
        summary: "Generated a random TOTP secret",
        details: { source: "random" },
      });
    } catch {
      setError("Failed to generate secret.");
    }
  }

  function reset() {
    setInput("");
    setTotp(null);
    setSource(null);
    setError(null);
  }

  const showReset = input || totp || error;

  return (
    <ModulePage
      icon={Timer}
      title="TOTP Generator"
      description="Enter a TOTP secret or an otpauth:// URI to see a live 6-digit code with a 30-second countdown."
    >
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Secret or otpauth:// URI
        </label>
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder={"Base32 secret — e.g. JBSWY3DPEHPK3PXP\nor otpauth://totp/Example?secret=…&issuer=Example"}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-none font-mono"
        />
        <p className="text-xs text-slate mt-1">
          The secret never leaves your browser and is not stored between sessions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={handleRandomSecret}
          className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-teal transition"
        >
          <RefreshCw size={14} />
          Random secret
        </button>
        {showReset && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      {totp && <TOTPDisplay totp={totp} onCopy={handleCopy} />}
    </ModulePage>
  );
}
