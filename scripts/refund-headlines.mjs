// 표지 후킹 카피 환불 — ₩200 차감 분 + 위로금 ₩300 = ₩500 환급

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { createClient } from "@vercel/postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const TARGET_EMAIL = "qmin93@gmail.com";
const REFUND_KRW = 500;
const REASON = "표지 후킹 카피 5종 화면 미반영 환불 + 위로금";

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) { console.error("POSTGRES_URL not set"); process.exit(1); }

const client = createClient({ connectionString: url });
await client.connect();
const sql = client.sql.bind(client);

const before = await sql`
  SELECT id, email, balance_krw FROM users WHERE email = ${TARGET_EMAIL}
`;
if (before.rows.length === 0) {
  console.error(`user not found: ${TARGET_EMAIL}`);
  await client.end();
  process.exit(1);
}
const user = before.rows[0];
console.log(`Before: ${user.email} balance = ₩${Number(user.balance_krw).toLocaleString()}`);

await sql`
  UPDATE users SET balance_krw = balance_krw + ${REFUND_KRW}, updated_at = NOW()
  WHERE id = ${user.id}
`;
await sql`
  INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, reason)
  VALUES (${user.id}, 'bonus', ${REFUND_KRW}, ${Number(user.balance_krw) + REFUND_KRW}, ${REASON})
`;

const after = await sql`SELECT balance_krw FROM users WHERE id = ${user.id}`;
console.log(`After:  ${user.email} balance = ₩${Number(after.rows[0].balance_krw).toLocaleString()} (+₩${REFUND_KRW.toLocaleString()})`);
await client.end();
