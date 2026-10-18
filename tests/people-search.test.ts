import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST } from "../src/app/api/admin/source/route";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalTimeout = AbortSignal.timeout;
const endpoint = "https://search.parallel.ai/mcp";
const agent = "Ambit/0.1.0 (+https://github.com/deveshagarwal/ambit)";
const profile = { url: "https://www.linkedin.com/in/alex/", title: "Alex | LinkedIn", excerpts: ["Fintech founder and advisor"] };
type Message = { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
type Call = { url: string; headers: Headers; message?: Message; signal?: AbortSignal | null };

beforeEach(() => {
  for (const key of ["AI_API_KEY", "DEEPSEEK_API_KEY", "EXA_API_KEY", "AMBIT_SEARCH_PROVIDER"]) delete process.env[key];
  process.env.ADMIN_SECRET = "test-admin";
  console.error = () => {};
});

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  console.error = originalError;
  AbortSignal.timeout = originalTimeout;
});

function request(body: unknown = { askText: "fintech founder advice" }, secret = "test-admin", signal?: AbortSignal) {
  return new Request("http://localhost/api/admin/source", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-secret": secret },
    body: JSON.stringify(body), signal,
  });
}

function mcp(options: {
  results?: unknown[]; textOnly?: boolean; toolError?: boolean; malformed?: boolean;
  missingTool?: boolean; httpStatus?: number; hang?: string;
} = {}) {
  const calls: Call[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const message = init?.body ? JSON.parse(String(init.body)) as Message : undefined;
    calls.push({ url, headers, message, signal: init?.signal });
    assert.equal(url, endpoint);
    assert.equal(headers.get("user-agent"), agent);
    assert.equal(headers.get("authorization"), null);
    if (options.hang === message?.method) {
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    if (options.httpStatus) return new Response("provider failure", { status: options.httpStatus });
    // The SDK may probe the optional server-to-client SSE stream.
    if (!message) return new Response(null, { status: 405 });
    if (!message.id && message.id !== 0) return new Response(null, { status: 202 });
    let result: unknown;
    if (message.method === "initialize") {
      result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } };
    } else if (message.method === "tools/list") {
      result = { tools: options.missingTool ? [] : [{ name: "web_search", inputSchema: { type: "object", properties: {} } }] };
    } else if (message.method === "tools/call") {
      assert.equal(message.params?.name, "web_search");
      assert.match(String(message.params?.arguments?.objective), /fintech/);
      assert.match(String((message.params?.arguments?.search_queries as string[])[0]), /^site:linkedin.com\/in\//);
      const data = { results: options.results ?? [profile] };
      result = options.toolError ? { isError: true, content: [{ type: "text", text: "search unavailable" }] }
        : options.malformed ? { content: [{ type: "text", text: "invalid JSON" }] }
        : options.textOnly ? { content: [{ type: "text", text: JSON.stringify(data) }] }
        : { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
    } else throw new Error(`Unexpected method: ${message.method}`);
    return Response.json({ jsonrpc: "2.0", id: message.id, result });
  };
  return calls;
}

test("fresh no-key route initializes, discovers and searches MCP, then returns profile cards", async () => {
  const calls = mcp();
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { people: [{ title: profile.title, url: profile.url, snippet: profile.excerpts[0] }] });
  assert.deepEqual(calls.flatMap((call) => call.message ? [call.message.method] : []),
    ["initialize", "notifications/initialized", "tools/list", "tools/call"]);
  assert.ok(calls.every((call) => call.signal));
});

test("only HTTPS LinkedIn individual profiles survive, with deduplication and bounded content", async () => {
  mcp({ results: [
    profile, { ...profile, url: `${profile.url}?tracking=1#about` },
    ...["https://linkedin.com.evil.test/in/alex", "https://evil.test/in/alex", "javascript:alert(1)",
      "http://linkedin.com/in/alex", "https://linkedin.com/company/acme", "https://linkedin.com/posts/alex",
      "https://user@linkedin.com/in/alex", "https://linkedin.com:444/in/alex", "https://linkedin.com/in/"].map((url) => ({ ...profile, url })),
    { url: "https://uk.linkedin.com/in/sam", title: null, excerpts: ["x".repeat(800)] },
  ] });
  const data = await (await POST(request())).json();
  assert.equal(data.people.length, 2);
  assert.equal(data.people[1].title, "LinkedIn profile");
  assert.equal(data.people[1].snippet.length, 500);
});

test("bounds results to eight and accepts JSON text output", async () => {
  mcp({ textOnly: true, results: Array.from({ length: 12 }, (_, i) => ({ ...profile, url: `https://linkedin.com/in/person-${i}` })) });
  const data = await (await POST(request())).json();
  assert.equal(data.people.length, 8);
});

test("an empty search remains an empty result", async () => {
  mcp({ results: [] });
  assert.deepEqual(await (await POST(request())).json(), { people: [] });
});

test("configured Exa key preserves its provider, query, domain restriction and result shape", async () => {
  process.env.EXA_API_KEY = "existing-test-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.exa.ai/search");
    assert.equal(new Headers(init?.headers).get("x-api-key"), "existing-test-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.type, "auto");
    assert.deepEqual(body.includeDomains, ["linkedin.com"]);
    assert.equal(body.numResults, 8);
    return Response.json({ results: [{ title: profile.title, url: profile.url, text: "Advisor", author: "Alex" }] });
  };
  for (const explicit of [false, true]) {
    if (explicit) process.env.AMBIT_SEARCH_PROVIDER = "exa";
    assert.deepEqual(await (await POST(request())).json(), {
      people: [{ title: profile.title, url: profile.url, snippet: "Advisor", author: "Alex" }],
    });
  }
});

test("explicit Parallel selection overrides an existing Exa key", async () => {
  process.env.EXA_API_KEY = "existing-test-key";
  process.env.AMBIT_SEARCH_PROVIDER = "parallel";
  const calls = mcp();
  assert.equal((await POST(request())).status, 200);
  assert.ok(calls.length > 0);
});

test("disabled, invalid provider, missing Exa key and unauthorized requests make no network calls", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No request allowed"); };
  for (const selected of ["disabled", "typo", "exa"]) {
    process.env.AMBIT_SEARCH_PROVIDER = selected;
    assert.equal((await POST(request())).status, 503);
  }
  delete process.env.AMBIT_SEARCH_PROVIDER;
  assert.equal((await POST(request({}, "wrong"))).status, 401);
  delete process.env.ADMIN_SECRET;
  assert.equal((await POST(request())).status, 401);
  assert.equal(calls, 0);
});

test("invalid request bodies return 400 before search", async () => {
  globalThis.fetch = async () => { throw new Error("No request allowed"); };
  for (const body of [null, {}, { askText: 42 }, { askText: "  " }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
});

test("MCP errors and malformed results return 503 without falling back to configured Exa", async () => {
  process.env.EXA_API_KEY = "existing-test-key";
  process.env.AMBIT_SEARCH_PROVIDER = "parallel";
  for (const options of [{ toolError: true }, { malformed: true }, { missingTool: true }, { httpStatus: 503 }, { httpStatus: 401 }, { results: [{}] }]) {
    const calls = mcp(options);
    assert.equal((await POST(request())).status, 503);
    assert.ok(calls.every((call) => call.url === endpoint));
  }
});

test("configured Exa failures never invoke Parallel", async () => {
  process.env.EXA_API_KEY = "existing-test-key";
  let count = 0;
  globalThis.fetch = async (url) => {
    count++;
    assert.equal(String(url), "https://api.exa.ai/search");
    return new Response("failure", { status: 503 });
  };
  assert.equal((await POST(request())).status, 503);
  assert.equal(count, 1);
});

test("request cancellation reaches MCP search", async () => {
  const calls = mcp({ hang: "tools/call" });
  const controller = new AbortController();
  const pending = POST(request(undefined, "test-admin", controller.signal));
  const timer = setTimeout(() => controller.abort(), 40);
  try { assert.equal((await pending).status, 503); } finally { clearTimeout(timer); }
  assert.ok(calls.find((call) => call.message?.method === "tools/call")?.signal?.aborted);
});

test("already-cancelled requests do not connect, and Exa requests receive cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  const calls = mcp();
  assert.equal((await POST(request(undefined, "test-admin", controller.signal))).status, 503);
  assert.equal(calls.length, 0);

  process.env.EXA_API_KEY = "existing-test-key";
  globalThis.fetch = async (_url, init) => {
    assert.ok(init?.signal?.aborted);
    throw init?.signal?.reason;
  };
  assert.equal((await POST(request(undefined, "test-admin", controller.signal))).status, 503);
});

test("the shared 15-second budget covers initialization, discovery and search", async () => {
  for (const stage of ["initialize", "tools/list", "tools/call"]) {
    const controller = new AbortController();
    AbortSignal.timeout = (ms) => { assert.equal(ms, 15_000); return controller.signal; };
    const calls = mcp({ hang: stage });
    const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 30);
    try { assert.equal((await POST(request())).status, 503); } finally { clearTimeout(timer); }
    assert.ok(calls.find((call) => call.message?.method === stage)?.signal?.aborted);
  }
});

test("scripted AI reranker consumes MCP snippets and returns the selected profile with its reason", async () => {
  process.env.AI_API_KEY = "test-ai-key";
  process.env.AI_BASE_URL = "https://api.deepseek.com";
  process.env.AI_MODEL = "test-model";
  mcp();
  const searchFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith(endpoint)) return searchFetch(url, init);
    assert.equal(String(url), "https://api.deepseek.com/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.match(body.messages[1].content, /Fintech founder and advisor/);
    assert.match(body.messages[1].content, /index=0/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ ranked: [{ index: 0, score: 95, reason: "Relevant fintech experience" }] }) } }] });
  };
  const response = await POST(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.people[0].reason, "Relevant fintech experience");
  assert.equal(data.people[0].url, profile.url);
});
