import type { BookProject } from "./storage";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^---+$/gm, "");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderBody(content: string, images: BookProject["chapters"][0]["images"]): string {
  const parts = content.split(/(\[IMAGE:[^\]]+\])/);
  return parts.map(part => {
    if (part.startsWith("[IMAGE:")) {
      const img = images.find(i => i.placeholder === part);
      if (img?.dataUrl) {
        return `<div class="img-block"><img src="${img.dataUrl}" />${img.caption ? `<p class="caption">${escapeHtml(img.caption)}</p>` : ""}</div>`;
      }
      return "";
    }
    const cleaned = stripMarkdown(part);
    return cleaned.split("\n").map(rawLine => {
      const line = rawLine.trim();
      if (!line) return "";
      if (line.startsWith("## ")) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line.startsWith("### ")) return `<h4>${escapeHtml(line.slice(4))}</h4>`;
      if (line.startsWith("- ") || line.startsWith("* ")) return `<p class="bullet">· ${escapeHtml(line.slice(2))}</p>`;
      if (/^\d+\.\s/.test(line)) return `<p class="bullet">${escapeHtml(line)}</p>`;
      return `<p>${escapeHtml(line)}</p>`;
    }).join("\n");
  }).join("\n");
}

export async function generatePdf(project: BookProject) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) { alert("팝업이 차단됐습니다. 팝업 허용 후 다시 시도해주세요."); return; }

  const stripChapterPrefix = (title: string): string =>
    title.replace(/^\s*\d+\s*장[\s.,:·—-]*/u, "").trim();

  const topicParts = project.topic.split(/\s*[—–\-]\s+/);
  const coverMainTitle = topicParts[0] || project.topic;
  const coverSubTitle = topicParts.slice(1).join(" — ");

  const chaptersHtml = project.chapters
    .filter(ch => ch.content)
    .map((ch, i) => `
      <div class="chapter-divider">
        <div class="chapter-num-big">${String(i + 1).padStart(2, "0")}</div>
        <div class="chapter-content">
          <div class="chapter-label">CHAPTER ${String(i + 1).padStart(2, "0")}</div>
          <div class="chapter-title">${escapeHtml(stripChapterPrefix(ch.title))}</div>
          <div class="chapter-accent"></div>
          ${ch.subtitle ? `<div class="chapter-sub">${escapeHtml(ch.subtitle)}</div>` : ""}
        </div>
      </div>
      <div class="chapter-body">
        ${renderBody(ch.content, ch.images)}
      </div>
    `).join("\n");

  const tocHtml = project.chapters
    .filter(ch => ch.content)
    .map((ch, i) => `<div class="toc-item"><strong>${i + 1}장.</strong> ${escapeHtml(stripChapterPrefix(ch.title))}</div>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(project.topic)}</title>
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');

@page {
  size: A4;
  margin: 2.5cm;
}
@page :first {
  margin: 0;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #111;
  background: #fff;
}

.cover {
  position: relative;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  page-break-after: always;
  background: #0a0a0a;
  color: #fff;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.cover-accent {
  position: absolute;
  top: 0;
  right: 0;
  width: 45%;
  height: 100%;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  clip-path: polygon(35% 0, 100% 0, 100% 100%, 0 100%);
}
.cover-brand {
  position: absolute;
  top: 3cm;
  left: 3cm;
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: 3px;
  color: #f97316;
  text-transform: uppercase;
}
.cover-brand::before {
  content: "🐯 ";
  font-size: 16pt;
  margin-right: 6px;
}
.cover-title-group {
  position: absolute;
  left: 3cm;
  bottom: 6cm;
  max-width: 14cm;
}
.cover-title {
  font-size: 36pt;
  font-weight: 900;
  line-height: 1.15;
  word-break: keep-all;
  color: #fff;
  margin-bottom: 18pt;
}
.cover-subtitle {
  font-size: 16pt;
  font-weight: 700;
  color: #f97316;
  line-height: 1.4;
  word-break: keep-all;
}
.cover-divider {
  position: absolute;
  left: 3cm;
  bottom: 4cm;
  width: 4cm;
  height: 3px;
  background: #f97316;
}
.cover-audience {
  position: absolute;
  left: 3cm;
  bottom: 2.5cm;
  font-size: 11pt;
  color: #9ca3af;
  font-weight: 400;
  letter-spacing: 0.5px;
}
.cover-audience strong {
  color: #fff;
  font-weight: 700;
}
.cover-footer {
  position: absolute;
  right: 2.5cm;
  bottom: 2cm;
  font-size: 10pt;
  font-weight: 700;
  color: #0a0a0a;
  letter-spacing: 1px;
  text-align: right;
}

.toc {
  page-break-after: always;
}
.toc h2 {
  font-size: 22pt;
  font-weight: 900;
  margin-bottom: 24px;
}
.toc-item {
  font-size: 13pt;
  margin-bottom: 12px;
  word-break: keep-all;
}

.chapter-divider {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  height: 100vh;
  padding-left: 1.5cm;
  page-break-before: always;
  page-break-after: always;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.chapter-num-big {
  position: absolute;
  right: -0.8cm;
  top: 50%;
  transform: translateY(-50%);
  font-size: 300pt;
  font-weight: 900;
  line-height: 0.85;
  color: #fff7ed;
  letter-spacing: -8pt;
  z-index: 0;
  -webkit-text-stroke: 2px #fed7aa;
  text-shadow: 0 0 0 #fff7ed;
}
.chapter-content {
  position: relative;
  z-index: 1;
  max-width: 12cm;
}
.chapter-label {
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: 4px;
  color: #f97316;
  text-transform: uppercase;
  margin-bottom: 10pt;
}
.chapter-num {
  display: none;
}
.chapter-title {
  font-size: 28pt;
  font-weight: 900;
  line-height: 1.2;
  color: #0a0a0a;
  word-break: keep-all;
  margin-bottom: 18pt;
}
.chapter-accent {
  width: 3cm;
  height: 3px;
  background: #f97316;
  margin-bottom: 16pt;
}
.chapter-sub {
  font-size: 13pt;
  color: #6b7280;
  line-height: 1.5;
  font-weight: 400;
  word-break: keep-all;
  max-width: 10cm;
}

.chapter-body {
  page-break-before: avoid;
}
.chapter-body h3 {
  font-size: 16pt;
  font-weight: 800;
  margin: 24px 0 12px;
  page-break-after: avoid;
}
.chapter-body h4 {
  font-size: 14pt;
  font-weight: 700;
  margin: 18px 0 8px;
  page-break-after: avoid;
}
.chapter-body p {
  margin-bottom: 10px;
  word-break: keep-all;
  orphans: 3;
  widows: 3;
}
.chapter-body .bullet {
  padding-left: 16px;
  margin-bottom: 6px;
}
.chapter-body .img-block {
  text-align: center;
  margin: 16px 0;
  page-break-inside: avoid;
}
.chapter-body .img-block img {
  max-width: 100%;
  border-radius: 6px;
}
.chapter-body .caption {
  font-size: 10pt;
  color: #888;
  font-style: italic;
  margin-top: 4px;
}

.watermark {
  page-break-before: always;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
  color: #aaa;
  font-size: 10pt;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>

<div class="cover">
  <div class="cover-accent"></div>
  <div class="cover-brand">TIGERBOOKMAKER</div>
  <div class="cover-title-group">
    <div class="cover-title">${escapeHtml(coverMainTitle)}</div>
    ${coverSubTitle ? `<div class="cover-subtitle">${escapeHtml(coverSubTitle)}</div>` : ""}
  </div>
  <div class="cover-divider"></div>
  <div class="cover-audience">독자 · <strong>${escapeHtml(project.audience)}</strong></div>
  <div class="cover-footer">AI 자동 집필<br>실전 가이드</div>
</div>

<div class="toc">
  <h2>목차</h2>
  ${tocHtml}
</div>

${chaptersHtml}

<div class="watermark">Made with Tigerbookmaker</div>

</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 2000);
}
