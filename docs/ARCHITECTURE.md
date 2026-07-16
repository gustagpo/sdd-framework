# Arquitetura — SDD Framework

Como o framework funciona por dentro. Leitura para quem vai mantê-lo ou estendê-lo.

---

## Visão geral

```
┌────────────────────────────  Plugin (este repo, versionado)  ───────────────────────────┐
│ commands/sdd.md  ── orquestra ──► Agent(subagent_type: sdd-*, model: <config>)          │
│ agents/sdd-*.md  ── identidades genéricas (frontmatter: name/description/model/tools)   │
│ standards/ ── DDD/SOLID/API + stacks/<perfil> (como os princípios viram código)         │
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
4. standards/DDD|SOLID|API.md           (princípios genéricos e regras verificáveis)
```

`context.byAgent` no config adiciona os documentos vivos por papel; `lessonsMode: "index"` faz os agentes lerem o índice do LESSONS.md e abrirem só as lições relevantes (controle de contexto).

## Orquestrador (`commands/sdd.md`)

- Resolve `${CLAUDE_PLUGIN_ROOT}` e **materializa caminhos absolutos** nos prompts (subagents não têm a variável).
- Invoca cada papel via `Agent({subagent_type, model, prompt})` — o `model` vem do config (override por rodada via `--model`), com retry em `fallbackModel`.
- Passos 3, 5 e 6 disparam agentes **em paralelo** (mesmo bloco de tool calls); consolidadores definidos em `conventions`.
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
  "agents":   { "<papel>": { "subagent": "sdd-*", "model": "fable|opus|sonnet|haiku", "fallbackModel": "...", "enabled": true, "objective": "..." } },
  "context":  { "alwaysRead": [...], "byAgent": { "<papel>": [...] }, "lessonsMode": "index|full" },
  "research": { "enabled": true, "docsDirs": [...], "openApiSpecs": [...], "webSearch": true },
  "gates":    { "afterStep1": true, "afterStep2": true, "afterStep3": true },
  "conventions": { "draftNaming": "drafts/{DOC}.{agent}.md", "contractConsolidator": "dev-backend", "evaluationConsolidator": "qa", "backendOnlyDesign": "skip", "maxFixIterations": 3 },
  "dashboard": { "enabled": true, "pricingOverrides": { "<model>": { "input": 5.0, "output": 25.0 } } }
}
```

## Schema do `RUN.jsonl` (append-only)

Um evento por linha; **nunca reescrever linhas** — atualizações chegam como novos eventos e o agregador aplica "último vence".

| type | Campos principais |
|---|---|
| `run_start` | `run_id`, `feature`, `started_at`, `models` |
| `agent_run` | `step`, `step_name`, `iteration`, `agent`, `subagent_type`, `model`, `model_requested`, `started_at`, `ended_at`, `status` (`completed`/`retried`/`failed`), `tokens{...source:"pending"}`, `summary`, `artifacts[]` |
| `gate` | `step`, `approved`, `notes`, `at` |
| `tokens_update` | `ref{step,agent,started_at,iteration}`, `model_resolved`, `tokens{...source:"transcript"|"unavailable"}`, `cost_usd_est`, `transcript` |
| `run_end` | `ended_at`, `status` |

Chave de correlação de um `agent_run`: `(step, agent, started_at)`.

## Telemetria (`scripts/`)

- **`sdd-tokens.mjs`** — para cada `agent_run` pendente, procura o transcript do subagent em `~/.claude/projects/<slug-do-cwd>/<sessão>/subagents/agent-*.jsonl`, casando por `agentType` (do `.meta.json`) + janela `[started_at−90s, ended_at+90s]`; um transcript casa com no máximo um evento. Soma `message.usage` das linhas `assistant` e calcula custo por `pricing.json` (+ `pricingOverrides`). Sem match ⇒ `source: "unavailable"` (painel mostra `—`; re-tenta na próxima execução). **Custo nunca vem do transcript** (subscription reporta 0).
- **`sdd-report.mjs`** — consolida o RUN.jsonl e gera: painel da feature (`--feature`, `--write` ⇒ DASHBOARD.md com tabela + mermaid + gates + artefatos), agregado do projeto (`--aggregate`), linha do índice global (`--append-run-index`) e estimativa por histórico (`--estimate`). Toda aritmética é feita aqui — o LLM só apresenta a saída.
- Fragilidade conhecida: o formato dos transcripts é interno do Claude Code e pode mudar entre versões — por isso o fallback `unavailable` nunca quebra o fluxo.

## Knowledge (`knowledge/`)

Ver [LEARNING.md](LEARNING.md). Estruturalmente: `INDEX.md` (1 linha/lição com tags — o que os agentes leem primeiro), `PROCESS.md`, `stacks/<perfil>.md` e `runs-index.jsonl` (1 linha agregada por rodada de qualquer projeto — alimenta `--estimate` e `/sdd-dashboard --global`).

## Decisões de design registradas

- **Paths, não conteúdo inline**, nos prompts — controle de contexto e cache.
- **Consolidadores por config** (CONTRACT=dev-backend, EVALUATION=qa) — resolve a ambiguidade histórica de "quem consolida".
- **Telemetria por script pós-hoc** em vez de hooks `SubagentStop` — zero fricção de instalação e menos acoplamento a formatos de hook; hook fica como evolução possível.
- **Backend-only pula o Passo 2 por completo** (sem DESIGN.md mínimo) — regra única, sem variações.
- **Aprendizado em arquivos de knowledge, não no corpo dos agentes** — diffs revisáveis e sem crescimento descontrolado.
