// text → chunks (500자 + 50자 overlap)
// 한국어 특화 — 단어 단위 자르기 X (대부분 1자 단위 처리)
// 문단(\n\n) > 문장(. ! ? 줄바꿈) 우선으로 자르되, 없으면 글자 단위

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE;
    if (end >= cleaned.length) {
      chunks.push(cleaned.slice(start).trim());
      break;
    }
    // 가까운 문단·문장 경계 찾기 (end 기준 ±50자)
    const window = cleaned.slice(start, end + 50);
    const paragraphBreak = window.lastIndexOf("\n\n");
    const sentenceBreak = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf(".\n"),
      window.lastIndexOf("다.\n"),
      window.lastIndexOf("다. "),
    );
    if (paragraphBreak > CHUNK_SIZE - 100) {
      end = start + paragraphBreak + 2;
    } else if (sentenceBreak > CHUNK_SIZE - 100) {
      end = start + sentenceBreak + 1;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }
  return chunks.filter(c => c.length > 0);
}
