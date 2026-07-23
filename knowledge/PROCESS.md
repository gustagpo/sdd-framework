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

### P-008 — A baseline de regressão (unit E e2e) se mede no HEAD pré-feature, nunca se herda de documento

**Contexto**: no Passo 6 (avaliação), o QA precisa separar "falha pré-existente" de "regressão introduzida pela feature" para dar o veredito.
**Problema**: herdar a contagem de um documento (`TESTS.md`, CONTRACT §baseline, RESUME anterior) é frágil — o número desatualiza entre features e, sobretudo para **e2e**, esconde falhas que já eram vermelhas. Numa rodada real, a suíte e2e tinha **15 falhas pré-existentes**; sem medir a baseline, elas seriam contadas como regressão da feature e reprovariam uma entrega correta. Uma suíte de **unit** também virou falso-positivo de regressão só porque a mensagem do TS mudou (ver stack N/L: parâmetro opcional muda `Expected 2` → `Expected 2-3`).
**Regra**: o QA mede a baseline **no HEAD imediatamente anterior à feature**, com `git stash -u` (ou checkout do HEAD limpo), rodando as **mesmas** suítes (unit e e2e) que rodará no fim; a regressão é o **delta** entre as duas medições, não a diferença contra um número escrito. Falha pré-existente é catalogada por **código do erro + arquivo:linha + causa**, para não ser reintroduzida na conta quando a string do erro mudar. O número herdado do `TESTS.md` é ponto de partida para investigar, nunca a baseline.
**Origem**: rodada real bypass-seguranca-integrador (algar, 22/07/2026) — QA usou `git stash -u` para provar 0 regressão sobre 153/1879 unit e as 15 falhas e2e pré-existentes; reforça a L036 do projeto.

### P-009 — O consolidador de um artefato multi-papel deve contradizer o próprio draft quando outro papel traz evidência melhor

**Contexto**: Passo 3 — o Dev Backend **consolida** o CONTRACT a partir dos drafts de Backend/Frontend/QA/Security/DevOps; ele é autor de um draft **e** árbitro do documento final.
**Problema**: o consolidador tende a defender o próprio draft. Numa rodada real, a SPEC (e o draft do Backend) afirmavam "**sem migration**"; o draft do **DevOps** mostrou que havia uma migration **de dados** obrigatória (deixar o segredo em texto plano no banco sobreviveria ao deploy do hash e violaria o requisito de segurança). Se o consolidador tivesse "vencido por ser o dono do documento", o furo entraria em produção.
**Regra**: consolidar é arbitrar por **evidência**, não por autoria — o consolidador deve inverter explicitamente o próprio draft (e registrar a inversão em "Conflitos resolvidos") quando outro papel apresenta fato mais forte. O papel que levanta o ponto costuma ser o que **opera** a consequência (DevOps para rollout/migration, Security para superfície, QA para regressão); dar peso extra ao papel-dono-da-consequência é parte do critério. A seção "Conflitos resolvidos" do CONTRACT torna a inversão auditável na retrospectiva.
**Origem**: rodada real bypass-seguranca-integrador (algar, 22/07/2026) — CONTRACT §10.3, "sem migration" (SPEC/Backend) × "migration de dados existe" (DevOps) → corrigido para migration de dados.

### P-010 — Dependência declarada no `package.json` não prova uso: convenção só entra em doc com evidência de import

**Contexto**: `/sdd-init` e qualquer preenchimento de STACK.md/perfil de projeto inferido do repositório.
**Problema**: o STACK.md de um projeto documentou que "shadcn/ui e MUI convivem" no frontend, inferido do `package.json` + `components.json` sem checar o código. Na primeira rodada com UI, o UX/UI provou o contrário: `src/components/ui/` não existia (shadcn nunca instalado de fato) e **zero** arquivos importavam `@mui` — o padrão real era Tailwind utilitário puro + lucide. A doc errada quase induziu o designer a seguir uma biblioteca inexistente, custou verificação extra no Passo 2 e correção do STACK no Passo 7 (e o STATE carregou um "débito" fantasma de "duas bibliotecas convivendo").
**Regra**: convenção só entra em STACK.md/ARCHITECTURE com evidência de **uso** no código (`grep -rln "<import>" src/` > 0, diretório de componentes existe), nunca de **declaração** (package.json, lockfile, config órfã como `components.json`). Registrar a evidência junto (comando + resultado) para a próxima verificação ser barata. Dependência declarada e não usada é registrada como débito ("remover deps órfãs"), não como convenção.
**Origem**: horus, `/sdd-init` (22/07/2026), corrigido na rodada permissao-criacao-senha-usuario.

### P-011 — Infra de teste indisponível: decidir a estratégia no Contract e catalogar explicitamente o que NÃO rodou

**Contexto**: rodadas TDD em ambiente sem os serviços que os testes de integração exigem (banco local, navegador para inspeção visual).
**Problema**: sem Postgres local, testes de integração não rodam; se isso só é descoberto no Passo 6, ou trava a rodada ou o gap é maquiado como "passou". Agravante real: a porta padrão pode estar ocupada por um banco de **outro projeto** — o sintoma muda (`ECONNREFUSED` → erro de autenticação SASL) sem mudar a causa, confundindo o QA seguinte; e rodar contra esse banco significaria testar o schema errado.
**Regra**: detectar a disponibilidade da infra de teste no **baseline (Passo 3)** e levar a decisão de estratégia ao gate — ex.: híbrida, unit com DB mockado + casos de integração marcados "requer infra" caso a caso, catalogados como `it.todo`/`describe.skip` (nunca deletados nem "passando" vazios). O EVALUATION lista em seção própria "o que não foi verificado e por quê" para o Gate Final decidir com fatos; o débito de infra entra no STATE.md como pré-requisito das features que dependam de integração real. Cobertura por leitura de código (ex.: Security confirmando um UPDATE condicional) é registrada como tal — evidência, mas não execução.
**Origem**: horus, rodada permissao-criacao-senha-usuario (22/07/2026) — 10 casos "requer Postgres" nunca executados; estratégia híbrida decidida pelo usuário no gate; aceite consciente no Gate Final.
