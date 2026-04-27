import { config } from "dotenv";
import postgres from "postgres";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1 });

const PID = process.argv[2];
if (!PID) {
  console.error("usage: node scripts/diag-summary.mjs <project-id>");
  process.exit(1);
}

const rows = await sql`
  SELECT id, topic, data->'chapters' AS chapters
  FROM book_projects WHERE id = ${PID}
`;
if (!rows.length) { console.error("project not found"); await sql.end(); process.exit(1); }

const { topic, chapters } = rows[0];
console.log(`PROJECT: ${topic} (${chapters.length} chapters)\n`);

for (let i = 0; i < chapters.length; i++) {
  const c = chapters[i];
  const cLen = (c.content || "").length;
  const sLen = (c.summary || "").length;
  const status = !c.summary ? "MISSING" : sLen < 150 ? "SHORT" : sLen > 400 ? "LONG" : "OK";
  console.log(`  ${i+1}장 [${status}] content=${cLen}자 summary=${sLen}자 — ${c.title}`);
  if (c.summary && c.summary.length > 0) {
    console.log(`     "${c.summary.slice(0, 120)}${c.summary.length > 120 ? '...' : ''}"`);
  }
}

const usage = await sql`
  SELECT task, COUNT(*) AS n, SUM(cost_krw)::int AS total_krw
  FROM ai_usage WHERE project_id = ${PID}
  GROUP BY task ORDER BY task
`;
console.log("\nCOST BY TASK:");
for (const r of usage) console.log(`  ${r.task}: ${r.n}회, ₩${r.total_krw}`);

await sql.end();
