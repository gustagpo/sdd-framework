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

### P-003 — Gate consome digest, nunca o documento inteiro

**Contexto**: apresentação de RESEARCH/SPEC/DESIGN/CONTRACT nos gates de aprovação.
**Problema**: documentos reais saem grandes (RESEARCH 80KB, SPEC 52KB, DESIGN 48KB); o orquestrador lendo-os inteiros para apresentar consome o contexto da sessão sem necessidade — o usuário pode abrir o arquivo.
**Regra**: o agente produtor retorna um `DIGEST DO GATE` (≤30 linhas, o essencial para decidir); o orquestrador apresenta digest + path e não lê o documento (exceção única: frontmatter do SPEC). Budgets de tamanho nos próprios documentos completam a economia.
**Origem**: mesmas rodadas reais de 16-17/07/2026.
