// POST /api/export/epub
// body: { projectId }
// 응답: { ok, base64 }  ← 클라이언트가 다운로드 트리거

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject } from "@/lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 30;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^---+$/gm, "");
}

function renderChapterHtml(content: string, images: any[]): string {
  const parts = content.split(/(\[IMAGE:[^\]]+\])/);
  return parts.map(part => {
    if (part.startsWith("[IMAGE:")) {
      const img = images.find((i: any) => i.placeholder === part);
      if (img?.dataUrl) {
        return `<div style="text-align:center;margin:1em 0"><img src="${img.dataUrl}" style="max-width:100%;height:auto" alt="${escapeHtml(img.caption || "")}" />${img.caption ? `<p style="font-size:0.85em;color:#666;margin-top:0.3em">${escapeHtml(img.caption)}</p>` : ""}</div>`;
      }
      return "";
    }
    const cleaned = stripMarkdown(part);
    return cleaned.split("\n").map(rawLine => {
      const line = rawLine.trim();
      if (!line) return "";
      if (line.startsWith("## ")) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line.startsWith("### ")) return `<h4>${escapeHtml(line.slice(4))}</h4>`;
      if (line.startsWith("- ") || line.startsWith("* ")) return `<p>· ${escapeHtml(line.slice(2))}</p>`;
      if (/^\d+\.\s/.test(line)) return `<p>${escapeHtml(line)}</p>`;
      return `<p>${escapeHtml(line)}</p>`;
    }).join("\n");
  }).join("\n");
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const chapters = project.chapters
      .filter((ch: any) => ch.content)
      .map((ch: any, i: number) => ({
        title: `${i + 1}장. ${ch.title}`,
        content: `${ch.subtitle ? `<p style="font-style:italic;color:#666;margin-bottom:1.5em">${escapeHtml(ch.subtitle)}</p>` : ""}${renderChapterHtml(ch.content, ch.images || [])}`,
      }));

    if (chapters.length === 0) {
      return NextResponse.json({ error: "NO_CONTENT", message: "작성된 챕터가 없습니다." }, { status: 400 });
    }

    const kPkg = (project as any).kmongPackage;
    const coverImg = kPkg?.images?.find((i: any) => i.type === "cover");
    const coverDataUrl = coverImg ? `data:image/png;base64,${coverImg.base64}` : undefined;

    // dynamic import — Node-only library
    const epubMod: any = await import("epub-gen-memory");
    const epubFn = epubMod.default;

    const options: any = {
      title: project.topic,
      author: "Tigerbookmaker",
      description: `${project.audience} 대상 ${project.type}. AI 자동 집필.`,
      lang: "ko",
      publisher: "Tigerbookmaker",
      cover: coverDataUrl,
      css: `
        body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.7; }
        h1, h2, h3, h4 { font-weight: 700; line-height: 1.3; }
        h3 { font-size: 1.3em; margin-top: 1.5em; margin-bottom: 0.8em; color: #0a0a0a; }
        h4 { font-size: 1.1em; margin-top: 1.2em; }
        p { margin-bottom: 1em; text-align: justify; word-break: keep-all; }
      `.trim(),
    };

    const buf: Buffer = await epubFn(options, chapters);
    const base64 = buf.toString("base64");

    return NextResponse.json({
      ok: true,
      base64,
      filename: `${project.topic.slice(0, 50).replace(/[^\w가-힣\s]/g, "")}.epub`,
    });
  } catch (e: any) {
    console.error("[/api/export/epub] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
