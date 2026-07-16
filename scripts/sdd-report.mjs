#!/usr/bin/env node
/**
 * sdd-report.mjs — RUN.jsonl → painel de terminal, DASHBOARD.md, agregados e estimativas.
 *
 * Modos:
 *   --feature <dir> [--write]            painel da feature no stdout; --write regenera <dir>/DASHBOARD.md
 *   --aggregate <specsDir> [--write]     agrega specs/features/*\/RUN.jsonl; --write grava <specsDir>/DASHBOARD.md
 *   --append-run-index <dir> --index <runs-index.jsonl> --project <nome>
 *                                        apenda 1 linha agregada da rodada ao índice global do framework
 *   --estimate --index <runs-index.jsonl> [--scope fullstack]
 *                                        estimativa de custo/duração com base no histórico
 *
 * Determinístico: toda a aritmética acontece aqui, nunca no LLM.
 */

import fs from 'node:fs';
import path from 'node:path';

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
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* ignora linha corrompida */
    }
  }
  return out;
}

/** Consolida um RUN.jsonl: aplica tokens_update (último vence) sobre agent_run. */
function consolidate(events) {
  const runs = [];
  const gates = [];
  let runStart = null;
  let runEnd = null;
  const byKey = new Map();
  for (const e of events) {
    if (e.type === 'run_start') runStart = e;
    else if (e.type === 'run_end') runEnd = e;
    else if (e.type === 'gate') gates.push(e);
    else if (e.type === 'agent_run') {
      const key = `${e.step}|${e.agent}|${e.started_at}`;
      const entry = { ...e, tokens: { ...e.tokens }, cost_usd_est: e.cost_usd_est ?? null };
      byKey.set(key, entry);
      runs.push(entry);
    } else if (e.type === 'tokens_update' && e.ref) {
      const key = `${e.ref.step}|${e.ref.agent}|${e.ref.started_at}`;
      const target = byKey.get(key);
      if (target) {
        target.tokens = { ...e.tokens };
        target.cost_usd_est = e.cost_usd_est ?? target.cost_usd_est;
        if (e.model_resolved) target.model_resolved = e.model_resolved;
      }
    }
  }
  return { runs, gates, runStart, runEnd };
}

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return '—';
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function fmtTok(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(c) {
  return c === null || c === undefined ? '—' : `$${c.toFixed(2)}`;
}

function totals(runs) {
  const t = { cost: 0, hasCost: false, input: 0, output: 0, hasTok: false, durMs: 0, count: runs.length };
  for (const r of runs) {
    if (r.cost_usd_est != null) {
      t.cost += r.cost_usd_est;
      t.hasCost = true;
    }
    if (r.tokens?.input != null) {
      t.input += r.tokens.input + (r.tokens.cache_read || 0) + (r.tokens.cache_creation || 0);
      t.output += r.tokens.output || 0;
      t.hasTok = true;
    }
    if (r.started_at && r.ended_at) t.durMs += Math.max(0, Date.parse(r.ended_at) - Date.parse(r.started_at));
  }
  return t;
}

function featureTable(runs, gates) {
  const lines = [];
  lines.push('| Passo | Iter | Agente | Modelo | Duração | Tok in/out | Custo est. | Status |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of runs) {
    const tokIn = r.tokens?.input != null ? fmtTok(r.tokens.input + (r.tokens.cache_read || 0) + (r.tokens.cache_creation || 0)) : '—';
    const tokOut = r.tokens?.output != null ? fmtTok(r.tokens.output) : '—';
    lines.push(
      `| ${r.step} | ${r.iteration ?? 1} | ${r.agent} | ${r.model_resolved || r.model || '—'} | ${fmtDuration(r.started_at, r.ended_at)} | ${tokIn} / ${tokOut} | ${fmtCost(r.cost_usd_est)} | ${r.status || '—'} |`
    );
  }
  const t = totals(runs);
  const gateStr = gates.length
    ? gates.map((g) => `Gate ${g.step}: ${g.approved ? '✔' : '✖'}`).join(' · ')
    : 'nenhum gate registrado';
  lines.push('');
  lines.push(
    `**Parcial:** ${t.hasCost ? '~' + fmtCost(t.cost) : '—'} (estimado) · ${t.count} invocações · ${fmtDuration(new Date(0).toISOString(), new Date(t.durMs).toISOString())} de agentes · ${gateStr}`
  );
  return lines.join('\n');
}

function mermaidSequence(runs) {
  const lines = ['```mermaid', 'sequenceDiagram', '  participant O as Orquestrador'];
  const agents = [...new Set(runs.map((r) => r.agent))];
  for (const a of agents) lines.push(`  participant ${a.replace(/[^a-zA-Z0-9]/g, '_')} as ${a}`);
  for (const r of runs) {
    const id = r.agent.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`  O->>+${id}: Passo ${r.step}${(r.iteration ?? 1) > 1 ? ` (iter ${r.iteration})` : ''}`);
    lines.push(`  ${id}-->>-O: ${(r.summary || r.status || 'ok').replace(/[|<>]/g, ' ').slice(0, 60)}`);
  }
  lines.push('```');
  return lines.join('\n');
}

function featureReport(featureDir, write) {
  const runFile = path.join(featureDir, 'RUN.jsonl');
  const events = readJsonl(runFile);
  if (!events.length) {
    console.log(`[sdd-report] sem RUN.jsonl legível em ${featureDir}`);
    return;
  }
  const { runs, gates, runStart, runEnd } = consolidate(events);
  const feature = runStart?.feature || path.basename(featureDir);
  const maxStep = runs.length ? Math.max(...runs.map((r) => r.step)) : 0;

  const header = `### Painel SDD — ${feature} · ${runEnd ? 'rodada concluída' : `até Passo ${maxStep}/7`}`;
  const table = featureTable(runs, gates);
  const terminal = `${header}\n\n${table}`;
  console.log(terminal);

  if (write) {
    const t = totals(runs);
    const md = [
      `# Dashboard: ${feature}`,
      '',
      '> Gerado automaticamente por `sdd-report.mjs` a partir do `RUN.jsonl` — não editar manualmente.',
      '',
      `**Run:** \`${runStart?.run_id || '—'}\` · **Início:** ${runStart?.started_at || '—'} · **Fim:** ${runEnd?.ended_at || 'em andamento'} · **Custo total estimado:** ${t.hasCost ? '~' + fmtCost(t.cost) : '—'}`,
      '',
      '## Invocações',
      '',
      table,
      '',
      '## Interação entre agentes',
      '',
      mermaidSequence(runs),
      '',
      '## Gates',
      '',
      gates.length
        ? gates.map((g) => `- Passo ${g.step}: ${g.approved ? 'APROVADO' : 'AJUSTES SOLICITADOS'}${g.notes ? ` — ${g.notes}` : ''} (${g.at || ''})`).join('\n')
        : '_nenhum gate registrado ainda_',
      '',
      '## Artefatos produzidos',
      '',
      [...new Set(runs.flatMap((r) => r.artifacts || []))].map((a) => `- \`${a}\``).join('\n') || '_nenhum registrado_',
      '',
      `_Custos são **estimativas** por tabela de preços (pricing.json); tokens vêm dos transcripts locais quando disponíveis._`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(featureDir, 'DASHBOARD.md'), md);
    console.log(`\n[sdd-report] DASHBOARD.md regenerado em ${featureDir}`);
  }
}

function aggregate(specsDir, write) {
  const featuresDir = path.join(specsDir, 'features');
  let dirs = [];
  try {
    dirs = fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => path.join(featuresDir, d.name));
  } catch {
    console.error(`[sdd-report] ${featuresDir} não encontrado`);
    process.exit(1);
  }

  const rows = [];
  const byAgent = new Map();
  const byModel = new Map();
  let semTelemetria = 0;

  for (const dir of dirs) {
    const events = readJsonl(path.join(dir, 'RUN.jsonl'));
    if (!events.length) {
      semTelemetria++;
      continue;
    }
    const { runs, runStart, runEnd } = consolidate(events);
    const t = totals(runs);
    const iter6 = Math.max(0, ...runs.filter((r) => r.step === 6).map((r) => r.iteration ?? 1));
    rows.push({
      feature: runStart?.feature || path.basename(dir),
      started: runStart?.started_at || null,
      status: runEnd ? 'concluída' : 'em andamento',
      invocacoes: t.count,
      custo: t.hasCost ? t.cost : null,
      tokensOut: t.hasTok ? t.output : null,
      durMs: t.durMs,
      iter6,
    });
    for (const r of runs) {
      const a = byAgent.get(r.agent) || { count: 0, cost: 0, hasCost: false };
      a.count++;
      if (r.cost_usd_est != null) {
        a.cost += r.cost_usd_est;
        a.hasCost = true;
      }
      byAgent.set(r.agent, a);
      const modelKey = r.model_resolved || r.model || '—';
      const m = byModel.get(modelKey) || { count: 0, cost: 0, hasCost: false };
      m.count++;
      if (r.cost_usd_est != null) {
        m.cost += r.cost_usd_est;
        m.hasCost = true;
      }
      byModel.set(modelKey, m);
    }
  }

  rows.sort((a, b) => (b.started || '').localeCompare(a.started || ''));
  const lines = [];
  lines.push(`# Dashboard SDD — agregado (${rows.length} rodadas com telemetria, ${semTelemetria} features sem telemetria)`);
  lines.push('');
  lines.push('| Feature | Início | Status | Invocações | Iter. Passo 6 | Tok out | Custo est. |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| ${r.feature} | ${r.started ? r.started.slice(0, 10) : '—'} | ${r.status} | ${r.invocacoes} | ${r.iter6 || 1} | ${fmtTok(r.tokensOut)} | ${fmtCost(r.custo)} |`
    );
  }
  const totalCost = rows.reduce((s, r) => s + (r.custo || 0), 0);
  const withCost = rows.filter((r) => r.custo != null);
  lines.push('');
  lines.push(`**Total estimado:** ${fmtCost(totalCost)} · **média/feature:** ${withCost.length ? fmtCost(totalCost / withCost.length) : '—'}`);
  lines.push('');
  lines.push('## Por agente');
  lines.push('');
  lines.push('| Agente | Invocações | Custo est. |');
  lines.push('|---|---|---|');
  for (const [agent, a] of [...byAgent.entries()].sort((x, y) => y[1].cost - x[1].cost)) {
    lines.push(`| ${agent} | ${a.count} | ${a.hasCost ? fmtCost(a.cost) : '—'} |`);
  }
  lines.push('');
  lines.push('## Por modelo');
  lines.push('');
  lines.push('| Modelo | Invocações | Custo est. |');
  lines.push('|---|---|---|');
  for (const [model, m] of [...byModel.entries()].sort((x, y) => y[1].cost - x[1].cost)) {
    lines.push(`| ${model} | ${m.count} | ${m.hasCost ? fmtCost(m.cost) : '—'} |`);
  }
  lines.push('');
  lines.push('### Top 5 mais caras');
  lines.push('');
  for (const r of [...rows].filter((r) => r.custo != null).sort((a, b) => b.custo - a.custo).slice(0, 5)) {
    lines.push(`- ${r.feature}: ${fmtCost(r.custo)}`);
  }
  lines.push('');
  lines.push('_Custos são **estimativas** por tabela de preços._');

  const out = lines.join('\n');
  console.log(out);
  if (write) {
    fs.writeFileSync(path.join(specsDir, 'DASHBOARD.md'), out + '\n');
    console.log(`\n[sdd-report] ${path.join(specsDir, 'DASHBOARD.md')} gravado`);
  }
}

function appendRunIndex(featureDir, indexPath, project) {
  const events = readJsonl(path.join(featureDir, 'RUN.jsonl'));
  if (!events.length) {
    console.error('[sdd-report] sem RUN.jsonl — nada para indexar');
    process.exit(0);
  }
  const { runs, runStart, runEnd } = consolidate(events);
  const t = totals(runs);
  const porAgente = {};
  for (const r of runs) {
    const a = porAgente[r.agent] || { invocacoes: 0, custo: 0, modelo: r.model_resolved || r.model || null };
    a.invocacoes++;
    if (r.cost_usd_est != null) a.custo = Math.round((a.custo + r.cost_usd_est) * 10000) / 10000;
    porAgente[r.agent] = a;
  }
  const line = {
    project: project || 'desconhecido',
    feature: runStart?.feature || path.basename(featureDir),
    run_id: runStart?.run_id || null,
    started_at: runStart?.started_at || null,
    ended_at: runEnd?.ended_at || null,
    status: runEnd ? 'concluida' : 'em_andamento',
    invocacoes: t.count,
    custo_total_est: t.hasCost ? Math.round(t.cost * 10000) / 10000 : null,
    tokens_out: t.hasTok ? t.output : null,
    iteracoes_passo6: Math.max(0, ...runs.filter((r) => r.step === 6).map((r) => r.iteration ?? 1)) || 1,
    por_agente: porAgente,
    indexed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.appendFileSync(indexPath, JSON.stringify(line) + '\n');
  console.log(`[sdd-report] rodada indexada em ${indexPath}`);
}

function estimate(indexPath) {
  const hist = readJsonl(indexPath).filter((h) => h.status === 'concluida' && h.custo_total_est != null);
  if (!hist.length) {
    console.log('[sdd-report] sem histórico ainda — nenhuma estimativa disponível (primeira rodada)');
    return;
  }
  const custos = hist.map((h) => h.custo_total_est).sort((a, b) => a - b);
  const durs = hist
    .filter((h) => h.started_at && h.ended_at)
    .map((h) => Date.parse(h.ended_at) - Date.parse(h.started_at))
    .sort((a, b) => a - b);
  const mediana = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);
  const medCusto = mediana(custos);
  const medDur = mediana(durs);
  console.log(
    `[sdd-report] histórico: ${hist.length} rodadas concluídas · custo mediano ~${fmtCost(medCusto)} (min ${fmtCost(custos[0])}, max ${fmtCost(custos[custos.length - 1])})` +
      (medDur ? ` · duração mediana ~${Math.round(medDur / 60000)}min` : '')
  );
}

const args = parseArgs(process.argv);
if (args.feature) featureReport(path.resolve(args.feature), !!args.write);
else if (args.aggregate) aggregate(path.resolve(args.aggregate), !!args.write);
else if (args['append-run-index']) appendRunIndex(path.resolve(args['append-run-index']), path.resolve(args.index), args.project);
else if (args.estimate) estimate(path.resolve(args.index));
else {
  console.error('uso: sdd-report.mjs --feature <dir> [--write] | --aggregate <specsDir> [--write] | --append-run-index <dir> --index <path> --project <nome> | --estimate --index <path>');
  process.exit(1);
}
