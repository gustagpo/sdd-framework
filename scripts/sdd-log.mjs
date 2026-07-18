#!/usr/bin/env node
/**
 * sdd-log.mjs — appender seguro de eventos do RUN.jsonl (sem printf/JSON frágil no shell).
 *
 * O orquestrador monta o evento por FLAGS; o script constrói o JSON, resolve run_id
 * (do run_start já gravado) e timestamps automaticamente, e apenda 1 linha.
 *
 * Uso:
 *   node sdd-log.mjs --feature <dir> --type run_start  --feature-name X --gate-mode supervised|autonomous \
 *                    [--phases-mode full|lite|spec-only|custom] [--phases-skip 2,4] [--models "team-leader=fable,qa=opus"] [--file-autonomy true|false]
 *   node sdd-log.mjs --feature <dir> --type agent_start --step 3 --agent dev-backend --label sdd-dev-backend-p3i1-abc123 --model opus [--iter 1] [--model-requested fable]
 *   node sdd-log.mjs --feature <dir> --type agent_run   --step 3 --agent dev-backend --label ... --model opus --status completed \
 *                    [--iter 1] [--summary "..."] [--artifacts "a.md,b.ts"] [--started <ISO>] [--model-requested fable]
 *   node sdd-log.mjs --feature <dir> --type gate        --step 0|1|2|3|final --approved true|false [--auto] [--notes "..."]
 *   node sdd-log.mjs --feature <dir> --type run_end     [--status completed|aborted]
 *   node sdd-log.mjs --feature <dir> --type note        --text "..."
 *
 * agent_run sem --started: usa o `at` do agent_start correspondente (mesmo step/agent/iter/label).
 * Sempre exit 0 em sucesso; exit 1 só para uso incorreto (flags obrigatórias ausentes).
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) args[name] = argv[++i];
      else args[name] = true;
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
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* ignora */
    }
  }
  return out;
}

function fail(msg) {
  console.error(`[sdd-log] ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv);
if (!args.feature || !args.type) fail('obrigatórios: --feature <dir> --type <tipo>');

const featureDir = path.resolve(args.feature);
fs.mkdirSync(featureDir, { recursive: true });
const runFile = path.join(featureDir, 'RUN.jsonl');
const now = new Date().toISOString();
const events = readJsonl(runFile);
const runStart = [...events].reverse().find((e) => e.type === 'run_start');

let ev;
switch (args.type) {
  case 'run_start': {
    const featureName = args['feature-name'] || path.basename(featureDir);
    const runId = `${now.replace(/[:.]/g, '-')}_${featureName}`;
    ev = {
      type: 'run_start',
      run_id: runId,
      feature: featureName,
      started_at: now,
      gate_mode: args['gate-mode'] || 'supervised',
      phases: {
        mode: args['phases-mode'] || 'full',
        skip: args['phases-skip'] ? String(args['phases-skip']).split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite) : [],
      },
      file_autonomy: args['file-autonomy'] === 'true' || args['file-autonomy'] === true,
      models: {},
    };
    if (args.models) {
      for (const pair of String(args.models).split(',')) {
        const [k, v] = pair.split('=');
        if (k && v) ev.models[k.trim()] = v.trim();
      }
    }
    break;
  }
  case 'agent_start': {
    if (!args.step || !args.agent) fail('agent_start exige --step e --agent');
    if (!runStart) fail('sem run_start no RUN.jsonl — grave-o primeiro');
    ev = {
      type: 'agent_start',
      run_id: runStart.run_id,
      feature: runStart.feature,
      step: /^\d+$/.test(String(args.step)) ? parseInt(args.step, 10) : args.step,
      iteration: args.iter ? parseInt(args.iter, 10) : 1,
      agent: args.agent,
      agent_label: args.label || null,
      model: args.model || null,
      model_requested: args['model-requested'] || args.model || null,
      at: now,
    };
    break;
  }
  case 'agent_run': {
    if (!args.step || !args.agent || !args.status) fail('agent_run exige --step, --agent e --status');
    if (!runStart) fail('sem run_start no RUN.jsonl — grave-o primeiro');
    const step = /^\d+$/.test(String(args.step)) ? parseInt(args.step, 10) : args.step;
    const iter = args.iter ? parseInt(args.iter, 10) : 1;
    let started = args.started || null;
    if (!started) {
      const start = [...events].reverse().find(
        (e) =>
          e.type === 'agent_start' &&
          e.step === step &&
          e.agent === args.agent &&
          (e.iteration ?? 1) === iter &&
          (!args.label || e.agent_label === args.label)
      );
      started = start?.at || now;
    }
    ev = {
      type: 'agent_run',
      run_id: runStart.run_id,
      feature: runStart.feature,
      step,
      step_name: args['step-name'] || null,
      iteration: iter,
      agent: args.agent,
      agent_label: args.label || null,
      subagent_type: args.subagent || null,
      model: args.model || null,
      model_requested: args['model-requested'] || args.model || null,
      started_at: started,
      ended_at: now,
      status: args.status,
      tokens: { input: null, output: null, cache_read: null, cache_creation: null, source: 'pending' },
      cost_usd_est: null,
      summary: args.summary || '',
      artifacts: args.artifacts ? String(args.artifacts).split(',').map((s) => s.trim()).filter(Boolean) : [],
    };
    break;
  }
  case 'gate': {
    if (args.step === undefined || args.approved === undefined) fail('gate exige --step e --approved');
    ev = {
      type: 'gate',
      run_id: runStart?.run_id || null,
      step: /^\d+$/.test(String(args.step)) ? parseInt(args.step, 10) : args.step,
      approved: String(args.approved) === 'true',
      auto: !!args.auto,
      notes: args.notes || '',
      at: now,
    };
    break;
  }
  case 'run_end': {
    ev = { type: 'run_end', run_id: runStart?.run_id || null, ended_at: now, status: args.status || 'completed' };
    break;
  }
  case 'note': {
    if (!args.text) fail('note exige --text');
    ev = { type: 'note', run_id: runStart?.run_id || null, text: String(args.text), at: now };
    break;
  }
  default:
    fail(`tipo desconhecido: ${args.type}`);
}

fs.appendFileSync(runFile, JSON.stringify(ev) + '\n');
console.log(`[sdd-log] ${args.type} gravado${ev.run_id ? ` (run ${ev.run_id})` : ''}`);
