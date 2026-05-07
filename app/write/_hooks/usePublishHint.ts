// app/write/_hooks/usePublishHint.ts
// 출간 준비 탭에 작은 주황 점 표시 여부 결정.
// 조건: 챕터 80%+ 완성됐는데 marketingMeta.tagline 없을 때.

import type { BookProject } from "@/lib/storage";

export function usePublishHint(project: BookProject | null | undefined): boolean {
  if (!project?.chapters?.length) return false;
  const completedChapters = project.chapters.filter(c => (c.content?.length ?? 0) > 100).length;
  const ratio = completedChapters / project.chapters.length;
  const hasMarketing = !!project.marketingMeta?.tagline;
  return ratio >= 0.8 && !hasMarketing;
}
