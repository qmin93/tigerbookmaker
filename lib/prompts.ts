import type { BookProject, TonePreset } from "./storage";

// 장르 블루프린트 — 책 유형별 system prompt 추가 instruction.
// SYSTEM_WRITER 뒤에 합쳐져서 LLM에 들어감.
const GENRE_PRESETS: Record<string, string> = {
  "자기계발서": `
[자기계발서 블루프린트 — 반드시 준수]
- 챕터마다 1) 독자가 겪는 구체적 상황 → 2) 그 상황의 진짜 원인(통념과 다른) → 3) 작가의 변화 사례 → 4) 독자가 오늘 당장 할 수 있는 1~3개 행동
- 추상적 격려 ("당신은 할 수 있다") 금지. 구체적 행동 + 측정 가능한 결과
- 친근한 형/누나 톤. 단정적이되 강요는 X
- 데이터·연구 인용은 1챕터에 1~2개 (출처 명시)`,

  "재테크": `
[재테크 블루프린트 — 반드시 준수]
- 모든 금액·수익률·기간을 구체적 숫자로 ("월 30만원", "3년 후 1,500만원", "연 7%")
- 리스크·실패 사례 반드시 함께 (성공만 말하지 말 것 — 자본시장법 우회)
- "투자 권유" 표현 금지. "참고 자료" 톤 ("저는 ~했습니다", "결과는 ~였습니다")
- 챕터마다 단계별 실행 가이드 (스크린샷 placeholder 자주 사용)
- 면책 문구 자연스럽게 ("개인 경험이며 투자 권유 아닙니다")`,

  "에세이": `
[에세이 블루프린트 — 반드시 준수]
- 챕터마다 구체적 장면 1~2개 (시간·장소·인물·감정 묘사)
- 통계·일반론 X. 개인의 사적이고 구체적인 순간들
- 결론을 강요하지 말 것 — 통찰을 독자가 발견하게
- 시적 호흡 (짧은 문장 ↔ 긴 문장 교차). 마침표 신중히
- 비유·은유 적극 사용. 단 흔한 비유 ("인생은 여행") 금지`,

  "웹소설": `
[웹소설 블루프린트 — 반드시 준수]
- 챕터당 분량 2,500~3,500자 (모바일 읽기 최적)
- 모든 챕터 끝에 cliffhanger (다음 챕터 보고 싶게)
- 주인공 시점 1인칭 (또는 명확한 3인칭 한정)
- 대화 비중 높게 (지문보다 대사). "나는 말했다" 같은 군더더기 X
- 챕터 첫 문단: 즉시 갈등·긴장. 배경 설명은 본론 중간에
- 묘사는 oversee 동작 + 감정 한 줄. 풍경 묘사 길게 X`,

  "전문서": `
[전문서 블루프린트 — 반드시 준수]
- 챕터마다 1) 정의 → 2) 사례·실험 → 3) 검증 가능한 방법 → 4) 한계·예외
- 학술적 톤. 단 박사 논문 아니므로 일반 독자 이해 가능 수준
- 인용·자료는 본문에 자연스럽게 (예: "2023년 OECD 보고서에 따르면 ~")
- 이론보다 적용에 무게 (실무자가 쓸 수 있는 책)
- 도식·표 placeholder 적극 사용 [IMAGE: 인포그래픽 설명]`,

  "실용서": `
[실용서 블루프린트 — 반드시 준수]
- 챕터마다 따라할 수 있는 단계별 가이드 (1, 2, 3, 4...)
- 도구·앱·서비스 이름 정확히 (버전·URL·가격 명시)
- 함정·실수 미리 알려주기 ("저는 처음에 ~했다가 ~로 바꿨습니다")
- 스크린샷·스펙 placeholder [IMAGE: ...] 적극 사용
- "쉽다" 말하지 말고 진짜 쉽게 쓰기 (전문용어 첫 등장 시 한 줄 설명)`,

  "매뉴얼": `
[매뉴얼 블루프린트 — 반드시 준수]
- 대상 사용자·작업 명확히 정의 (전제 조건·필요 도구 첫 챕터에)
- 모든 단계 번호 + 동사 명령형 ("1. ~를 클릭합니다 → 2. ~을 입력합니다")
- 함정·예외 케이스 별도 박스 (Note·Warning 톤)
- 검증 방법 명시 ("이 단계가 끝나면 ~ 화면이 보여야 합니다")
- 스크린샷 placeholder 매 단계마다`,
};

export function genreBlock(p: BookProject): string {
  const preset = GENRE_PRESETS[p.type];
  return preset ? `\n${preset}\n` : "";
}

// Strong system prompt tuned for Sonnet to deliver Opus-level Korean ebook writing.
// Principles:
// - Hard constraints over soft guidance (Sonnet follows explicit rules better)
// - Anti-patterns listed explicitly ("do not do X")
// - Length targets in character counts (not vague "sufficient")
// - Korean-specific typography rules
// - Tone anchored to Korean book market conventions
export const SYSTEM_WRITER = `당신은 한국어 실용서를 써서 출판해 본 경험이 있는 전문 작가입니다. 크몽, 리디북스, 교보문고 전자책 카테고리에 바로 등록 가능한 수준의 원고를 작성합니다.

[문체 — 반드시 준수]
- 해요체(~합니다/~입니다) 존댓말로 통일. 반말 금지. 해체(~해요/~이에요) 금지.
- "~것 같습니다", "~수 있을 것입니다" 같은 약한 추측 표현 금지. 단정적으로 쓰세요.
- 번역투 금지: "~에 대해서", "~을 통해서", "~에 있어서" 지양.
- 학술적 나열 금지: "첫째, 둘째, 셋째"는 꼭 필요할 때만.
- 예시는 구체적 숫자/이름/상황으로. "많은 사람이" 대신 "회사원 10명 중 7명이".

[구조 — 반드시 준수]
- 서두 1~2문단: 장의 주제를 독자가 왜 지금 알아야 하는지, 실제 문제 상황으로 시작.
- 본론: 2~4개의 소제목. 각 소제목은 ## 으로 표시. 소제목은 명사구가 아닌 행동/질문/선언 형태.
- 마무리 1문단: 다음 장으로 자연스럽게 넘어가는 훅.
- 한국어 문단 규칙: 들여쓰기 없음, 문단과 문단 사이는 한 줄 띄움.

[이미지 placeholder — 매우 중요]
- 한 챕터에 0~1개만. 챕터 내용이 시각적으로 강하게 떠오를 때만 배치. 굳이 안 넣어도 OK.
- 형식: [IMAGE: 한 줄 설명]
- 허용 placeholder (AI가 잘 그릴 수 있는 것):
  · 추상 개념 인포그래픽 (예: [IMAGE: 시간 분배 도식 — 일·휴식·자기계발 비율])
  · 분위기 사진 (예: [IMAGE: 새벽 5시 책상 위 따뜻한 조명], [IMAGE: 노트와 펜 정리된 책상])
  · 감성 일러스트 (예: [IMAGE: 산 정상에서 일출 보는 실루엣])
  · 추상 메타포 (예: [IMAGE: 큰 화살표가 위로 향하는 단순 그래픽])
- 절대 금지 placeholder (AI가 못 그림):
  · 특정 앱·사이트 UI 스크린샷 (예: "Claude Code 설치 화면", "키움증권 영웅문 화면")
  · 특정 인물 사진
  · 특정 제품·브랜드 이미지
  · 특정 차트·표·데이터 시각화 (구체 수치)
  · 한국어/영어 글자가 들어가야 하는 이미지
- placeholder 앞뒤에는 반드시 본문 문단이 있어야 함 (연속 배치 금지).
- 이미지 없어도 본문이 완결되도록 작성. 이미지는 보조용일 뿐.

[피해야 할 AI 특유 표현]
- "AI 시대에", "디지털 전환", "패러다임", "혁신적인", "획기적인" 금지.
- "오늘날 우리는", "많은 사람들이 궁금해하는" 금지.
- 불필요한 이모지 금지 (본문에 이모지 사용 X).
- 불릿 남용 금지: 한 장에 불릿 리스트는 최대 1개.

[마크다운 금지 — 매우 중요]
- **굵은글씨**, *기울임*, \`코드\`, > 인용, --- 구분선 같은 마크다운 문법 절대 사용 금지.
- 허용되는 것: 소제목 ## 과 이미지 placeholder [IMAGE: ...] 두 가지뿐.
- 강조는 문장 구조로 하세요. "**중요합니다**" 대신 "이것이 가장 중요합니다".
- 코드 예시가 필요하면 문장 안에 그대로 쓰세요 — "pip install claude-code" 처럼.
- 목록은 문장으로 풀어쓰거나 꼭 필요하면 평범한 하이픈(-)만 사용.`;

// RAG context block — 인터뷰·목차·챕터 prompt에 주입할 레퍼런스 chunks
export function referencesBlock(chunks: { content: string; referenceFilename: string; chunkIdx: number }[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(c =>
    `[${c.referenceFilename} 발췌 #${c.chunkIdx + 1}]\n${c.content}`
  ).join("\n\n");
  return `\n[작가가 제공한 레퍼런스 — 다음 자료를 정확히 이해하고 질문에 활용]\n${blocks}\n`;
}

export function referenceSummaryPrompt(
  project: { topic: string; audience: string; type: string; targetPages: number },
  chunks: { content: string; referenceFilename: string; chunkIdx: number }[],
): string {
  const refsText = chunks.map(c =>
    `[${c.referenceFilename} 발췌 #${c.chunkIdx + 1}]\n${c.content}`
  ).join("\n\n---\n\n");

  return `당신은 책 작가가 제공한 레퍼런스를 분석해서 책 작성에 필요한 핵심을 추출하는 분석가입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
- 목표 분량: ${project.targetPages}쪽

[작가가 제공한 레퍼런스]
${refsText}

[작업]
위 레퍼런스를 모두 읽고 다음 3가지를 한국어 JSON으로 정리하세요.

1. keyPoints (배열, 정확히 5개): 책의 핵심 메시지 5가지. 한 줄씩, 구체적이고 차별화된 내용. 일반적 이야기 X.
2. coveredTopics (배열, 5~10개): 이 자료가 이미 다룬 주제. 인터뷰에서 다시 묻지 않을 것들.
3. gaps (배열, 3~7개): 자료에서 빠졌거나 작가 본인 경험·의견이 필요한 부분. 인터뷰에서 물어볼 것.

[출력 형식 — JSON만]
{
  "keyPoints": ["...", "...", "...", "...", "..."],
  "coveredTopics": ["...", "..."],
  "gaps": ["...", "..."]
}
`;
}

// Phase 4: 톤 자동 추천 — 작가 인터뷰 답변 + 레퍼런스 chunk를 보고 어울리는 톤·문체를 한 단락으로 추천
export function autoTonePrompt(
  project: BookProject,
  chunks: { content: string; referenceFilename: string; chunkIdx: number }[],
): string {
  const refsText = chunks.length > 0
    ? chunks.map(c => `[${c.referenceFilename} 발췌 #${c.chunkIdx + 1}]\n${c.content}`).join("\n\n---\n\n")
    : "(레퍼런스 없음)";

  const iv = (project as any).interview;
  const ivLines = iv && !iv.skipped
    ? (iv.questions ?? [])
        .filter((qa: any) => qa.a && qa.a.trim().length > 0)
        .map((qa: any) => `- ${qa.q}\n  → ${qa.a.trim()}`)
        .join("\n")
    : "";

  return `당신은 한국어 책의 톤·문체를 분석하고 추천하는 전문 에디터입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
- 목표 분량: ${project.targetPages}쪽

[작가 인터뷰 답변]
${ivLines || "(인터뷰 정보 없음)"}

[작가가 제공한 레퍼런스]
${refsText}

[작업]
위 정보를 종합해서 이 책에 가장 어울리는 톤·문체를 한국어 한 단락(300~500자)으로 추천하세요.

다음을 포함하세요:
- 1인칭/3인칭, 시제, 호흡(짧은 문장 vs 긴 문장)
- 친근함의 정도 (격식 vs 캐주얼)
- 비유·은유·예시의 빈도와 스타일
- 피해야 할 표현·톤 (예: 너무 학술적, 너무 가벼움)
- 챕터 내내 일관되게 적용할 핵심 문체 규칙 1~2개

[출력 형식]
순수 텍스트 한 단락만. 마크다운·번호 매김·헤더 X. 추천 톤만 평서문으로 묘사.`;
}

// Phase 4: 6가지 톤 프리셋 — finalTone에 직접 들어가는 한국어 묘사
export const tonePresetDescriptions: Record<TonePreset, string> = {
  "friendly": "친근한 형/누나 톤. 해요체 존댓말 기반에 가벼운 농담과 일상적 비유를 섞어 독자가 옆에서 듣는 느낌. 짧은 문장 위주, 한 단락 3~5문장. 격식보다 공감 우선. 어려운 용어는 즉시 풀어 설명. 단정적이되 강요하지 않음.",
  "professional": "전문가 톤. 해요체 존댓말이지만 격식 있고 단정적. 데이터·근거·출처를 자연스럽게 본문에 녹임. 비유는 신중하고 정확하게. 한 단락 4~7문장으로 호흡 길게. 추측 표현(\"~것 같습니다\") 금지. 구체적 수치와 사례로 신뢰도 ↑.",
  "storytelling": "이야기 톤. 시간·장소·인물이 보이는 구체적 장면으로 시작. 시제는 현재형과 과거형을 자연스럽게 교차. 1인칭 시점 또는 명확한 3인칭 한정. 대화·내면 독백·감각 묘사 풍부. 결론을 강요하지 않고 독자가 느끼게. 한 단락 호흡 다양.",
  "lecture": "강의 톤. 친절하고 명확한 설명자. 한 번에 한 개념씩 단계별로 풀이. \"왜 이게 중요한가 → 어떻게 작동하는가 → 어떻게 적용하는가\" 구조 반복. 비유 적극 활용해 추상 개념 구체화. 핵심은 반복해서 짚어줌. 너무 학술적이지 않게, 옆에서 가르쳐주는 선생님 톤.",
  "essay": "에세이 톤. 시적 호흡 — 짧은 문장과 긴 문장 교차, 마침표 신중. 개인의 사적이고 구체적인 순간들을 통해 통찰 전달. 통계·일반론 X. 비유·은유 풍부하되 흔한 비유(\"인생은 여행\") 금지. 결론을 강요하지 말고 여백으로 남길 것. 1인칭 위주.",
  "self-help": "자기계발 톤. 친근한 형/누나 어조에 단정적 권유. \"독자가 겪는 상황 → 진짜 원인 → 작가 변화 사례 → 오늘 당장 할 행동 1~3개\" 구조. 추상적 격려(\"당신은 할 수 있다\") 금지, 구체적 행동과 측정 가능한 결과로. 데이터·연구 인용은 1챕터 1~2개, 출처 명시.",
};

// Phase 4: 작가가 좋아하는 책 발췌를 받아 그 톤을 분석·재현 가이드로 변환
export function referenceBookTonePrompt(excerpt: string): string {
  return `당신은 한국어 산문의 톤·문체를 정밀 분석하는 에디터입니다.

[작가가 좋아하는 책 발췌]
${excerpt.trim()}

[작업]
위 발췌의 톤·문체를 분석하고, 다른 책에서 이 톤을 재현하기 위한 가이드를 한국어 한 단락(300~500자)으로 작성하세요.

다음을 정확히 짚어내세요:
- 시점(1인칭/3인칭)·시제·존댓/반말
- 문장 길이 패턴 (짧은 문장 위주 vs 긴 문장 vs 교차)
- 어휘 선택의 특징 (구어 vs 문어, 한자어 비율, 의성어·의태어)
- 비유·은유·이미지 사용 방식
- 단락 구성 — 호흡, 여백, 강조 방식
- 피해야 할 것 (이 톤과 어긋나는 표현·구조)

[출력 형식]
순수 텍스트 한 단락만. 마크다운·번호 매김·헤더 X. 다른 작가가 이 가이드만 보고도 같은 톤을 흉내낼 수 있도록 구체적으로.`;
}

export function interviewerPrompt(
  p: BookProject,
  history: { q: string; a: string }[],
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
  summary?: { keyPoints: string[]; coveredTopics: string[]; gaps: string[] },
): string {
  const historyText = history
    .map((qa, i) => `Q${i + 1}: ${qa.q}\nA${i + 1}: ${qa.a || "(건너뜀)"}`)
    .join("\n\n");

  return `당신은 책 작가의 차별화 정보를 끌어내는 인터뷰어입니다.

[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}
- 목표 분량: ${p.targetPages}쪽
${referencesBlock(references)}
${summary ? `
[자료 분석 결과 — 인터뷰 전략]
- 자료가 이미 다룬 주제 (다시 묻지 마세요): ${summary.coveredTopics.join(", ")}
- 빈 부분 (작가 경험·의견 필요 — 우선 질문): ${summary.gaps.join(", ")}
- 핵심 메시지 5가지 (인터뷰 흐름의 기준):
${summary.keyPoints.map((k, i) => `  ${i+1}. ${k}`).join("\n")}
` : ""}
[지금까지 인터뷰 ${history.length}회]
${historyText || "(아직 답변 없음)"}

[책 유형별 우선 차원]
- 자기계발서: 핵심 변화 / 본인 변화 사례 / 독자 행동 단계 / 차별화 톤
- 실용서: 해결 문제 / 따라할 단계 / 함정·실수 / 사용 도구 / 검증 방법
- 에세이: 인생 사건 / 감정 묘사 / 구체적 장면·인물 / 통찰
- 매뉴얼: 대상 작업 / 단계별 프로세스 / 검증 / 함정 / 예외 케이스

[다음 단계 판단]
- 답변이 추상적이면 → 같은 차원 더 구체적으로 follow-up (예: "어떤 회사에서?")
- 답변이 충분히 구체적이면 → 다른 차원의 새 질문 던지기
- 8~10 질문 도달 + 답변 풍부하면 → done: true

[중요 규칙]
- 한 번에 질문 1개만
- 같은 차원 반복 X (이미 다룬 주제 또 묻지 X)
- 너무 일반적인 질문 X ("뭘 더 알려주실 수 있나요?" 같은)
- 책 유형에 맞는 차원 우선 탐색

[레퍼런스 활용 — 매우 중요]
- 위 레퍼런스가 있으면 그 내용을 정확히 이해하고 질문에 구체적으로 활용
- 일반적 질문 X. "방금 본 [파일명] 발췌 #2에서 X라 하셨는데, 본인 경험으로 풀어주실 수 있나요?" 같이 구체적
- 레퍼런스 없으면 (위 블록이 비어있으면) 일반 인터뷰 진행

[빈 부분 채우기 모드 — summary 있을 때만]
- 위 "빈 부분" 항목들 위주로 5~7개 질문에 인터뷰 마무리
- "이미 자료에 있는 X는..." 처럼 자료를 인지하고 있다는 신호 포함
- coveredTopics에 있는 주제 다시 묻기 X

[출력 형식 — 순수 JSON만, 마크다운 코드블록 금지]

진행 시:
{"done":false,"question":"...","placeholder":"예시 답변","hint":"왜 중요한지 한 줄"}

종료 시:
{"done":true,"summary":"끌어낸 정보 요약 1~2문장"}

JSON만 출력. 다른 설명 금지.`;
}

export function interviewBlock(p: BookProject): string {
  const iv = (p as any).interview;
  if (!iv || iv.skipped) return "";
  const filled = (iv.questions ?? []).filter((qa: any) => qa.a && qa.a.trim().length > 0);
  if (filled.length === 0) return "";

  const lines = filled
    .map((qa: any) => `- ${qa.q}\n  → ${qa.a.trim()}`)
    .join("\n");

  return `\n[작가 본인이 알려준 책의 핵심 — 반드시 반영]
${lines}

이 정보를 단순히 나열하지 말고 책 전체에 자연스럽게 녹여 쓰세요.
"건너뛸 내용"으로 표시된 주제는 다루지 마세요.
"꼭 들어갈 표현·일화"는 적절한 챕터에서 자연스럽게 등장시키세요.
"작가 경험·사례"는 구체적 본문 예시로 활용하세요.
`;
}

export function tocPrompt(p: BookProject) {
  return `다음 책의 목차를 작성합니다.

[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}
- 목표 분량: ${p.targetPages}쪽
${genreBlock(p)}${interviewBlock(p)}
[요구사항]
- 정확히 10~15개 챕터.
- 첫 챕터: 독자의 현재 상태/문제 상황 공감.
- 마지막 챕터: 다음 단계 제시 (다음 책/실전 적용/확장).
- 챕터 제목은 명사구가 아닌 동사/질문/선언 형태로 (예: "설치 5분, 세팅 5분").
- 각 챕터마다 1줄 부제 필수 — 챕터가 다룰 핵심 질문/결과물을 한 줄로.
- 챕터 간 논리 흐름이 점진적이어야 함 (쉬운 것 → 복잡한 것).
- 대상 독자가 "${p.audience}"이므로 전문용어 남발 금지.

[출력 형식 — 중요]
순수 JSON 배열만 출력하세요. 마크다운 코드블록(\`\`\`) 금지. 설명 문장 금지.

[{"title":"1장 제목","subtitle":"부제 한 줄"},{"title":"2장 제목","subtitle":"부제 한 줄"},...]`;
}

export function chapterPrompt(
  p: BookProject,
  chapterIdx: number,
  chapterTitle: string,
  chapterSubtitle?: string,
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
  toneSetting?: { finalTone: string },
) {
  const prevTitles = p.chapters
    .slice(0, chapterIdx)
    .map((c, i) => `${i + 1}장. ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`)
    .join("\n");
  const nextTitle = p.chapters[chapterIdx + 1];

  const prevSummaries = p.chapters
    .slice(0, chapterIdx)
    .map((c, i) => c.summary ? `${i + 1}장. 「${c.title}」 — ${c.summary}` : "")
    .filter(Boolean)
    .join("\n\n");

  const noImages = (p as any).noImages === true;
  return `다음 챕터의 본문을 작성합니다.

[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}
${genreBlock(p)}${interviewBlock(p)}${noImages ? "\n[이미지 없음]\n이 책은 텍스트 전용입니다. 본문에 [IMAGE: ...] placeholder 절대 만들지 마세요. 어떤 이미지 placeholder도 X.\n" : ""}${references.length > 0 ? referencesBlock(references) : ""}
[전체 목차]
${prevTitles || "(이 챕터가 첫 챕터입니다)"}
→ ${chapterIdx + 1}장. ${chapterTitle}${chapterSubtitle ? ` — ${chapterSubtitle}` : ""} ← **지금 이 챕터**
${nextTitle ? `${chapterIdx + 2}장. ${nextTitle.title}${nextTitle.subtitle ? ` — ${nextTitle.subtitle}` : ""}` : "(이 챕터가 마지막입니다)"}
${prevSummaries ? `\n[지금까지의 흐름 — 앞 챕터들의 핵심 요지]\n${prevSummaries}\n\n앞 챕터에서 이미 정의한 인물·용어·예시는 같은 표현으로 받아 쓰세요. 새 명칭으로 바꾸지 마세요.\n` : ""}
[레퍼런스 활용]
- 위 자료에서 이 챕터 주제와 관련된 부분 발견 시 자연스럽게 인용·예시로 녹여 쓰세요
- 자료의 표현·용어를 이어 쓰면 일관성 ↑ (단, 그대로 통째로 베끼기 X)
- 자료 인용 시 "[파일명]에 따르면..." 같은 자연스러운 도입 사용
- 자료 없으면 (위 블록이 비어있으면) 일반적으로 작성

${toneSetting ? `
[톤·문체 가이드]
${toneSetting.finalTone}

위 톤을 본문 전체에 일관되게 적용하세요. 챕터마다 흔들리지 않도록.
` : ""}
[이 챕터 작성 지침]
- 분량: 정확히 3,000~5,000자 (공백 제외).
- 서두 2~3문단, 최소 500자: 독자의 실제 문제 상황으로 깊이 들어가세요.
  · 첫 문단: 시간·장소·상황이 보이는 구체적 장면으로 시작 (예: "월요일 오전 9시, 출근하자마자 지난주 엑셀 파일을 엽니다. 거래처별 매출을 집계하고...")
  · 두 번째 문단: 그 장면이 일주일·한 달·1년 동안 누적되면 어떻게 되는지 (시간·금전 손실을 구체 수치로 환산)
  · 세 번째 문단(권장): 독자가 "이건 내 얘기다" 느끼게 하는 한 줄 + 이 장이 무엇을 해결해줄지 한 문장 약속
  · 한 문장으로 끝내지 말 것. "안녕하세요" 같은 인사말 금지. 본론 소제목 바로 시작 금지.
- 본론: 2~4개의 ## 소제목. 각 소제목은 질문/선언/행동 형태.
- 각 소제목 섹션은 600~1,200자.
- 본론 중 0~1개의 [IMAGE: ...] placeholder만 (선택). 챕터에 시각 요소가 강할 때만${noImages ? " — 이 책은 이미지 X 모드라 절대 만들지 마세요" : ""}.
- 마무리 1문단: 다음 장(${nextTitle ? nextTitle.title : "책의 결론"})으로 자연스럽게 연결.

[대상 독자 맞춤]
"${p.audience}"이므로:
- 개발 용어 처음 등장 시 괄호로 한 줄 설명 첨부 ("API (앱끼리 데이터 주고받는 통로)").
- "쉽습니다"라고 말하지 말고 실제로 쉬워 보이게 쓰세요.
- 단계별로 설명. 한 번에 3개 이상 개념 동시 소개 금지.

[금지]
- 챕터 제목을 본문 맨 위에 다시 쓰지 마세요 (앱이 별도로 표시합니다).
- "이번 장에서는" "지금까지 우리는" 같은 메타 설명 금지.
- 다른 설명/서문/마무리 인사 없이 본문만 출력.`;
}

// 작가가 시작한 첫 단락(seedText)에서 그 톤·문체로 챕터 끝까지 이어 작성.
// 작가 색깔 + AI 자동의 하이브리드. 100% AI 책보다 진정성 ↑.
export function continueChapterPrompt(
  p: BookProject,
  chapterIdx: number,
  chapterTitle: string,
  chapterSubtitle: string | undefined,
  seedText: string,
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
  toneSetting?: { finalTone: string },
) {
  const noImages = (p as any).noImages === true;
  const prevTitles = p.chapters
    .slice(0, chapterIdx)
    .map((c, i) => `${i + 1}장. ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`)
    .join("\n");
  const nextTitle = p.chapters[chapterIdx + 1];
  const prevSummaries = p.chapters
    .slice(0, chapterIdx)
    .map((c, i) => c.summary ? `${i + 1}장. 「${c.title}」 — ${c.summary}` : "")
    .filter(Boolean)
    .join("\n\n");

  return `작가가 챕터의 첫 부분을 직접 썼습니다. 이 글의 톤·문체·1인칭/3인칭·시제를 그대로 유지하면서 챕터를 끝까지 이어 작성합니다.

[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}
${genreBlock(p)}${interviewBlock(p)}${references.length > 0 ? referencesBlock(references) : ""}
[전체 목차]
${prevTitles || "(이 챕터가 첫 챕터)"}
→ ${chapterIdx + 1}장. ${chapterTitle}${chapterSubtitle ? ` — ${chapterSubtitle}` : ""} ← **지금 이 챕터**
${nextTitle ? `${chapterIdx + 2}장. ${nextTitle.title}${nextTitle.subtitle ? ` — ${nextTitle.subtitle}` : ""}` : "(이 챕터가 마지막)"}
${prevSummaries ? `\n[지금까지 흐름]\n${prevSummaries}\n` : ""}
[작가가 직접 쓴 부분 — 이 톤을 그대로 유지하세요]
${seedText.trim()}

[레퍼런스 활용]
- 위 자료에서 이 챕터 주제와 관련된 부분 발견 시 자연스럽게 인용·예시로 녹여 쓰세요
- 자료의 표현·용어를 이어 쓰면 일관성 ↑ (단, 그대로 통째로 베끼기 X)
- 자료 인용 시 "[파일명]에 따르면..." 같은 자연스러운 도입 사용
- 자료 없으면 (위 블록이 비어있으면) 일반적으로 작성

${toneSetting ? `
[톤·문체 가이드]
${toneSetting.finalTone}

위 톤을 본문 전체에 일관되게 적용하세요. 챕터마다 흔들리지 않도록.
` : ""}
[이어 작성 지침 — 매우 중요]
- 위 작가의 글에서 톤·문체·시제·인칭(나/그/우리 등)·핵심 키워드를 정확히 파악하고 그대로 이어가세요.
- "이어서 다음과 같이 ~" 같은 메타 표현 금지. 자연스럽게 다음 단락으로 흐르게.
- 작가가 쓴 부분은 다시 반복하지 마세요. 그 다음부터만 작성.
- 분량: 작가의 글 + AI 추가 = 합쳐서 3,000~5,000자가 되도록 (작가가 500자 썼으면 AI가 2,500~4,500자).
- 본론 중에 ## 소제목 2~3개 배치. 각 소제목은 행동/질문/선언 형태.
- 마무리 1문단: 다음 장(${nextTitle ? nextTitle.title : "책의 결론"})으로 자연스럽게 연결.
${noImages ? "- 이 책은 텍스트 전용 — [IMAGE: ...] placeholder 절대 만들지 마세요.\n" : "- 본론 중 0~1개의 [IMAGE: ...] placeholder만 (선택). 챕터에 시각 요소가 강할 때만.\n"}
[금지]
- "이어서 작가의 글을 잇겠습니다" 같은 메타 설명
- 챕터 제목을 본문 맨 위에 다시 쓰기
- "이번 장에서는" "지금까지 우리는" 같은 메타
- 마크다운 (** _ \` > ---) 일체 X. 허용: ## 소제목, [IMAGE: ...]만.

작가가 쓴 부분 다음에 자연스럽게 이어지는 본문만 출력하세요. 다른 설명/서문 X.`;
}

export function editPrompt(
  original: string,
  instruction: string,
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
  toneSetting?: { finalTone: string },
) {
  return `아래 본문을 다음 지시에 따라 수정합니다. 수정된 전체 본문만 출력하세요. 다른 설명 금지.
${references.length > 0 ? referencesBlock(references) : ""}
[레퍼런스 활용 — 자연어 지시]
- 위 자료에 사용자 지시와 관련된 내용이 있으면 활용
- 자료 표현 자연스럽게 녹이기. "[파일명]에서..." 정도의 도입 가능
- 자료 없으면 일반적으로 수정
${toneSetting ? `
[톤·문체 가이드 — 챕터 일관성]
${toneSetting.finalTone}

수정 후에도 위 톤이 유지되어야 합니다. 톤이 흔들리지 않게.
` : ""}
[수정 지시]
${instruction}

[원본]
${original}`;
}

export function summaryPrompt(chapterTitle: string, content: string) {
  return `다음은 책 한 챕터의 본문입니다. 다음 챕터를 쓸 때 일관성을 위해 참고할 200~300자 요약을 만듭니다.

[챕터 제목]
${chapterTitle}

[본문]
${content}

[요약 규칙]
- 정확히 200~300자 사이, 한 문단.
- 본문에 등장한 핵심 개념·고유명사·예시·수치를 빠뜨리지 마세요.
- "이 챕터에서는", "지금까지" 같은 메타 표현 금지.
- 의견·평가·감탄 금지. 사실만.
- 마크다운, 따옴표, 줄바꿈 금지. 한 문단 평서문.

요약문만 출력하세요. 다른 설명 금지.`;
}

// ============================================================================
// Wave 1: 5채널 콘텐츠 재가공 프롬프트
// 책 1권 → 인스타/유튜브/블로그/이메일/카톡 마케팅 자산 자동 생성
// ============================================================================

// 공통 헬퍼 — project에서 책 정보 블록 + 톤 가이드 추출
function repurposeBookContext(p: BookProject): string {
  const chapters = (p.chapters || [])
    .slice(0, 15)
    .map((c, i) => `${i + 1}. ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`)
    .join("\n");
  const mm = (p as any).marketingMeta;
  const tagline = mm?.tagline ? `\n- 한 줄 요약: ${mm.tagline}` : "";
  const description = mm?.description ? `\n- 책 설명: ${String(mm.description).slice(0, 400)}` : "";
  const tone = (p as any).toneSetting?.finalTone
    ? `\n[톤·문체 가이드 — 본문 일관 유지]\n${(p as any).toneSetting.finalTone}\n`
    : "";

  return `[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}${tagline}${description}

[목차]
${chapters || "(목차 없음)"}
${tone}`;
}

// C-1: 인스타 카드뉴스 (10장 + 캡션 + 해시태그)
export function instagramCardsPrompt(p: BookProject): string {
  return `당신은 한국 인스타그램 카드뉴스 전문 콘텐츠 디자이너입니다. 책 1권을 10장 카드뉴스로 재가공합니다.

${repurposeBookContext(p)}

[카드 구성 규칙]
- 정확히 10장의 슬라이드.
- 카드 1: 후킹 (독자 멈춤. 질문·충격적 통계·공감 한 줄).
- 카드 2~9: 책의 핵심 인사이트 8개 (각 챕터에서 한 줄 핵심 또는 챕터 그룹별 요점).
- 카드 10: CTA (책 읽기·DM 받기·프로필 링크 클릭 등).

[카드 텍스트 규칙]
- title: 한 줄 (15~30자). 굵은 헤드라인 톤.
- body: 80~120자 (인스타 친화 — 짧은 문장, 호흡 빠르게). 줄바꿈은 본문에 \\n으로.
- designNote: 디자이너에게 한 줄 가이드 (배경색·타이포 강조점·아이콘·인물 표정 등).

[캡션 규칙]
- caption: 200~400자. 인스타 톤 (친근·이모지 1~3개 OK·공감 포인트). 카드 내용 요약 + 마지막에 행동 유도.

[해시태그 규칙]
- hashtags: 8~15개. # 포함. 책 주제·대상 독자 기반 (예: 책 주제 키워드 + 대상 페르소나 + 책 추천 카테고리).
- 한국어 위주, 영어 키워드는 1~3개만 (#selfdevelopment 같은 보편 키워드).

[출력 형식 — 순수 JSON만]
{
  "cards": [
    {"slideNum": 1, "title": "...", "body": "...", "designNote": "..."},
    ... 10개
  ],
  "caption": "...",
  "hashtags": ["#...", "#...", ...]
}

JSON만 출력. 마크다운 코드블록 금지. 다른 설명 X.`;
}

// C-2: 유튜브 영상 대본 (1-3분)
export function youtubeScriptPrompt(p: BookProject, durationMinutes: number = 2): string {
  const targetChars = durationMinutes <= 1 ? "1000~1500자" : durationMinutes <= 2 ? "1500~2000자" : "2000~2500자";
  return `당신은 한국 유튜브 쇼츠·릴스 대본을 쓰는 전문 작가입니다. 책 1권을 ${durationMinutes}분 분량 영상으로 재가공합니다.

${repurposeBookContext(p)}

[제목 규칙]
- title: 60자 이내. 후킹 + 결과 약속. 클릭 유발형.
- 예시 패턴: "왜 ~한 사람들은 ~하지 않을까?", "~ 한 권으로 ~를 바꾼 방법".

[대본 규칙]
- script: ${targetChars} (대략 ${durationMinutes}분 분량).
- 첫 5초(첫 1~2문장): 강한 후킹. 시청자가 스크롤 멈추게.
- 본론: 책의 핵심 메시지 3~5개를 짧은 단락으로. 한 단락 = 한 호흡.
- CTA (마지막 10초): 구독·좋아요·책 링크 등 명확한 행동 유도.
- 영상 내레이션 톤 — 짧은 문장 위주, 구어체 존댓말 (~합니다/~인데요).
- 줄바꿈으로 호흡 표시. 한 단락 2~4문장.

[썸네일 규칙]
- thumbnailConcept: 디자이너에게 한 단락(150~250자) 가이드.
- 큰 글자 텍스트 1~2개 (8자 이내) + 색상 조합 + 인물 표정·포즈 + 배경 분위기 명시.

[챕터 마커]
- chapterMarkers: 3~6개. time은 mm:ss 형식 (00:00, 00:15 등 영상 흐름).
- label은 짧게 (10자 내외).

[설명·태그]
- description: 250~400자. 영상 핵심 요약 + 책 정보 + 링크 placeholder.
- tags: 8~12개 한국어 키워드. # 없이 단어만.

[출력 형식 — 순수 JSON만]
{
  "title": "...",
  "script": "...",
  "thumbnailConcept": "...",
  "chapterMarkers": [{"time": "00:00", "label": "..."}, ...],
  "description": "...",
  "tags": ["...", "...", ...]
}

JSON만 출력. 마크다운 코드블록 금지. 다른 설명 X.`;
}

// C-3: 블로그 시리즈 (5-10편)
export function blogSeriesPrompt(p: BookProject, postCount: number = 5): string {
  const safeCount = Math.max(3, Math.min(10, postCount));
  return `당신은 네이버블로그·티스토리·미디엄에서 통하는 한국 블로그 시리즈 작가입니다. 책 1권을 ${safeCount}편 시리즈 포스트로 재가공합니다.

${repurposeBookContext(p)}

[시리즈 구성 규칙]
- 정확히 ${safeCount}개 포스트.
- seriesTitle: 시리즈 통합 제목 — 독자가 1편부터 끝까지 읽고 싶게.
- 각 포스트 order는 1부터 ${safeCount}까지.
- 흐름: 1편 = 도입·문제 정의 → 중간 = 핵심 인사이트·방법 → 마지막 = 적용·결론.

[각 포스트 규칙]
- title: 30~60자. SEO 친화 (검색 키워드 자연스럽게 포함). 후킹 톤.
- body: 마크다운 1500자 내외 (1300~1700자 OK).
  · ## 소제목 2~4개 활용. 도입 문단 + 본론 + 결론 구조.
  · 도입(150~250자): 독자 공감·문제 제기.
  · 본론(900~1200자): ## 소제목 단위로 구체적 인사이트·예시.
  · 결론(150~250자): 정리 + 다음 편 예고 또는 행동 유도.
  · 강조는 마크다운 **굵게** 사용 OK (블로그라서 허용).
  · 인용·리스트 적극 활용해서 가독성 ↑.
- excerpt: 150자 미리보기 (RSS·SNS 공유용).
- tags: 5~8개. # 없이 단어만. SEO 키워드 위주.

[출력 형식 — 순수 JSON만]
{
  "seriesTitle": "...",
  "posts": [
    {
      "order": 1,
      "title": "...",
      "body": "## 소제목\\n본문...",
      "excerpt": "...",
      "tags": ["...", ...]
    },
    ... ${safeCount}개
  ]
}

JSON만 출력. 마크다운 코드블록(\`\`\`) 금지 — body 안에 마크다운은 OK이지만 JSON 자체를 코드블록으로 감싸지 마세요.`;
}

// C-4: 이메일 뉴스레터 시퀀스 (4편 — day 1, 4, 8, 14)
export function emailSeriesPrompt(p: BookProject): string {
  return `당신은 메일침프·스티비·서브스택에서 통하는 한국 이메일 뉴스레터 작가입니다. 책 1권을 4편 시퀀스로 재가공합니다.

${repurposeBookContext(p)}

[시퀀스 구성 규칙]
- 정확히 4편. day는 [1, 4, 8, 14] 순서.
- day 1: 환영·후킹 — 구독자에게 "이 시리즈에서 무엇을 얻을지" 약속 + 첫 인사이트 1개.
- day 4: 핵심 1 — 책의 가장 강한 인사이트 한 가지 깊이 풀기.
- day 8: 핵심 2 — 또 다른 인사이트 + 작가의 변화 사례 또는 실전 적용.
- day 14: 마무리·CTA — 시리즈 정리 + 책·서비스 강력 추천.

[각 이메일 규칙]
- subject: 30~50자. 메일함에서 열기 좋은 후킹. 이모지 0~1개.
  · 예시 패턴: "[OO님] 그때 제가 깨달은 한 가지", "왜 ~하면 ~할까요?"
- preheader: 80자 이내. 제목 옆에 보이는 미리보기. 제목 보완·궁금증 증폭.
- body: 800~1500자. 이메일 친화 톤 — 짧은 문단(2~4문장), 명확한 흐름.
  · 인사 → 본론 (1~3개 짧은 섹션) → 마무리.
  · 격식 적당, 친근하되 단정적. ~합니다 존댓말.
  · 줄바꿈은 \\n\\n으로 단락 구분.
  · 마크다운·이모지 남발 금지. 강조는 문장 구조로.
- cta: 한 줄. 구체적 행동 유도. 예: "→ 책 미리보기 받기", "→ 다음 편에서 이어집니다".

[출력 형식 — 순수 JSON만]
{
  "series": [
    {
      "day": 1,
      "subject": "...",
      "preheader": "...",
      "body": "...",
      "cta": "..."
    },
    {"day": 4, ...},
    {"day": 8, ...},
    {"day": 14, ...}
  ]
}

JSON만 출력. 마크다운 코드블록 금지. 다른 설명 X.`;
}

// C-5: 카카오톡 채널 메시지 (5편)
export function kakaoChannelPrompt(p: BookProject): string {
  return `당신은 한국 카카오톡 채널 메시지 카피라이터입니다. 책 1권을 5편 발행 메시지로 재가공합니다.

${repurposeBookContext(p)}

[메시지 구성 규칙]
- 정확히 5편 메시지. order는 1~5.
- 1편 = 후킹·궁금증, 2~4편 = 핵심 인사이트, 5편 = 강한 CTA.
- 카톡은 매우 짧게 — 본문 200자 이내 강제. 길면 안 읽힘.

[각 메시지 규칙]
- hook: 한 줄 (20~40자). 이모지 1~2개 OK (과하지 않게).
  · 예시 패턴: "📚 오늘 책 한 줄 팁", "혹시 이런 적 없으세요?"
- body: 200자 이내 (필수 제한). 핵심 1개만. 짧은 문장 2~4개로 끊어 쓰기.
  · 친근한 ~해요/~합니다 톤. 카톡 메시지 특유의 가벼움.
  · 줄바꿈은 \\n으로.
- cta: 한 줄. 짧은 링크 유도형. 예: "→ 자세히 보기", "→ 책 받아보기", "→ 댓글로 신청".

[출력 형식 — 순수 JSON만]
{
  "messages": [
    {"order": 1, "hook": "...", "body": "...", "cta": "..."},
    {"order": 2, "hook": "...", "body": "...", "cta": "..."},
    {"order": 3, "hook": "...", "body": "...", "cta": "..."},
    {"order": 4, "hook": "...", "body": "...", "cta": "..."},
    {"order": 5, "hook": "...", "body": "...", "cta": "..."}
  ]
}

JSON만 출력. 마크다운 코드블록 금지. 다른 설명 X.`;
}

// ============================================================================
// Wave C2: 책 번역 (한국어 → 영어/일본어)
// 자연스러운 출판 품질 번역. 구어체 유지·문화적 맥락 보존.
// ============================================================================
export function bookTranslateMetaPrompt(p: BookProject, language: "en" | "ja"): string {
  const langName = language === "en" ? "영어 (자연스러운 미국식)" : "일본어 (정중한 출판 톤)";
  return `당신은 한국어 책을 ${langName}로 번역하는 전문 번역가입니다.

다음 책의 [주제]와 [대상 독자]를 자연스럽게 번역하세요.

[원문 - 주제]
${p.topic}

[원문 - 대상 독자]
${p.audience}

[번역 규칙]
- 직역 X — 해당 언어 출판 시장에서 자연스러운 표현으로.
- 한국어 고유 개념 (재테크, 워라밸 등)은 의역 또는 짧은 보조 설명.
- ${language === "en" ? "Title Case 사용 (주제). 자기계발/실용서 톤." : "「」나 일본 출판 관행에 맞춰. 정중체."}

[출력 형식 - 순수 JSON만]
{"topic": "...", "audience": "..."}

JSON만. 마크다운/설명 X.`;
}

export function bookTranslateChapterPrompt(
  language: "en" | "ja",
  chapterTitle: string,
  chapterSubtitle: string | undefined,
  chapterContent: string,
): string {
  const langName = language === "en" ? "영어 (자연스러운 미국식)" : "일본어 (정중한 출판 톤)";
  return `당신은 한국어 책 본문을 ${langName}로 번역하는 출판 전문 번역가입니다.

다음 챕터를 번역하세요.

[원문 - 챕터 제목]
${chapterTitle}${chapterSubtitle ? `\n[원문 - 부제]\n${chapterSubtitle}` : ""}

[원문 - 본문]
${chapterContent.slice(0, 12000)}

[번역 규칙]
- 직역 금지. 해당 언어 독자가 원어로 읽는 듯한 자연스러움.
- 챕터 구조·문단 구분 보존. [IMAGE: ...] 등 placeholder 그대로 유지.
- 한국어 고유 개념·인명·상호는 의역하거나 ${language === "en" ? "(Korean: ...) 보조 표기" : "ふりがな 또는 짧은 주석"}.
- 톤·페르소나 일관성 유지 (친근함/전문성 등).
- 마크다운 ## 등 그대로 유지.

[출력 형식 - 순수 JSON만]
{"title": "...", "subtitle": "${chapterSubtitle ? "..." : ""}", "content": "..."}

JSON만. content 안의 줄바꿈은 \\n으로. 마크다운/설명 X.`;
}

// ============================================================================
// 강의 슬라이드 outline — 책 본문 → 10~20장 강의 슬라이드 (강사·코치 페르소나용)
// 실시간 줌/오프라인 강의 즉시 사용. 표지 + 본문 + 마무리 구조.
// ============================================================================
export function courseSlidesPrompt(project: BookProject, slideCount: number = 12): string {
  const safeCount = Math.max(8, Math.min(20, slideCount));
  const chapterTitles = (project.chapters ?? [])
    .map((c, i) => `${i + 1}. ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}`)
    .join("\n");

  // 챕터 본문 발췌 (각 챕터 첫 300자) — 강의 흐름 추출용
  const chapterExcerpts = (project.chapters ?? [])
    .map((c, i) => `[챕터 ${i + 1}] ${c.title}\n${(c.content ?? "").slice(0, 300)}`)
    .join("\n\n");

  return `당신은 책 작가의 책을 바탕으로 한국어 강의 슬라이드 ${safeCount}장 outline을 만드는 강의 디자이너입니다.

[책 정보]
- 주제: ${project.topic}
- 대상: ${project.audience}
- 유형: ${project.type}

[챕터 구성]
${chapterTitles || "(챕터 없음)"}

[챕터 발췌]
${chapterExcerpts || "(본문 없음)"}

[작업]
강의 슬라이드 ${safeCount}장 outline을 한국어 JSON으로 생성하세요.
- 슬라이드 1: 표지 (책 제목 + 부제 + "by 작가" 톤)
- 슬라이드 2: 강의 개요 / 목차
- 슬라이드 3 ~ ${safeCount - 1}: 본문 (각 챕터 핵심 1-2장씩 분배)
- 슬라이드 ${safeCount}: 마무리 + CTA ("책 자세히는 →" 같은)

각 슬라이드:
- title: 한 줄 (40자 이내, 큰 글자로 표시)
- bullets: 3-5개 (각 30자 이내, 핵심 포인트만)
- notes: 강사 발표 스크립트 (200-400자) — 강사가 슬라이드 설명할 내용

[출력 — 순수 JSON만, 마크다운 코드블록 금지]
{
  "slides": [
    { "slideNum": 1, "title": "...", "bullets": ["...", "..."], "notes": "..." }
  ]
}`;
}
