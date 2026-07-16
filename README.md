# SDD Framework

**Spec-Driven Design multi-agente para Claude Code.** Um plugin que orquestra o desenvolvimento de features através de um time de agentes especializados — Team Leader, UX/UI, Dev Backend, Dev Frontend e QA — com modelo de LLM configurável por agente, painel de custos por rodada e uma base de conhecimento que aprende a cada projeto.

## Filosofia

1. **Spec antes de código** — nenhuma feature é implementada sem `RESEARCH.md` + `SPEC.md` + `CONTRACT.md` aprovados. O Team Leader pesquisa a fundo (código, documentação local, web) antes de especificar.
2. **Papéis exclusivos** — cada agente só faz a sua função: Dev não decide design, UX/UI não escreve código, QA não escreve código de produção, Team Leader não implementa.
3. **Gates humanos** — o usuário aprova explicitamente a spec, o design e o contrato antes de qualquer implementação.
4. **TDD** — o QA escreve os testes antes de a feature existir; os Devs os fazem passar.
5. **Multi-stack** — o núcleo (fluxo + standards DDD/SOLID/API) é agnóstico; cada projeto declara sua stack (NestJS, Next.js, Python/FastAPI, Spring Boot, ...) via perfil + `STACK.md`.
6. **Aprendizado contínuo** — cada rodada gera lições classificadas (projeto/stack/processo). As de stack e processo ficam no plugin e propagam para todos os projetos que o usam.

## Quickstart (5 passos)

```bash
# 1. Adicione o marketplace (path local ou repo GitHub)
claude plugin marketplace add /caminho/para/sdd-framework

# 2. Instale o plugin no projeto
claude plugin install sdd-framework@sdd-framework --scope project
```

```text
# 3. Configure o projeto (detecta a stack, gera specs/ + sdd.config.json + STACK.md)
/sdd-init

# 4. Rode uma feature pelo fluxo completo (7 passos, com gates)
/sdd minha-feature "Descrição em linguagem natural do que a feature faz"

# 5. Veja custos e histórico
/sdd-dashboard
```

## O que tem dentro

| Diretório | Conteúdo |
|---|---|
| `commands/` | `/sdd` (orquestrador de 7 passos), `/sdd-init` (bootstrap/adoção), `/sdd-dashboard` (custos/histórico) |
| `agents/` | 5 subagents genéricos (`sdd-team-leader`, `sdd-ux-ui`, `sdd-dev-backend`, `sdd-dev-frontend`, `sdd-qa`) |
| `standards/` | DDD.md, SOLID.md, API.md (núcleo) + `stacks/` (nestjs, nextjs, python-fastapi, spring-boot) |
| `templates/` | Templates dos documentos de feature (RESEARCH/SPEC/PROMPT/DESIGN/CONTRACT/EVALUATION/RESUME) e de projeto (STACK, config, docs vivos) |
| `scripts/` | Telemetria determinística: `sdd-tokens.mjs` (tokens/custo dos transcripts), `sdd-report.mjs` (painéis), `pricing.json` |
| `knowledge/` | Base de conhecimento entre projetos: lições de processo, lições por stack, índice de rodadas |
| `docs/` | Documentação completa (abaixo) |

## Documentação

- **[docs/OPERATING.md](docs/OPERATING.md)** — manual de operação: anatomia de uma rodada, como agir nos gates, overrides de modelo, como ler os painéis, troubleshooting
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — como o framework funciona por dentro: orquestrador × agentes × config × standards, schemas do `sdd.config.json` e do `RUN.jsonl`, telemetria
- **[docs/EXTENDING.md](docs/EXTENDING.md)** — criar perfil de stack novo, customizar agentes e templates, ajustar preços
- **[docs/LEARNING.md](docs/LEARNING.md)** — o ciclo de aprendizado contínuo: taxonomia de lições, retrospectiva, calibração por histórico

## Requisitos e notas

- Claude Code com suporte a plugins; Node.js para os scripts de telemetria.
- Custos exibidos são **estimativas** por tabela de preços (`scripts/pricing.json`) — contas subscription não expõem custo real por token.
- Este repositório é a fonte de verdade do framework: lições aprendidas viram commits aqui (prefixo `learn:`) e propagam ao atualizar o plugin nos projetos.
- Se o diretório que contém este repo virar um repositório git, mova o framework para fora (repo aninhado só é seguro em workspace não-versionado).

## Versão

0.1.0 — ver `.claude-plugin/plugin.json`.
