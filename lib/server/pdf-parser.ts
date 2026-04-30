// PDF binary → 추출된 plain text
// pdfjs-dist는 Vercel serverless에서 worker 설정 필요 — Node 환경에선 legacy build 사용

export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // dynamic import — bundle size 줄임
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // worker 비활성화 (Node 환경)
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({
    data: buffer,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(" ");
    pages.push(text);
  }
  await pdf.destroy();
  return pages.join("\n\n").trim();
}
