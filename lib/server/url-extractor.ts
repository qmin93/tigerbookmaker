// URL → fetch HTML → Readability로 메인 콘텐츠 추출 → plain text
// linkedom 사용 (jsdom drop-in replacement, serverless 친화, 훨씬 가벼움)
// 이전 jsdom은 1277 파일 trace + Vercel cold start 무거움 + 종종 호환 이슈

export async function extractUrlText(url: string, timeoutMs = 15000): Promise<{
  title: string;
  text: string;
}> {
  // URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs supported");
  }

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tigerbookmaker/1.0)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`URL fetch timeout (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }

  // linkedom — DOMParser-호환 경량 라이브러리
  const { parseHTML } = await import("linkedom");
  const { Readability } = await import("@mozilla/readability");

  const { document } = parseHTML(html);
  // Readability는 jsdom의 document API와 동일 인터페이스 사용 — linkedom 호환
  const reader = new Readability(document as any);
  const article = reader.parse();
  if (!article) throw new Error("Could not extract readable content");

  return {
    title: article.title || parsed.hostname,
    text: (article.textContent || "").trim(),
  };
}
