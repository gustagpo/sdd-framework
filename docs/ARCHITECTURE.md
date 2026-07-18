# Arquitetura — SDD Framework

Como o framework funciona por dentro. Leitura para quem vai mantê-lo ou estendê-lo.

---

## Visão geral

```
┌────────────────────────────  Plugin (este repo, versionado)  ───────────────────────────┐
│ commands/ ── sdd (orquestrador) · sdd-init · sdd-deploy (DevOps: deploy do projeto) ·   │
│              sdd-dashboard ── invocam ─► Agent(subagent_type: sdd-*, name: label)       │
│ agents/sdd-*.md  ── identidades genéricas (frontmatter: name/description/model/tools)   │
│ standards/ ── DDD/SOLID/API/SECURITY/OPS + stacks/<perfil> + infra/ (docker/nginx/tf/ci)│
│ templates/ ── documentos de feature e de projeto                                        │
│ scripts/   ── telemetria determinística (tokens, custo, painéis)                        │
│ knowledge/ ── lições entre projetos + runs-index.jsonl (calibração)                     │
└───────────────────────────────────────┬─────────────────────────────────────────────────┘
                                        │ /sdd-init gera · /sdd consome
┌───────────────────────────  Projeto consumidor (cada repo)  ─────────────────────────────┐
│ specs/sdd.config.json ── agentes/modelos/comandos/gates/convenções                       │
│ specs/STACK.md        ── perfil do projeto (MAIOR precedência de contexto)               │
│ specs/{ARCHITECTURE,STATE,LESSONS,TESTS}.md ── documentos vivos                          │
│ specs/features/<nome>/ ── docs da feature + RUN.jsonl + DASHBOARD.md                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Cadeia de precedência de contexto

Cada agente recebe no prompt os **caminhos** (nunca conteúdo inline) dos documentos, com a regra explícita: **o mais específico vence**.

```
1. specs/STACK.md do projeto           (regras do repositório)
2. knowledge/ do plugin                 (lições acumuladas — via INDEX.md + tags)
3. standards/stacks/<perfil>.md         (como a stack materializa os princípios)
4. standards/DDD|SOLID|API|SECURITY|OPS.md  (princípios genéricos e regras verificáveis por papel)
```

`context.byAgent` no config adiciona os documentos vivos por papel; `lessonsMode: "index"` faz os agentes lerem o índice do LESSONS.md e abrirem só as lições relevantes (controle de contexto).

## Orquestrador (`commands/sdd.md`)

- Resolve `${CLAUDE_PLUGIN_ROOT}` e **materializa caminhos absolutos** nos prompts (subagents não têm a variável).
- Invoca cada papel via `Agent({subagent_type, model, prompt})` — o `model` vem do config (override por rodada via `--model`), com retry em `fallbackModel`.
- Passos 3, 5 e 6 disparam agentes **em paralelo** (mesmo bloco de tool calls); consolidadores definidos em `conventions`. Security e DevOps entram nos Passos 3 e 6 (e DevOps no 5, quando o contrato tem infra) conforme `participation` — no Passo 6 o EVALUATION consolida até 4 seções (Funcional, UX/UI, Segurança, DevOps) e o aprovado geral exige todas.
- Registra cada invocação/gate no `RUN.jsonl` e roda os scripts de telemetria ao fim de cada passo (best-effort — telemetria nunca bloqueia o fluxo).
- Só escreve: eventos no RUN.jsonl, placeholders do RESUME.md e cópia inicial de templates. Código e documentos são sempre dos agentes.

## Agentes (`agents/sdd-*.md`)

Subagents nativos do Claude Code: frontmatter (`name`, `description`, `model: opus`, `tools`) + corpo com a identidade genérica. O **fable** entra só via parâmetro `model` do Agent tool (frontmatter fica `opus` como base segura). Os agentes são **imutáveis em relação ao aprendizado** — inteligência acumula em `knowledge/`, não no corpo deles.

Contrato de entrega comum: a mensagem final de cada agente é (a) resumo ≤3 linhas, (b) lista de arquivos escritos, (c) dados extras do passo — é o que o orquestrador registra como `summary`/`artifacts`.

## Schema do `sdd.config.json`

```jsonc
{
  "version": 1,
  "project":  { "name": "...", "specsDir": "specs" },
  "stack":    { "backendProfile": "nestjs", "frontendProfile": "react-vite", "stackFile": "specs/STACK.md" },
  "commands": { "build:backend": "...", "test:backend": "... --testPathPatterns=\"{pattern}\"", "test:backend:full": "...", "test:e2e": "...", "build:frontend": "..." },
  "agents":   { "<papel>": { "subagent": "sdd-*", "model": "fable|opus|sonnet|haiku", "fallbackModel": "...", "enabled": true, "objective": "...",
                             "participation": "always|auto|never" } },  // participation: só security/devops — "auto" segue os flags security_sensitive/infra_impact do SPEC
  "context":  { "alwaysRead": [...], "byAgent": { "<papel>": [...] }, "lessonsMode": "index|full" },
  "research": { "enabled": true, "docsDirs": [...], "openApiSpecs": [...], "webSearch": true },
  "gates":    { "mode": "ask|supervised|autonomous", "afterStep1": true, "afterStep2": true, "afterStep3": true },
  "phases":   { "mode": "ask|full|lite|spec-only|custom", "skip": [] },   // presets de fases; escolhidos no Gate Inicial quando "ask"
              // mode "ask" (default) = o validador pergunta o modo no início de cada rodada; autonomous = sem paradas até o Gate Final (pré-Passo 7)
  "conventions": { "draftNaming": "drafts/{DOC}.{agent}.md", "contractConsolidator": "dev-backend", "evaluationConsolidator": "qa", "backendOnlyDesign": "skip", "maxFixIterations": 3 },
  "dashboard": { "enabled": true, "pricingOverrides": { "<model>": { "input": 5.0, "output": 25.0 } } }
}
```

## Schema do `RUN.jsonl` (append-only)

Um evento por linha; **nunca reescrever linhas** — atualizações chegam como novos eventos e o agregador aplica "último vence".

| type | Campos principais |
|---|---|
| `run_start` | `run_id`, `feature`, `started_at`, `gate_mode`, `phases` (`{mode, skip}`), `file_autonomy`, `models` |
| `agent_start` | `step`, `iteration`, `agent`, `agent_label`, `model`, `at` — emitido ANTES da invocação (alimenta o painel ao vivo; sem agent_run correspondente = "em execução") |
| `agent_run` | `step`, `step_name`, `iteration`, `agent`, `subagent_type`, `model`, `model_requested`, `started_at`, `ended_at`, `status` (`completed`/`retried`/`failed`), `tokens{...source:"pending"}`, `summary`, `artifacts[]` |
| `gate` | `step` (número, ou `"final"` para o Gate Final do modo autônomo), `approved`, `auto` (true = registrado sem parada, modo autônomo), `notes`, `at` |
| `tokens_update` | `ref{step,agent,started_at,iteration}`, `model_resolved`, `tokens{...source:"transcript"|"unavailable"}`, `cost_usd_est`, `transcript` |
| `run_end` | `ended_at`, `status` |

Chave de correlação de um `agent_run`: `(step, agent, started_at)`. **Correlação de tokens**: o orquestrador nomeia cada invocação com `agent_label` (`sdd-<papel>-p<passo>i<iter>-<sufixo>`, passado como `name` do Agent) — o meta.json do transcript grava esse nome em `agentType`, e o matcher casa por igualdade exata (fallback legado: janela de tempo). Eventos são gravados SEMPRE via `sdd-log.mjs` (nunca JSON manual no shell).

## Telemetria (`scripts/`)

- **`sdd-tokens.mjs`** — para cada `agent_run` pendente, procura o transcript do subagent em `~/.claude/projects/<slug-do-cwd>/<sessão>/subagents/agent-*.jsonl`, casando por `agentType` (do `.meta.json`) + janela `[started_at−90s, ended_at+90s]`; um transcript casa com no máximo um evento. Soma `message.usage` das linhas `assistant` e calcula custo por `pricing.json` (+ `pricingOverrides`). Sem match ⇒ `source: "unavailable"` (painel mostra `—`; re-tenta na próxima execução). **Custo nunca vem do transcript** (subscription reporta 0).
- **`sdd-log.mjs`** — appender de eventos do RUN.jsonl por flags (run_id/timestamps automáticos; agent_run herda started_at do agent_start).
- **`sdd-sync.mjs`** — wrapper único por passo: tokens → report → DASHBOARD → painel no stdout (best-effort).
- **`sdd-live.mjs`** — painel ao vivo para outro terminal: re-render a cada 2s, matcher de tokens a cada 10s, encerra no run_end (`--once` para render único).
- **`sdd-report.mjs`** — consolida o RUN.jsonl e gera: painel da feature (`--feature`, `--write` ⇒ DASHBOARD.md com tabela + mermaid + gates + artefatos), agregado do projeto (`--aggregate`), linha do índice global (`--append-run-index`) e estimativa por histórico (`--estimate`). Toda aritmética é feita aqui — o LLM só apresenta a saída.
- Fragilidade conhecida: o formato dos transcripts é interno do Claude Code e pode mudar entre versões — por isso o fallback `unavailable` nunca quebra o fluxo.

## Knowledge (`knowledge/`)

Ver [LEARNING.md](LEARNING.md). Estruturalmente: `INDEX.md` (1 linha/lição com tags — o que os agentes leem primeiro), `PROCESS.md`, `stacks/<perfil>.md` e `runs-index.jsonl` (1 linha agregada por rodada de qualquer projeto — alimenta `--estimate` e `/sdd-dashboard --global`). **Sync plug-and-play**: o destino padrão das lições é o clone do marketplace (`~/.claude/plugins/marketplaces/sdd-framework`), presente em qualquer instalação — commit `learn:` + push com aprovação; `project.frameworkRepo` é apenas override opcional de mantenedor.

## Decisões de design registradas

- **Paths, não conteúdo inline**, nos prompts — controle de contexto e cache.
- **Consolidadores por config** (CONTRACT=dev-backend, EVALUATION=qa) — resolve a ambiguidade histórica de "quem consolida".
- **Telemetria por script pós-hoc** em vez de hooks `SubagentStop` — zero fricção de instalação e menos acoplamento a formatos de hook; hook fica como evolução possível.
- **Backend-only pula o Passo 2 por completo** (sem DESIGN.md mínimo) — regra única, sem variações.
- **Aprendizado em arquivos de knowledge, não no corpo dos agentes** — diffs revisáveis e sem crescimento descontrolado.
