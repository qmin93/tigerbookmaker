// query → embedding → vector search → top-N chunks
// pgvector cosine distance 사용 (1 - cosine similarity, 작을수록 유사)

import { sql } from "@vercel/postgres";
import { embed } from "./embeddings";

export interface RagChunk {
  content: string;
  referenceFilename: string;
  chunkIdx: number;
  distance: number;  // 0~2 (cosine, 작을수록 유사)
}

export async function ragSearch(opts: {
  projectId: string;
  query: string;
  topN?: number;
  maxDistance?: number;  // 이 거리 초과 chunk는 결과에서 제외
}): Promise<RagChunk[]> {
  const { projectId, query, topN = 5, maxDistance = 0.7 } = opts;

  const queryEmbedding = await embed(query);
  // pgvector vector literal: '[0.1,0.2,...]'
  const vec = `[${queryEmbedding.join(",")}]`;

  const { rows } = await sql<{
    content: string;
    filename: string;
    chunk_idx: number;
    distance: number;
  }>`
    SELECT
      rc.content,
      br.filename,
      rc.chunk_idx,
      rc.embedding <=> ${vec}::vector AS distance
    FROM reference_chunks rc
    JOIN book_references br ON br.id = rc.reference_id
    WHERE br.project_id = ${projectId}
      AND rc.embedding IS NOT NULL
    ORDER BY distance
    LIMIT ${topN}
  `;

  return rows
    .filter(r => Number(r.distance) <= maxDistance)
    .map(r => ({
      content: r.content,
      referenceFilename: r.filename,
      chunkIdx: r.chunk_idx,
      distance: Number(r.distance),
    }));
}

// prompt 주입용 — chunks를 마크다운 블록으로 포맷
export function formatRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(c =>
    `--- [${c.referenceFilename} #${c.chunkIdx + 1}]\n${c.content}\n`
  );
  return `\n[작가가 제공한 레퍼런스 — 참고 자료]\n${blocks.join("\n")}\n`;
}
