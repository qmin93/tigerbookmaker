// app/write/_components/sections/RepurposeBox.tsx
// 콘텐츠 재가공 — Wave 1 (5채널: 인스타·유튜브·블로그·이메일·카톡)
// 책 1권 → 5채널 자동 생성. page.tsx에서 추출한 순수 JSX 박스.

"use client";
import { useState } from "react";

// ─── 콘텐츠 재가공 (Wave 1) helpers ───
type RepurposeChannel = "instagram" | "youtube" | "blog" | "email" | "kakao";

const REPURPOSE_EMOJI: Record<RepurposeChannel, string> = {
  instagram: "📱", youtube: "🎬", blog: "📰", email: "📧", kakao: "💬",
};
const REPURPOSE_LABEL: Record<RepurposeChannel, string> = {
  instagram: "인스타", youtube: "유튜브", blog: "블로그", email: "이메일", kakao: "카톡",
};
const REPURPOSE_COST: Record<RepurposeChannel, string> = {
  instagram: "~₩500", youtube: "~₩500", blog: "~₩1,500", email: "~₩1,000", kakao: "~₩300",
};

interface Props {
  project: any;
  repurposed: any;
  repurposeBusy: RepurposeChannel | null;
  onGenerate: (channel: RepurposeChannel) => void;
}

export function RepurposeBox({ project, repurposed, repurposeBusy, onGenerate }: Props) {
  // UI-only state (page.tsx에서 옮겨옴)
  const [activeRepurposeTab, setActiveRepurposeTab] = useState<RepurposeChannel>("instagram");
  const [repurposeCopiedKey, setRepurposeCopiedKey] = useState<string | null>(null);
  const [expandedBlogPost, setExpandedBlogPost] = useState<number | null>(null);

  // copyRepurpose — 클립보드 복사 + 1.5s "복사됨" 표시. 이 박스에서만 쓰이므로 컴포넌트 내부로 이동.
  const copyRepurpose = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setRepurposeCopiedKey(key);
    setTimeout(() => setRepurposeCopiedKey(null), 1500);
  };

  return (
    <div className="mb-3 p-3 bg-pink-50/50 border border-pink-300/40 rounded-lg">
      <h3 className="text-sm font-bold text-ink-900 mb-2">📢 콘텐츠 재가공</h3>
      <p className="text-[10px] text-gray-600 mb-3">책 1권 → 5채널 자동 생성</p>

      {/* 5 tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {(["instagram", "youtube", "blog", "email", "kakao"] as RepurposeChannel[]).map(ch => (
          <button
            key={ch}
            onClick={() => setActiveRepurposeTab(ch)}
            className={`px-2 py-1 text-[11px] rounded font-bold whitespace-nowrap ${
              activeRepurposeTab === ch
                ? "bg-pink-500 text-white"
                : "bg-white border border-pink-200 text-pink-700 hover:border-pink-400"
            }`}
          >
            {REPURPOSE_EMOJI[ch]} {REPURPOSE_LABEL[ch]}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div>
        {(!repurposed || !repurposed[activeRepurposeTab]) && repurposeBusy !== activeRepurposeTab && (
          <button
            onClick={() => onGenerate(activeRepurposeTab)}
            className="w-full px-3 py-2 bg-pink-500 text-white rounded text-xs font-bold hover:bg-pink-600"
          >
            {REPURPOSE_LABEL[activeRepurposeTab]} 생성 ({REPURPOSE_COST[activeRepurposeTab]})
          </button>
        )}
        {repurposeBusy === activeRepurposeTab && (
          <div className="text-xs text-pink-700 text-center py-2">⏳ 생성 중... (10-20초)</div>
        )}
        {repurposed?.[activeRepurposeTab] && (
          <div>
            {/* ── Instagram ── */}
            {activeRepurposeTab === "instagram" && (() => {
              const ig = repurposed.instagram;
              return (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    {(ig.cards ?? []).map((card: any, i: number) => {
                      const cardKey = `instagram-card-${i}`;
                      const cardText = `${card.title}\n\n${card.body}`;
                      return (
                        <div key={i} className="p-2 bg-white rounded border border-pink-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-pink-700">slide {card.slideNum ?? i + 1}</span>
                            <button onClick={() => copyRepurpose(cardText, cardKey)} className="text-[10px] text-pink-600 hover:underline">
                              {repurposeCopiedKey === cardKey ? "✓ 복사됨" : "복사"}
                            </button>
                          </div>
                          <div className="font-bold text-ink-900 break-words">{card.title}</div>
                          <div className="text-[11px] text-gray-700 mt-1 whitespace-pre-wrap break-words">{card.body}</div>
                          {card.designNote && (
                            <div className="text-[9px] text-gray-400 mt-1 italic">🎨 {card.designNote}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {ig.caption && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">📝 캡션</div>
                        <button onClick={() => copyRepurpose(ig.caption, "instagram-caption")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "instagram-caption" ? "✓ 복사됨" : "복사"}
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-gray-700">{ig.caption}</div>
                    </div>
                  )}
                  {ig.hashtags && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">#️⃣ 해시태그</div>
                        <button onClick={() => copyRepurpose(Array.isArray(ig.hashtags) ? ig.hashtags.join(" ") : String(ig.hashtags), "instagram-hashtags")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "instagram-hashtags" ? "✓ 복사됨" : "복사"}
                        </button>
                      </div>
                      <div className="break-words text-pink-700">
                        {Array.isArray(ig.hashtags) ? ig.hashtags.join(" ") : String(ig.hashtags)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── YouTube ── */}
            {activeRepurposeTab === "youtube" && (() => {
              const yt = repurposed.youtube;
              return (
                <div className="space-y-3 text-xs">
                  {yt.title && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">🎬 제목</div>
                        <button onClick={() => copyRepurpose(yt.title, "youtube-title")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "youtube-title" ? "✓ 복사됨" : "복사"}
                        </button>
                      </div>
                      <div className="text-sm font-bold text-ink-900 break-words">{yt.title}</div>
                    </div>
                  )}
                  {yt.script && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">📋 대본</div>
                        <button onClick={() => copyRepurpose(yt.script, "youtube-script")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "youtube-script" ? "✓ 복사됨" : "📋 대본 복사"}
                        </button>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words text-gray-700 text-[11px]">{yt.script}</div>
                    </div>
                  )}
                  {yt.thumbnailConcept && (
                    <div className="p-2 bg-gray-100 rounded">
                      <div className="font-bold text-ink-900 mb-1">🖼️ 썸네일 컨셉</div>
                      <div className="whitespace-pre-wrap break-words text-gray-700">{yt.thumbnailConcept}</div>
                    </div>
                  )}
                  {Array.isArray(yt.chapterMarkers) && yt.chapterMarkers.length > 0 && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="font-bold text-ink-900 mb-1">⏱️ 챕터 마커</div>
                      <div className="space-y-0.5">
                        {yt.chapterMarkers.map((m: any, i: number) => (
                          <div key={i} className="font-mono text-[11px]">
                            <span className="text-pink-600">{m.time ?? m.timestamp ?? "00:00"}</span>
                            <span className="text-gray-400"> → </span>
                            <span className="text-gray-800">{m.label ?? m.title ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {yt.description && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">📝 설명</div>
                        <button onClick={() => copyRepurpose(yt.description, "youtube-desc")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "youtube-desc" ? "✓ 복사됨" : "복사"}
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-gray-700">{yt.description}</div>
                    </div>
                  )}
                  {yt.tags && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-ink-900">🏷️ 태그</div>
                        <button onClick={() => copyRepurpose(Array.isArray(yt.tags) ? yt.tags.join(", ") : String(yt.tags), "youtube-tags")} className="text-[10px] text-pink-600 hover:underline">
                          {repurposeCopiedKey === "youtube-tags" ? "✓ 복사됨" : "복사"}
                        </button>
                      </div>
                      <div className="break-words text-gray-700">
                        {Array.isArray(yt.tags) ? yt.tags.join(", ") : String(yt.tags)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Blog ── */}
            {activeRepurposeTab === "blog" && (() => {
              const bl = repurposed.blog;
              const posts = (bl.posts ?? []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
              return (
                <div className="space-y-2 text-xs">
                  {bl.seriesTitle && (
                    <div className="p-2 bg-white rounded border border-pink-200">
                      <div className="text-[10px] text-gray-500">시리즈 제목</div>
                      <div className="font-bold text-ink-900 break-words">{bl.seriesTitle}</div>
                    </div>
                  )}
                  {posts.map((post: any, i: number) => {
                    const isOpen = expandedBlogPost === i;
                    const postKey = `blog-post-${i}`;
                    return (
                      <div key={i} className="bg-white rounded border border-pink-200">
                        <button
                          onClick={() => setExpandedBlogPost(isOpen ? null : i)}
                          className="w-full p-2 text-left flex items-start justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-pink-700 font-bold">Post {post.order ?? i + 1}</div>
                            <div className="font-bold text-ink-900 break-words">{post.title}</div>
                          </div>
                          <span className="text-pink-600 shrink-0">{isOpen ? "▼" : "▶"}</span>
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-2 space-y-2">
                            {post.excerpt && (
                              <div className="text-[11px] italic text-gray-600 border-l-2 border-pink-300 pl-2">{post.excerpt}</div>
                            )}
                            {Array.isArray(post.tags) && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {post.tags.map((t: string, ti: number) => (
                                  <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-800 rounded">#{t}</span>
                                ))}
                              </div>
                            )}
                            {post.body && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-[10px] font-bold text-ink-900">본문</div>
                                  <button onClick={() => copyRepurpose(post.body, postKey)} className="text-[10px] text-pink-600 hover:underline">
                                    {repurposeCopiedKey === postKey ? "✓ 복사됨" : "📋 본문 복사"}
                                  </button>
                                </div>
                                <div className="max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-gray-700 bg-gray-50 p-2 rounded">{post.body}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Email ── */}
            {activeRepurposeTab === "email" && (() => {
              const em = repurposed.email;
              const series = (em.series ?? []).slice().sort((a: any, b: any) => (a.day ?? 0) - (b.day ?? 0));
              return (
                <div className="space-y-2 text-xs">
                  {series.map((mail: any, i: number) => {
                    const mailKey = `email-${i}`;
                    const fullText = `제목: ${mail.subject}\n프리헤더: ${mail.preheader}\n\n${mail.body}\n\nCTA: ${mail.cta}`;
                    return (
                      <div key={i} className="p-2 bg-white rounded border border-pink-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-bold text-pink-700">Day {mail.day ?? i + 1}</div>
                          <button onClick={() => copyRepurpose(fullText, mailKey)} className="text-[10px] text-pink-600 hover:underline">
                            {repurposeCopiedKey === mailKey ? "✓ 복사됨" : "📋 복사"}
                          </button>
                        </div>
                        {mail.subject && <div className="font-bold text-ink-900 break-words">{mail.subject}</div>}
                        {mail.preheader && <div className="text-[10px] text-gray-500 italic break-words mt-0.5">{mail.preheader}</div>}
                        {mail.body && <div className="text-[11px] text-gray-700 whitespace-pre-wrap break-words mt-2">{mail.body}</div>}
                        {mail.cta && (
                          <div className="mt-2 inline-block px-2 py-1 bg-pink-100 text-pink-800 rounded text-[11px] font-bold">{mail.cta}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Kakao ── */}
            {activeRepurposeTab === "kakao" && (() => {
              const kk = repurposed.kakao;
              const messages = (kk.messages ?? []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
              // Wave C3: 카카오 비즈니스 채널 양식 (단일 .txt) 다운로드
              const downloadKakaoBizFormat = () => {
                const lines: string[] = [
                  "[카카오 비즈니스 채널 알림톡]",
                  "",
                  `책 주제: ${project?.topic ?? ""}`,
                  `대상 독자: ${project?.audience ?? ""}`,
                  "",
                  "─────────────────────────",
                  "",
                ];
                messages.forEach((m: any, i: number) => {
                  lines.push(`== 메시지 ${m.order ?? i + 1} ==`);
                  lines.push(`hook: ${m.hook ?? ""}`);
                  lines.push(`body: ${m.body ?? ""}`);
                  lines.push(`cta: ${m.cta ?? ""}`);
                  lines.push("");
                });
                lines.push("─────────────────────────");
                lines.push("※ 카카오 비즈니스 채널 관리자 페이지 → 알림톡 → 새 메시지에 위 내용을 그대로 복사·붙여넣기 하세요.");
                const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `kakao-biz-messages-${(project?.topic ?? "book").slice(0, 20).replace(/[^a-zA-Z0-9가-힣_-]/g, "_")}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };
              return (
                <div className="space-y-2 text-xs">
                  {messages.length > 0 && (
                    <button
                      onClick={downloadKakaoBizFormat}
                      className="w-full px-2 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 text-[11px] font-bold rounded border border-yellow-300"
                      title="5개 메시지를 단일 .txt 파일로 export"
                    >
                      📥 카카오 비즈 양식 다운로드 (.txt)
                    </button>
                  )}
                  {messages.map((msg: any, i: number) => {
                    const msgKey = `kakao-${i}`;
                    const fullText = `${msg.hook}\n\n${msg.body}\n\n${msg.cta}`;
                    return (
                      <div key={i} className="p-2 bg-white rounded border border-pink-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-bold text-pink-700">메시지 {msg.order ?? i + 1}</div>
                          <button onClick={() => copyRepurpose(fullText, msgKey)} className="text-[10px] text-pink-600 hover:underline">
                            {repurposeCopiedKey === msgKey ? "✓ 복사됨" : "📋 복사"}
                          </button>
                        </div>
                        {msg.hook && <div className="text-sm font-bold text-ink-900 break-words">{msg.hook}</div>}
                        {msg.body && <div className="text-[11px] text-gray-700 whitespace-pre-wrap break-words mt-1">{msg.body}</div>}
                        {msg.cta && (
                          <div className="mt-2 inline-block px-2 py-1 bg-pink-100 text-pink-800 rounded text-[11px] font-bold">{msg.cta}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <button
              onClick={() => onGenerate(activeRepurposeTab)}
              className="mt-2 text-[10px] text-pink-600 hover:underline"
            >
              🔄 다시 생성
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
