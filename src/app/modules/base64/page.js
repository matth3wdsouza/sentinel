"use client";

import { useState } from "react";
import { Binary } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import CodeBlock from "@/components/CodeBlock";
import TextOutput from "@/components/TextOutput";
import InlineError from "@/components/InlineError";
import OptionRow from "@/components/OptionRow";
import { Button } from "@/components/Button";
import Tabs from "@/components/Tabs";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";
import { toBase64, fromBase64 } from "@/lib/base64";

const TABS = [
  { id: "encode", label: "Encode" },
  { id: "decode", label: "Decode" },
];

// ─── Encode tab ───────────────────────────────────────────────────────────────

function EncodeTab({ moduleId }) {
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleInputChange(e) {
    setInput(e.target.value);
    setResult(null);
    setError(null);
  }

  function handleEncode() {
    if (!input) return;
    try {
      const encoded = toBase64(input, urlSafe);
      setResult(encoded);
      setError(null);
      saveActivity({
        moduleType: moduleId,
        summary: `Encoded a ${input.length}-character string to Base64${urlSafe ? "url" : ""}`,
        details: {
          action: "encode",
          variant: urlSafe ? "base64url" : "standard",
          inputLength: input.length,
          outputLength: encoded.length,
        },
      });
    } catch (err) {
      setError("Encoding failed. Check your input and try again.");
    }
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
  }

  const canEncode = input.length > 0;
  const showReset = input || result || error;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Text to encode
        </label>
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Paste or type any string…"
          rows={4}
          spellCheck={false}
          autoComplete="off"
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-y font-mono"
        />
      </div>

      <OptionRow
        checked={urlSafe}
        onChange={(e) => { setUrlSafe(e.target.checked); setResult(null); setError(null); }}
      >
        Use Base64url variant (
        <code className="font-mono text-xs">-_</code> instead of{" "}
        <code className="font-mono text-xs">+/</code>, no padding)
      </OptionRow>

      <div className="flex items-center gap-4">
        <Button onClick={handleEncode} disabled={!canEncode}>
          Encode
        </Button>
        {showReset && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {error && <InlineError>{error}</InlineError>}

      {result && (
        <ResultCard
          verdict="success"
          heading="Encoded"
          explanation={{
            means: urlSafe
              ? "Your text has been encoded as Base64url — the URL-safe variant that replaces + with - and / with _, and omits = padding. This is the format used in JWTs, URL query parameters, and browser crypto APIs."
              : "Your text has been encoded as standard Base64. The output is safe to transmit over any text-based channel — email, JSON, HTTP headers — but must be URL-encoded if used in a query string.",
            doesntMean:
              "Base64 is not encryption. Anyone who sees the output can decode it instantly — it offers no confidentiality. If you need to protect the content, encrypt it first.",
          }}
        >
          <div className="mt-1 mb-3">
            <p className="text-xs uppercase tracking-wide text-slate mb-1.5">
              Encoded output
            </p>
            <CodeBlock code={result} label="encoded output" variant="themed" />
          </div>
        </ResultCard>
      )}
    </div>
  );
}

// ─── Decode tab ───────────────────────────────────────────────────────────────

function DecodeTab({ moduleId }) {
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleInputChange(e) {
    setInput(e.target.value);
    setResult(null);
    setError(null);
  }

  function handleDecode() {
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      const decoded = fromBase64(trimmed, urlSafe);
      setResult(decoded);
      setError(null);
      saveActivity({
        moduleType: moduleId,
        summary: `Decoded a ${trimmed.length}-character Base64${urlSafe ? "url" : ""} string`,
        details: {
          action: "decode",
          variant: urlSafe ? "base64url" : "standard",
          inputLength: trimmed.length,
          outputLength: decoded.length,
        },
      });
    } catch (err) {
      setError("INVALID_BASE64");
    }
  }

  function reset() {
    setInput("");
    setResult(null);
    setError(null);
  }

  const canDecode = input.trim().length > 0;
  const showReset = input || result || error;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Base64 to decode
        </label>
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Paste a Base64 or Base64url string…"
          rows={4}
          spellCheck={false}
          autoComplete="off"
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-y font-mono"
        />
      </div>

      <OptionRow
        checked={urlSafe}
        onChange={(e) => { setUrlSafe(e.target.checked); setResult(null); setError(null); }}
      >
        Input is Base64url (
        <code className="font-mono text-xs">-_</code> instead of{" "}
        <code className="font-mono text-xs">+/</code>, no padding)
      </OptionRow>

      <div className="flex items-center gap-4">
        <Button onClick={handleDecode} disabled={!canDecode}>
          Decode
        </Button>
        {showReset && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {error === "INVALID_BASE64" && (
        <ResultCard
          verdict="mismatch"
          heading="Invalid Base64"
          explanation={{
            means:
              "The input couldn't be decoded. It may be truncated, contain characters outside the Base64 alphabet, or be in the wrong variant (standard vs Base64url).",
            action:
              "Check that you copied the full string. If it contains - or _ characters, enable the Base64url option above.",
          }}
        />
      )}

      {result !== null && (
        <ResultCard
          verdict="success"
          heading="Decoded"
          explanation={{
            means: "The Base64 string was valid and has been decoded to text.",
            doesntMean:
              "If the result looks like garbled characters, the original data may have been binary rather than text — Base64 can encode arbitrary bytes, not just readable strings.",
          }}
        >
          <TextOutput label="Decoded text" text={result} mono />
        </ResultCard>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Base64Page() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("encode");

  return (
    <ModulePage
      icon={Binary}
      title="Base64 Encoder / Decoder"
      description="Encode text to Base64 or decode Base64 back to text. Supports the Base64url variant used in JWTs and URLs."
    >
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <GuidedCard
        icon={Binary}
        accent="blue"
        heading="What is Base64?"
        description={
          "Base64 encodes arbitrary data as plain ASCII text — useful when a " +
          "channel can only handle text (emails, JSON, URLs, JWTs). Everything " +
          "runs in your browser; nothing is sent anywhere."
        }
      />

      <div id="panel-encode" role="tabpanel" className={activeTab === "encode" ? "" : "hidden"}>
        <EncodeTab moduleId={moduleId} />
      </div>
      <div id="panel-decode" role="tabpanel" className={activeTab === "decode" ? "" : "hidden"}>
        <DecodeTab moduleId={moduleId} />
      </div>
    </ModulePage>
  );
}
