# Knowledge Index — SDD Framework

> Índice da base de conhecimento acumulada entre projetos. **1 linha por lição**, com tags `[stack][papel][passo]`. Os agentes leem ESTE arquivo primeiro e abrem só as lições relevantes. Mantido pelo Team Leader na retrospectiva (Passo 7) de cada rodada — atualizar em vez de duplicar; lição errada é removida; lição que contradiz um standard corrige o standard.

## Processo (PROCESS.md)

- P-001 [processo][telemetria] Custo por agente exige label determinístico na invocação + telemetria em 1 comando por passo
- P-002 [processo][orquestrador] Uma feature por sessão — 2 rodadas na mesma sessão estouram o contexto
- P-003 [processo][gates] Gates consomem DIGEST (≤30 linhas) do agente, nunca o documento inteiro — **e o digest do agente é atalho, não fonte: sem ele, derivar do artefato (P-023)**
- P-004 [processo][telemetria] agentType do transcript tem 2 formatos (name livre | subagent_type namespaced) + ruído a filtrar
- P-005 [processo][telemetria] Só registre agent_run se houve invocação real de subagent — trabalho inline não tem transcript
- P-006 [processo][orquestrador] Spawn paralelo (tmux) esgota slots com agentes idle acumulados — limpar slots concluídos entre fases é pré-condição do próximo spawn
- P-007 [processo][gates] Gate supervised reverte propostas: digest leva a proposta E a alternativa descartada com custos — corte de escopo é o mais revertido
- P-008 [processo][qa][passo-6] Baseline de regressão (unit E e2e) se mede no HEAD pré-feature via `git stash -u`, nunca se herda do TESTS.md/documento — senão falha pré-existente conta como regressão
- P-009 [processo][dev-backend][passo-3] O consolidador do CONTRACT deve contradizer o próprio draft quando outro papel traz evidência melhor (a SPEC dizia "sem migration"; o DevOps mostrou migration de dados obrigatória)
- P-010 [processo][sdd-init][team-leader] Dependência no package.json não prova uso — convenção só entra em doc com evidência de import (grep); dep órfã vira débito
- P-011 [processo][qa][gates] Infra de teste ausente: detectar no baseline, decidir estratégia (híbrida) no gate, catalogar os casos "requer infra" e listar o não-verificado no EVALUATION
- P-012 [processo][ops][security][passo-6] Feature que gasta dinheiro exige avaliadores DevOps/Security independentes além do QA — bloqueante ALTA (guarda fail-open de compra) veio do raciocínio operacional com a suíte funcional 100% verde; a correção inclui o teste que faltava (dado hostil), não só o fix; **reforço 01/08**: convergência independente de 2 papéis no MESMO achado = sinal de confiança mais forte da avaliação; revalidação do loop se faz por REPRODUÇÃO independente, nunca por relato de quem corrigiu
- P-013 [processo][team-leader][passo-1] Reconciliar o pedido com o código no discovery — parte pode já existir de rodada anterior; RESEARCH abre com "Escopo real" (evidência arquivo:linha) e a spec cobre só o delta
- P-014 [processo][qa][passo-4] Teste TDD vermelho tem de falhar por ASSERÇÃO carregando — `Cannot find module` conta 0 no Jest e distorce o tamanho da bateria; criar stub do módulo junto
- P-015 [processo][orquestrador][passo-6] Spawn em lote: agente caído por limite de sessão fica pendurado horas — monitorar atividade com timeout curto (~15-20min sem tool-call = suspeito), re-spawnar limpo cedo (retry ~min vs detecção tardia ~horas); queda por limite é correlacionada no lote, checar os irmãos na hora
- P-016 [processo][orquestrador] Subagente com CWD num subrepo cria `specs/` órfão — docs de feature/STATE/LESSONS/knowledge por caminho ABSOLUTO injetado no prompt (agente nunca infere a raiz); fechamento confere path canônico + ausência de specs/ órfão nos subrepos
- P-017 [processo][telemetria] `sdd-log --type note` com run_id nulo corrompe o RUN.jsonl (flush race) — evento sem run válido é REJEITADO na origem; preferir eventos tipados a note; path do RUN.jsonl absoluto e injetado; linha inválida é quarentenada, não deletada
- P-018 [processo][qa][security][passo-3][passo-4] Invariante "fonte única" no CONTRACT nasce com spec de PARIDADE (entradas hostis × todos os call-sites); reconciliar divergência ELIMINANDO um lado (guarda mais ampla), nunca sincronizando dois predicados
- P-019 [processo][qa][passo-4][passo-6] Campo opcional de resposta contratado sem teste contra a classe REAL não é entregue (ausência é silenciosa em TS) — auditoria confere campo a campo do §API; degradação devolve campo AUSENTE, nunca []/neutro
- P-020 [processo][orquestrador][gates] Allowlist de Bash estreita trava a rodada no meio do Passo 5 e o agente NÃO pode ampliá-la (anti-escalada, bloqueio correto) — conferir cobertura dos comandos da rodada no Gate 0; lacuna é pedido ao usuário
- P-021 [processo][team-leader][passo-1][passo-5][passo-6] Renomear vocabulário de produto não é find/replace: inventário âncora-a-âncora + lista MANTER; gênero em cascata; falsos amigos; tradução literal pode fabricar informação FALSA; verificação escopada ao arquivo + hash p/ par cross-repo + diff normalizado (resíduo = mudança estrutural); rename REVELA defeito pré-existente sem causá-lo (medir com o rótulo antigo)
- P-023 [processo][orquestrador][gates] O ARQUIVO é a entrega: rodada inteira em que nenhum subagente devolveu mensagem final — idle sem texto com artefato presente é SUCESSO; o digest do gate se DERIVA do arquivo por passo barato, nunca depende do relatório do agente; **reforço 04/08**: 2ª rodada consecutiva 100% sem mensagem final (20 invocações) — derivação por artefato é o caminho PADRÃO, não contingência
- P-024 [processo][orquestrador][security][passo-6] Avaliador erra lendo código (fallback defensivo MORTO lido como caminho de produção ⇒ bug inexistente "crítico"): divergência entre papéis se arbitra ABRINDO o código e checando alcançabilidade, nunca pelo veredito mais alarmante; achado derrubado vira nota no EVALUATION; guarda morta é débito
- P-025 [processo][orquestrador][telemetria] `RUN.jsonl` é ponto de RETOMADA: rodada interrompida continua do 1º passo sem evento de conclusão (artefato conferido em disco) — passo concluído não se refaz, senão regenera documento já aprovado no gate
- P-022 [processo][qa][passo-3][passo-6] Lista derivável por 2 papéis se levanta 2× independentemente e compara (conjunto idêntico = confiança; divergência = erro de alguém); painel duplicado declara fonte única (vence o artefato versionado); mtime de artefato mutável não sustenta atribuição causal — verificar destrói a evidência; vale conteúdo × HEAD
- P-026 [processo][orquestrador][qa][passo-5][passo-6] Contagem de testes que sustenta gate é MEDIDA pelo orquestrador (comando canônico), nunca herdada do relato do agente; delta entre iterações fecha ARITMETICAMENTE (origem de cada teste + 0 deleções + 0 .skip/.only); divergência não reproduzível se registra como NÃO EXPLICADA — hipótese nunca vira causa
- P-027 [processo][qa][dev-backend][passo-3][passo-4][passo-5] Caso de teste com asserções INSATISFAZÍVEIS (not.toContain de substring do valor esperado) atravessa draft+consolidação+TDD — vermelho esperado mascara teste impossível; revisão do Passo 4 checa satisfiabilidade de pares positivo/negativo; correção de teste pelo dev no Passo 5 é evento auditável (corrigido ≠ afrouxado)

## Segurança (PROCESS.md, tags [security])

- P-101 [security][passo-3][passo-6] Endurecer identificador público sem auditar a RESPOSTA = fechadura nova em porta aberta — a superfície importa mais que o id; compat é com os campos consumidos, não com o payload inteiro (whitelist DTO)
- P-102 [security][passo-1][passo-7] Segurança × retrocompat: dual-resolve por formatos disjuntos + ramo legado como débito com gatilho OBJETIVO; o sinal de observabilidade nasce na mesma entrega (inclusive no caminho de erro); enforcement que pode bloquear receita (429 sob CGNAT) entra em modo observação primeiro

## Ops (PROCESS.md, tags [ops])

<!-- - P-2xx [ops][passo-5] Título curto — lições do agente DevOps ficam em PROCESS.md com tag [ops]; as específicas de stack vão para stacks/<perfil>.md -->

- P-201 [ops][dev-backend][passo-3][passo-5] Endpoint com produtor único e SEM reconciliação: só logar sucesso torna "produtor parado" e "produtor em erro em loop" indistinguíveis — helper `recusa()` (warn com slug estável + ids, sem PII) em TODO caminho 4xx; query de detecção manual exige baseline + dono + frequência

## Stack: Jest — transversal (stacks/jest.md)

- J-001 [jest][qa][dev-backend] `jest.clearAllMocks()` NÃO limpa a fila de `mock*Once` — `mockReset()` no `beforeEach`; resíduo de fila causa falha dependente de ordem
- J-002 [jest][qa][security][passo-4] Caminhos-irmãos de um guard (ausente × divergente) assertam o MESMO invariante (`not.toHaveBeenCalled()` do efeito externo) — só o status de erro mascara fail-closed violado em ação irreversível com suíte verde; **reforço 04/08**: bateria de idempotência exige fake COM ESTADO (honra `where`, simula rollback) + log de escrita não-revertido (pega escrita tentada-e-desfeita) + helper `nadaEscrito()` compartilhado por todos os ramos de recusa — mock de retorno passa por construção
- J-003 [jest][qa][passo-4] Fixture de dado que o PRÓPRIO sistema produz deriva o shape do código PRODUTOR (FKs inclusive; 1 variante por origem) — fixture "conveniente" com FK nula que produção nunca gera = suíte verde contra dado inexistente; **reforço 31/07**: feature com adapter externo exige ≥1 teste linha-do-banco→adapter REAL (incl. caminho fail-closed) — sem ele, 322 testes verdes conviveram com feature 100% inerte; **reforço 01/08**: o "produtor" inclui a PROJEÇÃO — select estreitado exige fixture do mapper reescrita A PARTIR do select (fixture larga fica SÓ nos testes de vazamento); total soma direto das rows, agregação sem id SOMA, nunca sobrescreve
- J-004 [jest][qa][dev-backend] `npx jest` avulso NÃO carrega a config do workspace ⇒ erro de parse de TypeScript FALSO em linha válida (sem transform/moduleNameMapper) — rodar sempre pelo script do projeto; erro de sintaxe que só aparece numa forma de invocação é do transform, não do arquivo
- J-005 [jest][qa][dev-frontend][passo-4][passo-6] Verificação estrutural por regex do fonte (`toMatch(/https:/)`) tem teto baixo — passa com a string em comentário; lógica em função pura EXPORTADA ganha teste de unidade real com entradas hostis mesmo sem testing-library; regex fica restrita a atributos JSX/imports (é lint, não teste de comportamento)

## Stack: NestJS (stacks/nestjs.md)

- N-001 [jest][qa] Jest 30: a flag é `--testPathPatterns` (plural)
- N-002 [nestjs][dev-backend] `Logger` não declarado em repositório trava o watch mode (TS2339)
- N-003 [nestjs][dev-backend] `console.log`/`util.inspect` trunca aninhamento (depth 2) — Logger + JSON.stringify
- N-004 [prisma][dev-backend] Cast TS (`as unknown as`) não converte em runtime — converter no repositório
- N-005 [prisma][qa] Cliente Prisma gerado stale derruba specs não relacionados — rodar db:generate antes
- N-006 [prisma][jest] Jest com mocks não pega erro de tipo Prisma — rodar `build`, não só `test`
- N-007 [prisma][dev-backend] N+1 insert em `$transaction` estoura 5s (P2028) — usar createMany em lote
- N-008 [prisma][dev-backend] Efeito externo é pós-commit; auditoria acoplada ao estado é intra-transação
- N-009 [nestjs][dev-backend] ValidationPipe global sem `transform` não converte DTO de query
- N-010 [jest][dev-backend] Método transacional gigante não é testável — extrair lógica pura p/ *.util.ts
- N-011 [prisma][dev-backend][passo-5] Escrita externa com custo real: recomputar invariante + pré-persistir id de idempotência NA tx (advisory lock); provider pós-commit; nunca confirmado fantasma
- N-012 [prisma][dev-backend][ops] Migration com `INSERT...SELECT`/`ON CONFLICT` dependente de linha/unique pré-existente vira no-op silencioso — queries de pré-requisito + conferência pós-aplicação
- N-013 [nestjs][seguranca][dev-backend] Hash de segredo de ALTA entropia (≥256 bits, `randomBytes`) ≠ hash de senha: SHA-256 puro sem salt/KDF (KDF lenta = ~100ms/login sem ganho; salt inviabiliza comparação por igualdade); prefixo de algoritmo (`sha256:`) desambigua hash × texto plano ⇒ migration idempotente + login fail-closed
- N-014 [nestjs][seguranca][dev-backend] Parâmetro OPCIONAL numa guarda de authz (`x !== undefined && regra`) fura a regra em silêncio no 2º call-site — argumento obrigatório na assinatura; teste com o argumento omitido
- N-015 [prisma][dev-backend][qa][passo-6] Lookup compartilhado com labels homônimas: leitura escopada × escrita solta = guarda fail-open (efeito com custo repete) — `escrita ⊆ leitura` por construção (união escopado∪solto fail-closed) + fixture com homônimo hostil e fake que honra o `where`
- N-016 [nestjs][seguranca][qa] Leitura de domínio que lança 404 com o id na mensagem reusada em rota pública = oráculo de existência (e o `throw` genérico abaixo é código morto) — wrapper captura→relança genérico + teste anti-oráculo comparativo por rota (Set size 1)
- N-017 [nestjs][prisma][seguranca] Update parcial sem DTO: ramo de validação decide pelo estado EFETIVO (`payload ?? banco`), nunca pelo tipo do payload — Prisma ignora `undefined` e o PUT parcial burla a regra; teste do exploit + não-regressão na bateria
- N-018 [prisma][dev-backend][ops] Migration de rename de valores exibidos: alvo por JOIN + IGUALDADE estrita — nunca LIKE (`_` é curinga: 'PLANO_%' casa PLANO_LOGISTICA_*); âncora redundante contra vizinho homônimo; conferir no schema se a tabela tem colunas de auditoria antes de carimbar (42703); rollback inerte comentado
- N-020 [prisma][dev-backend][qa] FK sem RELAÇÃO declarada no schema devolve só o id — o objeto esperado chega `undefined` em silêncio e a feature degrada como se estivesse funcionando; declarar relação + `include`, tipar o mapeador pelo retorno REAL (nunca `as`), testar da linha crua ao consumidor
- N-019 [prisma][jest][qa][dev-backend][passo-5] Spec de migration executável: readFileSync do .sql + tokenizar os UPDATEs — whitelist de SET, larguras por CARACTERE, valor antigo em todo WHERE, anti-LIKE, rollback 100% comentado; substitui prosa/grep manual; o gate empírico segue sendo staging (N-012); seletor do spec ancora no NOME EXATO do dir (regex ampla fica ambígua na 2ª migration) e a allowlist de posteriores cobra pedágio por design — editar N specs alheios É a revisão (reforço 04/08)
- N-021 [prisma][dev-backend][ops][passo-5] Guarda de constraint por `conname` sem `conrelid` falha ABERTA: conname é único POR RELAÇÃO — homônimo em outra tabela pula a FK em silêncio com migration "bem-sucedida"; toda guarda E conferência filtram `conname AND conrelid='<tabela>'::regclass` (+ `confrelid` na conferência)
- N-022 [prisma][ops][passo-5] Sonda de `--single-transaction` por grep `^(begin|commit)` acusa falso positivo em `DO $$ BEGIN` (bloco PL/pgSQL, não transação) e induz a aplicar SEM atomicidade — remover blocos $$…$$ antes do grep ou casar só `BEGIN\s*(;|TRANSACTION|WORK)`; na dúvida, default é COM `--single-transaction`
- N-023 [nestjs][seguranca][dev-backend][qa][passo-3] Validação de DTO só cobre o caminho do controller (ValidationPipe não roda em entrypoint de serviço — bot/job/service-a-service): regra que protege efeito COBRADO vive em 3 camadas (DTO 400 → domain fail-closed/fail-open auditável → guarda de infra antes do fetch), allowlist de fonte única e irmãs assertando o MESMO invariante (0 chamada cobrada)

## Stack: React + Vite (stacks/react-vite.md)

- R-001 [react][dev-frontend] Flag de feedback visual transitório (`setTimeout` que volta em Ns) nunca serve de flag de permissão de fluxo — dois estados: permanente (`jaCopiou`) × transitório (`mostrandoCheck`); reusar um pelo outro re-desabilita o botão/re-bloqueia o dialog
- R-003 [react][dev-frontend][qa] Campo não-opcional vindo de API é promessa, não garantia (`data.acoes.length` ⇒ TypeError na tela inteira): tipo do front declara coleção de API como OPCIONAL, normalização pura no SERVIÇO (`?? []` + alias) e `?? []` também no componente; cuidado com R-002 quando o vazio afirma
- R-002 [react][dev-frontend][qa] Estado vazio que AFIRMA ("sem X") ≠ dado ausente: renderização distingue `undefined`/campo omitido (gate OFF, falha — célula neutra) de `[]` real (afirmação); backend coopera omitindo o campo na degradação, nunca `[]` fabricado

## Stack: Next.js (stacks/nextjs.md)

## Stack: Python/FastAPI (stacks/python-fastapi.md)

## Stack: Spring Boot (stacks/spring-boot.md)
