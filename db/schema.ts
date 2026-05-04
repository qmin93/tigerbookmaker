// Drizzle 스키마 — db/migrations/0001_init.sql과 1:1 매핑
// NextAuth Drizzle adapter가 이 스키마를 참조

import {
  pgTable, text, timestamp, integer, uuid, boolean, decimal, primaryKey, jsonb, pgEnum,
} from "drizzle-orm/pg-core";

// ─── NextAuth 표준 ───────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  // 비즈니스 필드
  balanceKrw: integer("balance_krw").notNull().default(0),
  totalCharged: integer("total_charged").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  signupBonusGiven: boolean("signup_bonus_given").notNull().default(false),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socialLinks: jsonb("social_links").$type<Array<{ label: string; url: string }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Referral (추천 시스템 — 2026-05-04) ──
export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  totalReferred: integer("total_referred").notNull().default(0),
  totalCreditsEarned: integer("total_credits_earned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralSignups = pgTable("referral_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerUserId: uuid("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: uuid("referred_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  creditAmount: integer("credit_amount").notNull().default(2000),
  awardedAt: timestamp("awarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.identifier, t.token] }),
}));

// ─── 비즈니스 ─────────────────────────────
export const paymentStatus = pgEnum("payment_status", ["pending", "success", "failed", "refunded"]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tossKey: text("toss_key").unique(),
  orderId: text("order_id").unique().notNull(),
  amountKrw: integer("amount_krw").notNull(),
  bonusKrw: integer("bonus_krw").notNull().default(0),
  status: paymentStatus("status").notNull().default("pending"),
  method: text("method"),
  failReason: text("fail_reason"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundAmount: integer("refund_amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const taskType = pgEnum("task_type", ["toc", "chapter", "edit", "batch", "summary"]);

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  task: taskType("task").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  thoughtsTokens: integer("thoughts_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull(),
  costKrw: integer("cost_krw").notNull(),
  durationMs: integer("duration_ms"),
  projectId: uuid("project_id"),
  chapterIdx: integer("chapter_idx"),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookProjects = pgTable("book_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  audience: text("audience"),
  type: text("type"),
  targetPages: integer("target_pages").notNull().default(120),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const balanceTxType = pgEnum("balance_tx_type", ["charge", "spend", "refund", "bonus", "manual_adjust"]);

export const balanceTransactions = pgTable("balance_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: balanceTxType("type").notNull(),
  amountKrw: integer("amount_krw").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  paymentId: uuid("payment_id").references(() => payments.id),
  aiUsageId: uuid("ai_usage_id").references(() => aiUsage.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── 레퍼런스 RAG (Phase 1 — 2026-04-29) ───
export const bookReferences = pgTable("book_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => bookProjects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  sourceType: text("source_type").notNull(),  // 'pdf' | 'url' | 'text'
  sourceUrl: text("source_url"),
  totalChars: integer("total_chars").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// embedding은 Drizzle pgvector type 미지원 — raw SQL로 처리. Drizzle에선 컬럼 정의만.
export const referenceChunks = pgTable("reference_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceId: uuid("reference_id").notNull().references(() => bookReferences.id, { onDelete: "cascade" }),
  chunkIdx: integer("chunk_idx").notNull(),
  content: text("content").notNull(),
  // embedding vector(768) — Drizzle 직접 type 없음. 필요 시 raw SQL 사용
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
