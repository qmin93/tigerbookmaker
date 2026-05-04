// POST /api/reference/upload
// FormData (PDF / DOCX / Image) 또는 JSON ({type: url|text|youtube})
// 응답: { id, chunkCount, totalChars }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { extractPdfText } from "@/lib/server/pdf-parser";
import { extractDocxText } from "@/lib/server/docx-parser";
import { extractImageText } from "@/lib/server/image-ocr";
import { extractUrlText } from "@/lib/server/url-extractor";
import { extractYoutubeTranscript } from "@/lib/server/youtube-extractor";
import { chunkText } from "@/lib/server/chunker";
import { embedBatch } from "@/lib/server/embeddings";
import { rateLimit } from "@/lib/server/rate-limit";
import { getUser, logAIUsage, deductBalance } from "@/lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;  // 10MB
const MAX_DOCX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB (Gemini inline_data 한도 고려)
const MAX_TEXT_LENGTH = 500_000;          // 500k 글자
const MAX_CHUNKS = 1000;
// 가격 정책 (Sang-nim 10x 인상, 2026-05): 이미지 OCR ₩200
const OCR_COST_KRW = 200;
const OCR_MIN_BALANCE = 200;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`ref-upload:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const contentType = req.headers.get("content-type") || "";
    let projectId: string;
    let sourceType: "pdf" | "url" | "text" | "docx" | "youtube" | "image";
    let sourceUrl: string | null = null;
    let filename: string;
    let rawText: string;

    if (contentType.includes("multipart/form-data")) {
      // 파일 업로드 (PDF / DOCX / 이미지)
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      projectId = String(formData.get("projectId") ?? "");
      if (!file || !projectId) return NextResponse.json({ error: "INVALID_INPUT", message: "file과 projectId 필요" }, { status: 400 });

      const fileType = file.type || "";
      const fileName = file.name || "";
      const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
      const isDocx = fileType.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx");
      const isImage = fileType.startsWith("image/");

      if (isPdf) {
        if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE", message: "PDF는 10MB 이하만 가능" }, { status: 400 });
        const buf = new Uint8Array(await file.arrayBuffer());
        try {
          rawText = await extractPdfText(buf);
        } catch (e: any) {
          return NextResponse.json({ error: "PDF_PARSE_FAILED", message: `PDF 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        sourceType = "pdf";
        filename = fileName;
      } else if (isDocx) {
        if (file.size > MAX_DOCX_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE", message: "DOCX는 10MB 이하만 가능" }, { status: 400 });
        const buf = Buffer.from(await file.arrayBuffer());
        try {
          rawText = await extractDocxText(buf);
        } catch (e: any) {
          return NextResponse.json({ error: "DOCX_PARSE_FAILED", message: `DOCX 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        sourceType = "docx";
        filename = fileName;
      } else if (isImage) {
        if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE", message: "이미지는 8MB 이하만 가능" }, { status: 400 });
        // Balance check before OCR
        const user = await getUser(userId);
        if (!user || user.balance_krw < OCR_MIN_BALANCE) {
          return NextResponse.json({ error: "INSUFFICIENT_BALANCE", message: `OCR 약 ₩${OCR_COST_KRW} 필요 (현재 ₩${user?.balance_krw ?? 0})` }, { status: 402 });
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const t0 = Date.now();
        try {
          rawText = await extractImageText(buf, fileType || "image/jpeg");
        } catch (e: any) {
          // 실패 로그 + 차감 안 함
          await logAIUsage({
            userId, task: "edit", model: "gemini-2.5-flash",
            inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0,
            costUSD: 0, costKRW: 0,
            durationMs: Date.now() - t0,
            projectId, status: "failed",
            errorMessage: e?.message?.slice(0, 500),
          }).catch(() => {});
          return NextResponse.json({ error: "OCR_FAILED", message: `이미지 OCR 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        // 성공 시 로그 + 차감
        const log = await logAIUsage({
          userId, task: "edit", model: "gemini-2.5-flash",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0.02, costKRW: OCR_COST_KRW,
          durationMs: Date.now() - t0,
          projectId, status: "success",
        });
        await deductBalance({ userId, amountKRW: OCR_COST_KRW, aiUsageId: log.id, reason: "이미지 OCR" });
        sourceType = "image";
        filename = fileName;
      } else {
        return NextResponse.json({ error: "UNSUPPORTED_FORMAT", message: `지원하지 않는 파일 형식: ${fileType || fileName}` }, { status: 400 });
      }
    } else {
      // JSON: { projectId, type, url?, text? }
      const body = await req.json().catch(() => ({}));
      projectId = String(body.projectId ?? "");
      const type = body.type;
      if (!projectId || !["url", "text", "youtube"].includes(type)) {
        return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
      }
      if (type === "url") {
        const url = String(body.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "INVALID_INPUT", message: "url 필요" }, { status: 400 });
        try {
          const r = await extractUrlText(url);
          rawText = r.text;
          filename = r.title;
          sourceUrl = url;
        } catch (e: any) {
          return NextResponse.json({ error: "URL_FETCH_FAILED", message: `URL 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        sourceType = "url";
      } else if (type === "youtube") {
        const url = String(body.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "INVALID_INPUT", message: "url 필요" }, { status: 400 });
        try {
          const r = await extractYoutubeTranscript(url);
          rawText = r.text;
          filename = r.title;
          sourceUrl = url;
        } catch (e: any) {
          return NextResponse.json({ error: "YOUTUBE_FETCH_FAILED", message: `YouTube 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        sourceType = "youtube";
      } else {
        const text = String(body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "INVALID_INPUT", message: "text 필요" }, { status: 400 });
        if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "TEXT_TOO_LONG", message: `${MAX_TEXT_LENGTH}자 이하` }, { status: 400 });
        rawText = text;
        filename = `텍스트 메모 — ${new Date().toLocaleString("ko-KR")}`;
        sourceType = "text";
      }
    }

    // 프로젝트 권한 검증
    const { rows: projRows } = await sql`
      SELECT id FROM book_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;
    if (projRows.length === 0) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
    }

    if (rawText.length < 50) {
      return NextResponse.json({ error: "TEXT_TOO_SHORT", message: "최소 50자 필요" }, { status: 400 });
    }
    if (rawText.length > MAX_TEXT_LENGTH) {
      rawText = rawText.slice(0, MAX_TEXT_LENGTH);
    }

    // chunk
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return NextResponse.json({ error: "NO_CHUNKS" }, { status: 400 });
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({ error: "TOO_MANY_CHUNKS", message: `${MAX_CHUNKS} chunk 한도 초과 (현재 ${chunks.length})` }, { status: 400 });
    }

    // book_references row 먼저 INSERT
    const { rows: refRows } = await sql<{ id: string }>`
      INSERT INTO book_references (project_id, user_id, filename, source_type, source_url, total_chars, chunk_count)
      VALUES (${projectId}, ${userId}, ${filename}, ${sourceType}, ${sourceUrl}, ${rawText.length}, ${chunks.length})
      RETURNING id
    `;
    const refId = refRows[0].id;

    // embedding (순차) + chunks INSERT
    let embedded = 0;
    try {
      const vectors = await embedBatch(chunks, (done, total) => {
        embedded = done;
      });
      // bulk INSERT — pgvector vector literal
      for (let i = 0; i < chunks.length; i++) {
        const vec = `[${vectors[i].join(",")}]`;
        await sql`
          INSERT INTO reference_chunks (reference_id, chunk_idx, content, embedding)
          VALUES (${refId}, ${i}, ${chunks[i]}, ${vec}::vector)
        `;
      }
    } catch (e: any) {
      // embedding 실패 시 reference row 삭제 (cascade로 chunks도)
      await sql`DELETE FROM book_references WHERE id = ${refId}`;
      return NextResponse.json({
        error: "EMBEDDING_FAILED",
        message: `Embedding 실패 (${embedded}/${chunks.length} 처리됨): ${e?.message?.slice(0, 200)}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: refId,
      filename,
      sourceType,
      chunkCount: chunks.length,
      totalChars: rawText.length,
    });
  } catch (e: any) {
    console.error("[/api/reference/upload]", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
