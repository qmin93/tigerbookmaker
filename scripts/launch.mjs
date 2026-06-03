#!/usr/bin/env node
// scripts/launch.mjs — 5분 런칭 키트
// 사용: node scripts/launch.mjs
//
// 자동 처리:
//   1. .env.local 환경변수 점검 (필수/선택 구분)
//   2. preorders 관련 마이그레이션 0017, 0018 적용 여부 확인 + 미적용시 자동 적용
//   3. Resend / Toss / Gemini 키 유무 출력 (없는 건 후순위 작업으로 안내)
//   4. /preorder 빌드 결과 안내
//   5. PR 머지 + Vercel production 배포 안내 (수동)
//   6. Threads 5포스트 발행 캘린더 출력
//
// 안전: 파괴적 작업 없음. 실패 시 명확한 메시지 + exit 1.

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const cwd = process.cwd();
const HR = "─".repeat(60);

function step(n, title) {
  console.log(`\n${HR}\nSTEP ${n} · ${title}\n${HR}`);
}
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }
function info(msg) { console.log(`  · ${msg}`); }

const required = ["POSTGRES_URL"];
const recommended = ["RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET", "ADMIN_EMAILS"];
const optional = ["GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"];

// ─── STEP 1 ─────────────────────────────
step(1, "환경변수 점검 (.env.local)");

let envOk = true;
for (const k of required) {
  if (process.env[k]) ok(`${k} 설정됨`);
  else { fail(`${k} 없음 — POSTGRES_URL 또는 POSTGRES_URL_NON_POOLING 필요`); envOk = false; }
}
for (const k of recommended) {
  if (process.env[k]) ok(`${k} 설정됨`);
  else warn(`${k} 없음 — 5일 이메일 시퀀스/관리자/cron 동작에 필요`);
}
for (const k of optional) {
  if (process.env[k]) ok(`${k} 설정됨 (선택)`);
  else info(`${k} 없음 (선택 — 베타에는 영향 없음)`);
}

if (!envOk) {
  console.log(`\n.env.local 에 POSTGRES_URL 부터 채우고 다시 실행하세요.`);
  console.log(`Vercel Postgres 대시보드 → "Show secret" → .env.local 에 붙여넣기.`);
  process.exit(1);
}

// ─── STEP 2 ─────────────────────────────
step(2, "DB 마이그레이션 0017 + 0018 적용");

const pgUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;

const client = new pg.Client({ connectionString: pgUrl });
try {
  await client.connect();
  ok("Postgres 연결 성공");

  async function hasTable(name) {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [name]
    );
    return rows.length > 0;
  }

  async function applyMig(file, table) {
    if (await hasTable(table)) {
      ok(`${table} 이미 존재 — skip`);
      return;
    }
    const path = resolve(cwd, file);
    if (!existsSync(path)) {
      fail(`${file} 파일 없음`);
      throw new Error("MIGRATION_FILE_MISSING");
    }
    const sql = readFileSync(path, "utf8");
    await client.query(sql);
    ok(`${file} 적용 완료 → ${table} 생성됨`);
  }

  await applyMig("db/migrations/0017_preorders.sql", "preorders");
  await applyMig("db/migrations/0018_preorder_sequence_log.sql", "preorder_sequence_log");

  // 카운트 확인
  const { rows: [cnt] } = await client.query(`SELECT COUNT(*)::int AS n FROM preorders`);
  info(`현재 preorders 행 수: ${cnt.n}`);
} catch (e) {
  fail(`마이그레이션 실패: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}

// ─── STEP 3 ─────────────────────────────
step(3, "5일 이메일 시퀀스 준비도");

if (process.env.RESEND_API_KEY) {
  ok("RESEND_API_KEY 있음 — Day 0 즉시 답장 + Day 1-5 cron 작동 가능");
} else {
  warn("RESEND_API_KEY 없음 — 이메일 발송 불가");
  info("Resend 가입 → API 키 발급 → .env.local + Vercel 환경변수에 추가");
  info("도메인 인증 (managerkim.com 추천) → EMAIL_FROM 변경");
}
if (process.env.CRON_SECRET) {
  ok("CRON_SECRET 있음 — Vercel Cron 인증 작동");
} else {
  warn("CRON_SECRET 없음 — Vercel 환경변수에 랜덤 문자열 추가 권장");
  info("예: openssl rand -base64 32");
}

// ─── STEP 4 ─────────────────────────────
step(4, "PR & 배포");

info("tigerbookmaker PR: https://github.com/qmin93/tigerbookmaker/pull/47");
info("managerkim PR:    https://github.com/jaychalling/managerkim/pull/167");
info("");
info("머지 순서 (수동):");
info("  1. tigerbookmaker PR #47 머지 → Vercel auto deploy → 사전예약 라이브");
info("  2. managerkim PR #167 머지 → Vercel auto deploy → /docs/ai-ebook-30min 라이브");
info("");
info("배포 후 확인 URL:");
info("  · https://tigerbookmaker.vercel.app/preorder (사전예약)");
info("  · https://tigerbookmaker.vercel.app/admin/preorders (관리자, ADMIN_EMAILS 필요)");
info("  · https://managerkim.com/docs/ai-ebook-30min (SEO 가이드)");

// ─── STEP 5 ─────────────────────────────
step(5, "Threads 5포스트 발행 캘린더");

info("초안: tigerbookmaker/docs/marketing/threads-launch-5posts.md");
info("");
info("권장 발행 시간: 평일 21:00");
const now = new Date();
const day = now.getDay(); // 0=Sun 1=Mon ... 6=Sat
let nextMon = new Date(now);
const daysUntilMon = (8 - day) % 7 || 7;
nextMon.setDate(now.getDate() + daysUntilMon);
nextMon.setHours(21, 0, 0, 0);
const dayLabels = ["월", "화", "수", "목", "금"];
for (let i = 0; i < 5; i++) {
  const d = new Date(nextMon);
  d.setDate(nextMon.getDate() + i);
  const titles = [
    "포스트 1 — 실패담 (ChatGPT 2주 통째)",
    "포스트 2 — 잘못된 믿음 (AI 잡 글 X)",
    "포스트 3 — 결점 인정 (디자인 못 함)",
    "포스트 4 — 양극화 (AI 표절 X)",
    "포스트 5 — 직접 후크 (사전예약 링크)",
  ];
  info(`  ${d.getMonth() + 1}/${d.getDate()} (${dayLabels[i]}) 21:00 — ${titles[i]}`);
}

// ─── STEP 6 ─────────────────────────────
step(6, "인터뷰 5명 진행");

info("스크립트: tigerbookmaker/research/day4-5-interviews/interview-script.md");
info("빈 노트: notes-01.md ~ notes-05.md");
info("");
info("진행 후 Day 7 결정문 v2 채우기:");
info("  tigerbookmaker/research/day7-decision-v2.md");

// ─── FINISH ─────────────────────────────
console.log(`\n${HR}\n✓ 런칭 키트 완료. PR 머지 → 트래픽 시작 → 인터뷰 진행 순.\n${HR}\n`);
