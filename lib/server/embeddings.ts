// Gemini text-embedding-004 — 768 dim, 한국어 OK
// 무료 tier: 분당 1500 RPM (paid Tier 1), 무료 분당 30
// rate limit hit 시 자동 retry 1회 + 1초 백오프

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIM = 768;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
        throw new Error(`Invalid embedding response (expected ${EMBEDDING_DIM} dim)`);
      }
      return values;
    } catch (e: any) {
      if (attempt >= 1) throw e;
    }
  }
  throw new Error("Embedding failed after retry");
}

// batch embedding — 여러 chunks 한 번에 (현재 Gemini API는 1개씩, 순차 호출)
export async function embedBatch(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const v = await embed(texts[i]);
    results.push(v);
    onProgress?.(i + 1, texts.length);
  }
  return results;
}
