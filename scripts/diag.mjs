import { config } from "dotenv";
import postgres from "postgres";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL, { ssl: "require", max: 1 });

const users = await sql`SELECT id, email, balance_krw, password_hash IS NOT NULL AS has_pw, signup_bonus_given, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 10`;
console.log("=== USERS (recent) ===");
for (const u of users) console.log(`  ${u.email.padEnd(30)} | id=${u.id.slice(0, 8)} | bal=${String(u.balance_krw).padStart(5)} | pw=${u.has_pw} | bonus=${u.signup_bonus_given} | verified=${!!u.email_verified} | ${u.created_at.toISOString().slice(0, 19)}`);

const projects = await sql`SELECT id, user_id, topic, jsonb_array_length(COALESCE(data->'chapters', '[]'::jsonb)) AS chapters, created_at FROM book_projects ORDER BY created_at DESC LIMIT 10`;
console.log("\n=== PROJECTS ===");
if (projects.length === 0) console.log("  (없음)");
for (const p of projects) console.log(`  ${p.topic.slice(0, 50).padEnd(50)} | user=${p.user_id.slice(0, 8)} | ch=${p.chapters} | ${p.created_at.toISOString().slice(0, 19)}`);

const sessions = await sql`SELECT user_id, expires FROM sessions LIMIT 5`;
console.log("\n=== SESSIONS (DB session 잔존 — JWT로 전환했으니 신규는 안 들어옴) ===");
if (sessions.length === 0) console.log("  (없음 — 정상)");
for (const s of sessions) console.log(`  user=${s.user_id.slice(0, 8)} | expires=${s.expires.toISOString().slice(0, 19)}`);

await sql.end();
