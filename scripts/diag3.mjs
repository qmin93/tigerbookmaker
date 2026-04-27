import { config } from "dotenv";
import postgres from "postgres";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1 });

const projects = await sql`
  SELECT id, topic, jsonb_array_length(COALESCE(data->'chapters','[]'::jsonb)) AS n_ch, updated_at
  FROM book_projects ORDER BY updated_at DESC LIMIT 10`;
console.log("RECENT PROJECTS:");
for (const p of projects) console.log(" ", p.updated_at.toISOString().slice(0,19), p.n_ch+"ch", p.id, p.topic);

const recent = await sql`
  SELECT task, model, status, cost_krw, project_id, chapter_idx, duration_ms, created_at
  FROM ai_usage WHERE created_at > NOW() - INTERVAL '6 hours'
  ORDER BY created_at DESC`;
console.log("\nLAST 6HR AI USAGE:");
for (const r of recent) console.log(" ", r.created_at.toISOString().slice(0,19), r.task, r.status, "ch="+r.chapter_idx, "₩"+r.cost_krw, r.duration_ms+"ms", r.project_id?.slice(0,8));

await sql.end();
