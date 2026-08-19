"use client";

import { useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import PasswordField from "@/components/PasswordField";
import ResultCard from "@/components/ResultCard";
import CodeBlock from "@/components/CodeBlock";
import TextOutput from "@/components/TextOutput";
import InlineError from "@/components/InlineError";
import { Button } from "@/components/Button";
import Tabs from "@/components/Tabs";
import { encryptText, decryptText } from "@/lib/encrypt";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";

const TABS = [
  { id: "encrypt", label: "Encrypt" },
  { id: "decrypt", label: "Decrypt" },
];

// ─── Encrypt tab ─────────────────────────────────────────────────────────────

function EncryptTab({ moduleId }) {
  const [plaintext, setPlaintext] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState(null);  // string on success
  const [error, setError] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  // Only show the mismatch warning once the user has typed in both fields —
  // showing it immediately on the first keystroke of the confirm field
  // would feel accusatory before they've had a chance to finish typing.
  const showMismatch = confirm.length > 0 && passphrase !== confirm;
  const canEncrypt =
    plaintext.trim().length > 0 &&
    passphrase.length > 0 &&
    passphrase === confirm &&
    !isWorking;

  function reset() {
    setPlaintext("");
    setPassphrase("");
    setConfirm("");
    setResult(null);
    setError(null);
  }

  async function handleEncrypt() {
    if (!canEncrypt) return;
    setIsWorking(true);
    setError(null);
    setResult(null);

    try {
      const encrypted = await encryptText(plaintext, passphrase);
      setResult(encrypted);
      saveActivity({
        moduleType: moduleId,
        summary: "Text encrypted",
        details: { action: "encrypt", success: true },
      });
    } catch (err) {
      console.error("Encryption error:", err);
      setError("Encryption failed. Your browser may not support Web Crypto.");
      saveActivity({
        moduleType: moduleId,
        summary: "Text encryption failed",
        details: { action: "encrypt", success: false },
      });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Plaintext input */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Text to encrypt
        </label>
        <textarea
          value={plaintext}
          onChange={(e) => { setPlaintext(e.target.value); setResult(null); setError(null); }}
          placeholder="Paste or type the text you want to encrypt…"
          rows={5}
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-y font-mono"
        />
      </div>

      {/* Passphrase fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Passphrase
          </label>
          <PasswordField
            value={passphrase}
            onChange={(e) => { setPassphrase(e.target.value); setResult(null); setError(null); }}
            placeholder="Choose a strong passphrase"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Confirm passphrase
          </label>
          <PasswordField
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setResult(null); setError(null); }}
            placeholder="Repeat your passphrase"
            onEnter={handleEncrypt}
            autoComplete="new-password"
          />
          {showMismatch && (
            <p className="text-xs text-mismatch mt-1.5">Passphrases don&apos;t match.</p>
          )}
        </div>
      </div>

      <Link
        href="/modules/passphrase-generator"
        className="inline-block text-sm text-teal"
      >
        Generate a strong passphrase →
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleEncrypt}
          disabled={!canEncrypt}
          loading={isWorking}
          loadingLabel="Encrypting…"
        >
          Encrypt
        </Button>
        {(plaintext || passphrase || confirm || result || error) && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <InlineError>{error}</InlineError>
      )}

      {/* Result */}
      {result && (
        <ResultCard
          verdict="success"
          heading="Text encrypted"
          explanation={{
            means:
              "Your text has been encrypted using AES-256-GCM — the current industry standard for authenticated encryption. The output below bundles everything needed to decrypt it: the encrypted data, a random salt, and a random IV.",
            doesntMean:
              "This does not protect you if someone obtains your passphrase. The security of the encrypted output depends entirely on keeping your passphrase secret.",
            action:
              "Copy the encrypted output and share it freely. To decrypt it, the recipient will need this app and your passphrase — share those through a separate, secure channel.",
          }}
        >
          <div className="mt-1 mb-3">
            <p className="text-xs uppercase tracking-wide text-slate mb-1.5">
              Encrypted output
            </p>
            <CodeBlock code={result} label="encrypted text" variant="themed" />
          </div>
        </ResultCard>
      )}
    </div>
  );
}

// ─── Decrypt tab ─────────────────────────────────────────────────────────────

function DecryptTab({ moduleId }) {
  const [ciphertext, setCiphertext] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [result, setResult] = useState(null);  // string on success
  const [error, setError] = useState(null);    // { type: "MALFORMED"|"DECRYPT_FAILED"|"UNKNOWN" }
  const [isWorking, setIsWorking] = useState(false);

  const canDecrypt =
    ciphertext.trim().length > 0 &&
    passphrase.length > 0 &&
    !isWorking;

  function reset() {
    setCiphertext("");
    setPassphrase("");
    setResult(null);
    setError(null);
  }

  async function handleDecrypt() {
    if (!canDecrypt) return;
    setIsWorking(true);
    setError(null);
    setResult(null);

    try {
      const plaintext = await decryptText(ciphertext.trim(), passphrase);
      setResult(plaintext);
      saveActivity({
        moduleType: moduleId,
        summary: "Text decrypted",
        details: { action: "decrypt", success: true },
      });
    } catch (err) {
      const type = err.message === "MALFORMED" ? "MALFORMED"
        : err.message === "DECRYPT_FAILED" ? "DECRYPT_FAILED"
        : "UNKNOWN";
      setError(type);
      saveActivity({
        moduleType: moduleId,
        summary: "Text decryption failed",
        details: { action: "decrypt", success: false },
      });
    } finally {
      setIsWorking(false);
    }
  }

  const errorContent = {
    MALFORMED: {
      heading: "Unrecognised format",
      means:
        `This doesn't look like a Sentinel-encrypted message. Make sure you copied the full output, starting with "sentinel:v1:".`,
      action:
        "Go back to whoever sent you this message and ask them to re-send the full encrypted output.",
    },
    DECRYPT_FAILED: {
      heading: "Decryption failed",
      means:
        "The passphrase didn't match, or the encrypted text was modified after it was created. AES-256-GCM detects any tampering automatically.",
      doesntMean:
        "This doesn't reveal anything about the original text — a wrong passphrase and a tampered message look identical by design.",
      action:
        "Double-check your passphrase and make sure the encrypted text hasn't been truncated or altered.",
    },
    UNKNOWN: {
      heading: "Unexpected error",
      means: "Something went wrong during decryption. Your browser may not support Web Crypto.",
      action: "Try again, or use a modern browser such as Chrome, Firefox, or Safari.",
    },
  };

  return (
    <div className="space-y-5">
      {/* Ciphertext input */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Encrypted text
        </label>
        <textarea
          value={ciphertext}
          onChange={(e) => { setCiphertext(e.target.value); setResult(null); setError(null); }}
          placeholder="Paste the sentinel:v1:… encrypted output here…"
          rows={4}
          className="w-full border border-slate/30 rounded-xl px-4 py-3 text-sm text-ink bg-surface focus:outline-none focus:border-teal transition resize-y font-mono"
        />
      </div>

      {/* Passphrase */}
      <div className="max-w-sm">
        <label className="block text-sm font-medium text-ink mb-1.5">
          Passphrase
        </label>
        <PasswordField
          value={passphrase}
          onChange={(e) => { setPassphrase(e.target.value); setResult(null); setError(null); }}
          placeholder="Enter the passphrase"
          onEnter={handleDecrypt}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleDecrypt}
          disabled={!canDecrypt}
          loading={isWorking}
          loadingLabel="Decrypting…"
        >
          Decrypt
        </Button>
        {(ciphertext || passphrase || result || error) && (
          <Button variant="ghost" resetIcon onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {/* Error result */}
      {error && (
        <ResultCard
          verdict="mismatch"
          heading={errorContent[error].heading}
          explanation={{
            means: errorContent[error].means,
            doesntMean: errorContent[error].doesntMean,
            action: errorContent[error].action,
          }}
        />
      )}

      {/* Success result */}
      {result !== null && (
        <ResultCard
          verdict="success"
          heading="Decryption succeeded"
          explanation={{
            means: "The passphrase matched and the encrypted text was authentic — it hasn't been modified since it was encrypted.",
            action: "Your original message is shown below. Copy it and close this tab when you're done.",
          }}
        >
          <TextOutput label="Decrypted text" text={result} />
        </ResultCard>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EncryptorPage() {
  const moduleId = useModuleId();
  const [activeTab, setActiveTab] = useState("encrypt");


  return (
    <ModulePage
      icon={LockKeyhole}
      title="Text Encryptor"
      description="Encrypt text with a passphrase using AES-256-GCM."
    >

        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div id="panel-encrypt" role="tabpanel" className={activeTab === "encrypt" ? "" : "hidden"}>
          <EncryptTab moduleId={moduleId} />
        </div>
        <div id="panel-decrypt" role="tabpanel" className={activeTab === "decrypt" ? "" : "hidden"}>
          <DecryptTab moduleId={moduleId} />
        </div>
    </ModulePage>
  );
}
