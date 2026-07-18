#!/usr/bin/env node
/**
 * sdd-sync.mjs — wrapper único de telemetria por passo: tokens → report → DASHBOARD → painel.
 *
 * O orquestrador roda UM comando ao fim de cada passo (e no fechamento):
 *   node sdd-sync.mjs --feature <dir> [--project-dir <cwd>] [--overrides <json>]
 *
 * Best-effort: falha em qualquer etapa não derruba o comando (exit 0 sempre que possível) —
 * telemetria nunca bloqueia o fluxo. O painel sai no stdout para o orquestrador reproduzir.
 */

import { spawnSync } from 'node:child_process';
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
  console.error('uso: sdd-sync.mjs --feature <dir> [--project-dir <cwd>] [--overrides <json>]');
  process.exit(1);
}

const featureDir = path.resolve(args.feature);
const projectDir = args['project-dir'] || process.cwd();

// 1) tokens (best-effort)
const tokensArgs = [path.join(scriptDir, 'sdd-tokens.mjs'), '--feature', featureDir, '--project-dir', projectDir];
if (args.overrides) tokensArgs.push('--overrides', args.overrides);
const tok = spawnSync('node', tokensArgs, { encoding: 'utf8' });
if (tok.status !== 0) console.error(`[sdd-sync] sdd-tokens falhou (seguindo mesmo assim): ${(tok.stderr || '').trim()}`);
else if (tok.stdout) process.stdout.write(tok.stdout);

// 2) report + DASHBOARD (painel no stdout)
const rep = spawnSync('node', [path.join(scriptDir, 'sdd-report.mjs'), '--feature', featureDir, '--write'], {
  encoding: 'utf8',
});
if (rep.status !== 0) {
  console.error(`[sdd-sync] sdd-report falhou: ${(rep.stderr || '').trim()}`);
  process.exit(0); // best-effort
}
process.stdout.write(rep.stdout);
