#!/usr/bin/env node
/**
 * GenXTaxi AI evaluation harness (spec §5: golden test sets per feature run in
 * CI on every prompt/model change — regression gate). Exits non-zero if any
 * suite falls below its threshold.
 *
 * Deterministic suites import the ACTUAL built service code (grounding,
 * redaction) and the real Python surge engine — so this tests production logic,
 * not a re-implementation. The FAQ suite runs LIVE against ai-gateway only when
 * EVAL_GATEWAY_URL + EVAL_TOKEN are set (needs a provider key); otherwise it is
 * reported as SKIPPED (never a silent pass).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(HERE, 'golden', f), 'utf8'));

const results = [];
function record(suite, passed, total, threshold, note = '') {
  const score = total ? passed / total : 0;
  const ok = score >= threshold;
  results.push({ suite, passed, total, score, threshold, ok, note });
}

// ── Redaction (imports ai-gateway/dist) ──────────────────────────────────────
async function evalRedaction() {
  const fx = load('redaction.json');
  let mod;
  try {
    mod = await import('../ai-gateway/dist/redaction/redaction.service.js');
  } catch (e) {
    record('redaction', 0, fx.cases.length, fx.threshold, 'ai-gateway not built');
    return;
  }
  const svc = new mod.RedactionService();
  let pass = 0;
  for (const c of fx.cases) {
    const { text } = svc.scrub(c.input);
    const ok =
      (c.mustContain ?? []).every((s) => text.includes(s)) &&
      (c.mustNotContain ?? []).every((s) => !text.includes(s));
    if (ok) pass++;
  }
  record('redaction', pass, fx.cases.length, fx.threshold);
}

// ── Grounding (imports chat-orchestrator/dist) ───────────────────────────────
async function evalGrounding() {
  const fx = load('grounding.json');
  let mod;
  try {
    mod = await import('../chat-orchestrator/dist/orchestrator/grounding.service.js');
  } catch (e) {
    record('grounding', 0, fx.cases.length, fx.threshold, 'chat-orchestrator not built');
    return;
  }
  const svc = new mod.GroundingService();
  let pass = 0;
  for (const c of fx.cases) {
    const r = svc.check(c.reply, c.allowed);
    if (r.grounded === c.expectGrounded) pass++;
  }
  record('grounding', pass, fx.cases.length, fx.threshold);
}

// ── Surge (calls the real Python engine) ─────────────────────────────────────
function evalSurge() {
  const fx = load('surge.json');
  // A small python program that drives the real surge engine over the fixtures.
  const program = [
    'import json,sys',
    'sys.path.insert(0, "demand-service")',
    'from app.surge.surge_engine import SurgeConfig, compute_surge',
    'fx=json.loads(sys.argv[1])',
    'cfg=SurgeConfig(max_surge=fx["maxSurge"])',
    'ok=0',
    'for c in fx["cases"]:',
    '    d=compute_surge("h", c["predicted"], c["drivers"], cfg, None, 1000,'
      + ' kill_switch=c.get("killSwitch",False), manual_override=c.get("override"))',
    '    good = d.multiplier <= c.get("expectMax", fx["maxSurge"]) + 1e-9 and d.multiplier >= c.get("expectMin",1.0)-1e-9',
    '    if "expect" in c: good = good and abs(d.multiplier - c["expect"]) < 1e-9',
    '    ok += 1 if good else 0',
    'print(ok)',
  ].join('\n');
  try {
    const out = execFileSync('python3', ['-c', program, JSON.stringify(fx)], {
      cwd: join(HERE, '..'),
      encoding: 'utf8',
    }).trim();
    record('surge', Number(out), fx.cases.length, fx.threshold);
  } catch (e) {
    record('surge', 0, fx.cases.length, fx.threshold, 'python/demand-service unavailable');
  }
}

// ── FAQ correctness + language (LIVE, optional) ──────────────────────────────
async function evalFaq() {
  const fx = load('faq.json');
  const url = process.env.EVAL_GATEWAY_URL;
  const token = process.env.EVAL_TOKEN;
  if (!url || !token) {
    results.push({ suite: 'faq(live)', skipped: true, threshold: fx.threshold });
    return;
  }
  let pass = 0;
  for (const c of fx.cases) {
    try {
      const res = await fetch(`${url}/api/v1/ai/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          task: 'chat',
          feature: 'eval_faq',
          messages: [
            { role: 'system', content: `You are GenXTaxi support. Answer in ${c.expectLang}. One short sentence.` },
            { role: 'user', content: c.q },
          ],
        }),
      });
      const data = await res.json();
      const text = (data.content ?? '').toLowerCase();
      const hit = (c.mustMentionAny ?? []).some((k) => text.includes(k.toLowerCase()));
      if (hit) pass++;
    } catch {
      /* counts as fail */
    }
  }
  record('faq(live)', pass, fx.cases.length, fx.threshold);
}

// ── run ──────────────────────────────────────────────────────────────────────
await evalRedaction();
await evalGrounding();
evalSurge();
await evalFaq();

console.log('\nGenXTaxi AI Evaluation Harness (regression gate)\n' + '='.repeat(48));
let failed = false;
for (const r of results) {
  if (r.skipped) {
    console.log(`  SKIP  ${r.suite.padEnd(16)} (set EVAL_GATEWAY_URL + EVAL_TOKEN to run)`);
    continue;
  }
  const tag = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed = true;
  console.log(
    `  ${tag}  ${r.suite.padEnd(16)} ${r.passed}/${r.total} ` +
      `(${(r.score * 100).toFixed(0)}% ≥ ${(r.threshold * 100).toFixed(0)}%)` +
      (r.note ? `  — ${r.note}` : ''),
  );
}
console.log('='.repeat(48));
if (failed) {
  console.error('Evaluation gate FAILED');
  process.exit(1);
}
console.log('Evaluation gate PASSED');
