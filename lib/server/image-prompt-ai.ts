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
  templateHint?: string;       // 레이아웃 template의 coverStyleHint
  // Wave: 사용자 시각 컨셉 직접 입력 — 입력 있으면 main subject로 강제 반영
  userConcept?: string;
  // Wave: 표지 스타일 방향 — image(시각 메타포 위주, 기본) / typography(글씨 위주) / hybrid(둘 다)
  styleDirection?: "image" | "typography" | "hybrid";
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

  const templateBlock = opts.templateHint
    ? `\n[TEMPLATE STYLE GUIDANCE — keep the cover consistent with this style direction]\n${opts.templateHint}`
    : "";

  const userConceptBlock = opts.userConcept && opts.userConcept.trim()
    ? `\n[USER'S VISUAL INTENT — TOP PRIORITY, RENDER THIS AS THE MAIN SUBJECT]\n${opts.userConcept.trim()}\n`
    : "";

  // 표지 스타일 방향 — typography 모드는 글씨가 메인, image는 시각 메타포 메인, hybrid는 둘 다
  const sd = opts.styleDirection ?? "image";
  const styleDirectionBlock = opts.purpose === "cover" && sd !== "image"
    ? sd === "typography"
      ? `\n[STYLE DIRECTION: TYPOGRAPHY-DRIVEN COVER]
The cover MUST be typography-as-art. Imagine a Penguin Modern Classics or Korean bestseller cover ("원씽", "아주 작은 습관의 힘") where the title itself IS the visual.
- Compose a striking abstract typography-style composition: bold geometric letterforms, oversized initial-cap silhouettes, type stacks, type wrapped around shapes
- The actual book title will be added separately as overlay — but the prompt should describe a TYPE-CENTRIC composition (large abstract letter shapes, color blocks behind text areas, modernist editorial type layout)
- AVOID literal scenes, photographs, illustrated objects, characters
- Think: Pentagram / Nationale / Mucca / Pinterest "editorial typography" boards
- Output a composition that LOOKS like typography even though no actual letters are drawn (text overlay handled later by code)`
      : `\n[STYLE DIRECTION: HYBRID — TYPOGRAPHY + ILLUSTRATION]
The cover should mix bold typography composition (top half) with a small focused illustrative element (bottom or corner).
- Top 60-70%: type-centric design (color blocks, letterform silhouettes, ample whitespace)
- Bottom 30-40%: ONE small illustration or symbolic icon related to the topic
- AVOID full-frame photographs or characters that fight the typography
- Editorial magazine aesthetic, restrained palette led by ${opts.themeColorName}`
    : "";

  const systemPrompt = `You are an expert at writing image generation prompts for Imagen 4 / DALL-E 3 / Flux. You MUST write the prompt in ENGLISH (image models don't understand Korean well). Output ONLY the prompt — no explanations, no JSON, no quotes, no code fences, no preamble. Just the prompt as plain text.

CRITICAL — These rules prevent text artifacts in the output:
1. NEVER mention hex codes (like #f97316 or F97316), color codes, or aspect ratio strings (1:1 / 16:9) in the prompt — image models render those as text in the picture
2. NEVER mention "1:1", "16:9", "9:16", or any colon-separated number in the prompt body
3. NEVER mention pixel dimensions like "1080x1080"
4. Refer to colors by NAME only (e.g., "warm orange", "midnight blue") — never by hex
5. NO text, letters, numbers, words, captions, labels, watermarks, signatures of ANY language

Style principles:
6. Be specific and visual (concrete objects/scenes), not abstract mood words
7. Include a clear focal point and composition direction
8. Pinterest / Behance editorial design aesthetic
9. Generate VISUAL CONCEPTS only — not translations of Korean text
10. If [USER'S VISUAL INTENT] is provided, treat it as the highest-priority subject — build the prompt around it`;

  const userPrompt = `[BOOK]
Topic (translate the concept into visuals, not the literal text): ${opts.bookTopic}
Audience: ${opts.bookAudience}
Genre: ${opts.bookType}
Theme color (use this NAME only, do NOT include any color code): ${opts.themeColorName}
${opts.headline ? `Headline (Korean — for theme context ONLY, NEVER to be drawn or rendered): "${opts.headline}"` : ""}
${userConceptBlock}

[IMAGE PURPOSE]
${purposeHint}
${templateBlock}
${styleDirectionBlock}

${ragContext}
${refinementBlock}

Now write a single English image prompt (max 100 words). Describe ONLY the visual scene. Do NOT mention aspect ratios, hex codes, dimensions, or any Korean/English text to be displayed. Start directly with the prompt — no preamble.`;

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
  // Sanitize: remove hex codes, aspect ratios, dimensions that would be rendered as text on image
  prompt = prompt
    .replace(/#?[0-9a-fA-F]{6}\b/g, "")            // hex codes (#f97316 or f97316)
    .replace(/\b\d{1,2}\s*:\s*\d{1,2}\b/g, "")     // 1:1, 16:9 etc.
    .replace(/\b\d{3,5}\s*[xX×]\s*\d{3,5}\b/g, "") // 1080x1080
    .replace(/\s{2,}/g, " ")
    .trim();
  // 무조건 강한 no-text constraint 부착 (Imagen이 종종 한국어 시도하다 깨짐)
  prompt = prompt
    .replace(/\s*WORDLESS[^.]*\.?\s*$/i, "")   // 기존 wordless 문구 제거 (중복 방지)
    + " ⚠️ ABSOLUTE NEGATIVE: No text, no letters, no numbers, no Korean characters, no Chinese characters, no Japanese characters, no English words, no captions, no labels, no signs, no logos, no symbols that resemble letters, no glyphs of any writing system. Pure abstract visual composition only. If you cannot resist drawing text, just draw a simple geometric shape instead.";

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
