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

### P-006 — Limpar slots de subagentes concluídos entre fases destrava o paralelismo

**Contexto**: passos do SDD que invocam múltiplos subagentes em paralelo via spawn de painéis/sessões tmux (ex.: Passo 3 com 5 drafts simultâneos, Passo 6 com 4 avaliadores).
**Problema**: agentes que já terminaram o trabalho ficam **idle mas vivos** ocupando slot; ao longo da rodada os slots acumulam e o spawn da fase seguinte falha ou serializa por esgotamento — o paralelismo planejado degrada silenciosamente para execução sequencial (ou trava).
**Regra**: encerrar/limpar explicitamente os slots de agentes **concluídos** ao fechar cada fase (antes do gate ou do próximo spawn em lote) — o ciclo de vida do slot pertence ao orquestrador, não ao agente. Verificar slots livres é pré-condição do spawn paralelo, não diagnóstico pós-falha.
**Origem**: rodada real pagamentos-auditoria-estorno (algar, 21/07/2026) — spawn tmux esgotou slots com agentes idle acumulados entre fases.

### P-007 — O gate supervised existe para reverter propostas: levar sempre a proposta E a alternativa descartada, com o custo de cada uma

**Contexto**: gates de aprovação humana após Research/Spec, Design e Contract em modo supervised.
**Problema**: tratar o gate como carimbo ("aprovar o que o agente propôs") subestima seu valor real. Numa rodada real, o humano **reverteu duas propostas dos agentes**: no Gate 1 ampliou o escopo que o Team Leader propunha cortar (CC-e + inutilização de numeração + IPI entraram na v1) e no Gate 2 incluiu a emissão avulsa que o designer propunha deixar de fora. Se o digest tivesse apresentado só a recomendação (sem a alternativa descartada e seus custos), o humano não teria material para decidir diferente — e as reversões custariam uma iteração inteira ao serem descobertas tarde.
**Regra**: para toda decisão de escopo/arquitetura levada a gate, o digest apresenta **a proposta do agente E a(s) alternativa(s) descartada(s)**, cada uma com custo/risco/consequência em 1-2 linhas — a alternativa rejeitada pelo agente é informação de primeira classe, não ruído. O agente registra a decisão do humano no documento (com a proposta original preservada como "proposta revertida no gate") para a retrospectiva medir a taxa de reversão. Corolário: propostas conservadoras de corte de escopo são as mais frequentemente revertidas — sinalizá-las explicitamente como "corte proposto" no digest.
**Origem**: rodada real emissao-nfe-produto (algar, 22/07/2026) — Gates 1 e 2 reverteram propostas de TL e designer.
