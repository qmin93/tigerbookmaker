// NextAuth v5 (Auth.js beta) — 이메일 매직링크 인증
// Resend로 메일 발송. Drizzle adapter로 users/sessions DB 저장.

import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/nodemailer";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { Resend } from "resend";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens, balanceTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isDisposableEmail } from "@/lib/server/rate-limit";

// 베타 환영 크레딧 — 이메일 인증 후 지급 (어뷰즈 방지).
// 매직링크/Google: events.createUser에서 자동 (verify된 가입이라 즉시 OK)
// 비밀번호 가입: 첫 매직링크 verify 시 signIn callback에서 지급
const SIGNUP_BONUS_KRW = 1000;

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? "missing");
  return _resend;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as any) as any,
  providers: [
    // Google OAuth — 가장 빠른 가입 (한 번 클릭)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),

    // 이메일 + 비밀번호 (한국에서 가장 익숙)
    CredentialsProvider({
      id: "credentials",
      name: "Email + Password",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const { rows } = await import("@vercel/postgres").then(m => m.sql<{
          id: string; email: string; name: string | null; image: string | null; password_hash: string | null;
        }>`SELECT id, email, name, image, password_hash FROM users WHERE email = ${email}`);
        const u = rows[0];
        if (!u || !u.password_hash) return null;
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return null;
        return { id: u.id, email: u.email, name: u.name ?? undefined, image: u.image ?? undefined };
      },
    }),

    // 이메일 매직링크 (백업)
    EmailProvider({
      server: { host: "smtp.resend.com", port: 465, auth: { user: "resend", pass: process.env.RESEND_API_KEY ?? "" } },
      from: process.env.EMAIL_FROM ?? "Tigerbookmaker <noreply@tigerbookmaker.com>",
      async sendVerificationRequest({ identifier: email, url, provider }) {
        await getResend().emails.send({
          from: provider.from as string,
          to: email,
          subject: "Tigerbookmaker 로그인 링크",
          html: emailTemplate(url),
        });
      },
    }),
  ],
  // Credentials provider 호환을 위해 JWT 전략 사용
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 365, // 1년 — stay logged in
    updateAge: 60 * 60 * 24,    // 하루마다 세션 갱신
  },
  pages: { signIn: "/login", verifyRequest: "/login?check=email" },
  events: {
    async createUser({ user }) {
      // 회원가입 시 1,000원 크레딧 자동 지급
      if (!user.id) return;
      try {
        await db.update(users)
          .set({ balanceKrw: SIGNUP_BONUS_KRW, signupBonusGiven: true })
          .where(eq(users.id, user.id));
        await db.insert(balanceTransactions).values({
          userId: user.id,
          type: "bonus",
          amountKrw: SIGNUP_BONUS_KRW,
          balanceAfter: SIGNUP_BONUS_KRW,
          reason: "베타 환영 크레딧 (책 3권)",
        });
      } catch (e) {
        console.error("[signup-bonus] failed", e);
      }
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // 1회용 이메일 도메인 차단 (어뷰즈 방지)
      if (user.email && isDisposableEmail(user.email)) {
        console.warn("[signin] disposable email blocked:", user.email);
        return false;
      }
      // 비밀번호로 가입한 사용자가 매직링크 verify 첫 클릭 시 베타 보너스 지급.
      // (events.createUser는 NextAuth가 새 user 생성할 때만 호출 — 비번 가입자는 우리 register route가
      //  직접 INSERT 했으므로 호출 안 됨. signIn callback이 첫 verify 시점이라 여기서 지급.)
      if (account?.provider === "email" && user.email) {
        try {
          const { rows } = await import("@vercel/postgres").then(m => m.sql<{
            id: string; signup_bonus_given: boolean;
          }>`SELECT id, signup_bonus_given FROM users WHERE email = ${user.email!.toLowerCase()}`);
          const u = rows[0];
          if (u && !u.signup_bonus_given) {
            await db.update(users)
              .set({ balanceKrw: SIGNUP_BONUS_KRW, signupBonusGiven: true })
              .where(eq(users.id, u.id));
            await db.insert(balanceTransactions).values({
              userId: u.id,
              type: "bonus",
              amountKrw: SIGNUP_BONUS_KRW,
              balanceAfter: SIGNUP_BONUS_KRW,
              reason: "베타 환영 크레딧 (책 3권 — 이메일 인증 완료)",
            });
          }
        } catch (e) {
          console.error("[verify-bonus] failed", e);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // 첫 로그인 시 user.id를 token에 박아둠
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as any).id = token.uid;
      }
      return session;
    },
  },
});

function emailTemplate(url: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: 'Pretendard', system-ui, sans-serif; background: #f9fafb; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; border: 1px solid #f0f0f0;">
    <div style="font-size: 24px; margin-bottom: 24px;">🐯 <strong>Tigerbookmaker</strong></div>
    <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 12px;">로그인 링크</h1>
    <p style="color: #4b5563; margin: 0 0 24px;">아래 버튼을 눌러 Tigerbookmaker에 로그인하세요. 이 링크는 24시간 동안 유효합니다.</p>
    <a href="${url}" style="display: inline-block; padding: 14px 28px; background: #f97316; color: white; text-decoration: none; font-weight: bold; border-radius: 12px;">로그인</a>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">버튼이 작동하지 않으면 아래 링크를 복사해 주소창에 붙여넣으세요:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${url}</p>
    <p style="color: #d1d5db; font-size: 11px; margin-top: 24px; border-top: 1px solid #f0f0f0; padding-top: 16px;">본인이 요청하지 않은 경우 이 메일을 무시해도 됩니다.</p>
  </div>
</body>
</html>
  `.trim();
}
