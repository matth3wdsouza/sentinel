"use client";

import { useState, useEffect } from "react";
import { KeySquare } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import KeyValueRow from "@/components/KeyValueRow";
import TextArea from "@/components/TextArea";
import { Button } from "@/components/Button";
import CodeBlock from "@/components/CodeBlock";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { parseJWT, formatTimestamp, relativeTime } from "@/lib/jwt";

// Known dangerous algorithms worth flagging explicitly.
const DANGEROUS_ALGS = ["none", "None", "NONE"];
const WEAK_ALGS = ["HS1", "RS1"];

// ─── Sub-components ───────────────────────────────────────────────────────────

// A single labelled field row — used for both header and payload fields.
function Field({ label, value, mono = false, warning }) {
  return (
    <KeyValueRow
      label={label}
      value={value}
      mono={mono}
      tone={warning ? "warning" : undefined}
      className="py-1.5"
    />
  );
}

// Raw JSON display with copy button — uses CodeBlock dark variant so it
// stays on the design-system token system rather than hardcoded gray/cyan.
function JsonBlock({ label, value }) {
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-slate mb-1.5">{label}</p>
      <CodeBlock code={json} label={label} variant="dark" pre />
    </div>
  );
}

// ─── Result display ───────────────────────────────────────────────────────────

function JWTResult({ header, payload, signature }) {
  const alg = header.alg ?? "unknown";
  const isDangerous = DANGEROUS_ALGS.includes(alg);
  const isWeak = WEAK_ALGS.includes(alg);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      30000
    );
    return () => clearInterval(id);
  }, []);

  const exp = payload.exp;
  const iat = payload.iat;
  const nbf = payload.nbf;
  const isExpired = exp != null && now > exp;
  const isNotYetValid = nbf != null && now < nbf;

  // Derive a top-level verdict.
  const verdict = isDangerous || isExpired ? "mismatch" : "success";
  const heading = isDangerous
    ? "Decoded — dangerous algorithm"
    : isExpired
    ? "Decoded — token expired"
    : "Decoded";

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <ResultCard verdict={verdict} heading={heading} headingLevel="h2">
        <div className="divide-y divide-slate/10">
          <Field
            label="Algorithm (alg)"
            value={alg}
            mono
            warning={isDangerous || isWeak}
          />
          {isDangerous && (
            <p className="text-xs text-mismatch py-1.5">
              alg: none means the token has no signature — any payload can be
              forged. Servers that accept this are critically vulnerable.
            </p>
          )}
          {isWeak && (
            <p className="text-xs text-mismatch py-1.5">
              {alg} is considered weak. Prefer RS256, ES256, or HS256.
            </p>
          )}
          {header.typ && <Field label="Type (typ)" value={header.typ} mono />}
          {header.kid && <Field label="Key ID (kid)" value={header.kid} mono />}
          <JsonBlock label="Full header" value={header} />
        </div>
      </ResultCard>

      {/* Payload */}
      <ResultCard verdict="neutral" heading="Payload">
        <div className="divide-y divide-slate/10">
          {payload.sub && <Field label="Subject (sub)" value={payload.sub} mono />}
          {payload.iss && <Field label="Issuer (iss)" value={payload.iss} />}
          {payload.aud && (
            <Field
              label="Audience (aud)"
              value={Array.isArray(payload.aud) ? payload.aud.join(", ") : payload.aud}
            />
          )}
          {exp != null && (
            <Field
              label={`Expires (exp)${isExpired ? " — EXPIRED" : ""}`}
              value={`${formatTimestamp(exp)} (${relativeTime(exp)})`}
              warning={isExpired}
            />
          )}
          {iat != null && (
            <Field
              label="Issued at (iat)"
              value={`${formatTimestamp(iat)} (${relativeTime(iat)})`}
            />
          )}
          {nbf != null && (
            <Field
              label={`Not before (nbf)${isNotYetValid ? " — not yet valid" : ""}`}
              value={`${formatTimestamp(nbf)} (${relativeTime(nbf)})`}
              warning={isNotYetValid}
            />
          )}
          {payload.jti && <Field label="JWT ID (jti)" value={payload.jti} mono />}
          <JsonBlock label="Full payload" value={payload} />
        </div>
      </ResultCard>

      {/* Signature */}
      <ResultCard verdict="neutral" heading="Signature">
        <p className="text-sm text-slate mb-2">
          The signature cannot be verified here — that requires the secret key
          or public key held by the issuing server. Its presence only means the
          token was signed; it doesn&apos;t confirm the signature is valid without
          checking it.
        </p>
        <Field label="Signature (raw)" value={signature} mono />
      </ResultCard>
    </div>
  );
}

// ─── Error display ────────────────────────────────────────────────────────────

const ERROR_CONTENT = {
  MALFORMED: {
    heading: "Not a valid JWT",
    means:
      "A JWT must have exactly three Base64url segments separated by dots (header.payload.signature). This input doesn't match that structure.",
    action:
      "Make sure you copied the full token. If it came from an Authorization header, strip the leading 'Bearer ' before pasting.",
  },
  BAD_HEADER: {
    heading: "Unreadable header",
    means: "The first segment decoded but couldn't be parsed as JSON.",
    action: "Check that the token hasn't been truncated or modified.",
  },
  BAD_PAYLOAD: {
    heading: "Unreadable payload",
    means: "The second segment decoded but couldn't be parsed as JSON.",
    action: "Check that the token hasn't been truncated or modified.",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JWTInspectorPage() {
  const moduleId = useModuleId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleInputChange(e) {
    setInput(e.target.value);
    setResult(null);
    setError(null);
  }

  function handleInspect() {
    const token = input.trim();
    if (!token) return;

    try {
      const parsed = parseJWT(token);
      setResult(parsed);
      setError(null);
      saveActivity({
        moduleType: moduleId,
        summary: `Inspected a JWT (alg: ${parsed.header.alg ?? "unknown"})`,
        details: {
          alg: parsed.header.alg,
          typ: parsed.header.typ,
          hasExp: parsed.payload.exp != null,
          hasSub: parsed.payload.sub != null,
          hasIss: parsed.payload.iss != null,
        },
      });
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
  }

  const canInspect = input.trim().length > 0;
  const showReset = input || result || error;
  const errorContent = ERROR_CONTENT[error] ?? ERROR_CONTENT.MALFORMED;

  return (
    <ModulePage
      icon={KeySquare}
      title="JWT Inspector"
      description="Paste a JSON Web Token to decode its header and payload, read timestamps in plain English, and spot dangerous algorithm settings."
    >
      <GuidedCard
        icon={KeySquare}
        heading="What is a JWT?"
        description={
          "A JSON Web Token is a signed piece of data commonly used in web " +
          "authentication. Paste one below to decode its header, payload, and " +
          "timestamps — and spot dangerous algorithm settings. Nothing leaves " +
          "your browser."
        }
      />

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          JSON Web Token
        </label>
        <TextArea
          value={input}
          onChange={handleInputChange}
          placeholder="Paste a JWT here — eyJ…"
          rows={4}
          ariaLabel="JSON Web Token"
          mono
        />
      </div>

      <div className="flex items-center gap-4 mt-4">
        <Button onClick={handleInspect} disabled={!canInspect}>
          Inspect
        </Button>
        {showReset && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <ResultCard
            verdict="mismatch"
            heading={errorContent.heading}
            explanation={{
              means: errorContent.means,
              action: errorContent.action,
            }}
          />
        </div>
      )}

      {result && (
        <JWTResult
          header={result.header}
          payload={result.payload}
          signature={result.signature}
        />
      )}
    </ModulePage>
  );
}
