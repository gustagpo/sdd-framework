# Manual de Operação — SDD Framework

Guia do dia a dia para quem opera o fluxo. Pressupõe o plugin instalado e o projeto configurado (`/sdd-init` — ver README → Quickstart).

---

## Anatomia de uma rodada `/sdd`

Comando: `/sdd <nome-da-feature> "<descrição>" [--model papel=modelo,...]`

| Passo | Quem | O que você vê / faz |
|---|---|---|
| **Preparação** | orquestrador | Confirma o nome da pasta, copia templates para `specs/features/<nome>/`, abre o `RUN.jsonl` e mostra a **estimativa de custo/duração** baseada no histórico (se houver) |
| **1 — Research + Spec** | Team Leader | Discovery profundo (código, docs locais, web) → `RESEARCH.md`; depois `SPEC.md` + `PROMPT.md`. **[Gate 1]**: você revisa o research (perguntas em aberto!) e a spec |
| **2 — Design** | UX/UI | `DESIGN.md` com layout, componentes, estados de UI. Pulado por completo se a spec é `backend-only`. **[Gate 2]** |
| **3 — Contract** | Devs + QA + Security + DevOps (paralelo) | Rascunhos em `drafts/` (Security traz o threat model + casos SEC-XXX; DevOps traz requisitos operacionais + casos OPS-XXX); Dev Backend consolida o `CONTRACT.md`. **[Gate 3]** |
| **4 — Testes (TDD)** | QA | Testes escritos e **falhando** (compilam); você confirma |
| **5 — Implementação** | Devs + DevOps (paralelo) | Código + build/testes passando; DevOps implementa os itens de infra do contrato (env templates, CI/CD, configs), se houver; você confirma |
| **6 — Avaliação** | UX/UI + QA + Security + DevOps (paralelo) | `EVALUATION.md` com até 4 seções, consolidado pelo QA; aprovado geral exige TODAS as seções participantes; reprovações voltam ao responsável — `[DevOps]` corrige a própria infra (máx. 3 iterações) |
| **7 — Fechamento** | Team Leader | `RESUME.md`, `STATE.md`, **retrospectiva de aprendizado**; orquestrador mostra o painel final consolidado |

Ao fim de **cada** passo o orquestrador imprime o painel parcial (agente, modelo, duração, tokens, custo estimado, gates) e regenera o `DASHBOARD.md` da feature.

## Como agir em cada gate

- **Aprovar**: diga explicitamente ("aprovado", "pode seguir") — o gate é registrado no RUN.jsonl.
- **Pedir ajustes**: descreva o que mudar; o mesmo agente é re-invocado (iteração incrementada) e o gate se repete.
- **Abortar**: peça para parar — a pasta da feature e o RUN.jsonl ficam como registro; retome depois rodando `/sdd` de novo com o mesmo nome (o orquestrador vê o que já existe).
- Perguntas em aberto do `RESEARCH.md` aparecem no Gate 1 — respondê-las ali evita retrabalho nos passos seguintes.

## Participação de Security e DevOps

- Config `agents.security.participation` / `agents.devops.participation`: `"always"` (toda rodada — default), `"never"`, ou `"auto"` (entram quando o SPEC.md marcar `security_sensitive: true` / `infra_impact: true`; o Team Leader define os flags com base no research e você confirma no Gate 1).
- Custo: no modo `always`, cada rodada ganha ~2 invocações a mais no Passo 3 e ~2 no Passo 6 (+1 no Passo 5 quando há infra). Projetos com muitas features simples podem preferir `"auto"`.
- O Security **não corrige código** — findings dele são roteados aos Devs; o DevOps corrige os próprios itens de infra.

## Overrides de modelo

- **Por projeto**: edite `agents.<papel>.model` no `specs/sdd.config.json` (valores: `fable`, `opus`, `sonnet`, `haiku`; `fallbackModel` cobre indisponibilidade).
- **Por rodada**: `/sdd minha-feature "..." --model team-leader=opus,qa=sonnet` — vale só para a rodada.
- O modelo **efetivamente usado** fica registrado por invocação no RUN.jsonl e aparece nos painéis e no RESUME.md.

## Lendo os painéis

- **Terminal (por passo)**: tabela por invocação + parciais. `—` em tokens/custo = telemetria indisponível para aquela invocação (ver troubleshooting).
- **`specs/features/<nome>/DASHBOARD.md`**: painel completo da rodada — tabela, diagrama de sequência das interações, gates e artefatos. Regenerado automaticamente; não editar.
- **`/sdd-dashboard`**: agregado do projeto (custo por feature/agente/modelo, top 5, médias). Flags: `--feature <nome>` (detalhe), `--write` (persiste `specs/DASHBOARD.md`), `--global` (histórico entre projetos + sugestões de downgrade de modelo), `--learning` (lições da base de conhecimento).
- Todo valor monetário é **estimativa** por `pricing.json` — trate como ordem de grandeza, não como fatura.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `/sdd` pede `/sdd-init` | `specs/sdd.config.json` ausente | Rode `/sdd-init` |
| Agente iniciou com modelo diferente do configurado | Modelo primário indisponível | Normal: `fallbackModel` assumiu; evento fica `status: "retried"` no RUN.jsonl |
| Painel com `—` em tokens/custo | Transcript do subagent ainda não gravado/encontrado | Rode `/sdd-dashboard --feature <nome>` mais tarde — o `sdd-tokens` re-tenta eventos pendentes |
| Passo 6 estourou 3 iterações | Reprovações persistentes | O orquestrador para e apresenta a situação; decida entre relaxar o critério, ajustar o contrato (voltar ao Gate 3) ou intervir manualmente |
| Comando de teste falha com flag desconhecida | Comando errado no config | Corrija `commands.*` no `sdd.config.json` (os agentes nunca inventam flags — usam o que está lá) |
| Rodada interrompida no meio | sessão caiu / abort | Rode `/sdd` de novo com o mesmo nome de feature: os documentos já aprovados são reaproveitados; o orquestrador continua do primeiro passo sem artefato |
| Feature antiga "sem telemetria" no dashboard | Anterior ao framework | Esperado — só rodadas novas geram RUN.jsonl |

## Boas práticas

- Descrições de feature ricas no `/sdd` (contexto + para quem + restrições) reduzem perguntas no Gate 1.
- Mantenha o `specs/STACK.md` vivo: é o documento de maior precedência — regras novas do projeto entram lá (ou via retrospectiva).
- Revise periodicamente `/sdd-dashboard --learning` e `--global` — é onde o framework mostra o que aprendeu e onde dá para economizar.
