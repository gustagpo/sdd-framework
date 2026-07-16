## Metodologia SDD — Spec-Driven Design (via plugin sdd-framework)

Toda nova feature passa pelo fluxo SDD orquestrado pelo comando `/sdd <nome-da-feature> "<descrição>"` (plugin `sdd-framework`).

- **Configuração**: `specs/sdd.config.json` (agentes, modelos, comandos, gates) + `specs/STACK.md` (stack, convenções e regras do projeto — maior precedência de contexto)
- **Fluxo**: 7 passos — Research+Spec (Team Leader) → Design (UX/UI) → Contract (Devs+QA) → Testes TDD (QA) → Implementação (Devs) → Avaliação (UX/UI+QA) → Resume+aprendizado (Team Leader). Gates de aprovação humana após os passos 1, 2 e 3.
- **Documentos por feature**: `specs/features/<nome>/` — RESEARCH, SPEC, PROMPT, DESIGN, CONTRACT, EVALUATION, RESUME + `RUN.jsonl`/`DASHBOARD.md` (telemetria da rodada)
- **Painel**: custos e interações por rodada em `DASHBOARD.md` de cada feature; histórico agregado via `/sdd-dashboard`
- **Regra crítica**: nunca implementar feature sem SPEC.md e CONTRACT.md aprovados. Se chegar pedido de implementação direto, orientar a rodar `/sdd`.
