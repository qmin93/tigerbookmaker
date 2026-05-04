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
