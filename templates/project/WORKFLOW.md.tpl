# SDD Workflow — {{PROJECT_NAME}}

**Spec-Driven Design** multi-agente, executado pelo plugin `sdd-framework`. Configuração em `specs/sdd.config.json`; perfil do projeto em `specs/STACK.md` (maior precedência de contexto).

> **Como rodar**: `/sdd <nome-da-feature> "<descrição>" [--gates supervised|autonomous] [--phases full|lite|spec-only]`

---

## Gate Inicial (Gate 0) — as definições de cada rodada

Toda rodada começa com **uma única parada de configuração**, onde você define (o que já estiver fixado no `sdd.config.json` não é perguntado):

| Definição | Opções | O que muda |
|---|---|---|
| **Modo de aprovação** | `supervised` — gates entre as fases (1, 2 e 3) + confirmações · `autonomous` — permissão total, roda tudo e você confere UMA vez no **Gate Final** (antes do fechamento) | Onde a rodada para para você aprovar |
| **Fases (preset)** | `full` — 7 passos · `lite` — enxuto (sem TDD dedicado nem loop UX completo) · `spec-only` — só Research+Spec+Design+Contract (entrega specs, sem implementar) · `custom` — escolha os passos | Quais passos rodam |
| **Autonomia de arquivos** | sim/não | Concedida ⇒ os agentes leem/criam/editam sem pedir confirmação DENTRO das fases (paradas só nos gates) |

Guard-rails invioláveis: implementação nunca roda sem CONTRACT aprovado; pular testes/avaliação exige aceite explícito de risco; o fechamento (Passo 7) é obrigatório quando houve implementação; em modo autônomo o Gate Final é obrigatório.

## Teammates

| Papel | Subagent | Função |
|---|---|---|
| **Team Leader** | `sdd-team-leader` | Discovery profundo (RESEARCH.md), SPEC.md, PROMPT.md, RESUME.md, retrospectiva de aprendizado |
| **UX/UI** | `sdd-ux-ui` | DESIGN.md (pré) e validação visual/UX (pós) |
| **Dev Backend** | `sdd-dev-backend` | Contrato + implementação backend; consolida o CONTRACT.md |
| **Dev Frontend** | `sdd-dev-frontend` | Viabilidade do design, contrato + implementação frontend |
| **QA** | `sdd-qa` | Casos de teste, TDD, avaliação funcional; consolida o EVALUATION.md |
| **Security** | `sdd-security` | Threat model + casos SEC-XXX no contrato; revisão de segurança na avaliação |
| **DevOps** | `sdd-devops` | Requisitos operacionais + casos OPS-XXX; infra no Passo 5; deployability na avaliação |

Modelos por agente em `agents` do config (override por rodada: `--model papel=modelo`).

## Fluxo (preset `full`)

```
[Gate 0] configuração da rodada (modo, fases, autonomia)
[1. Team Leader] RESEARCH → SPEC + PROMPT          [Gate 1]
[2. UX/UI] DESIGN (pulado se backend-only)          [Gate 2]
[3. Devs+QA+Security+DevOps] drafts → CONTRACT      [Gate 3]
[4. QA] testes TDD (falham; compilam)
[5. Devs+DevOps] implementação
[6. UX/UI+QA+Security+DevOps] EVALUATION (4 seções; loop de correção máx. 3)
   [Gate Final — só modo autônomo]
[7. Team Leader] RESUME + STATE + retrospectiva de aprendizado
```

`lite`: 1 → 3 → 5 (testes junto ao dev) → 6 simplificado → 7 curto. `spec-only`: 1 → 2 → 3 e para.

## Estrutura de uma feature

```
specs/features/<nome>/
├── RESEARCH.md / SPEC.md / PROMPT.md / DESIGN.md
├── drafts/               ← rascunhos por agente (CONTRACT.*, EVALUATION.*)
├── CONTRACT.md / EVALUATION.md / RESUME.md
├── RUN.jsonl             ← telemetria (append-only)
└── DASHBOARD.md          ← painel gerado (não editar)
```

## Painéis e custo

- **Ao vivo**: o orquestrador imprime no início da rodada o comando do `sdd-live.mjs` — rode em outro terminal para ver agentes em execução, tokens e custo em tempo real.
- **Por feature**: `DASHBOARD.md` regenerado a cada passo. **Agregado**: `/sdd-dashboard`.
- Custos são **estimativas** por tabela de preços.

## Regras fundamentais

1. Cada teammate só faz a sua função; nenhum agente faz o trabalho de outro
2. Nenhuma spec sem RESEARCH (toda afirmação com fonte); nenhuma implementação sem CONTRACT aprovado
3. Feature só fecha com EVALUATION aprovado em TODAS as seções participantes
4. Uma feature por sessão do Claude Code
5. Toda lição vira aprendizado classificado (projeto → `specs/LESSONS.md`; stack/processo → `knowledge/` do plugin)
6. `STATE.md` atualizado a cada feature implementada; `ARCHITECTURE.md` a cada mudança arquitetural
