# Wave 4 — 자료 형식 확장 (DOCX / YouTube 자막 / 이미지 OCR)

**Goal**: 현재 PDF / URL / 텍스트만 지원 → DOCX, YouTube 자막, 이미지(OCR) 추가. RAG 활용도 ↑.

HWP는 라이브러리 native binding 이슈로 보류 (사용자에게 "한글 → DOCX로 저장" 안내).

---

## 새 형식 3가지

| 형식 | 라이브러리 | 비용 | 비고 |
|---|---|---|---|
| **DOCX** | `mammoth` (pure JS) | 무료 | Word 호환 |
| **YouTube 자막** | `youtube-transcript` (직접 fetch) | 무료 | 자막 있는 영상만 |
| **이미지 OCR** | Gemini Vision (이미 설치됨) | ~₩30/이미지 | 한국어 정확 |

---

## Tasks

### W4-1. DOCX 파서

`npm install mammoth`

`lib/server/docx-parser.ts`:

```typescript
import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (e: any) {
    throw new Error(`DOCX 파싱 실패: ${e?.message ?? "unknown"}`);
  }
}
```

Commit: `feat(rag): DOCX 파서 (mammoth.js)`

### W4-2. YouTube 자막 추출

`youtube-transcript` 라이브러리 또는 직접 fetch.

`lib/server/youtube-extractor.ts`:

```typescript
// YouTube 자막 추출 — 공개 영상의 caption track fetch
// 대상: youtube.com/watch?v=VIDEO_ID 또는 youtu.be/VIDEO_ID URL
// 한국어 caption 우선, 없으면 자동생성된 한국어, 없으면 영어

export interface YoutubeTranscript {
  videoId: string;
  title: string;
  text: string;
}

export async function extractYoutubeTranscript(url: string): Promise<YoutubeTranscript> {
  const videoId = parseVideoId(url);
  if (!videoId) throw new Error("YouTube URL에서 video ID를 찾을 수 없습니다.");

  // YouTube 페이지 HTML에서 captionTracks 추출
  const ytPage = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Tigerbookmaker/1.0)" },
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

  // baseUrl로 자막 XML fetch
  const captionRes = await fetch(track.baseUrl);
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
```

Commit: `feat(rag): YouTube 자막 추출 (한국어 우선, 영어 fallback)`

### W4-3. 이미지 OCR (Gemini Vision)

Gemini API에 이미지 + 프롬프트 보내서 한국어 OCR.

`lib/server/image-ocr.ts`:

```typescript
// 이미지 → 한국어 텍스트 (Gemini Vision OCR)
// 비용: ~₩30/이미지 (Gemini 2.5 Flash text+vision)

export async function extractImageText(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const base64 = imageBuffer.toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "이 이미지의 모든 텍스트를 한국어로 정확히 추출하세요. 텍스트만 출력. 다른 설명 X." },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Vision OCR 실패 ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("OCR 결과 없음");
  return text;
}
```

Commit: `feat(rag): 이미지 OCR (Gemini Vision)`

### W4-4. Upload route 확장

`app/api/reference/upload/route.ts` 수정:

기존 source_type: `"pdf" | "url" | "text"`
추가: `"docx" | "youtube" | "image"`

흐름 분기:
```typescript
// 기존 multipart/form-data 분기 안에 PDF 외 docx, image 추가
if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
  // PDF 기존 로직
} else if (file.type.includes("wordprocessingml") || file.name.endsWith(".docx")) {
  rawText = await extractDocxText(buf);
  sourceType = "docx";
} else if (file.type.startsWith("image/")) {
  rawText = await extractImageText(buf, file.type);
  sourceType = "image";
} else {
  return NextResponse.json({ error: "UNSUPPORTED_FORMAT" }, { status: 400 });
}

// JSON 분기에 youtube 추가
} else if (type === "youtube") {
  const url = String(body.url ?? "").trim();
  const r = await extractYoutubeTranscript(url);
  rawText = r.text;
  filename = r.title;
  sourceUrl = url;
  sourceType = "youtube";
}
```

`source_type` DB constraint도 변경 필요? 현재 `CHECK (source_type IN ('pdf', 'url', 'text'))`. → 새 값 허용 필요.

Migration: `db/migrations/0008_reference_types.sql`
```sql
ALTER TABLE book_references DROP CONSTRAINT IF EXISTS book_references_source_type_check;
ALTER TABLE book_references ADD CONSTRAINT book_references_source_type_check
  CHECK (source_type IN ('pdf', 'url', 'text', 'docx', 'youtube', 'image'));
```

OCR은 잔액 차감 (₩30) 추가. 기타 무료.

Commit (multiple):
- `feat(db): book_references source_type에 docx/youtube/image 허용`
- `feat(api): /api/reference/upload — DOCX / YouTube / image OCR 지원`

### W4-5. UI — 추가 업로드 버튼

`/write/setup` 페이지의 "📚 참고 자료" 박스에 새 버튼 추가:
- 기존: PDF / URL / 텍스트 (3 버튼)
- 추가: DOCX / YouTube / 이미지 (3 버튼 더)

각 버튼 클릭 시:
- **DOCX**: 파일 input (.docx accept) → multipart upload
- **YouTube**: URL input → JSON `{type: "youtube", url}`
- **이미지**: 파일 input (image/*) → multipart upload

기존 PDF / URL / 텍스트 버튼들 옆에 같은 스타일로 추가. 6개 버튼이 되면 한 줄에 안 들어갈 수 있으니 grid 또는 wrap.

Commit: `feat(ui): /write/setup에 DOCX / YouTube / 이미지 업로드 버튼`

---

## 통합

- `npm install mammoth` (production)
- Migration 실행
- `npm run build` 통과
- main merge + push

---

*— end of Wave 4 plan*
