// DOCX binary → 추출된 plain text (mammoth.js)
// Word/Office 호환 .docx 파일에서 raw text 만 추출

import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (e: any) {
    throw new Error(`DOCX 파싱 실패: ${e?.message ?? "unknown"}`);
  }
}
