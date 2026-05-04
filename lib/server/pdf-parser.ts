// PDF binary → 추출된 plain text
// unpdf 사용 — serverless 전용, pure JS, native binary 의존 없음
// 이전 시도:
//   - pdfjs-dist: GlobalWorkerOptions.workerSrc 에러 (Vercel serverless 비호환)
//   - pdf-parse 2.x: @napi-rs/canvas 네이티브 바이너리 의존 (cold start 느림 + 빌드 위험)

import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buffer);
  const result = await extractText(pdf, { mergePages: true });
  // result.text는 string[] 또는 string. mergePages: true면 string.
  const text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  return (text ?? "").trim();
}
