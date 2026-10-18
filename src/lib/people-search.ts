import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { exaEnabled, searchLinkedInPeople as searchExa, type ExaPerson } from "./exa";

export type Person = ExaPerson;
export type SearchProvider = "parallel" | "exa" | "disabled";

// Keep existing deployments on Exa when they have deliberately configured a key.
// An explicit selection (including disabled) always wins; never fail over silently.
export function searchProvider(): SearchProvider {
  const selected = process.env.AMBIT_SEARCH_PROVIDER?.trim();
  if (!selected) return exaEnabled() ? "exa" : "parallel";
  if (selected === "parallel" || selected === "exa" || selected === "disabled") return selected;
  throw new Error("Invalid AMBIT_SEARCH_PROVIDER");
}

const SearchResults = z.object({
  results: z.array(z.object({
    url: z.string(),
    title: z.string().nullable().optional(),
    excerpts: z.array(z.string()),
  })),
});

// Search operators guide retrieval, but only validated public profile URLs may
// reach the admin's clickable results. Reject companies, posts and lookalikes.
function profileUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== "linkedin.com" && !url.hostname.endsWith(".linkedin.com")) return null;
    if (!/^\/in\/[^/]+\/?$/.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

async function searchParallel(query: string, limit: number, signal?: AbortSignal): Promise<Person[]> {
  // One budget covers connection, discovery and search, as well as caller aborts.
  const deadline = AbortSignal.timeout(15_000);
  const operation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  operation.throwIfAborted();
  const client = new Client({ name: "ambit", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://search.parallel.ai/mcp"), {
    requestInit: {
      headers: { "User-Agent": "Ambit/0.1.0 (+https://github.com/deveshagarwal/ambit)" },
    },
    fetch: (url, init) => fetch(url, {
      ...init,
      signal: init?.signal ? AbortSignal.any([operation, init.signal]) : operation,
    }),
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools({}, { signal: operation });
    if (!tools.tools.some((tool) => tool.name === "web_search")) {
      throw new Error("Parallel web_search tool unavailable");
    }
    const result = CallToolResultSchema.parse(await client.callTool({
      name: "web_search",
      arguments: {
        objective: `Find public LinkedIn profiles of individual people who can help with: ${query}`,
        search_queries: [`site:linkedin.com/in/ ${query}`],
      },
    }, undefined, { signal: operation }));
    if (result.isError) throw new Error("Parallel search failed");
    // MCP structured output is preferred; older servers expose the same JSON as text.
    const text = result.content.find((block) => block.type === "text");
    const data = SearchResults.parse(result.structuredContent ?? JSON.parse(text?.text ?? "null"));
    const people: Person[] = [];
    const seen = new Set<string>();
    for (const entry of data.results) {
      const url = profileUrl(entry.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      people.push({
        title: entry.title?.trim().slice(0, 300) || "LinkedIn profile",
        url,
        snippet: entry.excerpts.join("\n").trim().slice(0, 500),
      });
      if (people.length >= limit) break;
    }
    return people;
  } finally {
    await client.close();
  }
}

export async function searchLinkedInPeople(
  query: string,
  provider: SearchProvider,
  signal?: AbortSignal,
): Promise<Person[]> {
  if (provider === "disabled") throw new Error("People sourcing disabled");
  if (provider === "exa") return searchExa(query, 8, signal);
  return searchParallel(query, 8, signal);
}
