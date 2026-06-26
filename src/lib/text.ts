const STOP = new Set([
  "the","a","an","and","or","for","to","of","in","on","with","i","im","i'm",
  "need","want","looking","help","someone","who","can","me","my","is","are",
  "at","by","about","into","intro","introduction","connect","find","get","know",
  "would","like","please","anyone","good","great","really","just","new","build",
]);

export function normalizeTag(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+# ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pull candidate keyword tags out of free text (used for the no-AI fallback).
export function keywordTags(s: string): string[] {
  const words = normalizeTag(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

// Overlap score between a set of need tags and a candidate's attribute tags.
export function tagOverlap(needTags: string[], candidateTags: string[]): number {
  if (needTags.length === 0) return 0;
  const set = new Set(candidateTags);
  let hits = 0;
  for (const t of needTags) {
    if (set.has(t)) {
      hits += 1;
      continue;
    }
    // partial token containment, e.g. "fintech" vs "fintech recruiting"
    if (candidateTags.some((c) => c.includes(t) || t.includes(c))) hits += 0.5;
  }
  return hits;
}
