const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// SHA-1 of the raw password text, computed entirely client-side via the
// Web Crypto API. Never sent anywhere in full — only its first 5 hex
// characters are (see checkPasswordBreach below).
export async function sha1Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return bufferToHex(digest);
}

// k-anonymity check against HIBP's Pwned Passwords API: only the first 5
// hex characters of the password's SHA-1 hash leave the device. HIBP
// returns every suffix that shares that 5-character prefix (typically
// several hundred to a couple thousand), each with a breach count — we
// compare the remaining 35 characters locally and never learn (and HIBP
// never learns) anything more specific than "some password starting with
// this 5-character hash prefix was checked."
export async function checkPasswordBreach(password) {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let response;
  try {
    response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
  } catch {
    throw new Error(
      "Couldn't reach the breach-check service. Check your connection and try again."
    );
  }

  if (!response.ok) {
    throw new Error(
      `The breach-check service returned an unexpected error (${response.status}). Try again in a moment.`
    );
  }

  const body = await response.text();
  const match = body
    .split("\n")
    .map((line) => line.trim().split(":"))
    .find(([lineSuffix]) => lineSuffix === suffix);

  return {
    breached: Boolean(match),
    count: match ? Number(match[1]) : 0,
  };
}
