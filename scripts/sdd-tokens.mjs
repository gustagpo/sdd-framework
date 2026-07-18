#!/usr/bin/env node
/**
 * sdd-tokens.mjs — enriquece o RUN.jsonl de uma feature com tokens e custo estimado.
 *
 * Correlaciona cada evento `agent_run` pendente com os transcripts de subagents
 * gravados pelo Claude Code em ~/.claude/projects/<slug>/<sessão>/subagents/agent-*.jsonl,
 * casando por agentType (meta.json) + janela de tempo [started_at, ended_at].
 * Soma o usage e apenda eventos `tokens_update` (append-only; o agregador aplica
 * "último update vence"). Custo SEMPRE estimado por pricing.json (contas
 * subscription reportam costUSD=0 — o valor nunca vem do transcript).
 *
 * Uso:
 *   node sdd-tokens.mjs --feature <dir-da-feature> [--project-dir <cwd>] [--pricing <path>] [--overrides <json>]
 *
 * Fallback gracioso: sem match => tokens.source: "unavailable" (o painel mostra "—").
 * Nunca lança para o fluxo: exit 0 mesmo sem matches; exit 1 só para uso incorreto.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MARGIN_MS = 90_000; // tolerância de relógio/lag entre orquestrador e transcript

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

function readJsonl(file) {
  const out = [];
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      /* linha corrompida: ignora */
    }
  }
  return out;
}

function projectSlug(dir) {
  // Claude Code: path com separadores/pontos substituídos por '-'
  return path.resolve(dir).replace(/[^a-zA-Z0-9-]/g, '-');
}

/** Coleta todos os transcripts de subagent do projeto: { meta, file, firstTs, lastTs } */
function collectSubagentTranscripts(projectsDir) {
  const results = [];
  let sessions;
  try {
    sessions = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return results;
  }
  for (const sess of sessions) {
    const subDir = path.join(projectsDir, sess.name, 'subagents');
    let files;
    try {
      files = fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const f of files) {
      const jsonlPath = path.join(subDir, f);
      const metaPath = jsonlPath.replace(/\.jsonl$/, '.meta.json');
      let meta = {};
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        /* sem meta: ainda usável por janela de tempo */
      }
      let stat;
      try {
        stat = fs.statSync(jsonlPath);
      } catch {
        continue;
      }
      results.push({ meta, file: jsonlPath, mtimeMs: stat.mtimeMs });
    }
  }
  return results;
}

/** Lê um transcript de subagent e devolve { usage, model, firstTs, lastTs } */
function summarizeTranscript(file) {
  const usage = { input: 0, output: 0, cache_read: 0, cache_creation: 0, cache_creation_1h: 0 };
  let model = null;
  let firstTs = null;
  let lastTs = null;
  for (const o of readJsonl(file)) {
    const ts = o.timestamp ? Date.parse(o.timestamp) : null;
    if (ts) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }
    if (o.type === 'assistant' && o.message) {
      const m = o.message;
      if (m.model && m.model !== '<synthetic>') model = m.model;
      const u = m.usage;
      if (u) {
        usage.input += u.input_tokens || 0;
        usage.output += u.output_tokens || 0;
        usage.cache_read += u.cache_read_input_tokens || 0;
        usage.cache_creation += u.cache_creation_input_tokens || 0;
        if (u.cache_creation && typeof u.cache_creation === 'object') {
          usage.cache_creation_1h += u.cache_creation.ephemeral_1h_input_tokens || 0;
        }
      }
    }
  }
  return { usage, model, firstTs, lastTs };
}

function loadPricing(pricingPath, overrides) {
  let pricing = { models: {}, aliases: {} };
  try {
    pricing = JSON.parse(fs.readFileSync(pricingPath, 'utf8'));
  } catch {
    /* sem pricing: custo fica null */
  }
  if (overrides && typeof overrides === 'object') {
    pricing.models = { ...pricing.models, ...overrides };
  }
  return pricing;
}

function resolvePrice(pricing, modelId) {
  if (!modelId) return null;
  if (pricing.models[modelId]) return pricing.models[modelId];
  const alias = pricing.aliases?.[modelId];
  if (alias && pricing.models[alias]) return pricing.models[alias];
  // prefixo: "claude-opus-4-8-xyz" → melhor match conhecido
  const known = Object.keys(pricing.models).find((k) => modelId.startsWith(k));
  return known ? pricing.models[known] : null;
}

function estimateCost(pricing, modelId, usage) {
  const p = resolvePrice(pricing, modelId);
  if (!p) return null;
  const M = 1_000_000;
  const cc5m = usage.cache_creation - (usage.cache_creation_1h || 0);
  const cost =
    (usage.input / M) * p.input +
    (usage.output / M) * p.output +
    (usage.cache_read / M) * (p.cache_read ?? p.input * 0.1) +
    (Math.max(0, cc5m) / M) * (p.cache_write_5m ?? p.input * 1.25) +
    ((usage.cache_creation_1h || 0) / M) * (p.cache_write_1h ?? p.input * 2);
  return Math.round(cost * 10000) / 10000;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.feature) {
    console.error('uso: sdd-tokens.mjs --feature <dir> [--project-dir <cwd>] [--pricing <path>] [--overrides <json>]');
    process.exit(1);
  }
  const featureDir = path.resolve(args.feature);
  const runFile = path.join(featureDir, 'RUN.jsonl');
  if (!fs.existsSync(runFile)) {
    console.error(`[sdd-tokens] RUN.jsonl não encontrado em ${featureDir} — nada a fazer`);
    process.exit(0);
  }

  const projectDir = args['project-dir'] || process.cwd();
  const slug = projectSlug(projectDir);
  const projectsDir = path.join(os.homedir(), '.claude', 'projects', slug);

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const pricingPath = args.pricing || path.join(scriptDir, 'pricing.json');
  let overrides = null;
  if (args.overrides) {
    try {
      overrides = JSON.parse(args.overrides);
    } catch {
      console.error('[sdd-tokens] --overrides inválido (JSON) — ignorando');
    }
  }
  const pricing = loadPricing(pricingPath, overrides);

  const events = readJsonl(runFile);

  // eventos agent_run pendentes = sem tokens_update posterior com source resolvida
  const updatedKeys = new Set(
    events
      .filter((e) => e.type === 'tokens_update' && e.tokens?.source === 'transcript')
      .map((e) => `${e.ref?.step}|${e.ref?.agent}|${e.ref?.started_at}`)
  );
  const pending = events.filter(
    (e) =>
      e.type === 'agent_run' &&
      e.started_at &&
      !updatedKeys.has(`${e.step}|${e.agent}|${e.started_at}`)
  );

  if (pending.length === 0) {
    console.log('[sdd-tokens] nenhum agent_run pendente');
    process.exit(0);
  }

  const transcripts = collectSubagentTranscripts(projectsDir);
  const summaries = new Map(); // lazy cache file → summary
  const claimed = new Set(); // um transcript casa com no máximo 1 evento
  const updates = [];

  for (const ev of pending) {
    const start = Date.parse(ev.started_at) - MARGIN_MS;
    const end = ev.ended_at ? Date.parse(ev.ended_at) + MARGIN_MS : Date.now() + MARGIN_MS;

    // 1) MATCH DETERMINÍSTICO por label: o orquestrador nomeia cada invocação
    //    (param `name` do Agent) e o meta.json grava esse nome em agentType.
    let best =
      (ev.agent_label &&
        transcripts.find((t) => !claimed.has(t.file) && t.meta?.agentType === ev.agent_label)) ||
      null;
    if (best && !summaries.has(best.file)) summaries.set(best.file, summarizeTranscript(best.file));

    // 2) Fallback (rodadas legadas sem label): janela de tempo, SEM exigir agentType —
    //    agentTypes reais são rótulos livres (ex.: "tl-passo1") e nunca casariam com o papel.
    if (!best) {
      const candidates = transcripts.filter((t) => !claimed.has(t.file));
      for (const c of candidates) {
        if (!summaries.has(c.file)) summaries.set(c.file, summarizeTranscript(c.file));
        const s = summaries.get(c.file);
        if (s.firstTs === null) continue;
        if (s.firstTs >= start && s.firstTs <= end && s.lastTs <= end) {
          if (!best || Math.abs(s.firstTs - (start + MARGIN_MS)) < Math.abs(summaries.get(best.file).firstTs - (start + MARGIN_MS))) {
            best = c;
          }
        }
      }
    }

    if (best) {
      claimed.add(best.file);
      const s = summaries.get(best.file);
      const model = s.model || best.meta?.model || ev.model || null;
      const tokens = {
        input: s.usage.input,
        output: s.usage.output,
        cache_read: s.usage.cache_read,
        cache_creation: s.usage.cache_creation,
        source: 'transcript',
      };
      updates.push({
        type: 'tokens_update',
        run_id: ev.run_id,
        ref: { step: ev.step, agent: ev.agent, started_at: ev.started_at, iteration: ev.iteration ?? 1 },
        model_resolved: model,
        tokens,
        cost_usd_est: estimateCost(pricing, model, s.usage),
        transcript: best.file,
        at: new Date().toISOString(),
      });
    } else if (ev.ended_at) {
      // só marca unavailable para eventos já encerrados (os em andamento podem casar depois)
      updates.push({
        type: 'tokens_update',
        run_id: ev.run_id,
        ref: { step: ev.step, agent: ev.agent, started_at: ev.started_at, iteration: ev.iteration ?? 1 },
        model_resolved: ev.model || null,
        tokens: { input: null, output: null, cache_read: null, cache_creation: null, source: 'unavailable' },
        cost_usd_est: null,
        at: new Date().toISOString(),
      });
    }
  }

  if (updates.length) {
    fs.appendFileSync(runFile, updates.map((u) => JSON.stringify(u)).join('\n') + '\n');
  }
  const resolved = updates.filter((u) => u.tokens.source === 'transcript').length;
  console.log(`[sdd-tokens] ${resolved}/${pending.length} eventos resolvidos (${updates.length - resolved} unavailable)`);
}

main();
