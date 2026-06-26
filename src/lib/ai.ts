import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Provider-agnostic. Defaults to DeepSeek (OpenAI-compatible). Swap by env.
const API_KEY = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
const BASE_URL = process.env.AI_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.AI_MODEL ?? "deepseek-chat";

export function aiEnabled(): boolean {
  return API_KEY.length > 0;
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
  return _client;
}

export async function chat(
  messages: ChatCompletionMessageParam[],
  opts: { temperature?: number } = {},
): Promise<string> {
  const res = await client().chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
  });
  return res.choices[0]?.message?.content ?? "";
}

// Asks the model for JSON and parses it. Throws on bad output so callers can fall back.
export async function chatJSON<T>(
  messages: ChatCompletionMessageParam[],
  opts: { temperature?: number } = {},
): Promise<T> {
  const res = await client().chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}
