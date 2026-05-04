// GET /api/chapter/[idx]/chunks?projectId=...
// 챕터 title/subtitle을 query로 ragSearch 다시 실행 → 챕터 주제와 의미적으로 가까운 chunks 반환.
// 주의: 챕터 본문 생성 시 사용된 chunks를 저장하지 않으므로, 이는 "참고했을 가능성이 높은" 근사치임.
// 응답: { chunks: [{ filename, chunkIdx, content, distance }] }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject } from "@/lib/server/db";
import { ragSearch, hasReferences } from "@/lib/server/rag";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { idx: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "projectId 누락" }, { status: 400 });
  }

  const chapterIdx = Number(params.idx);
  if (!Number.isInteger(chapterIdx) || chapterIdx < 0) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "chapterIdx 형식 오류" }, { status: 400 });
  }

  // ownership 체크 (getProject가 user_id 매치 안 되면 null 반환)
  const projectRow = await getProject(projectId, userId);
  if (!projectRow) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const project: any = projectRow.data ?? {};
  const chapters: any[] = Array.isArray(project.chapters) ? project.chapters : [];
  const ch = chapters[chapterIdx];
  if (!ch) {
    return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
  }

  // references 없으면 빈 배열 반환 (UI 측에서 버튼 자체를 안 보이지만 방어)
  const refsExist = await hasReferences(projectId);
  if (!refsExist) {
    return NextResponse.json({ chunks: [] });
  }

  // chapter title + subtitle을 query로 사용
  const query = [ch.title ?? "", ch.subtitle ?? ""].filter(Boolean).join(" — ").trim();
  if (!query) {
    return NextResponse.json({ chunks: [] });
  }

  const chunks = await ragSearch({
    projectId,
    query,
    topN: 5,
    maxDistance: 0.7,
  });

  return NextResponse.json({
    chunks: chunks.map(c => ({
      filename: c.referenceFilename,
      chunkIdx: c.chunkIdx,
      content: c.content,
      distance: c.distance,
    })),
  });
}
