// PDF binary → 추출된 plain text
// pdf-parse 사용 (Node.js 친화, worker 설정 불필요)
// 이전 pdfjs-dist는 GlobalWorkerOptions.workerSrc 문제로 Vercel serverless에서 깨짐

export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // dynamic import — bundle size 줄임 + Vercel cold start 최적화
  const mod = (await import("pdf-parse")) as any;
  // pdf-parse는 default 또는 module 자체가 함수
  const pdfParse: any = mod.default ?? mod;

  // pdf-parse는 Buffer를 받음 — Uint8Array를 Buffer로 변환
  const buf = Buffer.from(buffer);

  const data = await pdfParse(buf, {
    // version은 자동 감지. max 0 = 모든 페이지 처리.
    max: 0,
  });

  return (data?.text ?? "").trim();
}
