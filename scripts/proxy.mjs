#!/usr/bin/env node
// Local proxy: browser → this server → `claude -p --output-format json` CLI
// Returns { text, usage, model, cost, durationMs }

import http from "http";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

const PORT = 7777;
const MODEL = process.env.TIGER_MODEL || "sonnet";

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST" || req.url !== "/v1/generate") {
    res.writeHead(404); res.end("Not found"); return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const { system, user, model: reqModel } = JSON.parse(body);
      const model = reqModel || MODEL;
      const prompt = `${system}\n\n---\n\n${user}`;
      const dir = mkdtempSync(join(tmpdir(), "tiger-"));
      const file = join(dir, "prompt.txt");
      writeFileSync(file, prompt, "utf8");
      console.log(`[proxy] ${new Date().toISOString()} → claude -p --model ${model} (${prompt.length} chars)`);
      const started = Date.now();
      const out = execSync(`claude -p --output-format json --model ${model} < "${file}"`, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000,
        shell: true,
      });
      try { unlinkSync(file); } catch {}
      const parsed = JSON.parse(out);
      const usage = parsed.usage || {};
      const modelUsage = parsed.modelUsage || {};
      const modelKey = Object.keys(modelUsage)[0] || model;
      const mu = modelUsage[modelKey] || {};
      const result = {
        text: (parsed.result || "").trim(),
        usage: {
          model: modelKey,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          cacheCreateTokens: usage.cache_creation_input_tokens || 0,
          costUSD: parsed.total_cost_usd || mu.costUSD || 0,
          durationMs: parsed.duration_ms || (Date.now() - started),
          contextWindow: mu.contextWindow || 0,
        },
      };
      console.log(`[proxy] done ${model} | in=${result.usage.inputTokens} out=${result.usage.outputTokens} cache_r=${result.usage.cacheReadTokens} cache_w=${result.usage.cacheCreateTokens} | $${result.usage.costUSD.toFixed(4)} | ${(result.usage.durationMs / 1000).toFixed(1)}s | ${result.text.length} chars`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      console.error("[proxy] error:", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🐯 Tigerbookmaker local proxy running on http://localhost:${PORT}`);
  console.log(`   Model: ${MODEL} (override with TIGER_MODEL env or per-request)`);
  console.log(`   Tigerbookmaker에서 "Local Claude Code" provider 선택하세요.`);
});
