#!/usr/bin/env node
/**
 * sdd-live.mjs — painel AO VIVO da rodada /sdd, para rodar em OUTRO terminal.
 *
 * O orquestrador imprime o comando pronto no início da rodada:
 *   node <plugin>/scripts/sdd-live.mjs --feature specs/features/<nome> --project-dir "$(pwd)"
 *
 * Comportamento: re-renderiza o painel a cada N segundos (default 2) tailing o RUN.jsonl —
 * mostra passos concluídos, agentes EM EXECUÇÃO (via eventos agent_start, com elapsed vivo),
 * tokens/custo por agente e total da spec (roda o matcher de tokens a cada ~10s), gates e modo.
 * Sai sozinho quando detecta run_end (render final) ou com Ctrl+C.
 *
 * Flags: --interval <seg> (default 2) · --tokens-every <seg> (default 10) · --once (1 render, sem loop)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);

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

const args = parseArgs(process.argv);
if (!args.feature) {
  console.error('uso: sdd-live.mjs --feature <dir> [--project-dir <cwd>] [--interval 2] [--tokens-every 10] [--once]');
  process.exit(1);
}

const featureDir = path.resolve(args.feature);
const projectDir = args['project-dir'] || process.cwd();
const intervalMs = Math.max(1, parseInt(args.interval || '2', 10)) * 1000;
const tokensEveryMs = Math.max(5, parseInt(args['tokens-every'] || '10', 10)) * 1000;
const runFile = path.join(featureDir, 'RUN.jsonl');

function runTokens() {
  spawnSync('node', [path.join(scriptDir, 'sdd-tokens.mjs'), '--feature', featureDir, '--project-dir', projectDir], {
    encoding: 'utf8',
  });
}

function renderOnce() {
  const rep = spawnSync('node', [path.join(scriptDir, 'sdd-report.mjs'), '--feature', featureDir], {
    encoding: 'utf8',
  });
  return rep.status === 0 ? rep.stdout : `[sdd-live] report indisponível: ${(rep.stderr || '').trim()}`;
}

function hasRunEnd() {
  try {
    return fs.readFileSync(runFile, 'utf8').includes('"type":"run_end"');
  } catch {
    return false;
  }
}

if (args.once) {
  runTokens();
  process.stdout.write(renderOnce());
  process.exit(0);
}

console.log(`[sdd-live] acompanhando ${featureDir} — Ctrl+C para sair\n`);
let lastTokens = 0;
let stop = false;
process.on('SIGINT', () => {
  stop = true;
});

const tick = () => {
  if (stop) process.exit(0);
  const now = Date.now();
  if (now - lastTokens >= tokensEveryMs) {
    runTokens();
    lastTokens = now;
  }
  const out = renderOnce();
  // limpa a tela e re-renderiza (ANSI)
  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(`sdd-live · ${new Date().toLocaleTimeString()} · atualiza a cada ${intervalMs / 1000}s · Ctrl+C sai\n\n`);
  process.stdout.write(out);
  if (hasRunEnd()) {
    runTokens();
    process.stdout.write('\x1b[2J\x1b[H');
    process.stdout.write(renderOnce());
    process.stdout.write('\n[sdd-live] rodada concluída (run_end) — encerrando.\n');
    process.exit(0);
  }
  setTimeout(tick, intervalMs);
};

if (!fs.existsSync(runFile)) {
  console.log(`[sdd-live] aguardando ${runFile} ser criado...`);
  const wait = () => {
    if (stop) process.exit(0);
    if (fs.existsSync(runFile)) tick();
    else setTimeout(wait, 1000);
  };
  wait();
} else {
  tick();
}
