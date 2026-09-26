import { spawn } from 'node:child_process';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExplanation } from '../lib/explanation.js';
import { MAX_BYTES } from '../lib/pipeline.js';

// This module is imported only by the opt-in local launcher, never by Next routes.
export async function codexExplanation(_url, { body, signal }) {
  const { instructions, facts } = JSON.parse(body);
  const directory = await mkdtemp(join(tmpdir(), 'pipeline-pulse-summary-'));
  try {
    const text = await new Promise((resolve, reject) => {
      const args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
        '--sandbox', 'read-only', '--cd', directory, '--json',
        ...['shell_tool', 'apps', 'plugins', 'browser_use', 'computer_use', 'image_generation', 'shell_snapshot'].flatMap(feature => ['--disable', feature]),
        '-c', 'web_search="disabled"', '-c', 'model_reasoning_effort="low"', '-'];
      const child = spawn(process.env.PIPELINE_CODEX_BIN || 'codex', args, {
        shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], signal,
      });
      let output = ''; let answer = ''; let failed = false;
      child.on('error', reject);
      child.stdin.on('error', () => {});
      child.stderr.resume(); // Never expose credential diagnostics to the browser.
      child.stdout.on('data', chunk => {
        output += chunk;
        if (output.length > 1000000) { child.kill(); reject(new Error('Output limit exceeded')); return; }
        let newline;
        while ((newline = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, newline); output = output.slice(newline + 1);
          try {
            const event = JSON.parse(line);
            if (event.type === 'item.completed' && event.item?.type === 'agent_message') answer = event.item.text;
            if (event.type === 'turn.failed' || event.type === 'error') failed = true;
          } catch { /* Ignore non-event CLI diagnostics. */ }
        }
      });
      child.on('close', code => {
        if (code !== 0 || failed || !answer) return reject(new Error('Local Codex failed'));
        try { resolve(JSON.parse(answer).text); } catch { resolve(answer); }
      });
      child.stdin.end(`${instructions}\nDo not inspect files or use tools. Explain only the supplied facts.\n${JSON.stringify(facts)}`);
    });
    return Response.json({ text });
  } finally { await rmdir(directory); }
}

export function explanationHandler(port, fetcher = codexExplanation) {
  let busy = false;
  return async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const host = req.headers.host;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) || req.headers.origin !== `http://${host}`)
      return reply(403, { error: 'A localhost same-origin request is required.' });
    if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
    if (busy) return reply(429, { error: 'A summary is already being generated. Please wait.' });
    const max = MAX_BYTES * 2 + 65536;
    if (Number(req.headers['content-length']) > max) return reply(413, { error: 'Dataset is too large.' });
    busy = true;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > max) { reply(413, { error: 'Dataset is too large.' }); return; }
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply(400, { error: 'Invalid JSON.' }); }
      // Reuse validation, deterministic recomputation and anonymous facts projection.
      // The URL is a placeholder for the injected local adapter; no HTTP call is made.
      const result = await createExplanation(payload, { LLM_EXPLANATION_URL: 'https://local-adapter.invalid' }, fetcher);
      reply(result.status, result.body);
    } catch { reply(502, { error: 'Local ChatGPT connection failed. Check codex login status and try again.' }); }
    finally { busy = false; }
  };
}
