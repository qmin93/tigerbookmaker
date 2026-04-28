// EPUB 다운로드 — 서버에서 생성, 클라이언트는 base64 받아 다운로드

import type { BookProject } from "./storage";

export async function generateEpub(project: BookProject): Promise<void> {
  const res = await fetch("/api/export/epub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: project.id }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `EPUB 생성 실패 (${res.status})`);
  }
  const data = await res.json();

  // base64 → Uint8Array → Blob
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/epub+zip" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.filename || `${project.topic.slice(0, 50)}.epub`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
