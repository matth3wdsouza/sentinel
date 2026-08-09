// Character class definitions. Each class is a disjoint slice of the
// alphabet the generator draws from; keeping them disjoint is what makes
// the inclusion-exclusion entropy calculation for the "guarantee one of
// each class" option exact rather than approximate.
export const CHARSET_CLASSES = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?",
};

// Characters that are easy to misread in most fonts (zero/O, one/l/I).
const AMBIGUOUS_CHARS = "0OoIl1";

export const DEFAULT_OPTIONS = {
  length: 16,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  customExclusions: "",
  guaranteeOneOfEach: false,
};

/**
 * Builds the per-class character sets and combined charset for the given
 * options, after applying ambiguous-character and custom exclusions.
 * Classes with an empty result (fully excluded) are dropped.
 *
 * Returns: { classes: [{ name, chars }], fullCharset: string }
 */
export function buildCharset(options) {
  const exclude = new Set(
    (options.excludeAmbiguous ? AMBIGUOUS_CHARS : "") +
      (options.customExclusions || "")
  );

  const classes = [];
  for (const name of Object.keys(CHARSET_CLASSES)) {
    if (!options[name]) continue;
    const chars = Array.from(CHARSET_CLASSES[name])
      .filter((c) => !exclude.has(c))
      .join("");
    if (chars.length > 0) {
      classes.push({ name, chars });
    }
  }

  const fullCharset = classes.map((c) => c.chars).join("");
  return { classes, fullCharset };
}

/**
 * Returns a uniformly distributed random integer in [0, max) using the
 * Web Crypto CSPRNG, via rejection sampling to eliminate modulo bias.
 * (Math.random() / a raw `% max` would both be inappropriate here: the
 * former isn't cryptographically secure, the latter slightly favors
 * smaller remainders whenever max doesn't evenly divide 2^32.)
 */
export function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("secureRandomInt: max must be a positive integer");
  }
  if (max > 0x100000000) {
    throw new Error("secureRandomInt: max exceeds supported range");
  }

  const range = 0x100000000; // 2^32, the size of a Uint32 draw
  const largestMultiple = Math.floor(range / max) * max;

  const buffer = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= largestMultiple);

  return value % max;
}

/** Fisher-Yates shuffle using secureRandomInt, so guarantee-one-of-each
 * passwords don't have a predictable "one per class, then filler"
 * structure. Mutates and returns the given array. */
export function secureShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomCharFrom(chars) {
  return chars[secureRandomInt(chars.length)];
}

/**
 * Exact entropy in bits for a password drawn uniformly at random from a
 * charset of the given size, with no further constraints.
 */
export function calculateEntropy(charsetSize, length) {
  return length * Math.log2(charsetSize);
}

/**
 * Exact entropy in bits when the password is constrained to contain at
 * least one character from each of several disjoint classes. Computed via
 * inclusion-exclusion over the class sizes rather than estimated:
 *
 *   #{valid strings} = sum over subsets S of classes,
 *                       (-1)^|S| * (totalSize - sum of sizes in S)^length
 *
 * classSizes: array of sizes of each required class (must be disjoint,
 * i.e. sum(classSizes) <= totalSize).
 */
export function calculateGuaranteedEntropy(classSizes, totalSize, length) {
  const k = classSizes.length;
  let count = 0;

  for (let mask = 0; mask < 1 << k; mask++) {
    let excluded = 0;
    let bitsSet = 0;
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) {
        excluded += classSizes[i];
        bitsSet++;
      }
    }
    const base = totalSize - excluded;
    const sign = bitsSet % 2 === 0 ? 1 : -1;

    if (base > 0) {
      count += sign * Math.pow(base, length);
    } else if (base === 0 && length === 0) {
      count += sign;
    }
    // base < 0 (or base === 0 with length > 0) contributes 0 valid strings.
  }

  return Math.log2(count);
}

/**
 * Generates a password per the given options and returns it alongside the
 * exact entropy of the process that produced it (branching on whether
 * guaranteeOneOfEach was used, since that constrains the sample space).
 *
 * Throws if no character classes are enabled, or if guaranteeOneOfEach is
 * set but length is shorter than the number of enabled classes.
 */
export function generatePassword(rawOptions) {
  const options = { ...DEFAULT_OPTIONS, ...rawOptions };
  const { classes, fullCharset } = buildCharset(options);

  if (classes.length === 0) {
    throw new Error(
      "No characters available to generate from — check your character class and exclusion settings."
    );
  }

  if (options.guaranteeOneOfEach && options.length < classes.length) {
    throw new Error(
      `Length must be at least ${classes.length} to guarantee one character from each of the ${classes.length} selected classes.`
    );
  }

  let passwordChars;
  let entropyBits;

  if (options.guaranteeOneOfEach) {
    passwordChars = classes.map((c) => randomCharFrom(c.chars));
    for (let i = passwordChars.length; i < options.length; i++) {
      passwordChars.push(randomCharFrom(fullCharset));
    }
    secureShuffle(passwordChars);

    entropyBits = calculateGuaranteedEntropy(
      classes.map((c) => c.chars.length),
      fullCharset.length,
      options.length
    );
  } else {
    passwordChars = [];
    for (let i = 0; i < options.length; i++) {
      passwordChars.push(randomCharFrom(fullCharset));
    }

    entropyBits = calculateEntropy(fullCharset.length, options.length);
  }

  return {
    password: passwordChars.join(""),
    entropyBits,
    charsetSize: fullCharset.length,
    length: options.length,
    guaranteeOneOfEach: options.guaranteeOneOfEach,
    classesUsed: classes.map((c) => c.name),
  };
}
