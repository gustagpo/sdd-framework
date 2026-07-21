# Lições de Processo — SDD Framework

> Lições sobre o PRÓPRIO fluxo SDD (orquestração, gates, contratos, iterações) que valem em qualquer projeto e stack. Cada lição tem 1 linha no `INDEX.md` com tags. Formato: Contexto / Problema / Regra / Origem.

### P-001 — Telemetria de custo exige label determinístico + comando único

**Contexto**: captura de tokens/custo por invocação de agente (RUN.jsonl + transcripts).
**Problema**: correlacionar transcript↔invocação por heurística (tipo do agente, janela de tempo) quebra — os `agentType` reais são rótulos livres; e uma sequência de 2-3 comandos de telemetria por passo acaba esquecida pelo orquestrador (rodada de 17/07/2026: zero tokens_update, custo inteiro perdido).
**Regra**: toda invocação recebe `name`/label padronizado (`sdd-<papel>-p<passo>i<iter>-<sufixo>`) gravado no evento e casado por igualdade exata com o `agentType` do transcript; e a telemetria do passo é UM comando (`sdd-sync.mjs`), tratada como parte obrigatória do passo.
**Origem**: rodadas reais integracao-correios/improve-correios-connection (algar, 16-17/07/2026).

### P-002 — Uma feature por sessão

**Contexto**: rodadas `/sdd` consecutivas na mesma sessão do Claude Code.
**Problema**: o contexto do orquestrador acumula (gates, painéis, retornos de ~26 invocações por rodada); duas features + loops de correção na mesma sessão chegaram a ~305M de cache_read e estouraram o limite da sessão.
**Regra**: o orquestrador RECUSA iniciar uma segunda rodada na mesma sessão e instrui sessão nova. Vale também para retomadas longas.
**Origem**: sessão real com 2 rodadas (algar, 16-17/07/2026).

### P-004 — `agentType` do transcript tem dois formatos (e há ruído a filtrar)

**Contexto**: correlacionar transcripts de subagent com eventos do RUN.jsonl.
**Problema**: o `meta.agentType` vem como o `name` passado na invocação (rótulo livre) OU, quando `name` é omitido, como o `subagent_type` **namespaced pelo plugin** (`sdd-framework:sdd-qa`). Um matcher que compare `agentType` cru com o papel falha em todos os casos; e o diretório de subagents também contém agentes genéricos (`Explore`, `general-purpose`) que poluem o fallback por tempo.
**Regra**: matching em cascata — (1) label exato, (2) `subagent_type` **normalizado** (remover prefixo `<plugin>:`) + janela de tempo, (3) janela pura ignorando os agentTypes genéricos. Passar `name` continua sendo o único jeito preciso em passos paralelos (5 agentes simultâneos).
**Origem**: bug reportado em rodada de outro projeto + backfill de 3 rodadas (07/2026).

### P-005 — Só registre `agent_run` se houve invocação real de subagent

**Contexto**: telemetria de custo por agente.
**Problema**: em 3 rodadas reais, 26/26/24 `agent_run` foram registrados mas só 12/15/2 transcripts existiam — o orquestrador fez parte do trabalho **inline** e mesmo assim registrou o evento. Custo desses eventos é irrecuperável (não há transcript) e o trabalho inline ainda consome o contexto da sessão principal, que é o recurso mais escasso.
**Regra**: trabalho inline do orquestrador NÃO gera `agent_run`. Mais importante: o orquestrador **não deve** fazer inline o que é de um agente — delegue sempre; se delegar for inviável, registre `note`, nunca `agent_run`.
**Origem**: backfill das rodadas integracao-correios / improve-correios-connection / relatorio-consumo-detalhado (07/2026).

### P-003 — Gate consome digest, nunca o documento inteiro

**Contexto**: apresentação de RESEARCH/SPEC/DESIGN/CONTRACT nos gates de aprovação.
**Problema**: documentos reais saem grandes (RESEARCH 80KB, SPEC 52KB, DESIGN 48KB); o orquestrador lendo-os inteiros para apresentar consome o contexto da sessão sem necessidade — o usuário pode abrir o arquivo.
**Regra**: o agente produtor retorna um `DIGEST DO GATE` (≤30 linhas, o essencial para decidir); o orquestrador apresenta digest + path e não lê o documento (exceção única: frontmatter do SPEC). Budgets de tamanho nos próprios documentos completam a economia.
**Origem**: mesmas rodadas reais de 16-17/07/2026.
