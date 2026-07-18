#!/usr/bin/env node
/**
 * sdd-version-check.mjs — avisa (e só avisa) quando há versão nova do framework.
 *
 * NUNCA atualiza nada: imprime a versão nova + os comandos para o usuário rodar.
 * Falha = silêncio (offline/rate-limit/node antigo ⇒ exit 0 sem ruído).
 *
 * Uso: node sdd-version-check.mjs [--force] [--local-version X.Y.Z] [--repo-override owner/repo]
 * Cache: ~/.claude/plugins/cache/.sdd-version-check.json (TTL 24h; --force ignora)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 3000;

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

function semver(v) {
  const m = String(v || '').trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

function newer(a, b) {
  // a > b ?
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

function printNotice(remote, local) {
  console.log(`[sdd] 🔔 Nova versão do SDD Framework disponível: v${remote} (instalada: v${local}). Para atualizar:`);
  console.log('      claude plugin marketplace update sdd-framework && claude plugin update sdd-framework@sdd-framework --scope project');
  console.log('      (reinicie a sessão do Claude Code depois)');
}

async function fetchRemoteVersion(ownerRepo) {
  if (typeof fetch !== 'function') return null; // node < 18: silêncio
  for (const branch of ['main', 'master']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(
        `https://raw.githubusercontent.com/${ownerRepo}/${branch}/.claude-plugin/plugin.json`,
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.version) return String(data.version);
    } catch {
      /* tenta o próximo/fallback */
    }
  }
  // fallback: tags do clone do marketplace — só se o origin dele for o MESMO repo do manifest
  try {
    const mkt = path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'sdd-framework');
    if (fs.existsSync(path.join(mkt, '.git'))) {
      const origin = spawnSync('git', ['-C', mkt, 'remote', 'get-url', 'origin'], {
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
      });
      if (origin.status !== 0 || !origin.stdout.includes(ownerRepo)) return null;
      const out = spawnSync('git', ['-C', mkt, 'ls-remote', '--tags', 'origin'], {
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
      });
      if (out.status === 0) {
        const tags = (out.stdout.match(/refs\/tags\/v(\d+\.\d+\.\d+)/g) || [])
          .map((t) => t.replace('refs/tags/v', ''))
          .map(semver)
          .filter(Boolean)
          .sort((a, b) => (newer(a, b) ? -1 : 1));
        if (tags.length) return tags[0].join('.');
      }
    }
  } catch {
    /* silêncio */
  }
  return null;
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const pluginRoot = path.dirname(scriptDir);
    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
    } catch {
      process.exit(0);
    }
    const localStr = args['local-version'] || manifest.version;
    const local = semver(localStr);
    if (!local) process.exit(0);

    const repoUrl = args['repo-override'] || manifest.repository || '';
    const m = String(repoUrl).match(/(?:github\.com[/:])?([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
    if (!m) process.exit(0);
    const ownerRepo = m[1];

    // cache TTL
    const cacheFile = path.join(os.homedir(), '.claude', 'plugins', 'cache', '.sdd-version-check.json');
    if (!args.force) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.repo === ownerRepo && Date.now() - Date.parse(cache.checked_at) < TTL_MS) {
          const remote = semver(cache.remote_version);
          if (remote && newer(remote, local)) printNotice(cache.remote_version, localStr);
          else console.log(`[sdd] framework atualizado (v${localStr}) — última verificação: ${cache.checked_at}`);
          process.exit(0);
        }
      } catch {
        /* sem cache válido */
      }
    }

    const remoteStr = await fetchRemoteVersion(ownerRepo);
    if (!remoteStr) process.exit(0); // offline/erro: silêncio
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({ repo: ownerRepo, remote_version: remoteStr, checked_at: new Date().toISOString() })
      );
    } catch {
      /* cache é conveniência */
    }
    const remote = semver(remoteStr);
    if (remote && newer(remote, local)) printNotice(remoteStr, localStr);
    else console.log(`[sdd] framework atualizado (v${localStr})`);
  } catch {
    /* nunca falha barulhento */
  }
  process.exit(0);
}

main();
