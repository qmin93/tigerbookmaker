// YouTube 자막 추출 — 공개 영상의 caption track fetch
// 대상: youtube.com/watch?v=VIDEO_ID 또는 youtu.be/VIDEO_ID URL
// 한국어 caption 우선, 없으면 자동생성된 한국어, 없으면 영어

export interface YoutubeTranscript {
  videoId: string;
  title: string;
  text: string;
}

export async function extractYoutubeTranscript(url: string, timeoutMs = 20000): Promise<YoutubeTranscript> {
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("YouTube URL에서 video ID를 찾을 수 없습니다.");

  // YouTube 페이지 HTML에서 captionTracks 추출 — 20초 timeout (Vercel 60초 제한 안에서 여유)
  const ytPage = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Tigerbookmaker/1.0)" },
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: Error) => {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw new Error("YouTube 응답이 너무 느립니다. 영상이 길거나 일시 장애일 수 있어요. 다시 시도해 주세요.");
    }
    throw e;
  });
  if (!ytPage.ok) throw new Error(`YouTube 페이지 로드 실패: ${ytPage.status}`);
  const html = await ytPage.text();

  // 영상 제목 추출
  const titleMatch = html.match(/"title":"([^"]+)"/);
  const title = titleMatch ? decodeURIComponent(titleMatch[1]).replace(/\\u0026/g, "&") : "(제목 없음)";

  // captionTracks JSON 추출
  const trackMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
  if (!trackMatch) throw new Error("이 영상에는 자막이 없습니다.");
  const tracks = JSON.parse(trackMatch[1].replace(/\\u0026/g, "&"));

  // 한국어 우선, 없으면 영어
  const ko = tracks.find((t: any) => t.languageCode === "ko");
  const en = tracks.find((t: any) => t.languageCode === "en");
  const track = ko || en || tracks[0];
  if (!track) throw new Error("사용 가능한 자막이 없습니다.");

  // baseUrl로 자막 XML fetch — 자막이 매우 길 수 있으므로 timeoutMs 그대로 사용
  const captionRes = await fetch(track.baseUrl, {
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: Error) => {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw new Error("자막 다운로드가 너무 오래 걸립니다. 영상이 매우 긴 경우 발생합니다.");
    }
    throw e;
  });
  if (!captionRes.ok) throw new Error("자막 다운로드 실패");
  const captionXml = await captionRes.text();

  // <text>...</text> 태그 안 텍스트만 추출
  const matches = captionXml.matchAll(/<text[^>]*>([^<]+)<\/text>/g);
  const text = Array.from(matches)
    .map(m => decodeHtmlEntities(m[1]))
    .join(" ")
    .trim();

  if (!text) throw new Error("자막 내용을 파싱할 수 없습니다.");

  return { videoId, title, text };
}

function parseVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
