import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun } from "docx";
import type { BookProject } from "./storage";

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function generateDocx(project: BookProject) {
  const children: Paragraph[] = [];

  // Cover
  children.push(new Paragraph({ text: "", spacing: { before: 2400 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: project.topic, bold: true, size: 56 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [new TextRun({ text: project.audience, size: 28, color: "666666" })],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // TOC
  children.push(new Paragraph({ text: "목차", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 400 } }));
  project.chapters.forEach((c, i) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}장. ${c.title}`, size: 24 })],
      spacing: { after: 120 },
    }));
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Chapters
  for (let i = 0; i < project.chapters.length; i++) {
    const ch = project.chapters[i];
    if (!ch.content) continue;
    children.push(new Paragraph({
      text: `${i + 1}장`,
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
    }));
    children.push(new Paragraph({
      text: ch.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }));
    if (ch.subtitle) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: ch.subtitle, italics: true, color: "666666", size: 22 })],
      }));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));

    const parts = ch.content.split(/(\[IMAGE:[^\]]+\])/);
    for (const part of parts) {
      if (part.startsWith("[IMAGE:")) {
        const img = ch.images.find(im => im.placeholder === part);
        if (img?.dataUrl) {
          try {
            const data = dataUrlToUint8(img.dataUrl);
            children.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [new ImageRun({ data, transformation: { width: 400, height: 300 } } as any)],
            }));
            if (img.caption) {
              children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: img.caption, size: 18, color: "888888", italics: true })],
              }));
            }
          } catch {}
        }
        continue;
      }
      for (const line of part.split("\n")) {
        if (!line.trim()) {
          children.push(new Paragraph({ text: "" }));
          continue;
        }
        if (line.startsWith("## ")) {
          children.push(new Paragraph({
            text: line.slice(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 24 })], // 24 half-points = 12pt
            spacing: { line: 360, after: 100 }, // line 360 = 1.5 spacing
          }));
        }
      }
    }
  }

  // Footer
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [new TextRun({ text: "Made with Tigerbookmaker", size: 18, color: "aaaaaa" })],
  }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { size: 24, font: "Pretendard" }, paragraph: { spacing: { line: 360 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.topic.slice(0, 30)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
