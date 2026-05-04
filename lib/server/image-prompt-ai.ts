// AI Meta-prompting — Gemini Flash가 책 정보 + RAG context 보고 image gen용 prompt 작성
// generic / topic 미반영 이미지 방지가 목표.
// 1) 책 topic/audience/type/themeColor + 2) chapter 1 발췌 + 3) reference chunks 1-2개 → prompt
// 4) iterative refinement: 사용자 자연어 피드백 + previousPrompt → 새 prompt
import "server-only";
import { callAIServer } from "./ai-server";

export type ImagePurpose =
  | "cover"
  | "meta-feed"
  | "meta-story"
  | "meta-link"
  | "infographic-card"
  | "video-frame"
  | "thumbnail";

export interface ImagePromptOptions {
  bookTopic: string;
  bookAudience: string;
  bookType: string;
  themeColorHex: string;       // 예 "#f97316"
  themeColorName: string;      // 예 "warm orange"
  purpose: ImagePurpose;
  aspectRatio: string;         // "1:1" | "9:16" | "16:9" 등
  // RAG context
  chapterExcerpt?: string;     // chapter 1 발췌 (300자)
  referenceChunks?: Array<{ content: string; filename: string }>;  // 1-2개
  // Iterative refinement
  feedback?: string;           // 사용자 자연어 피드백
  previousPrompt?: string;     // 이전 prompt (refinement 시)
  // Misc
  headline?: string;           // 텍스트 합성용 헤드라인 (이미지엔 안 그려짐 — context로만)
}

export interface ImagePromptResult {
  prompt: string;              // English prompt to feed Imagen / Flux
  costKRW: number;
}

export async function generateImagePromptAI(opts: ImagePromptOptions): Promise<ImagePromptResult> {
  const purposeHint = describePurpose(opts.purpose, opts.aspectRatio);

  const ragContext = buildRagContext(opts.chapterExcerpt, opts.referenceChunks);

  const refinementBlock = opts.feedback && opts.previousPrompt
    ? `\n[PREVIOUS PROMPT — DO NOT REPEAT, IMPROVE IT]\n${opts.previousPrompt}\n\n[USER FEEDBACK ON THE PREVIOUS RESULT]\n${opts.feedback}\n\nGenerate a NEW prompt addressing this feedback specifically.`
    : "";

  const systemPrompt = `You are an expert at writing image generation prompts for Imagen 4 / Flux. You MUST write the prompt in ENGLISH (image models don't understand Korean well). Output ONLY the prompt — no explanations, no JSON, no quotes. Just the prompt as plain text.

Strong principles:
1. Be specific and visual (concrete objects/scenes), not abstract mood words
2. Mention exact colors and composition
3. Include a clear focal point
4. NO text/letters/numbers in the image (Korean text is added separately via overlay)
5. Pinterest / Behance editorial design aesthetic
6. Match the aspect ratio: ${opts.aspectRatio}
7. The book is in Korean — but generate VISUAL CONCEPTS, not translation`;

  const userPrompt = `[BOOK]
Topic (translate concept, not text): ${opts.bookTopic}
Audience: ${opts.bookAudience}
Genre: ${opts.bookType}
Theme color: ${opts.themeColorName} (${opts.themeColorHex})
${opts.headline ? `Headline (for context only, NOT to render): "${opts.headline}"` : ""}

[IMAGE PURPOSE]
${purposeHint}

${ragContext}
${refinementBlock}

Now write a single English prompt (max 100 words) for Imagen 4 to generate the perfect image. Start directly with the prompt — no preamble.`;

  const result = await callAIServer({
    model: "gemini-flash-latest",
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 400,
    temperature: 0.7,
    timeoutMs: 15000,
  });

  let prompt = result.text.trim();
  // Strip code fences if AI added any
  prompt = prompt.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  // Always append no-text constraint
  if (!/no text|no letters|no characters|wordless/i.test(prompt)) {
    prompt += " WORDLESS, no text, no letters, no numbers, no Korean characters anywhere.";
  }

  // Approx cost calc — Gemini Flash output 2.50 USD/M tokens, very cheap for ~400 tokens
  const costKRW = Math.ceil((result.usage.costUSD ?? 0) * 1400);

  return { prompt, costKRW };
}

function describePurpose(purpose: ImagePurpose, ar: string): string {
  switch (purpose) {
    case "cover":
      return `Book cover thumbnail (${ar}) — magazine cover-style abstract composition. Single bold visual element, premium publishing aesthetic.`;
    case "meta-feed":
      return `Instagram Feed ad (${ar}, square). Eye-catching central element. Bottom 30% reserved for text overlay (keep simple/blank there).`;
    case "meta-story":
      return `Instagram Story / Reels ad (${ar}, vertical). Top half: visual hook. Bottom half: text overlay space.`;
    case "meta-link":
      return `Facebook link ad (${ar}, landscape). Visual on left, text overlay on right.`;
    case "infographic-card":
      return `Infographic card (${ar}). Single clean concept illustration. Centered. Minimalist.`;
    case "video-frame":
      return `Video preview frame (${ar}, vertical 9:16). Cinematic, mood-setting. Text overlay space at bottom.`;
    case "thumbnail":
      return `Thumbnail (${ar}, square). Bold central icon/symbol representing the topic.`;
  }
}

function buildRagContext(
  chapterExcerpt?: string,
  referenceChunks?: Array<{ content: string; filename: string }>,
): string {
  const parts: string[] = [];
  if (chapterExcerpt && chapterExcerpt.trim()) {
    parts.push(`[CHAPTER 1 EXCERPT — visual cues only]
${chapterExcerpt.slice(0, 300)}`);
  }
  if (referenceChunks && referenceChunks.length > 0) {
    parts.push(`[USER'S REFERENCE MATERIAL — visual themes]
${referenceChunks.slice(0, 2).map(c => `(${c.filename}) ${c.content.slice(0, 200)}`).join("\n\n")}`);
  }
  if (parts.length === 0) return "";
  return "\n" + parts.join("\n\n") + "\n\nUse these to make the image truly relevant to THIS specific book, not a generic genre photo.\n";
}
