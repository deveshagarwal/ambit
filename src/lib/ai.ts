import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Provider-agnostic. Defaults to DeepSeek (OpenAI-compatible). Swap by env.
// Read env lazily so Next.js dev reloads pick up .env.local edits without a
// full restart, and infer OpenAI when the key is clearly an OpenAI project key.
function aiConfig() {
  const API_KEY = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
  const BASE_URL =
    process.env.AI_BASE_URL ??
    (API_KEY.startsWith("sk-proj-") ? "https://api.openai.com/v1" : "https://api.deepseek.com");
  const MODEL = process.env.AI_MODEL ?? (API_KEY.startsWith("sk-proj-") ? "gpt-4o-mini" : "deepseek-chat");
  const FAST_MODEL = process.env.AI_FAST_MODEL ?? MODEL;
  return { API_KEY, BASE_URL, MODEL, FAST_MODEL };
}

export function aiEnabled(): boolean {
  return aiConfig().API_KEY.length > 0;
}

let _client: { key: string; url: string; client: OpenAI } | null = null;
function client(): OpenAI {
  const { API_KEY, BASE_URL } = aiConfig();
  if (!_client || _client.key !== API_KEY || _client.url !== BASE_URL) {
    // A bounded timeout is essential: without it the SDK waits up to 10 minutes,
    // so on a hung provider the serverless function times out and the callers'
    // deterministic fallbacks never get to run. Keep this well under the route
    // budget (maxDuration) so a slow call fails fast into the fallback.
    _client = {
      key: API_KEY,
      url: BASE_URL,
      client: new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 15_000, maxRetries: 1 }),
    };
  }
  return _client.client;
}

export async function chat(
  messages: ChatCompletionMessageParam[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const { MODEL } = aiConfig();
  const res = await client().chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 500,
  });
  const content = res.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("empty completion");
  return content;
}

// Asks the model for JSON and parses it. Throws on bad output so callers can fall back.
// Pass `fast: true` to route through FAST_MODEL for latency-sensitive calls.
export async function chatJSON<T>(
  messages: ChatCompletionMessageParam[],
  opts: { temperature?: number; maxTokens?: number; fast?: boolean } = {},
): Promise<T> {
  const { MODEL, FAST_MODEL } = aiConfig();
  const res = await client().chat.completions.create({
    model: opts.fast ? FAST_MODEL : MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 800,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("empty completion");
  return JSON.parse(raw) as T;
}
