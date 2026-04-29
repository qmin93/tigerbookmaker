// 서버사이드 전용 AI 호출 — API 키는 환경변수에서만 로드
// 클라이언트에서 import 금지 (가능하면 'server-only' 패키지 사용 권장)

import "server-only";

export type AIModel =
  | "gemini-2.5-flash-lite"
  | "gemini-flash-lite-latest"
  | "gemini-2.5-flash"
  | "gemini-flash-latest"
  | "gemini-2.5-pro"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gpt-4.1-mini"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUSD: number;
  durationMs: number;
}

export interface AIResult {
  text: string;
  usage: AIUsage;
}

const PRICING: Record<AIModel, { in: number; out: number }> = {
  "gemini-2.5-flash-lite":   { in: 0.10,  out: 0.40 },
  "gemini-flash-lite-latest":{ in: 0.10,  out: 0.40 },
  "gemini-2.5-flash":        { in: 0.30,  out: 2.50 },
  "gemini-flash-latest":     { in: 0.30,  out: 2.50 },
  "gemini-2.5-pro":          { in: 1.25,  out: 10.00 },
  "gpt-4o-mini":             { in: 0.15,  out: 0.60 },
  "gpt-4o":                  { in: 2.50,  out: 10.00 },
  "gpt-4.1-mini":            { in: 0.40,  out: 1.60 },
  "claude-sonnet-4-6":       { in: 3.00,  out: 15.00 },
  "claude-haiku-4-5":        { in: 1.00,  out: 5.00 },
};

// non-streaming fallback chain — model 여러 개 순차 시도.
// 한 모델이 retry 다 실패해도 다음 모델로 넘어감.
export async function callAIServerWithFallback(opts: {
  candidates: AIModel[];
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  retries?: number;
}): Promise<AIResult & { actualModel: AIModel }> {
  const errors: string[] = [];
  for (const model of opts.candidates) {
    try {
      const r = await callAIServer({ ...opts, model });
      return { ...r, actualModel: model };
    } catch (e: any) {
      errors.push(`${model}: ${String(e?.message ?? e).slice(0, 100)}`);
    }
  }
  throw new Error(`모든 모델 실패. ${errors.join(" / ")}`);
}

export async function callAIServer(opts: {
  model: AIModel;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  retries?: number; // 503/UNAVAILABLE 등 일시 장애 시 자동 재시도 (기본 2)
}): Promise<AIResult> {
  const { model, system, user, maxTokens = 6144, temperature = 0.7, timeoutMs, retries = 2 } = opts;
  const started = Date.now();

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (model.startsWith("gemini")) {
        return await callGemini({ model, system, user, maxTokens, temperature, timeoutMs, started });
      } else if (model.startsWith("claude")) {
        return await callAnthropic({ model, system, user, maxTokens, temperature, timeoutMs, started });
      } else if (model.startsWith("gpt")) {
        return await callOpenAI({ model, system, user, maxTokens, temperature, timeoutMs, started });
      }
      throw new Error(`Unknown model: ${model}`);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? "");
      // 일시 장애만 재시도 — 503, 502, UNAVAILABLE, overloaded
      const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과|429|quota/i.test(msg);
      if (!transient || attempt >= retries) throw e;
      // 백오프 1s, 2s
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function callGemini(opts: {
  model: AIModel; system: string; user: string;
  maxTokens: number; temperature: number; timeoutMs?: number; started: number;
}): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;
  const ctrl = opts.timeoutMs ? new AbortController() : undefined;
  const tid = opts.timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens,
          temperature: opts.temperature,
          // Gemini 2.5 series는 reasoning 모델 — thinking을 끄면 30~50% 빨라지고 비용도 절반
          // 책 본문/요약처럼 추론보다 작문이 본질인 작업엔 불필요
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: ctrl?.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Gemini 호출 시간 초과 (${opts.timeoutMs}ms)`);
    throw e;
  } finally {
    if (tid) clearTimeout(tid);
  }
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429 && opts.model === "gemini-2.5-pro") {
      throw new Error("Gemini Pro는 Cloud Console 결제 활성화가 필요합니다. 일단 Flash 모델을 사용하세요.");
    }
    if (res.status === 503 || /UNAVAILABLE|overloaded/i.test(err)) {
      // 자동 재시도용 — callAIServer의 retry 로직이 이 메시지를 감지
      throw new Error(`Gemini 503 (UNAVAILABLE): Google AI 일시 장애. 잠시 후 다시 시도하세요.`);
    }
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const u = data.usageMetadata || {};
  const inputTokens = u.promptTokenCount || 0;
  const outputTokens = u.candidatesTokenCount || 0;
  const thoughtsTokens = u.thoughtsTokenCount || 0;
  const p = PRICING[opts.model];
  const costUSD = (inputTokens * p.in + (outputTokens + thoughtsTokens) * p.out) / 1_000_000;
  return {
    text,
    usage: {
      inputTokens, outputTokens, thoughtsTokens,
      cacheReadTokens: 0, cacheWriteTokens: 0, costUSD,
      durationMs: Date.now() - opts.started,
    },
  };
}

async function callAnthropic(opts: {
  model: AIModel; system: string; user: string;
  maxTokens: number; temperature: number; timeoutMs?: number; started: number;
}): Promise<AIResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Sonnet/Haiku 모델은 현재 비활성 상태입니다. Gemini Flash로 다시 시도하세요.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const u = data.usage || {};
  const inputTokens = u.input_tokens || 0;
  const outputTokens = u.output_tokens || 0;
  const cacheReadTokens = u.cache_read_input_tokens || 0;
  const cacheWriteTokens = u.cache_creation_input_tokens || 0;
  const p = PRICING[opts.model];
  const costUSD = (
    inputTokens * p.in +
    outputTokens * p.out +
    cacheReadTokens * p.in * 0.1 +
    cacheWriteTokens * p.in * 1.25
  ) / 1_000_000;
  return {
    text,
    usage: {
      inputTokens, outputTokens, thoughtsTokens: 0,
      cacheReadTokens, cacheWriteTokens, costUSD,
      durationMs: Date.now() - opts.started,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Streaming (Gemini SSE only — used for chapter body)
// ─────────────────────────────────────────────────────────────────────────

export interface StreamChunk { type: "chunk"; text: string; }
export interface StreamDone { type: "done"; usage: AIUsage; }
export type StreamEvent = StreamChunk | StreamDone;

export async function* callGeminiStream(opts: {
  model: AIModel;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): AsyncGenerator<StreamEvent, void, unknown> {
  const { model, system, user, maxTokens = 6144, temperature = 0.7, timeoutMs } = opts;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");
  if (!model.startsWith("gemini")) throw new Error(`Streaming은 현재 Gemini 모델만 지원: ${model}`);

  const started = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const ctrl = timeoutMs ? new AbortController() : undefined;
  const tid = timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: ctrl?.signal,
    });
  } catch (e: any) {
    if (tid) clearTimeout(tid);
    if (e?.name === "AbortError") throw new Error(`Gemini 호출 시간 초과 (${timeoutMs}ms)`);
    throw e;
  }

  if (!res.ok) {
    if (tid) clearTimeout(tid);
    const errText = await res.text();
    if (res.status === 503 || /UNAVAILABLE|overloaded/i.test(errText)) {
      throw new Error(`Gemini 503 (UNAVAILABLE): Google AI 일시 장애. 잠시 후 다시 시도하세요.`);
    }
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
  }
  if (!res.body) {
    if (tid) clearTimeout(tid);
    throw new Error("Gemini stream body is null");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let thoughtsTokens = 0;

  // Line-based SSE 파서 — 각 line이 "data: {...}" 또는 빈 줄. 빈 줄은 event boundary (skip).
  const processLine = (line: string): { text?: string; usage?: any } | null => {
    if (!line.startsWith("data:")) return null;
    const json = line.slice(5).trim();
    if (!json || json === "[DONE]") return null;
    let payload: any;
    try { payload = JSON.parse(json); } catch { return null; }
    return {
      text: payload?.candidates?.[0]?.content?.parts?.[0]?.text,
      usage: payload?.usageMetadata,
    };
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // line by line — \n 또는 \r\n 모두 처리
      let lineEnd;
      while ((lineEnd = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, lineEnd);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(lineEnd + 1);
        if (!line.trim()) continue;
        const parsed = processLine(line);
        if (!parsed) continue;
        if (parsed.text) yield { type: "chunk", text: parsed.text };
        if (parsed.usage) {
          inputTokens = parsed.usage.promptTokenCount ?? inputTokens;
          outputTokens = parsed.usage.candidatesTokenCount ?? outputTokens;
          thoughtsTokens = parsed.usage.thoughtsTokenCount ?? thoughtsTokens;
        }
      }
    }
    // 남은 buffer 처리 (마지막 line이 \n 없이 끝났을 경우)
    if (buffer.trim()) {
      const parsed = processLine(buffer.trim());
      if (parsed) {
        if (parsed.text) yield { type: "chunk", text: parsed.text };
        if (parsed.usage) {
          inputTokens = parsed.usage.promptTokenCount ?? inputTokens;
          outputTokens = parsed.usage.candidatesTokenCount ?? outputTokens;
          thoughtsTokens = parsed.usage.thoughtsTokenCount ?? thoughtsTokens;
        }
      }
    }
  } finally {
    if (tid) clearTimeout(tid);
    try { reader.releaseLock(); } catch {}
  }

  const p = PRICING[model];
  const costUSD = (inputTokens * p.in + (outputTokens + thoughtsTokens) * p.out) / 1_000_000;
  yield {
    type: "done",
    usage: {
      inputTokens,
      outputTokens,
      thoughtsTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUSD,
      durationMs: Date.now() - started,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI provider (chat completions)
// ─────────────────────────────────────────────────────────────────────────

async function callOpenAI(opts: {
  model: AIModel; system: string; user: string;
  maxTokens: number; temperature: number; timeoutMs?: number; started: number;
}): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다.");

  const ctrl = opts.timeoutMs ? new AbortController() : undefined;
  const tid = opts.timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      signal: ctrl?.signal,
    });
  } catch (e: any) {
    if (tid) clearTimeout(tid);
    if (e?.name === "AbortError") throw new Error(`OpenAI 호출 시간 초과 (${opts.timeoutMs}ms)`);
    throw e;
  } finally {
    if (tid) clearTimeout(tid);
  }

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error(`OpenAI 429 (quota): ${err.slice(0, 200)}`);
    if (res.status === 503) throw new Error(`OpenAI 503 (UNAVAILABLE): ${err.slice(0, 200)}`);
    throw new Error(`OpenAI API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const u = data.usage || {};
  const inputTokens = u.prompt_tokens || 0;
  const outputTokens = u.completion_tokens || 0;
  const p = PRICING[opts.model];
  const costUSD = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  return {
    text,
    usage: {
      inputTokens, outputTokens, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0, costUSD,
      durationMs: Date.now() - opts.started,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI streaming
// ─────────────────────────────────────────────────────────────────────────

export async function* callOpenAIStream(opts: {
  model: AIModel; system: string; user: string;
  maxTokens?: number; temperature?: number; timeoutMs?: number;
}): AsyncGenerator<StreamEvent, void, unknown> {
  const { model, system, user, maxTokens = 6144, temperature = 0.7, timeoutMs } = opts;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다.");
  if (!model.startsWith("gpt")) throw new Error(`OpenAI streaming은 gpt 모델만 지원: ${model}`);

  const started = Date.now();
  const ctrl = timeoutMs ? new AbortController() : undefined;
  const tid = timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: ctrl?.signal,
    });
  } catch (e: any) {
    if (tid) clearTimeout(tid);
    if (e?.name === "AbortError") throw new Error(`OpenAI 호출 시간 초과 (${timeoutMs}ms)`);
    throw e;
  }

  if (!res.ok) {
    if (tid) clearTimeout(tid);
    const errText = await res.text();
    if (res.status === 429) throw new Error(`OpenAI 429 (quota): ${errText.slice(0, 200)}`);
    if (res.status === 503) throw new Error(`OpenAI 503 (UNAVAILABLE): ${errText.slice(0, 200)}`);
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
  }
  if (!res.body) {
    if (tid) clearTimeout(tid);
    throw new Error("OpenAI stream body is null");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lineEnd;
      while ((lineEnd = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, lineEnd);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(lineEnd + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let parsed: any;
        try { parsed = JSON.parse(payload); } catch { continue; }
        const text = parsed?.choices?.[0]?.delta?.content;
        if (text) yield { type: "chunk", text };
        const u = parsed?.usage;
        if (u) {
          inputTokens = u.prompt_tokens ?? inputTokens;
          outputTokens = u.completion_tokens ?? outputTokens;
        }
      }
    }
  } finally {
    if (tid) clearTimeout(tid);
    try { reader.releaseLock(); } catch {}
  }

  const p = PRICING[model];
  const costUSD = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  yield {
    type: "done",
    usage: {
      inputTokens, outputTokens, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0, costUSD,
      durationMs: Date.now() - started,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Anthropic streaming
// ─────────────────────────────────────────────────────────────────────────

export async function* callAnthropicStream(opts: {
  model: AIModel; system: string; user: string;
  maxTokens?: number; temperature?: number; timeoutMs?: number;
}): AsyncGenerator<StreamEvent, void, unknown> {
  const { model, system, user, maxTokens = 6144, temperature = 0.7, timeoutMs } = opts;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API 키가 설정되지 않았습니다.");
  if (!model.startsWith("claude")) throw new Error(`Anthropic streaming은 claude 모델만 지원: ${model}`);

  const started = Date.now();
  const ctrl = timeoutMs ? new AbortController() : undefined;
  const tid = timeoutMs && ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
        stream: true,
      }),
      signal: ctrl?.signal,
    });
  } catch (e: any) {
    if (tid) clearTimeout(tid);
    if (e?.name === "AbortError") throw new Error(`Anthropic 호출 시간 초과 (${timeoutMs}ms)`);
    throw e;
  }

  if (!res.ok) {
    if (tid) clearTimeout(tid);
    const errText = await res.text();
    if (res.status === 429) throw new Error(`Anthropic 429 (quota): ${errText.slice(0, 200)}`);
    if (res.status === 503) throw new Error(`Anthropic 503 (UNAVAILABLE): ${errText.slice(0, 200)}`);
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
  }
  if (!res.body) {
    if (tid) clearTimeout(tid);
    throw new Error("Anthropic stream body is null");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lineEnd;
      while ((lineEnd = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, lineEnd);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        buffer = buffer.slice(lineEnd + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let parsed: any;
        try { parsed = JSON.parse(payload); } catch { continue; }
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          yield { type: "chunk", text: parsed.delta.text };
        }
        if (parsed.type === "message_start" && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens ?? inputTokens;
        }
        if (parsed.type === "message_delta" && parsed.usage) {
          outputTokens = parsed.usage.output_tokens ?? outputTokens;
        }
      }
    }
  } finally {
    if (tid) clearTimeout(tid);
    try { reader.releaseLock(); } catch {}
  }

  const p = PRICING[model];
  const costUSD = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  yield {
    type: "done",
    usage: {
      inputTokens, outputTokens, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0, costUSD,
      durationMs: Date.now() - started,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Multi-vendor streaming with fallback chain
// ─────────────────────────────────────────────────────────────────────────

// chain의 첫 모델부터 시도. 첫 chunk 이전 503/429/timeout 시 다음 모델.
// chunk 도착 이후 실패는 fallback 안 함 (이미 일부 보낸 본문 깨짐).
export async function* callStreamWithFallback(opts: {
  candidates: AIModel[];
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): AsyncGenerator<StreamEvent & { model?: AIModel }, void, unknown> {
  if (opts.candidates.length === 0) {
    throw new Error("사용 가능한 모델 후보가 없습니다 (API 키 미등록).");
  }
  let lastErr: any = null;
  for (let i = 0; i < opts.candidates.length; i++) {
    const model = opts.candidates[i];
    const isLast = i === opts.candidates.length - 1;
    try {
      const gen =
        model.startsWith("gemini") ? callGeminiStream({ ...opts, model }) :
        model.startsWith("gpt")    ? callOpenAIStream({ ...opts, model }) :
        callAnthropicStream({ ...opts, model });

      for await (const evt of gen) {
        yield { ...evt, model };
      }
      return;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? "");
      const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과|429|quota/i.test(msg);
      if (!transient || isLast) throw e;
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────
// Image generation (Imagen 4 Fast 메인, OpenAI gpt-image-1 fallback)
// ─────────────────────────────────────────────────────────────────────────

export interface ImageResult {
  base64: string;
  vendor: "cloudflare" | "pollinations" | "gemini" | "openai";
  costUSD: number;
  durationMs: number;
}

// Cloudflare 일일 quota (10k neurons) hit detection — process 재시작 전까지 cache.
// 한 번 429 받으면 다음 호출은 즉시 다음 vendor로 (15s timeout 낭비 X).
let cloudflareDownUntil = 0;

export async function callImageGeneration(opts: {
  prompt: string;
  timeoutMs?: number;
}): Promise<ImageResult> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const errors: string[] = [];
  const now = Date.now();

  // 1순위: Cloudflare Workers AI (무료 1만/일) — quota 도달 시 1시간 skip
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID && now > cloudflareDownUntil) {
    try {
      const r = await callCloudflareImage(opts.prompt, timeoutMs);
      return { ...r, durationMs: Date.now() - started };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      errors.push(`Cloudflare: ${msg.slice(0, 120)}`);
      // daily quota 도달 — 1시간 skip (UTC 자정 reset되니 보수적)
      if (msg.includes("429") || msg.includes("daily free allocation") || msg.includes("neurons")) {
        cloudflareDownUntil = now + 60 * 60 * 1000;
        console.warn("[image-gen] Cloudflare quota exceeded, skipping for 1h");
      }
    }
  }
  // 2순위: OpenAI gpt-image-1 (paid, 신뢰성 높음) — quota 도달 시 우선
  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await callOpenAIImage(opts.prompt, timeoutMs);
      return { ...r, durationMs: Date.now() - started };
    } catch (e: any) {
      errors.push(`OpenAI: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  // 3순위: Imagen 4 Fast (paid, 한국어 깔끔) — Gemini billing 활성화 시
  if (process.env.GEMINI_API_KEY) {
    try {
      const r = await callImagenFast(opts.prompt, timeoutMs);
      return { ...r, durationMs: Date.now() - started };
    } catch (e: any) {
      errors.push(`Imagen: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  // 4순위: Pollinations (무료, 한국어 약함, Vercel server에서 종종 hang) — 마지막 보루, 짧은 timeout
  try {
    const r = await callPollinations(opts.prompt, Math.min(timeoutMs, 8000));
    return { ...r, durationMs: Date.now() - started };
  } catch (e: any) {
    errors.push(`Pollinations: ${String(e?.message ?? e).slice(0, 120)}`);
  }
  throw new Error(`모든 이미지 vendor 실패. ${errors.join(" / ") || "API 키 없음"}`);
}

async function callCloudflareImage(prompt: string, timeoutMs: number): Promise<Omit<ImageResult, "durationMs">> {
  const token = process.env.CLOUDFLARE_API_TOKEN!;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const model = "@cf/black-forest-labs/flux-1-schnell";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, num_steps: 4 }),  // flux-schnell은 4 steps default
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data?.success) {
      throw new Error(`Cloudflare error: ${JSON.stringify(data?.errors).slice(0, 200)}`);
    }
    const base64 = data?.result?.image;
    if (!base64) throw new Error("Cloudflare: no image in response");
    return { base64, vendor: "cloudflare", costUSD: 0 };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Cloudflare 시간 초과 (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

async function callPollinations(prompt: string, timeoutMs: number): Promise<Omit<ImageResult, "durationMs">> {
  // Pollinations.ai — 무료, API 키 불필요. flux 모델로 1024x1024 PNG 반환.
  // private=true: feed에 이미지 노출 안 함
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&private=true`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Pollinations ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) throw new Error(`Pollinations: too small response (${buf.byteLength} bytes)`);
    const base64 = Buffer.from(buf).toString("base64");
    return { base64, vendor: "pollinations", costUSD: 0 };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Pollinations 시간 초과 (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

async function callImagenFast(prompt: string, timeoutMs: number): Promise<Omit<ImageResult, "durationMs">> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Imagen ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Imagen: no image in response");
    return { base64: b64, vendor: "gemini", costUSD: 0.02 };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Imagen 시간 초과 (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

async function callOpenAIImage(prompt: string, timeoutMs: number): Promise<Omit<ImageResult, "durationMs">> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Image ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI Image: no b64_json in response");
    return { base64: b64, vendor: "openai", costUSD: 0.04 };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`OpenAI Image 시간 초과 (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}
