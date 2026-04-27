// Client-side AI caller — BYOK. API keys never leave the browser.

export type Provider = "anthropic" | "openai" | "local";

export interface AIConfig {
  provider: Provider;
  apiKey: string;
  model?: string;
}

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  costUSD: number;
  durationMs: number;
  contextWindow?: number;
}

export interface AIResult {
  text: string;
  usage: Usage;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  local: "sonnet",
};

function emptyUsage(model: string, durationMs: number): Usage {
  return { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0, costUSD: 0, durationMs };
}

export async function callAI(config: AIConfig, systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<AIResult> {
  const model = config.model || DEFAULT_MODELS[config.provider];
  const started = Date.now();

  if (config.provider === "local") {
    const res = await fetch("http://localhost:7777/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, user: userPrompt, model }),
    });
    if (!res.ok) throw new Error(`Local proxy ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { text: data.text || "", usage: data.usage || emptyUsage(model, Date.now() - started) };
  }

  if (config.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const u = data.usage || {};
    const inputTokens = u.input_tokens || 0;
    const outputTokens = u.output_tokens || 0;
    const cacheReadTokens = u.cache_read_input_tokens || 0;
    const cacheCreateTokens = u.cache_creation_input_tokens || 0;
    // Sonnet 4.6 pricing (rough): $3/MTok in, $15/MTok out, cache write $3.75, cache read $0.30
    const costUSD = (inputTokens * 3 + outputTokens * 15 + cacheCreateTokens * 3.75 + cacheReadTokens * 0.3) / 1_000_000;
    return {
      text: data.content?.[0]?.text || "",
      usage: { model, inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens, costUSD, durationMs: Date.now() - started },
    };
  }

  // openai
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const u = data.usage || {};
  const inputTokens = u.prompt_tokens || 0;
  const outputTokens = u.completion_tokens || 0;
  // GPT-4o pricing: $2.50/MTok in, $10/MTok out
  const costUSD = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
  return {
    text: data.choices?.[0]?.message?.content || "",
    usage: { model, inputTokens, outputTokens, cacheReadTokens: 0, cacheCreateTokens: 0, costUSD, durationMs: Date.now() - started },
  };
}
