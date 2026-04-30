// URL → fetch HTML → Readability로 메인 콘텐츠 추출 → plain text

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

  // Readability로 메인 콘텐츠 추출
  const { JSDOM } = await import("jsdom");
  const { Readability } = await import("@mozilla/readability");
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) throw new Error("Could not extract readable content");

  return {
    title: article.title || parsed.hostname,
    text: (article.textContent || "").trim(),
  };
}
