// AI for the browser-only demo workspaces. The browser sends the case it holds plus the
// question; the Ollama key stays in this function's environment and never reaches the page.
// No database or identity is involved, so requests are limited by origin, size and rate.
import OpenAI from "openai";
import { assistantMessages } from "../../shared/assistant.mjs";

const ORIGINS = new Set(
  [
    "https://expensivestrike50.github.io",
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEMO_ASSIST_ORIGINS,
  ]
    .flatMap((v) => String(v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean),
);
// Per-instance limit: 20 requests per origin address per hour.
const hits = new Map<string, number[]>();
const limited = (key: string) => {
  const now = Date.now(),
    recent = (hits.get(key) ?? []).filter((t) => now - t < 36e5);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
};
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
});

export default async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ORIGINS.has(origin);
  const headers = allowed ? cors(origin) : {};
  if (req.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (!allowed) return reply({ error: "Request not permitted." }, 403);
  if (!process.env.OLLAMA_API_KEY) return reply({ error: "AI is not configured for this deployment." }, 503);
  const ip = req.headers.get("x-nf-client-connection-ip") ?? "unknown";
  if (limited(`${origin}|${ip}`)) return reply({ error: "You have reached 20 AI requests this hour. Please try later." }, 429);
  try {
    const raw = await req.text();
    if (raw.length > 60000) return reply({ error: "This case is too large to send." }, 413);
    const body = JSON.parse(raw);
    const question = String(body.question ?? "").trim().slice(0, 2000);
    if (!question) return reply({ error: "Enter a question." }, 400);
    if (body.consent !== true) return reply({ error: "Confirm the information-sharing notice first." }, 400);
    if (!body.data || typeof body.data !== "object" || !body.data.profile) return reply({ error: "Missing case details." }, 400);
    const mode = body.mode === "advisor" ? "advisor" : "owner";
    const previous = Array.isArray(body.previous)
      ? body.previous.slice(0, 4).map((m: { question?: unknown; answer?: unknown }) => ({ question: String(m?.question ?? ""), answer: String(m?.answer ?? "") }))
      : [];
    const completion = await new OpenAI({
      apiKey: process.env.OLLAMA_API_KEY,
      baseURL: process.env.OLLAMA_BASE_URL || "https://ollama.com/v1",
      timeout: 25000,
      maxRetries: 0,
    }).chat.completions.create({
      model: process.env.AI_MODEL || "gpt-oss:120b",
      max_tokens: 1800,
      messages: assistantMessages(body.data, mode, question, previous) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    });
    const answer = completion.choices[0]?.message.content;
    if (!answer) return reply({ error: "The assistant returned no answer. Try again." }, 503);
    return reply({ answer });
  } catch (e) {
    console.error("demo-assist", e instanceof Error ? e.message : e);
    return reply({ error: "The assistant could not answer right now. Please try again." }, 502);
  }
};

export const config = { path: "/api/demo-assist" };
