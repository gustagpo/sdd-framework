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
**Origem**: rodada real bypass-seguranca-integrador (algar, 22/07/2026) — QA usou `git stash -u` para provar 0 regressão sobre 153/1879 unit e as 15 falhas e2e pré-existentes; reforça a L036 do projeto. Reforço: rodada solicitacao-chip-por-estoque (algar, 23/07/2026) — a baseline medida no HEAD `752185f` (157/1971 com 1 suíte já vermelha) foi o que permitiu declarar 0 regressão em 164/2154; sem ela, a falha pré-existente (TS2554) teria reprovado a entrega.

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

### P-012 — Avaliadores independentes (DevOps/Security) sobre o caminho de GASTO acham o que a suíte funcional verde não mostra

**Contexto**: Passo 6 — avaliação da implementação por 4 papéis (QA funcional, UX/UI, Security, DevOps) quando a feature dispara efeito externo com custo real (compra, cobrança, emissão).
**Problema**: a cobertura funcional do QA tende a modelar o **caminho especificado** — fixtures "felizes" que contêm exatamente os dados que o código espera. Numa rodada real, a suíte da feature estava 100% verde e mesmo assim escondia um bloqueante ALTA: uma guarda de idempotência fail-open que compraria chips repetidamente. O achado veio do **DevOps**, por raciocínio **operacional** (o que acontece no deploy real, com o gatilho ligado por default e dados legados no banco), e o **Security** apontou a mesma raiz por outro ângulo (janela de gasto) — nenhum dos dois estava na matriz de testes do QA. Sem avaliadores independentes, o bug iria a produção com suíte verde e EVALUATION funcional aprovado.
**Regra**: toda feature cujo caminho normal **gasta dinheiro ou dispara efeito irreversível** recebe avaliação independente de DevOps (deploy/defaults/dados legados/rollback: "o que acontece na 1ª execução em produção?") e Security (janelas de gasto/burst/bypass) **além** da funcional — os três leem o mesmo código com perguntas diferentes. Quando um desses avaliadores derruba uma suíte verde, a correção inclui **o teste que faltava** (com o dado hostil que a fixture feliz omitia — ver N-015 da stack), não só o fix. Verde funcional ≠ seguro operacional.
**Origem**: rodada real solicitacao-chip-por-estoque (algar, 23/07/2026) — D-01 (DevOps, ALTA/bloqueante) e S-01 (Security) sobre a mesma raiz que a suíte funcional verde do QA não cobria.

### P-013 — Reconciliar o pedido com o estado real do código ANTES de especificar: parte do pedido pode já existir

**Contexto**: Passo 1 (discovery), quando o pedido de feature chega do usuário/orquestrador descrevendo o que deve ser construído.
**Problema**: o autor do pedido nem sempre viu as entregas anteriores — o pedido pode descrever coisas que **já existem**. Numa rodada real, metade do pedido original (rotas públicas sob `/portal/`, página `/portal/fatura/:token`, endpoint público com `loggedUser` de serviço, token opaco na entidade de fatura) já existia de uma feature entregue 2 semanas antes; só foi descoberto na preparação da rodada. Especificar sem reconciliar produziria spec/contract/testes para código existente (custo de uma rodada inteira) ou, pior, reimplementação paralela do que já funciona.
**Regra**: o RESEARCH abre com uma seção **"Escopo real"** que reconcilia **cada item do pedido** contra o código, com evidência (`arquivo:linha`), **antes** dos requisitos — itens já existentes saem do escopo com a evidência registrada e a spec cobre só o delta. "A feature (ou parte dela) já existe" é o achado mais valioso do discovery: procurá-lo ativamente (grep pelos nomes de rota/coluna/página citados no pedido), não esperar encontrá-lo por acidente.
**Origem**: algar, rodada checkout-token-opaco-e-logistica (23/07/2026) — pedido de 4 itens reduzido a 2 na abertura do RESEARCH.

### P-014 — TDD: teste vermelho tem de falhar por ASSERÇÃO, carregando — não por `Cannot find module`

**Contexto**: Passo 4 (QA escreve a bateria de testes antes da implementação do Passo 5).
**Problema**: suíte que importa módulo/tipo ainda inexistente falha no **load** — o Jest conta **0 testes** para ela. Numa rodada real, 5 de 9 suítes falhavam por `Cannot find module`: o Passo 4 reportou "58 falhando" quando a bateria real tinha 187 casos (só reconciliado na auditoria de TDD do Passo 6). O sinal de progresso do Passo 5 fica falso (a suíte "aparece de uma vez" em vez de virar verde teste a teste) e não dá para distinguir teste que valida comportamento de teste que nem compila.
**Regra**: para todo módulo novo, o QA cria junto o **stub mínimo** (arquivo com as assinaturas exportadas retornando trivial/lançando `NotImplemented`) para que toda suíte **carregue e falhe por asserção**. O relatório do Passo 4 declara "N suítes / M testes, todos falhando por asserção" — falha de load é estado intermediário de escrita, nunca estado entregue do passo. Corolário para a auditoria do Passo 6: reconciliar a contagem do Passo 4 com a final (suítes que não carregavam contam 0) antes de concluir qualquer coisa sobre a integridade do TDD.
**Origem**: algar, rodada checkout-token-opaco-e-logistica (23/07/2026) — ressalva de processo registrada pelo QA no EVALUATION.

### P-015 — Agente em lote que cai por limite de sessão fica pendurado por horas: monitorar atividade e re-spawnar cedo

**Contexto**: qualquer passo com múltiplos agentes spawnnados em paralelo (típico: Passo 6, avaliadores independentes), orquestrador aguardando as mensagens finais.
**Problema**: numa rodada real, agentes spawnnados em lote caíram por **limite de sessão** e ficaram **pendurados ~3h45** antes de serem tratados como falha; o retry limpo custou **~8 min**. O custo do incidente não é o retry — é a **detecção tardia**: esperar passivamente a mensagem final não distingue "trabalhando" de "morto", e a rodada inteira fica refém do agente mais quebrado.
**Regra**: spawn em lote exige monitoramento ativo: (1) verificação periódica de progresso por agente (transcript cresce? há tool-calls recentes?) com **timeout de inatividade** ordens de grandeza menor que a duração esperada do passo (ex.: 15–20 min sem atividade ⇒ suspeito); (2) agente inativo além do timeout é **re-spawnado limpo** sem cerimônia — o retry é barato, o pendurado é caro; (3) limite de sessão/contexto é causa **correlacionada em lote**: se um agente cai por limite, verificar os irmãos imediatamente, sem esperar o timeout individual de cada um. Relaciona-se com P-006 (slots idle no spawn paralelo).
**Origem**: algar, rodada ciclo-vida-linha (24/07/2026) — Passo 6 com avaliadores em lote; detecção tardia custou ~3h45 contra ~8 min do retry.

### P-016 — Subagente com CWD num subrepo cria `specs/` órfão: docs de feature/estado/lições se escrevem por caminho ABSOLUTO

**Contexto**: workspace multi-repo (raiz do workspace com `specs/` + subrepos de código, ex.: `algar/` com `algar-back/` e `algar-front/`); subagentes spawnnados com CWD dentro do subrepo onde o código muda.
**Problema**: agente instruído a escrever "em `specs/features/<nome>/...`" resolve o caminho relativo contra o **próprio CWD** e cria uma árvore `specs/` **órfã dentro do subrepo** — o documento "entregue" não existe onde o orquestrador/gates o leem, e o working tree do subrepo ganha lixo que polui o `git status` da feature.
**Regra**: todo prompt a subagente que escreve fora do repositório em trabalho (docs de feature, STATE, LESSONS, knowledge) usa caminhos **ABSOLUTOS, resolvidos e injetados pelo orquestrador** — o agente nunca infere a raiz do workspace a partir do CWD. O fechamento de cada passo confere (1) a existência do artefato no path canônico e (2) a ausência de `specs/` órfão nos subrepos (`ls <subrepo>/specs` deve falhar).
**Origem**: algar, rodada notas-algar-por-servico (24/07/2026).

### P-017 — `sdd-log --type note` com `run_id` nulo corrompe o RUN.jsonl (flush race): eventos tipados com run válido + paths absolutos

**Contexto**: telemetria da rodada — RUN.jsonl append-only alimentado por `sdd-log` a partir do orquestrador e de subagentes.
**Problema**: uma chamada `sdd-log --type note` com `run_id` **nulo** (a sessão do agente não herdou o id da rodada) gravou concorrendo com o flush de outro evento e **corrompeu linhas** do RUN.jsonl (JSONL inválido no meio do arquivo) — dashboard e backfill de custos passam a falhar no parse, e o dano só aparece na leitura, longe da causa.
**Regra**: (1) evento **sem `run_id` válido é rejeitado na origem** (o wrapper valida antes de abrir o arquivo) — nunca gravado "para não perder"; (2) preferir os **eventos tipados** do fluxo (`step_start`/`agent_run`/`gate`) à `note` genérica — é o evento com menos contexto e o que mais aparece sem run; (3) o path do RUN.jsonl é **absoluto e injetado** no prompt (mesma raiz da P-016) — CWD errado + path relativo é a receita do arquivo fantasma/duplicado; (4) recuperação: linhas inválidas são **quarentenadas** (movidas para um `.corrupt`, não deletadas) para o backfill posterior.
**Origem**: algar, rodada notas-algar-por-servico (24/07/2026).

### P-101 [security] — Endurecer o identificador sem auditar a resposta é trocar a fechadura mantendo a porta aberta

**Contexto**: feature pedida como "trocar id sequencial por token opaco" (ou endurecer qualquer identificador) numa rota pública.
**Problema**: o valor da enumeração não está no identificador — está no que a **resposta** entrega. Na rodada real, a resposta pública do checkout vazava PII do pagador (nome+CPF/CNPJ no JSON cru do provider de pagamento) e uma **credencial de outra superfície** (o token do portal da fatura), tudo enumerável pelo id sequencial; trocar o id por UUID sem tocar a resposta manteria o prêmio do ataque intacto para todo link legado retrocompatível e para qualquer vazamento futuro de token. O requisito "mudança aditiva, nenhum campo removido" da SPEC teria perpetuado o vazamento.
**Regra**: toda mudança de identificador público inclui, no mesmo escopo, a auditoria da **superfície da resposta** ("o que a resposta entrega HOJE a quem enumera?") — o threat model do Passo 3 trata a resposta como entregável de 1ª classe (whitelist DTO em 2 camadas, `Object.keys` asserido). "Nenhum campo removido" não é requisito válido para resposta pública: a compatibilidade é com os campos que o cliente **consome** (verificáveis por grep no front), não com o payload inteiro.
**Origem**: algar, rodada checkout-token-opaco-e-logistica (23/07/2026) — achado S-01 CRÍTICO do Security, invertendo a RN-010 da SPEC (CONTRACT C-01); reforça a L034 do projeto.

### P-102 [security] — Segurança × retrocompat: ramo legado vira débito com gatilho OBJETIVO, e o sinal que sustenta o gatilho nasce na mesma entrega

**Contexto**: requisito de segurança logicamente incompatível com retrocompatibilidade — ex.: "resolver só por token opaco, nunca por id sequencial" × "links numéricos já enviados (e-mails, QR) não podem quebrar e vivem meses".
**Problema**: escolher um lado quebra o outro; adiar "para depois" sem gatilho vira débito eterno; e a decisão futura (desligar o ramo legado, ligar um rate-limit) fica **indecidível** sem dados — agravante: rate-limit por IP em fluxo de pagamento é armadilha, pois clientes móveis atrás de **CGNAT compartilham IP** e um 429 mal calibrado **bloqueia receita** (dano maior que a enumeração mitigada).
**Regra**: (1) **dual-resolve por formatos disjuntos** (UUID × inteiro — zero ambiguidade), com o ramo legado explicitamente documentado como transitório: a mitigação está **incompleta** enquanto ele existir; (2) o débito de desativação entra no STATE com **gatilho objetivo e verificável** (ex.: cobranças não-terminais pré-deploy = 0 **E** 30 dias sem `ref_tipo=NUMERICO` no log; revisão periódica com prazo), nunca "remover no futuro"; (3) o **sinal de observabilidade que alimenta o gatilho é implementado na própria entrega** (log estruturado por tipo de ref, incluindo o caminho de erro — 404 sem log = enumeração invisível e gatilho cego); (4) enforcement que pode bloquear receita entra primeiro em **modo observação**, virando débito calibrado pelo sinal real antes de ligar o bloqueio.
**Origem**: algar, rodada checkout-token-opaco-e-logistica (23/07/2026) — decisões D-04/D-06/C-05 e débitos S-10/F-S2/D-02.
