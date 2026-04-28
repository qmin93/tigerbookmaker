// 클라이언트에서 base64 이미지 + 카피 → zip 다운로드

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const TYPE_FILENAME: Record<string, string> = {
  cover: "01-cover.png",
  thumb: "02-thumbnail.png",
  toc: "03-toc.png",
  spec: "04-spec.png",
  audience: "05-audience.png",
  preview: "06-preview.png",
};

function detectExt(b64: string): string {
  // JPEG: /9j/, PNG: iVBOR
  if (b64.startsWith("/9j/")) return "jpg";
  if (b64.startsWith("iVBOR")) return "png";
  return "png";
}

interface KmongPackageData {
  images: { type: string; base64: string; vendor: string }[];
  copy: {
    kmongDescription: string;
    kmongHighlights: string[];
    instagram: string;
    kakao: string;
    twitter: string;
  };
}

export async function buildKmongZip(pkg: KmongPackageData, projectTopic: string): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const img of pkg.images) {
    const baseFilename = TYPE_FILENAME[img.type] ?? `${img.type}.png`;
    const ext = detectExt(img.base64);
    const filename = baseFilename.replace(/\.png$/, `.${ext}`);
    zip.file(filename, base64ToUint8Array(img.base64));
  }

  zip.file("description.txt", pkg.copy.kmongDescription || "");
  zip.file("highlights.txt", (pkg.copy.kmongHighlights ?? []).join("\n\n• "));
  zip.file("instagram.txt", pkg.copy.instagram || "");
  zip.file("kakao.txt", pkg.copy.kakao || "");
  zip.file("twitter.txt", pkg.copy.twitter || "");

  const README = `# 크몽 등록 패키지 — ${projectTopic}

자동 생성: ${new Date().toLocaleString("ko-KR")}

## 이미지 (1024×1024)
- 01-cover     — 책 표지
- 02-thumbnail — 크몽 메인 (필요 시 652×488로 crop)
- 03-toc       — 목차 시각화
- 04-spec      — 스펙 카드
- 05-audience  — 추천 대상
- 06-preview   — 본문 미리보기

## 카피
- description  — 크몽 상세 페이지 메인
- highlights   — 강조 포인트 5개
- instagram    — 인스타 캡션
- kakao        — 카톡 메시지
- twitter      — 트위터/X

## 사용 가이드
1. 크몽: 02 메인, 01·03·04·05·06 상세. 본문에 description+highlights
2. SNS: instagram/kakao/twitter 그대로 복붙
`;
  zip.file("README.txt", README);

  return await zip.generateAsync({ type: "blob" });
}

export function downloadKmongZip(blob: Blob, projectTopic: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kmong-${projectTopic.slice(0, 30).replace(/[^\w가-힣]/g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
