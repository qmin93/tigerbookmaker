// 서버사이드 전용 AI 호출 — API 키는 환경변수에서만 로드
// 클라이언트에서 import 금지 (가능하면 'server-only' 패키지 사용 권장)

import "server-only";

export type AIModel =
  | "gemini-2.5-flash"
  | "gemini-flash-latest"
  | "gemini-2.5-pro"
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
  "gemini-2.5-flash":     { in: 0.30, out: 2.50 },
  "gemini-flash-latest":  { in: 0.30, out: 2.50 },
  "gemini-2.5-pro":       { in: 1.25, out: 10.00 },
  "claude-sonnet-4-6":    { in: 3.00, out: 15.00 },
  "claude-haiku-4-5":     { in: 1.00, out: 5.00 },
};

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
      }
      throw new Error(`Unknown model: ${model}`);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? "");
      // 일시 장애만 재시도 — 503, 502, UNAVAILABLE, overloaded
      const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과/i.test(msg);
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
