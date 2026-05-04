// Gemini TTS — 한국어 voice
// Google Generative Language API: gemini-2.5-flash-preview-tts
// 응답: base64 PCM (24kHz, 16-bit, mono) → WAV로 wrap해서 반환.
// 이유: ffmpeg 의존성 없이 브라우저 <audio>로 바로 재생 가능.

import "server-only";

export interface TtsResult {
  wavBase64: string;
  durationMs: number;
  voiceName: string;
}

const VOICE_KOR = "Charon"; // Korean-compatible prebuilt voice

export async function ttsKorean(
  text: string,
  opts?: { voiceName?: string },
): Promise<TtsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const voiceName = opts?.voiceName ?? VOICE_KOR;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const t0 = Date.now();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const pcmBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmBase64) throw new Error("TTS: no audio in response");

  // PCM → WAV (24kHz, 16-bit, mono)
  const pcmBuf = Buffer.from(pcmBase64, "base64");
  const wavBuf = pcmToWav(pcmBuf, { sampleRate: 24000, bitDepth: 16, channels: 1 });

  return {
    wavBase64: wavBuf.toString("base64"),
    durationMs: Date.now() - t0,
    voiceName,
  };
}

function pcmToWav(
  pcm: Buffer,
  opts: { sampleRate: number; bitDepth: number; channels: number },
): Buffer {
  const { sampleRate, bitDepth, channels } = opts;
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const dataSize = pcm.length;
  const wavSize = 44 + dataSize;
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(wavSize - 8, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitDepth, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return Buffer.concat([buf, pcm]);
}
