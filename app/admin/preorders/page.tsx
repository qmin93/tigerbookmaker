// /admin/preorders — 사전예약 신청자/시퀀스 현황 대시보드
// ADMIN_EMAILS 환경변수 안에 본인 이메일 있어야 함

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(email?: string | null): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());
  return !!email && list.includes(email.toLowerCase());
}

interface PreorderRow {
  id: string;
  email: string;
  icp_signal: string | null;
  intent: string;
  amount_won: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
}

interface StepSummary {
  step: number;
  sent: number;
  failed: number;
}

interface ICPSummary {
  icp_signal: string | null;
  cnt: number;
}

async function getData() {
  const [preordersRes, summaryRes, icpRes] = await Promise.all([
    sql<PreorderRow>`
      SELECT id, email, icp_signal, intent, amount_won, utm_source, utm_campaign, created_at::text
      FROM preorders
      ORDER BY created_at DESC
      LIMIT 200
    `,
    sql<StepSummary>`
      SELECT step,
        COUNT(*) FILTER (WHERE failed_at IS NULL)::int AS sent,
        COUNT(*) FILTER (WHERE failed_at IS NOT NULL)::int AS failed
      FROM preorder_sequence_log
      GROUP BY step
      ORDER BY step
    `,
    sql<ICPSummary>`
      SELECT icp_signal, COUNT(*)::int AS cnt
      FROM preorders
      GROUP BY icp_signal
      ORDER BY cnt DESC
    `,
  ]);

  const total = preordersRes.rows.length;
  const paidIntent = preordersRes.rows.filter((r) => r.intent === "paid_intent").length;
  const avgPaidIntent =
    preordersRes.rows
      .filter((r) => r.intent === "paid_intent" && r.amount_won)
      .reduce((s, r) => s + (r.amount_won ?? 0), 0) / Math.max(1, paidIntent);

  return {
    preorders: preordersRes.rows,
    stepSummary: summaryRes.rows,
    icpSummary: icpRes.rows,
    total,
    paidIntent,
    avgPaidIntent,
  };
}

const ICP_LABELS: Record<string, string> = {
  kmong_seller: "크몽 셀러",
  side_writer: "블로그·뉴스레터",
  coach: "1인 코치",
  other: "기타",
};

const STEP_LABELS: Record<number, string> = {
  0: "즉시 답장",
  1: "Day 1 — 무대 설정",
  2: "Day 2 — 페인포인트",
  3: "Day 3 — 깨달음",
  4: "Day 4 — 변화",
  5: "Day 5 — 오픈",
};

export default async function AdminPreordersPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/admin/preorders");
  }
  if (!isAdmin(session.user.email)) {
    return (
      <main style={{ padding: 80, textAlign: "center", fontFamily: "Pretendard, system-ui" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>접근 권한이 없습니다</h1>
        <p style={{ marginTop: 16, color: "#666" }}>
          {session.user.email} — ADMIN_EMAILS 환경변수에 등록되지 않은 계정입니다.
        </p>
      </main>
    );
  }

  let data: Awaited<ReturnType<typeof getData>> | null = null;
  let dbError: string | null = null;
  try {
    data = await getData();
  } catch (e: any) {
    dbError = e?.message ?? "DB query failed";
  }

  return (
    <main
      style={{
        background: "#F8F5EE",
        color: "#0B0B0B",
        minHeight: "100vh",
        fontFamily:
          "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', system-ui, sans-serif",
        padding: "32px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 32,
            borderBottom: "1px solid #E7E0D2",
            paddingBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "#D24B2A",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              tigerbookmaker · admin
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
              사전예약 대시보드
            </h1>
          </div>
          <span style={{ fontSize: 13, color: "#7B7468" }}>{session.user.email}</span>
        </header>

        {dbError && (
          <div
            style={{
              padding: "16px 18px",
              border: "1px solid #D24B2A55",
              background: "#F4DED4",
              borderRadius: 10,
              marginBottom: 24,
              fontSize: 13,
              color: "#A93917",
            }}
          >
            DB 쿼리 실패 — `0017_preorders.sql` 과 `0018_preorder_sequence_log.sql` 가 적용됐는지 확인해주세요.
            <br />
            <code style={{ fontSize: 11 }}>{dbError}</code>
          </div>
        )}

        {data && (
          <>
            {/* 상단 4개 KPI */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                marginBottom: 36,
              }}
            >
              <KpiCard label="총 신청" value={`${data.total} / 100`} hint={`${100 - data.total}석 남음`} />
              <KpiCard
                label="얼리버드 (입금의향)"
                value={`${data.paidIntent}명`}
                hint={
                  data.paidIntent > 0
                    ? `평균 ₩${Math.round(data.avgPaidIntent).toLocaleString()}`
                    : "—"
                }
              />
              <KpiCard
                label="ICP 1위"
                value={
                  data.icpSummary[0]?.icp_signal
                    ? ICP_LABELS[data.icpSummary[0].icp_signal] ?? data.icpSummary[0].icp_signal
                    : "—"
                }
                hint={data.icpSummary[0] ? `${data.icpSummary[0].cnt}명` : ""}
              />
              <KpiCard
                label="시퀀스 누적 발송"
                value={`${data.stepSummary.reduce((s, x) => s + x.sent, 0)}건`}
                hint={`실패 ${data.stepSummary.reduce((s, x) => s + x.failed, 0)}건`}
              />
            </section>

            {/* 시퀀스 진행 표 */}
            <Section title="이메일 시퀀스 진행">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #1a1714" }}>
                    <Th>Step</Th>
                    <Th>제목</Th>
                    <Th align="right">발송</Th>
                    <Th align="right">실패</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(STEP_LABELS).map((s) => {
                    const step = Number(s);
                    const row = data.stepSummary.find((r) => r.step === step);
                    return (
                      <tr key={step} style={{ borderBottom: "1px solid #E7E0D2" }}>
                        <Td mono accent>
                          {step.toString().padStart(2, "0")}
                        </Td>
                        <Td>{STEP_LABELS[step]}</Td>
                        <Td align="right" mono>
                          {row?.sent ?? 0}
                        </Td>
                        <Td align="right" mono color={(row?.failed ?? 0) > 0 ? "#D24B2A" : "#7B7468"}>
                          {row?.failed ?? 0}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            {/* ICP 분포 */}
            <Section title="ICP 분포">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #1a1714" }}>
                    <Th>ICP</Th>
                    <Th align="right">신청</Th>
                    <Th align="right">비율</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.icpSummary.map((r) => (
                    <tr key={r.icp_signal ?? "null"} style={{ borderBottom: "1px solid #E7E0D2" }}>
                      <Td>{r.icp_signal ? ICP_LABELS[r.icp_signal] ?? r.icp_signal : "(미선택)"}</Td>
                      <Td align="right" mono>
                        {r.cnt}
                      </Td>
                      <Td align="right" mono color="#7B7468">
                        {((r.cnt / Math.max(1, data.total)) * 100).toFixed(0)}%
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* 최근 신청 200건 */}
            <Section title="최근 신청">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #1a1714" }}>
                      <Th>이메일</Th>
                      <Th>ICP</Th>
                      <Th>의향</Th>
                      <Th align="right">금액</Th>
                      <Th>UTM</Th>
                      <Th align="right">시각</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.preorders.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #E7E0D2" }}>
                        <Td mono>{p.email}</Td>
                        <Td>{p.icp_signal ? ICP_LABELS[p.icp_signal] ?? p.icp_signal : "—"}</Td>
                        <Td color={p.intent === "paid_intent" ? "#D24B2A" : "#36322C"}>
                          {p.intent === "paid_intent" ? "얼리버드" : "사전예약"}
                        </Td>
                        <Td align="right" mono>
                          {p.amount_won ? `₩${p.amount_won.toLocaleString()}` : "—"}
                        </Td>
                        <Td color="#7B7468">{p.utm_source || p.utm_campaign ? `${p.utm_source ?? ""} ${p.utm_campaign ?? ""}` : "—"}</Td>
                        <Td align="right" mono color="#7B7468">
                          {new Date(p.created_at).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Td>
                      </tr>
                    ))}
                    {data.preorders.length === 0 && (
                      <tr>
                        <Td colSpan={6} color="#7B7468">
                          아직 신청자가 없어요. <a href="/preorder" style={{ color: "#D24B2A" }}>/preorder</a>에서 트래픽 시작하기.
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E7E0D2",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "#7B7468",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#7B7468", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 12,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          background: "white",
          border: "1px solid #E7E0D2",
          borderRadius: 12,
          padding: 18,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: "0.18em",
        color: "#7B7468",
        textTransform: "uppercase",
        fontWeight: 500,
        padding: "10px 8px",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  accent = false,
  color,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  accent?: boolean;
  color?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: "10px 8px",
        fontFamily: mono
          ? "'JetBrains Mono', ui-monospace, monospace"
          : undefined,
        color: color ?? (accent ? "#D24B2A" : "#0B0B0B"),
        fontWeight: accent ? 700 : 400,
      }}
    >
      {children}
    </td>
  );
}
