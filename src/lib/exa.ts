// Exa.ai search — powers the admin "find people on LinkedIn" sourcing tool.
// Mirrors the shape of ai.ts: key from env, an enabled() gate so the surface is
// closed when unconfigured, a bounded timeout, and helpers that THROW so route
// callers can try/catch and fall back. Plain fetch (no SDK — openai is the only
// external client dependency in the repo).
const EXA_API_KEY = process.env.EXA_API_KEY ?? "";

export function exaEnabled(): boolean {
  return EXA_API_KEY.length > 0;
}

export interface ExaPerson {
  title: string; // usually "Name - Headline | LinkedIn"
  url: string;
  snippet: string;
  author?: string;
}

interface ExaResult {
  title?: string;
  url?: string;
  text?: string;
  author?: string;
}

// Search Exa for LinkedIn people matching a natural-language query. Restricted to
// linkedin.com so results are real profiles the admin can reach out to. Throws on
// a non-ok response or network/timeout error; the caller falls back.
export async function searchLinkedInPeople(query: string, limit = 8): Promise<ExaPerson[]> {
  if (!exaEnabled()) throw new Error("exa not configured");

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": EXA_API_KEY },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: limit,
      includeDomains: ["linkedin.com"],
      contents: { text: { maxCharacters: 500 } },
    }),
    // A bounded timeout matters for the same reason it does in ai.ts: keep it well
    // under the route's maxDuration so a hung provider fails fast into the fallback.
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`exa search failed: ${res.status}`);
  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? r.url ?? "LinkedIn profile",
    url: r.url ?? "",
    snippet: (r.text ?? "").trim(),
    author: r.author,
  }));
}
