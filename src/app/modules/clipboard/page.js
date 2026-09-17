"use client";

import { useState } from "react";
import { Clipboard, ClipboardX, AlertTriangle } from "lucide-react";
import ModulePage from "@/components/ModulePage";
import GuidedCard from "@/components/GuidedCard";
import ResultCard from "@/components/ResultCard";
import TextOutput from "@/components/TextOutput";
import InlineError from "@/components/InlineError";
import { Button } from "@/components/Button";
import { readClipboard, writeClipboard, analyzeContent } from "@/lib/clipboard";
import { saveActivity } from "@/lib/api";
import { useModuleId } from "@/lib/useModuleId";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_WRITE_TEXT =
  "Sentinel wrote this. Any site with clipboard access could have done the same.";

const MAX_PREVIEW_LENGTH = 300;

// ─── analysisExplanation ──────────────────────────────────────────────────────
// Returns { heading, verdict, means, doesntMean, action } for each content type.

function analysisExplanation(analysis, text) {
  const { type, detail } = analysis;

  switch (type) {
    case "url":
      if (detail.trackingParams.length > 0) {
        return {
          heading: "URL with tracking parameters",
          verdict: "mismatch",
          means: `This URL contains ${detail.trackingParams.length} tracking parameter${detail.trackingParams.length > 1 ? "s" : ""} (${detail.trackingParams.join(", ")}) — telling the destination site where you came from, which campaign sent you, and sometimes who you are. A site reading your clipboard would get that too.`,
          doesntMean: "You haven't been tracked yet — these parameters only activate when you follow the link.",
          action: "Use a URL cleaner to strip tracking parameters before sharing links, or paste them into a private window.",
        };
      }
      return {
        heading: "URL",
        verdict: "neutral",
        means: `Your clipboard contains a link to ${detail.domain}. Any site that requested clipboard access while this was copied could have read it — including where you were browsing.`,
        doesntMean: detail.isHttps
          ? "HTTPS encrypts the connection to that site — it says nothing about that site's privacy practices."
          : null,
        action: "Be cautious which sites you grant clipboard access to, especially for sensitive URLs (internal tools, private shares, session links).",
      };

    case "card":
      return {
        heading: "Possible payment card number",
        verdict: "mismatch",
        means: `Your clipboard appears to contain a ${detail.digits}-digit number matching a payment card format. Any site with clipboard access while it's copied could silently read it.`,
        doesntMean: "Sentinel hasn't verified this is a real card number — it just matches the length pattern. Could be any long number.",
        action: "Avoid copying card numbers when possible. If you did, clear your clipboard now (copy something harmless).",
      };

    case "token":
      return {
        heading: "Possible API key or token",
        verdict: "mismatch",
        means: `Your clipboard contains a long string (${detail.length} chars) that looks like an API key, access token, or cryptographic value — a high-value target a site could use to impersonate you.`,
        doesntMean: "This might just be a base64-encoded file or other innocent data — Sentinel can't tell for certain.",
        action: "If this is a real credential, treat it as potentially exposed and rotate it. Clear your clipboard by copying something else.",
      };

    case "password":
      return {
        heading: "Possible password",
        verdict: "mismatch",
        means: `Your clipboard contains something that looks like a password — mixed case and symbols, no spaces. Any site with clipboard access while this was copied could have silently read it.`,
        doesntMean: "Sentinel hasn't confirmed this is a password — it just matches the pattern. Could be any short mixed-character string.",
        action: "Password managers that autofill directly avoid the clipboard entirely. If you copied this manually, clear it now.",
      };

    case "email":
      return {
        heading: "Email address",
        verdict: "neutral",
        means: "Your clipboard contains an email address. Sites with clipboard access could collect these silently to build mailing lists or cross-reference with other data.",
        doesntMean: null,
        action: "Email addresses are lower-risk than passwords or card numbers, but worth being aware of.",
      };

    case "phone":
      return {
        heading: "Possible phone number",
        verdict: "neutral",
        means: "Your clipboard contains something that looks like a phone number. Like an email address, this is personal contact information that a malicious site could silently collect.",
        doesntMean: null,
        action: null,
      };

    case "text":
      return {
        heading: "Text content",
        verdict: "neutral",
        means: detail.lines > 1
          ? `Your clipboard contains ${detail.lines} lines of text (${detail.length} characters). Any site with clipboard access could read all of it.`
          : `Your clipboard contains ${detail.length} characters of text. Any site with clipboard access could read it.`,
        doesntMean: null,
        action: null,
      };

    case "empty":
      return {
        heading: "Clipboard is empty",
        verdict: "success",
        means: "Nothing is currently on your clipboard — or it contained only whitespace.",
        doesntMean: null,
        action: null,
      };

    default:
      return {
        heading: "Content read",
        verdict: "neutral",
        means: "Your clipboard content was read successfully.",
        doesntMean: null,
        action: null,
      };
  }
}

// ─── ReadSection ──────────────────────────────────────────────────────────────

function ReadSection({ moduleId }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [clipValue, setClipValue] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [reading, setReading] = useState(false);

  async function handleRead() {
    if (reading) return;
    // The first read transitions through "loading" (nothing is shown yet);
    // a re-read happens in place so the result card never unmounts.
    const isFirstRead = state === "idle";
    if (isFirstRead) {
      setState("loading");
    } else {
      setReading(true);
    }

    const result = await readClipboard();

    if (result.error) {
      setErrorCode(result.error);
      setState("error");
      setReading(false);
      return;
    }

    const analyzed = analyzeContent(result.value);
    setClipValue(result.value);
    setAnalysis(analyzed);
    setState("done");
    setReading(false);

    saveActivity({
      moduleType: moduleId,
      summary: "Clipboard read",
      details: {
        hadContent: result.value.trim().length > 0,
        contentType: analyzed.type,
      },
    });
  }

  const errorMessages = {
    DENIED: {
      heading: "Permission denied",
      means: "You declined the clipboard permission — a reasonable choice. But note that any website can trigger this prompt, and clicking Allow on one you don't fully trust lets it read your clipboard silently from then on.",
      action: "You can manage clipboard permissions per-site in your browser settings under Privacy → Site Permissions → Clipboard.",
    },
    NOT_SUPPORTED: {
      heading: "Not supported",
      means: "Your browser doesn't support the Clipboard API, or this page isn't running on HTTPS. The API requires a secure context.",
      action: "Try a modern browser such as Chrome, Firefox, or Safari over HTTPS.",
    },
    ERROR: {
      heading: "Could not read clipboard",
      means: "An unexpected error occurred. Some browsers block clipboard access in certain contexts even with permission granted.",
      action: "Try again, or check your browser's clipboard permissions.",
    },
  };

  return (
    <div className="space-y-4">
      <GuidedCard
        icon={Clipboard}
        heading="Read your clipboard"
        description={
          "Clicking the button below triggers the real browser clipboard " +
          "permission prompt — exactly as any website would. If you grant " +
          "it, your current clipboard contents will be shown and analysed. " +
          "Nothing is stored or sent anywhere."
        }
      >
        {state === "idle" && (
          <Button onClick={handleRead}>
            Read clipboard
          </Button>
        )}
        {state === "loading" && (
          <p className="text-sm text-slate">Waiting for permission…</p>
        )}
        {(state === "done" || state === "error") && (
          <button
            onClick={handleRead}
            disabled={reading}
            className="text-sm text-slate hover:text-teal transition disabled:opacity-50 disabled:hover:text-slate disabled:cursor-wait"
          >
            {reading ? "Reading…" : "Read again"}
          </button>
        )}
      </GuidedCard>

      {state === "done" && analysis && (
        () => {
          const exp = analysisExplanation(analysis, clipValue);
          return (
            <ResultCard
              verdict={exp.verdict}
              heading={exp.heading}
              explanation={{
                means: exp.means,
                doesntMean: exp.doesntMean,
                action: exp.action,
              }}
            >
              {clipValue && clipValue.trim().length > 0 && (
                <TextOutput
                  label="Clipboard contents"
                  text={clipValue}
                  mono
                  maxChars={MAX_PREVIEW_LENGTH}
                  className="mt-1 mb-2"
                  containerClassName="text-xs leading-relaxed"
                />
              )}
            </ResultCard>
          );
        }
      )()}

      {state === "error" && errorCode && (
        <ResultCard
          verdict="mismatch"
          heading={errorMessages[errorCode]?.heading ?? "Error"}
          explanation={{
            means: errorMessages[errorCode]?.means,
            action: errorMessages[errorCode]?.action,
          }}
        />
      )}
    </div>
  );
}

// ─── WriteSection ─────────────────────────────────────────────────────────────

function WriteSection({ moduleId }) {
  const [state, setState] = useState("idle"); // idle | done | error
  const [verified, setVerified] = useState(false);

  async function handleWrite() {
    const result = await writeClipboard(DEMO_WRITE_TEXT);
    if (result.error) {
      setState("error");
    } else {
      setState("done");
      saveActivity({
        moduleType: moduleId,
        summary: "Clipboard write demonstrated",
        details: { action: "write" },
      });
    }
  }

  return (
    <div className="space-y-4">
      <GuidedCard
        icon={ClipboardX}
        heading="Sites can also overwrite your clipboard"
        description={
          "The clipboard write API needs no permission prompt in most " +
          "browsers — a site can silently replace what you've copied the " +
          "moment you interact with the page. A malicious site could swap " +
          "a safe address for a scammer\u2019s wallet address the instant you " +
          "click \u201cCopy\u201d."
        }
      >
        {state === "idle" && (
          <Button onClick={handleWrite}>
            Overwrite my clipboard
          </Button>
        )}

        {state === "error" && (
          <InlineError>
            Write failed — your browser may require a user gesture or HTTPS context.
          </InlineError>
        )}
      </GuidedCard>

      {state === "done" && (
        <ResultCard
          verdict="neutral"
          heading="Clipboard overwritten"
          explanation={{
            means:
              "Your clipboard was just silently replaced — no prompt, no warning. This page did it to demonstrate the attack; a malicious site would do it invisibly, swapping a copied cryptocurrency address for its own.",
            doesntMean:
              "Not every site that writes to your clipboard is malicious — legitimate 'copy' buttons do the same thing. The difference is intent and timing.",
            action:
              "Always verify what you've pasted before confirming a transaction — especially wallet addresses, bank details, or anything where a swap costs you money.",
          }}
        >
          <div className="mt-1 mb-2">
            <p className="text-xs uppercase tracking-wide text-slate mb-1.5">
              What&apos;s now on your clipboard
            </p>
            <div className="border border-slate/20 rounded-xl px-4 py-3 text-xs text-ink bg-surface font-mono leading-relaxed break-words">
              {DEMO_WRITE_TEXT}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs text-slate">
                Paste somewhere to confirm:
              </p>
              <button
                onClick={() => setVerified(true)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                  verified
                    ? "border-match text-match bg-match-light"
                    : "border-slate/30 text-slate hover:border-teal hover:text-teal"
                }`}
              >
                {verified ? "✓ Confirmed" : "I pasted it — it matched"}
              </button>
            </div>
          </div>
        </ResultCard>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClipboardPage() {
  const moduleId = useModuleId();
  return (
    <ModulePage>

        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate">
                Reading
              </span>
              <span className="flex-1 h-px bg-slate/15" />
            </div>
            <ReadSection moduleId={moduleId} />
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate">
                Writing
              </span>
              <span className="flex-1 h-px bg-slate/15" />
            </div>
            <WriteSection moduleId={moduleId} />
          </section>
        </div>
    </ModulePage>
  );
}
