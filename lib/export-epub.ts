// EPUB 다운로드 — 모바일 안전.
// 이전: blob: URL을 a.click()으로 트리거 → in-app 브라우저(Telegram·카톡·iOS)에서
// "Only HTTP(S) protocols are supported" 에러로 차단됨.
// 현재: 서버 GET endpoint가 직접 binary 응답 → 브라우저가 native download 처리.
// NextAuth cookie session으로 인증.

import type { BookProject } from "./storage";

export async function generateEpub(project: BookProject): Promise<void> {
  const url = `/api/export/epub?id=${encodeURIComponent(project.id)}`;
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    // 모바일: 새 탭 (in-app 브라우저는 같은 탭이 더 안전할 수도 있어 fallback)
    const w = window.open(url, "_blank");
    if (!w) {
      // 팝업 차단된 경우 같은 탭으로
      window.location.href = url;
    }
  } else {
    // 데스크탑: hidden a + click
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.topic.slice(0, 50)}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
