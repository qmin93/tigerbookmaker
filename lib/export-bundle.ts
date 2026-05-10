// 통합 패키지 ZIP 다운로드 — 본문(EPUB) + 표지·광고 이미지·카피·재가공 콘텐츠 등 한 번에.
// 크몽·교보·자체 배포 등록 시 그대로 업로드 가능한 풀 패키지 만들기.
//
// 클라이언트 사이드 ZIP (Vercel 4.5MB 응답 한도 회피).
// PDF는 print dialog 방식이라 binary 추출 어려움 — EPUB만 ZIP에 포함, PDF는 별도 버튼.

import JSZip from "jszip";
import type { BookProject } from "./storage";

function safeName(s: string, max = 50): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function base64ToBlob(base64: string, mime = "image/png"): Blob {
  // dataUrl prefix 떼기 (있는 경우)
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function dataUrlToBlob(dataUrl: string): Blob {
  // "data:image/png;base64,XXXX" 형식
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (m) return base64ToBlob(m[2], m[1]);
  return base64ToBlob(dataUrl, "image/png");
}

interface BundleProgress {
  current: number;
  total: number;
  label: string;
}

export async function generateBundle(
  project: BookProject,
  onProgress?: (p: BundleProgress) => void
): Promise<void> {
  const zip = new JSZip();
  const steps: Array<{ label: string; fn: () => Promise<void> | void }> = [];
  const baseName = safeName(project.topic);

  // 1. 본문 EPUB (서버에서 fetch)
  steps.push({
    label: "본문 EPUB",
    fn: async () => {
      try {
        const res = await fetch(`/api/export/epub?id=${encodeURIComponent(project.id)}`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        zip.file(`${baseName}.epub`, buf);
      } catch (e) {
        console.warn("[bundle] EPUB fetch failed:", e);
      }
    },
  });

  // 2. 표지 (kmongPackage 또는 coverVariations 첫 장)
  steps.push({
    label: "표지",
    fn: () => {
      const cover = project.kmongPackage?.images?.find(i => i.type === "cover");
      if (cover?.base64) {
        zip.file("표지/main.png", base64ToBlob(cover.base64));
        return;
      }
      const v0 = project.coverVariations?.[0];
      if (v0?.base64) {
        zip.file("표지/main.png", base64ToBlob(v0.base64));
      }
    },
  });

  // 3. 표지 다양화 5종
  if (project.coverVariations?.length) {
    steps.push({
      label: `표지 다양화 ${project.coverVariations.length}종`,
      fn: () => {
        project.coverVariations!.forEach((v, i) => {
          const styleName = safeName(v.style || `variation-${i + 1}`, 30);
          zip.file(`표지/variations/${i + 1}-${styleName}.png`, base64ToBlob(v.base64));
        });
      },
    });
  }

  // 4. 챕터별 본문 삽화
  const chaptersWithImages = project.chapters.filter(c => c.images?.some(im => im.dataUrl));
  if (chaptersWithImages.length > 0) {
    steps.push({
      label: "챕터 본문 삽화",
      fn: () => {
        chaptersWithImages.forEach((ch, ci) => {
          const idx = project.chapters.indexOf(ch);
          ch.images.forEach((im, ii) => {
            if (!im.dataUrl) return;
            const cap = safeName(im.caption || im.alt || `image-${ii + 1}`, 30);
            zip.file(`본문 삽화/${idx + 1}장/${ii + 1}-${cap}.png`, dataUrlToBlob(im.dataUrl));
          });
        });
      },
    });
  }

  // 5. Meta 광고 이미지 3비율
  if (project.metaAdImages?.length) {
    steps.push({
      label: `Meta 광고 이미지 ${project.metaAdImages.length}장`,
      fn: () => {
        project.metaAdImages!.forEach(img => {
          const ar = img.aspectRatio.replace(":", "x");
          zip.file(`Meta 광고/이미지/${img.type}-${ar}.png`, base64ToBlob(img.base64));
        });
      },
    });
  }

  // 6. 카드뉴스 인포그래픽 5장
  if (project.infographic?.slides?.length) {
    steps.push({
      label: `카드뉴스 ${project.infographic.slides.length}장`,
      fn: () => {
        project.infographic!.slides.forEach(s => {
          zip.file(`카드뉴스/${s.slideNum}.png`, base64ToBlob(s.base64));
        });
      },
    });
  }

  // 7. 강의 슬라이드
  if (project.courseSlides?.slides?.length) {
    steps.push({
      label: `강의 슬라이드 ${project.courseSlides.slides.length}장`,
      fn: () => {
        const outline: string[] = ["# 강의 슬라이드 outline", ""];
        project.courseSlides!.slides.forEach((s: any) => {
          outline.push(`## ${s.slideNum}. ${s.title ?? ""}`);
          if (s.bullets?.length) outline.push(s.bullets.map((b: string) => `- ${b}`).join("\n"));
          if (s.speakerNotes) outline.push(`> 발표 노트: ${s.speakerNotes}`);
          outline.push("");
          if (s.imageBase64) {
            zip.file(`강의 슬라이드/이미지/${s.slideNum}.png`, base64ToBlob(s.imageBase64));
          }
        });
        zip.file("강의 슬라이드/outline.md", outline.join("\n"));
      },
    });
  }

  // 8. 오디오북 WAV chunks
  if (project.audiobook?.chapters?.length) {
    steps.push({
      label: `오디오북 ${project.audiobook.chapters.length}장`,
      fn: () => {
        project.audiobook!.chapters.forEach(ch => {
          const t = safeName(ch.title, 30);
          zip.file(`오디오북/${ch.chapterIdx + 1}장-${t}.wav`, base64ToBlob(ch.wavBase64, "audio/wav"));
        });
      },
    });
  }

  // 9. 마케팅 카피 (.md)
  if (project.marketingMeta) {
    steps.push({
      label: "마케팅 카피",
      fn: () => {
        const m = project.marketingMeta!;
        const md = [
          `# 마케팅 카피`,
          ``,
          `## 한 줄 소개 (tagline)`,
          m.tagline || "(미작성)",
          ``,
          `## 상세 설명 (description)`,
          m.description || "(미작성)",
          ``,
          `## 작가 이름`,
          m.authorName || "(미작성)",
          ``,
          `## 작가 소개`,
          m.authorBio || "(미작성)",
        ].join("\n");
        zip.file("마케팅/마케팅카피.md", md);
      },
    });
  }

  // 10. Meta 광고 카피 (.md)
  if (project.metaAdPackage) {
    steps.push({
      label: "Meta 광고 카피",
      fn: () => {
        const p = project.metaAdPackage!;
        const md = [
          `# Meta(페이스북·인스타) 광고 카피`,
          ``,
          `## 헤드라인 (3종)`,
          ...p.headlines.map((h, i) => `${i + 1}. ${h}`),
          ``,
          `## 본문 (3종)`,
          ...p.primaryTexts.map((t, i) => `${i + 1}. ${t}`),
          ``,
          `## CTA 버튼 추천`,
          ...p.ctaButtons.map(c => `- ${c}`),
          ``,
          `## 타겟팅 추천`,
          `- 나이: ${p.audienceSuggestion.ageMin} ~ ${p.audienceSuggestion.ageMax}세`,
          `- 관심사: ${p.audienceSuggestion.interests.join(", ")}`,
          `- 지역: ${p.audienceSuggestion.locations.join(", ")}`,
        ].join("\n");
        zip.file("Meta 광고/카피.md", md);
      },
    });
  }

  // 11. 콘텐츠 재가공
  if (project.repurposedContent) {
    steps.push({
      label: "콘텐츠 재가공",
      fn: () => {
        const r = project.repurposedContent!;
        if (r.instagram) {
          const md = [
            `# 인스타그램 카드뉴스`,
            ``,
            `## 캡션`,
            r.instagram.caption,
            ``,
            `## 해시태그`,
            r.instagram.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" "),
            ``,
            `## 카드 (${r.instagram.cards.length}장)`,
            ...r.instagram.cards.map(c =>
              [`### ${c.slideNum}. ${c.title}`, c.body, `> 디자인 노트: ${c.designNote}`, ``].join("\n")
            ),
          ].join("\n");
          zip.file("재가공/인스타그램.md", md);
        }
        if (r.youtube) {
          zip.file("재가공/유튜브.md", JSON.stringify(r.youtube, null, 2));
        }
        if ((r as any).blog) {
          zip.file("재가공/블로그.md", JSON.stringify((r as any).blog, null, 2));
        }
        if ((r as any).email) {
          zip.file("재가공/이메일.md", JSON.stringify((r as any).email, null, 2));
        }
        if ((r as any).kakao) {
          zip.file("재가공/카카오톡.md", JSON.stringify((r as any).kakao, null, 2));
        }
      },
    });
  }

  // 12. 크몽 패키지 카피
  if (project.kmongPackage?.copy) {
    steps.push({
      label: "크몽 카피",
      fn: () => {
        const c = project.kmongPackage!.copy;
        const md = [
          `# 크몽 등록 카피 (8종)`,
          ``,
          `## 크몽 상세 페이지 메인 카피`,
          c.kmongDescription,
          ``,
          `## 강조 포인트 5개`,
          ...c.kmongHighlights.map(h => `- ${h}`),
          ``,
          `## 인스타 캡션`,
          c.instagram,
          ``,
          `## 카톡 1:1 메시지`,
          c.kakao,
          ``,
          `## 트위터/X`,
          c.twitter,
          ``,
          c.blogReview ? `## 블로그 후기\n${c.blogReview}\n` : "",
          c.youtubeDescription ? `## 유튜브 영상 설명란\n${c.youtubeDescription}\n` : "",
          c.naverCafe ? `## 네이버 카페 정보 공유 글\n${c.naverCafe}\n` : "",
        ].filter(Boolean).join("\n");
        zip.file("크몽/카피.md", md);
      },
    });
  }

  // 13. 번역본 (영/일)
  if (project.translations?.length) {
    steps.push({
      label: `번역본 ${project.translations.length}개`,
      fn: () => {
        project.translations!.forEach((t: any) => {
          const lang = t.lang || "translation";
          const txt = (t.chapters || []).map((c: any, i: number) =>
            `# ${i + 1}. ${c.title}\n\n${c.content}`
          ).join("\n\n---\n\n");
          zip.file(`번역/${lang}.md`, txt);
        });
      },
    });
  }

  // 14. README — 패키지 안내
  steps.push({
    label: "README",
    fn: () => {
      const counts = {
        chapters: project.chapters.filter(c => c.content).length,
        cover: project.kmongPackage?.images?.some(i => i.type === "cover") || (project.coverVariations?.length ?? 0) > 0,
        coverVariations: project.coverVariations?.length ?? 0,
        chapterImages: project.chapters.reduce((s, c) => s + (c.images?.filter(i => i.dataUrl).length ?? 0), 0),
        metaAdCopy: !!project.metaAdPackage,
        metaAdImages: project.metaAdImages?.length ?? 0,
        infographic: project.infographic?.slides?.length ?? 0,
        courseSlides: project.courseSlides?.slides?.length ?? 0,
        audiobook: project.audiobook?.chapters?.length ?? 0,
        marketing: !!project.marketingMeta,
        kmongCopy: !!project.kmongPackage?.copy,
        translations: project.translations?.length ?? 0,
      };
      const md = [
        `# ${project.topic}`,
        ``,
        `🐯 Tigerbookmaker 통합 패키지`,
        ``,
        `## 포함 자료`,
        `- 본문 EPUB: ${baseName}.epub (${counts.chapters}장)`,
        counts.cover ? `- 표지: 표지/main.png` : "",
        counts.coverVariations > 0 ? `- 표지 다양화 ${counts.coverVariations}종: 표지/variations/` : "",
        counts.chapterImages > 0 ? `- 챕터 본문 삽화 ${counts.chapterImages}장: 본문 삽화/` : "",
        counts.metaAdImages > 0 ? `- Meta 광고 이미지 ${counts.metaAdImages}장: Meta 광고/이미지/` : "",
        counts.metaAdCopy ? `- Meta 광고 카피: Meta 광고/카피.md` : "",
        counts.infographic > 0 ? `- 카드뉴스 ${counts.infographic}장: 카드뉴스/` : "",
        counts.courseSlides > 0 ? `- 강의 슬라이드 ${counts.courseSlides}장: 강의 슬라이드/` : "",
        counts.audiobook > 0 ? `- 오디오북 ${counts.audiobook}장 (WAV): 오디오북/` : "",
        counts.marketing ? `- 마케팅 카피: 마케팅/마케팅카피.md` : "",
        counts.kmongCopy ? `- 크몽 등록 카피 8종: 크몽/카피.md` : "",
        counts.translations > 0 ? `- 번역본 ${counts.translations}개: 번역/` : "",
        ``,
        `## 사용 안내`,
        `- 크몽·교보·예스24 등 외부 마켓에 본문 EPUB을 그대로 업로드 가능합니다.`,
        `- 표지·광고 이미지는 PNG 포맷, 마켓 등록 시 그대로 사용하세요.`,
        `- 본 자료의 저작권은 작성자에게 있으며, 무단 재배포·재판매는 금지됩니다.`,
        ``,
        `생성일: ${new Date().toISOString()}`,
        `Tigerbookmaker · tigerbookmaker.vercel.app`,
      ].filter(Boolean).join("\n");
      zip.file("README.md", md);
    },
  });

  // 실행
  for (let i = 0; i < steps.length; i++) {
    onProgress?.({ current: i + 1, total: steps.length, label: steps[i].label });
    await steps[i].fn();
  }

  // ZIP 생성 (압축 레벨 6 = 균형)
  onProgress?.({ current: steps.length, total: steps.length, label: "ZIP 압축 중..." });
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // 다운로드 트리거
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_전체패키지.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 진행률 계산 — TopHeader/Export에서 사용. 0~100 % + 항목별 위치 정보 포함.
// tab: /write의 어느 탭에 가야 만들 수 있는가
// hashAnchor: 해당 탭 안의 어느 영역인지 (스크롤 보조)
// hint: 사용자가 만들 때 보일 짧은 안내
export interface ProgressItem {
  key: string;
  label: string;
  done: boolean;
  tab: "writing" | "publish" | "extras" | "ops";
  hint: string;
}

export interface ProjectProgress {
  percent: number;
  done: number;
  total: number;
  details: ProgressItem[];
}

export function calculateProgress(project: BookProject): ProjectProgress {
  const writtenChapters = project.chapters.filter(c => c.content).length;
  const totalChapters = project.chapters.length;
  const items: ProgressItem[] = [
    {
      key: "chapters",
      label: `본문 ${writtenChapters}/${totalChapters}장`,
      done: totalChapters > 0 && writtenChapters === totalChapters,
      tab: "writing",
      hint: writtenChapters < totalChapters
        ? `${totalChapters - writtenChapters}장 더 [본문 생성] 클릭`
        : "완료",
    },
    {
      key: "cover",
      label: "표지 이미지",
      done: !!(project.kmongPackage?.images?.some(i => i.type === "cover") || project.coverVariations?.length),
      tab: "writing",
      hint: "writing 탭의 [표지 다양화 5종] 또는 [크몽 패키지 생성]에서 만들어짐",
    },
    {
      key: "marketing",
      label: "마케팅 카피",
      done: !!project.marketingMeta?.tagline,
      tab: "publish",
      hint: "publish 탭 [🤖 AI 마케팅 카피 생성] (~₩500)",
    },
    {
      key: "meta-ad-copy",
      label: "Meta 광고 카피",
      done: !!project.metaAdPackage,
      tab: "publish",
      hint: "publish 탭 [Meta 광고 카피] (₩500)",
    },
    {
      key: "meta-ad-images",
      label: "Meta 광고 이미지 3장",
      done: (project.metaAdImages?.length ?? 0) >= 3,
      tab: "publish",
      hint: "publish 탭 [Meta 광고 이미지 3장] (₩1,500)",
    },
  ];
  const done = items.filter(i => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    done,
    total: items.length,
    details: items,
  };
}
