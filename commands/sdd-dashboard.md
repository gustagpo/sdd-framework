# /sdd-dashboard — Painel de custos e histórico das rodadas SDD

Você apresenta o painel agregado das rodadas SDD deste projeto (e, opcionalmente, o histórico global entre projetos). **Toda a aritmética vem dos scripts — você apenas executa e apresenta.**

**Input**: `$ARGUMENTS` = `[--feature <nome>] [--write] [--global] [--learning]`

## Fluxo

1. **Aviso de atualização** (best-effort; pule se `updates.check === false`): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-version-check.mjs` — informativo apenas, nunca atualize automaticamente.
2. Leia `specs/sdd.config.json` (se ausente, informe que o projeto não usa o SDD Framework e sugira `/sdd-init`).
3. **Atualize a telemetria** (best-effort) das features com RUN.jsonl antes de reportar:
   ```bash
   for d in specs/features/*/; do [ -f "$d/RUN.jsonl" ] && node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-tokens.mjs --feature "$d" --project-dir "$(pwd)"; done
   ```
4. Escolha o modo:
   - **Sem argumentos**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --aggregate specs` — apresente a saída como markdown (custo/tokens/duração por feature, por agente, por modelo, médias, top 5). Com `--write`, adicione a flag para persistir `specs/DASHBOARD.md`.
   - **`--feature <nome>`**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --feature specs/features/<nome> --write` — painel detalhado da rodada (tabela + diagrama de sequência + gates + artefatos).
   - **`--global`**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --estimate --index ${CLAUDE_PLUGIN_ROOT}/knowledge/runs-index.jsonl` + leia o `runs-index.jsonl` e apresente a visão entre projetos (rodadas por projeto, custo mediano, evolução temporal). Se o histórico mostrar que um agente **nunca reprovou/iterou** com determinado modelo em várias rodadas, **sugira** (nunca aplique) testar um modelo mais barato para aquele papel.
   - **`--learning`**: leia `${CLAUDE_PLUGIN_ROOT}/knowledge/INDEX.md` e os arquivos de knowledge; apresente as lições registradas por categoria e destaque candidatas a revisão (muito antigas, nunca referenciadas, possivelmente supersedidas por standards).

## Regras

- Features sem `RUN.jsonl` aparecem como "sem telemetria" — normal para features anteriores ao framework; nunca trate como erro.
- Todo valor monetário é **estimativa** por tabela de preços — diga isso explicitamente ao apresentar.
- Falha em qualquer script: mostre o que foi possível e informe o que falhou; nunca aborte o painel inteiro.
