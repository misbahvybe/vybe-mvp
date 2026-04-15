export type FuzzyOptions = {
  /** Max edit distance allowed for a match. */
  maxDistance?: number;
};

function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Damerau–Levenshtein distance with early exit.
function damerauLevenshtein(aRaw: string, bRaw: string, maxDistance: number): number {
  const a = normalize(aRaw);
  const b = normalize(bRaw);
  if (!a || !b) return Math.max(a.length, b.length);
  if (a === b) return 0;
  // Fast path for substring
  if (a.includes(b) || b.includes(a)) return 0;

  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDistance) return maxDistance + 1;

  const dp = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;

  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    let bestInRow = dp[0];
    for (let j = 1; j <= bl; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + cost, // substitution
      );
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, (i === 2 ? j - 2 : 0) + cost); // small approximation
      }
      dp[j] = val;
      prev = temp;
      if (val < bestInRow) bestInRow = val;
    }
    if (bestInRow > maxDistance) return maxDistance + 1; // early exit
  }
  return dp[bl];
}

/** Returns a score (lower is better) or null if no fuzzy match. */
export function fuzzyScore(haystack: string, needle: string, opts?: FuzzyOptions): number | null {
  const q = normalize(needle);
  const h = normalize(haystack);
  if (!q) return 0;
  if (!h) return null;
  if (h.includes(q)) return 0;
  // Adaptive distance: shorter queries tolerate fewer edits.
  const maxDistance =
    opts?.maxDistance ??
    (q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3);
  const d = damerauLevenshtein(h, q, maxDistance);
  return d <= maxDistance ? d : null;
}

export function fuzzyMatch(haystack: string, needle: string, opts?: FuzzyOptions): boolean {
  return fuzzyScore(haystack, needle, opts) != null;
}

