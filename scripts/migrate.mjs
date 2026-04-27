// 0001_init.sql을 Postgres에 적용
// 사용법: node scripts/migrate.mjs

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL not set");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1 });
const dir = join(__dirname, "..", "db", "migrations");
const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

for (const f of files) {
  const path = join(dir, f);
  const content = readFileSync(path, "utf8");
  console.log(`▶ ${f}`);
  try {
    // CREATE TYPE이 IF NOT EXISTS를 안 받아서 idempotent하지 않음.
    // 실패하면 statement 단위로 끊어서 시도.
    await sql.unsafe(content);
    console.log(`  ✓ applied`);
  } catch (e) {
    if (e.code === "42710" || e.code === "42P07") {
      // 이미 존재 — 부분 재적용 시 정상
      console.log(`  ⚠ skipped (already exists): ${e.message?.slice(0, 80)}`);
    } else {
      console.log(`  ✗ FAIL: ${e.message?.slice(0, 200)}`);
      // 부분 적용 위해 statement 분리 시도
      const statements = content.split(/;\s*\n/).filter(s => s.trim() && !s.trim().startsWith("--"));
      let ok = 0, skip = 0, fail = 0;
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt + ";");
          ok++;
        } catch (e2) {
          if (e2.code === "42710" || e2.code === "42P07") skip++;
          else { fail++; console.log(`     ✗ stmt fail (${e2.code}): ${e2.message?.slice(0, 100)}`); }
        }
      }
      console.log(`  → statement-by-statement: ok=${ok} skip=${skip} fail=${fail}`);
    }
  }
}

// 검증
const tables = await sql`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`;
console.log("\n현재 테이블:");
for (const t of tables) console.log(`  ${t.tablename}`);

await sql.end();
