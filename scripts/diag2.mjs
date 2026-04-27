import { config } from "dotenv";
import postgres from "postgres";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1 });

const PID = process.argv[2] || "af153ac0-032e-4d6e-9df7-74a845ef3e0e";
const p = await sql`SELECT id, topic, audience, jsonb_array_length(COALESCE(data->'chapters','[]'::jsonb)) AS n_ch FROM book_projects WHERE id=${PID}`;
console.log("PROJECT:", JSON.stringify(p[0] ?? "NOT FOUND"));

const ai = await sql`SELECT task, model, status, cost_krw, LEFT(error_message,200) AS err, duration_ms, created_at FROM ai_usage WHERE project_id=${PID} ORDER BY created_at DESC LIMIT 5`;
console.log("\nAI USAGE for this project:");
for (const r of ai) console.log(" ", r.task, r.model, r.status, `₩${r.cost_krw}`, r.duration_ms+"ms", r.created_at.toISOString().slice(0,19), r.err ? "ERR: "+r.err : "");

const allAi = await sql`SELECT task, model, status, cost_krw, LEFT(error_message,200) AS err, created_at FROM ai_usage ORDER BY created_at DESC LIMIT 5`;
console.log("\nALL recent AI USAGE:");
for (const r of allAi) console.log(" ", r.task, r.model, r.status, `₩${r.cost_krw}`, r.created_at.toISOString().slice(0,19), r.err ? "ERR: "+r.err : "");

await sql.end();
