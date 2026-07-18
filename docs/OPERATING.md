# Manual de Operação — SDD Framework

Guia do dia a dia para quem opera o fluxo. Pressupõe o plugin instalado e o projeto configurado (`/sdd-init` — ver README → Quickstart).

---

## Anatomia de uma rodada `/sdd`

Comando: `/sdd <nome-da-feature> "<descrição>" [--model papel=modelo,...] [--gates supervised|autonomous] [--phases full|lite|spec-only]`

| Passo | Quem | O que você vê / faz |
|---|---|---|
| **Gate Inicial (0)** | orquestrador | UMA parada de configuração: modo de aprovação, **preset de fases** (full/lite/spec-only/custom), **autonomia de arquivos** e nome da pasta. Depois: copia templates, abre o `RUN.jsonl`, imprime o comando do **painel ao vivo** (`sdd-live.mjs`, para outro terminal) e a estimativa histórica |
| **1 — Research + Spec** | Team Leader | Discovery profundo (código, docs locais, web) → `RESEARCH.md`; depois `SPEC.md` + `PROMPT.md`. **[Gate 1]**: você revisa o research (perguntas em aberto!) e a spec |
| **2 — Design** | UX/UI | `DESIGN.md` com layout, componentes, estados de UI. Pulado por completo se a spec é `backend-only`. **[Gate 2]** |
| **3 — Contract** | Devs + QA + Security + DevOps (paralelo) | Rascunhos em `drafts/` (Security traz o threat model + casos SEC-XXX; DevOps traz requisitos operacionais + casos OPS-XXX); Dev Backend consolida o `CONTRACT.md`. **[Gate 3]** |
| **4 — Testes (TDD)** | QA | Testes escritos e **falhando** (compilam); você confirma |
| **5 — Implementação** | Devs + DevOps (paralelo) | Código + build/testes passando; DevOps implementa os itens de infra do contrato (env templates, CI/CD, configs), se houver; você confirma |
| **6 — Avaliação** | UX/UI + QA + Security + DevOps (paralelo) | `EVALUATION.md` com até 4 seções, consolidado pelo QA; aprovado geral exige TODAS as seções participantes; reprovações voltam ao responsável — `[DevOps]` corrige a própria infra (máx. 3 iterações) |
| **7 — Fechamento** | Team Leader | `RESUME.md`, `STATE.md`, **retrospectiva de aprendizado**; orquestrador mostra o painel final consolidado |

Ao fim de **cada** passo o orquestrador imprime o painel parcial (agente, modelo, duração, tokens, custo estimado, gates) e regenera o `DASHBOARD.md` da feature.

## Painel ao vivo

No início da rodada o orquestrador imprime o comando pronto — cole em outro terminal:

```bash
node <plugin>/scripts/sdd-live.mjs --feature specs/features/<nome> --project-dir "$(pwd)"
```

Re-renderiza a cada 2s: agentes **em execução** (com elapsed), tokens/custo por agente (matcher rodando a cada ~10s), totais da spec, gates e fases puladas. Encerra sozinho no `run_end`.

## Presets de fases (Gate Inicial)

| Preset | Passos | Para quem |
|---|---|---|
| `full` | 1→7 | Feature completa com TDD e avaliação total |
| `lite` | 1→3→5→6simpl.→7 | Rapidez: testes escritos junto da implementação; avaliação enxuta |
| `spec-only` | 1→2→3 e PARA | Quer só as specs (research/spec/design/contrato) para implementar por fora |
| `custom` | você escolhe | Guard-rails: implementação exige CONTRACT; pular testes/avaliação pede aceite de risco; Passo 7 obrigatório se implementou |

Default em `phases.mode` (`ask` pergunta a cada rodada); override por rodada com `--phases`.

## Modos de aprovação (o validador)

No início de cada rodada você escolhe como quer supervisionar (config `gates.mode`, default `"ask"` = perguntar sempre; `--gates` na chamada pula a pergunta):

| Modo | Comportamento |
|---|---|
| **`supervised`** | Gates após Passos 1, 2 e 3 + confirmações após 4 e 5 — você acompanha e aprova etapa a etapa (comportamento clássico) |
| **`autonomous`** | **Permissão total**: a rodada roda os 7 passos sem parar. Perguntas em aberto do research são decididas pelo Team Leader de forma conservadora e documentadas em "Decisões tomadas em autonomia". Toda a conferência acontece UMA vez, no **Gate Final** (entre os Passos 6 e 7): sumários de research/spec/contrato, decisões autônomas, veredito das 4 seções da avaliação, arquivos alterados e painel de custos. Você aprova (⇒ fechamento) ou pede ajustes (⇒ correção e novo Gate Final) |

Segurança do modo autônomo: o limite de iterações de correção (`maxFixIterations`) continua valendo — se estourar, a rodada para e apresenta a situação; e o fechamento (STATE/lições/RESUME) **nunca** acontece sem a sua aprovação no Gate Final.

## Como agir em cada gate

- **Aprovar**: diga explicitamente ("aprovado", "pode seguir") — o gate é registrado no RUN.jsonl.
- **Pedir ajustes**: descreva o que mudar; o mesmo agente é re-invocado (iteração incrementada) e o gate se repete.
- **Abortar**: peça para parar — a pasta da feature e o RUN.jsonl ficam como registro; retome depois rodando `/sdd` de novo com o mesmo nome (o orquestrador vê o que já existe).
- Perguntas em aberto do `RESEARCH.md` aparecem no Gate 1 — respondê-las ali evita retrabalho nos passos seguintes.

## Participação de Security e DevOps

- Config `agents.security.participation` / `agents.devops.participation`: `"always"` (toda rodada — default), `"never"`, ou `"auto"` (entram quando o SPEC.md marcar `security_sensitive: true` / `infra_impact: true`; o Team Leader define os flags com base no research e você confirma no Gate 1).
- Custo: no modo `always`, cada rodada ganha ~2 invocações a mais no Passo 3 e ~2 no Passo 6 (+1 no Passo 5 quando há infra). Projetos com muitas features simples podem preferir `"auto"`.
- O Security **não corrige código** — findings dele são roteados aos Devs; o DevOps corrige os próprios itens de infra.

## Autonomia de arquivos (sem interrupções dentro das fases)

Concedida no Gate Inicial ⇒ os agentes recebem a cláusula "leia/crie/edite sem pedir confirmação; nunca pergunte 'posso modificar X?'" e, se o projeto não tiver allowlist, o orquestrador oferece gravar `.claude/settings.local.json` escopado. Os gates continuam ENTRE as fases — dentro delas, zero paradas. Alternativa de sessão: `claude --permission-mode acceptEdits`.

## Overrides de modelo

- **Por projeto**: edite `agents.<papel>.model` no `specs/sdd.config.json` (valores: `fable`, `opus`, `sonnet`, `haiku`; `fallbackModel` cobre indisponibilidade).
- **Por rodada**: `/sdd minha-feature "..." --model team-leader=opus,qa=sonnet` — vale só para a rodada.
- O modelo **efetivamente usado** fica registrado por invocação no RUN.jsonl e aparece nos painéis e no RESUME.md.

## /sdd-deploy — planejar e configurar o deploy do projeto

Fluxo em 4 fases com o agente DevOps: **Discovery** (estado atual: Docker/nginx/Terraform/CI) → **Entrevista+Plano** (alvo, ambientes, TLS, secrets ⇒ `specs/DEPLOY.md`, com **gate de aprovação** antes de tocar em qualquer arquivo) → **Implementação assistida** (gera/ajusta Dockerfile, compose, nginx, Terraform, pipeline, `.env.example` — seguindo os checklists DKR/NGX/TF/CI de `standards/infra/`) → **Validação local** (`docker build`, `nginx -t`, `terraform validate`... pulando o que a máquina não tem) + próximos passos manuais numerados.

**Fronteira de segurança**: o comando prepara e valida — NUNCA executa `terraform apply`, provisionamento, `docker push`, deploy real, DNS ou secrets de provedor. Telemetria/painel ao vivo funcionam como nas rodadas (`specs/deploy/`). Com o `DEPLOY.md` existente, as rodadas `/sdd` passam a planejar OPS-XXX contra a topologia real.

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
| Painel com `—` em tokens/custo | Transcript ainda não gravado, ou invocação sem label | Rode `/sdd-dashboard --feature <nome>` mais tarde (o matcher re-tenta); rodadas novas casam por label determinístico (`agent_label`) |
| Passo 6 estourou 3 iterações | Reprovações persistentes | O orquestrador para e apresenta a situação; decida entre relaxar o critério, ajustar o contrato (voltar ao Gate 3) ou intervir manualmente |
| Comando de teste falha com flag desconhecida | Comando errado no config | Corrija `commands.*` no `sdd.config.json` (os agentes nunca inventam flags — usam o que está lá) |
| Rodada interrompida no meio | sessão caiu / abort | Rode `/sdd` de novo com o mesmo nome de feature: os documentos já aprovados são reaproveitados; o orquestrador continua do primeiro passo sem artefato |
| Feature antiga "sem telemetria" no dashboard | Anterior ao framework | Esperado — só rodadas novas geram RUN.jsonl |

## Atualizações do framework

O `/sdd`, o `/sdd-init` e o `/sdd-dashboard` verificam (no máx. 1×/dia, com timeout de 3s e silêncio em falha/offline) se há versão nova do plugin no repositório de origem e **apenas avisam**:

```
[sdd] 🔔 Nova versão do SDD Framework disponível: vA.B.C (instalada: vX.Y.Z). Para atualizar:
      claude plugin marketplace update sdd-framework && claude plugin update sdd-framework@sdd-framework --scope project
```

Atualizar é SEMPRE decisão do usuário (nunca automático; reinicie a sessão depois). Opt-out por projeto: `"updates": { "check": false }` no `sdd.config.json`. Verificação manual: `node <plugin>/scripts/sdd-version-check.mjs --force`.

## Boas práticas

- Descrições de feature ricas no `/sdd` (contexto + para quem + restrições) reduzem perguntas no Gate 1.
- Mantenha o `specs/STACK.md` vivo: é o documento de maior precedência — regras novas do projeto entram lá (ou via retrospectiva).
- Revise periodicamente `/sdd-dashboard --learning` e `--global` — é onde o framework mostra o que aprendeu e onde dá para economizar.
