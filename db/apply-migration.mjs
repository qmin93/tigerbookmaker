// 마이그레이션 SQL을 Postgres에 적용
// usage: node db/apply-migration.mjs db/migrations/0001_init.sql

import { readFileSync, existsSync } from "fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const file = process.argv[2] || "db/migrations/0001_init.sql";
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}
const sql = readFileSync(file, "utf8");

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING 또는 POSTGRES_URL 환경변수 없음");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  console.log(`연결 성공. 마이그레이션 적용 중: ${file}`);
  await client.query(sql);
  console.log("✓ 적용 완료");
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name
  `);
  console.log("\n생성된 테이블:");
  rows.forEach(r => console.log(`  - ${r.table_name}`));
} catch (e) {
  console.error("✗ 실패:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
