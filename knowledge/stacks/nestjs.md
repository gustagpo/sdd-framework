# Lições de Stack — NestJS

> Lições genéricas desta stack aprendidas em rodadas SDD (qualquer projeto). Complementam o perfil `standards/stacks/nestjs.md` — se uma lição contradiz o perfil, corrija o perfil. Cada lição tem 1 linha no `knowledge/INDEX.md`.

### N-001 — Jest 30: flag `--testPathPatterns` (plural)
**Contexto**: rodar uma suíte isolada no Jest 30.
**Problema**: `--testPathPattern` (singular) foi removido no Jest 30 e aborta a execução com "Unrecognized CLI Parameter".
**Regra**: use sempre a forma plural `--testPathPatterns="..."`. Atualize scripts/exemplos herdados do Jest ≤29.
**Origem**: algar/LESSONS.md L019

### N-002 — `Logger` não declarado em repositório trava o watch mode
**Contexto**: usar `this.logger` numa classe `*RepositoryImp` (ou qualquer provider) sem declarar a propriedade.
**Problema**: gera `TS2339: Property 'logger' does not exist` que impede a recompilação no watch mode — o servidor segue rodando o código antigo sem recarregar, mascarando a mudança.
**Regra**: antes de usar `this.logger`, importar `Logger` de `@nestjs/common` e declarar `private readonly logger = new Logger(Classe.name)`.
**Origem**: algar/LESSONS.md L004

### N-003 — `console.log`/`util.inspect` trunca objetos aninhados
**Contexto**: logar um objeto de diagnóstico (payload de webhook, resposta de provider) em produção.
**Problema**: o Node usa `util.inspect` com profundidade 2 no `console.log` — níveis mais fundos viram `[Object]`/`[Array]` e o diagnóstico se perde.
**Regra**: nunca `console.log(objeto)` em produção. Use o `Logger` do Nest com `JSON.stringify(obj, null, 2)` para qualquer objeto aninhado importante.
**Origem**: algar/LESSONS.md L005

### N-004 — Cast TypeScript não converte em runtime
**Contexto**: uma coluna do banco tem tipo (ex.: `Char(1)`) diferente do tipo exposto no domínio (ex.: `boolean`).
**Problema**: `as unknown as string` / `as unknown as boolean` só engana o compilador — em runtime o valor continua o mesmo, e o ORM rejeita (ex.: Prisma `Expected String or Null, provided Boolean`). Mocks de repositório em Jest não pegam isso.
**Regra**: faça a conversão explícita **no repositório** (gravar/ler/filtrar convertendo o valor de verdade), nunca via cast de tipo.
**Origem**: algar/LESSONS.md L003

### N-005 — Cliente Prisma gerado defasado (stale) derruba specs não relacionados
**Contexto**: `schema.prisma` mudou (colunas/tabelas novas) e ainda não se rodou o `db:generate`.
**Problema**: o `ts-jest` type-checa contra o cliente gerado em disco (`generated/prisma`). Um cliente stale derruba specs fortemente tipados de modelos **não relacionados** à mudança, com "Test suite failed to run" + erro de tipo do Prisma — parece regressão da feature, mas é dívida de ferramenta.
**Regra**: ao ver esse sintoma numa suíte não relacionada, suspeite de cliente stale e rode o `db:generate` do projeto **antes** de medir baseline ou creditar a falha.
**Origem**: algar/LESSONS.md L039

### N-006 — Jest com mocks não pega erro de tipo do Prisma — rodar `build`, não só `test`
**Contexto**: backend implementado e suíte Jest 100% verde.
**Problema**: specs mockam o repositório inteiro com `jest.fn()` e **não** exercitam os tipos do cliente Prisma real. Erros como `@@unique(map:)` que não gera accessor TS (`WhereUniqueInput` sem a chave da constraint), ou qualquer `TS2353`, passam despercebidos no `test` e só aparecem no `build`.
**Regra**: após o backend, rode o `build` do projeto (não apenas `test`) para type-checar contra o cliente Prisma gerado. Para duplicata de constraint composta, `findFirst` pelos campos individuais em vez de `findUnique` pelo nome da constraint. (Distinto de N-005: lá o cliente está stale; aqui os mocks simplesmente não type-checam.)
**Origem**: algar/LESSONS.md L016

### N-007 — N+1 insert dentro de `$transaction` interativa estoura o timeout (P2028)
**Contexto**: fluxo de lote (centenas de linhas) que grava por item dentro de um `$transaction` interativo do Prisma.
**Problema**: um `create` por item em loop `for...await` são N round-trips sequenciais; o timeout default da transação interativa é **5000 ms** e um lote grande estoura antes de terminar (`P2028 — transaction ... expired`), revertendo tudo. O unit test com mock não detecta — round-trip não existe no mock.
**Regra**: em lote dentro de transação, toda escrita repetida por item vira `createMany`/`updateMany` (uma query por tabela). O `timeout` explícito é salvaguarda, nunca a correção — subir o timeout sem remover o N+1 só adia o estouro.
**Origem**: algar/LESSONS.md L041

### N-008 — Efeito colateral externo é pós-commit; auditoria acoplada ao estado é intra-transação
**Contexto**: uma operação transacional precisa tanto disparar efeitos externos quanto registrar auditoria.
**Problema**: confundir os dois. Chamada externa (cobrança, notificação, HTTP a provider) **dentro** do `$transaction` segura a conexão e pode reverter um efeito já materializado no mundo externo. Já uma trilha de auditoria acoplada à mudança de estado, se gravada best-effort **fora** da transação, dessincroniza do estado quando a operação falha no meio.
**Regra**: efeitos externos/irreversíveis rodam **pós-commit**, fora da transação, com captura de erro best-effort. Auditoria acoplada à mudança de estado entra **na mesma transação** (atômica), concentrada num helper tx-aware que recebe o `tx` — sem repositório-em-repositório.
**Origem**: algar/LESSONS.md L040

### N-009 — `ValidationPipe` global sem `transform` não converte DTO de query
**Contexto**: DTO de filtro de query com `@Type(() => Number)` / `@IsInt()` sob um `ValidationPipe` global registrado sem `transform: true`.
**Problema**: `@Type(() => Number)` (class-transformer) só roda com `transform` ligado. Sem ele, a querystring chega como string — `@IsInt()` rejeita com 400, ou a string vaza para o `where` do ORM.
**Regra**: não assuma `transform` global. Use um `ValidationPipe` **local** com `transform: true` no `@Query(...)`, ou converta manualmente (`Number(query.x)`) no controller.
**Origem**: algar/LESSONS.md L021

### N-010 — Método transacional gigante não é unitariamente testável — extrair a lógica pura
**Contexto**: uma regra de negócio (decisão/mapeamento/cálculo) vive dentro de um método de orquestração transacional de centenas de linhas.
**Problema**: para testar 1 regra seria preciso mockar todo o método transacional — mock frágil e caro; na prática a regra fica sem teste unitário.
**Regra**: extraia a lógica pura para um `*.util.ts` com spec próprio (funções sem I/O). Fallback aceitável só para mudança trivial de baixo risco enquanto não extraído: `build` verde + inspeção do diff + verificação manual — registrando a dívida.
**Origem**: algar/LESSONS.md L020

### N-011 — Escrita externa com custo real: validar invariantes e pré-persistir o id de idempotência NA transação; provider pós-commit
**Contexto**: fluxo que dispara uma operação externa irreversível/com custo (estorno, cobrança, postagem) condicionada a uma invariante de negócio (saldo, estado, limite).
**Problema**: validar a invariante fora da transação permite double-submit (duas requisições passam pelo check e chamam o provider 2×); validar mas chamar o provider **dentro** da transação viola N-008 (conexão presa + efeito externo não-revertível dentro de rollback); e confirmar o estado local antes da resposta real do provider cria "confirmado fantasma" quando o upstream falha.
**Regra**: sequência canônica — (1) `$transaction` + advisory lock por chave de negócio (`pg_advisory_xact_lock`); (2) **recomputar** a invariante dentro da tx (nunca confiar no valor lido antes) e rejeitar na borda com **zero** chamada externa; (3) **pré-persistir** o registro da operação com id de idempotência gerado localmente (o provider recebe o mesmo id em retry); (4) commit; (5) chamar o provider **pós-commit** e só então transicionar o estado com a resposta real — falha upstream vira erro tipado, nunca estado confirmado. Testar com duas chamadas concorrentes assertando 1 única chamada externa, e com valor inválido assertando ausência total de chamada.
**Origem**: algar/LESSONS.md L065 + L056 (rodadas integracao-correios e pagamentos-auditoria-estorno, 07/2026)

### N-012 — Migration que depende de linha/constraint pré-existente vira no-op silencioso — asserir a pré-condição
**Contexto**: migration SQL idempotente (Postgres/Prisma) que concede RBAC, semeia domínio ou copia dados usando `INSERT ... SELECT FROM <tabela>` ou `INSERT ... ON CONFLICT DO NOTHING`.
**Problema**: dois modos de falha **silenciosos** — (a) `INSERT ... SELECT` cujo `SELECT` não encontra a linha de origem (tela/perfil/domínio esperado não existe naquele ambiente) insere **zero linhas e termina com sucesso**; (b) `ON CONFLICT` exige uma constraint **UNIQUE** correspondente — sem ela o Postgres erra (ou, com `WHERE NOT EXISTS` mal escrito, duplica). O ambiente fica meio-migrado sem nenhum erro no log e o furo só aparece em runtime (403 de RBAC, lookup vazio).
**Regra**: todo bloco de migration dependente de estado pré-existente ganha (1) **queries de pré-requisito documentadas** no roteiro de operação (rodar antes de aplicar: a tela/domínio/perfil existe?), (2) **queries de conferência pós-aplicação** (contagens esperadas), e — quando o projeto testa migrations — um spec que guarda a pré-condição. `ON CONFLICT` só com a UNIQUE conferida no schema real; senão `WHERE NOT EXISTS`.
**Origem**: algar/LESSONS.md DO-08/DO-07 da rodada emissao-nfe-produto (22/07/2026) + L048/L063 (migrations de correção e RBAC fail-closed)

### N-013 — Hash de segredo de alta entropia não é hash de senha: SHA-256 puro, e o prefixo de algoritmo desambigua
**Contexto**: persistir com segurança um segredo de máquina gerado pelo servidor (`crypto.randomBytes(32)` → 256 bits: token de bypass, API key, webhook secret) do qual só se precisa verificar **igualdade**.
**Problema**: aplicar o reflexo "senha → bcrypt/argon2" aqui é desperdício e às vezes quebra o requisito. Uma KDF lenta existe para conter brute-force de segredos de **baixa** entropia (senhas humanas); para 256 bits aleatórios não há brute-force viável, e a KDF adiciona ~100 ms **por login** sem reduzir risco. Pior: **salt** (inerente a bcrypt/argon2) inviabiliza qualquer comparação por igualdade e qualquer backfill/migração determinística. E, ao migrar a coluna de texto plano para hash, não há como o código distinguir um valor já-hasheado de um legado em claro.
**Regra**: para segredo de alta entropia gerado pela máquina, use **hash rápido sem salt** (SHA-256) e comparação **timing-safe** (`crypto.timingSafeEqual` sobre os digests). Prefixe o valor persistido com o **algoritmo** (`sha256:<hex>`): o prefixo (1) torna a migration idempotente (`WHERE valor NOT LIKE 'sha256:%'`), (2) deixa o login **fail-closed** sobre qualquer resquício de texto plano, e (3) permite evoluir o algoritmo depois. Se algum dia o segredo puder ser **escolhido por humano**, a decisão se inverte (volta a KDF+salt).
**Origem**: algar/LESSONS.md L072 + CONTRACT §10 da rodada bypass-seguranca-integrador (22/07/2026)

### N-014 — Parâmetro opcional numa guarda de autorização fura a regra em silêncio
**Contexto**: um service aplica uma regra de segurança condicionada a um argumento (ex.: `generateBypassSecret(id, codUsuarioLogado?)` que proíbe auto-emissão com `codUsuarioLogado !== undefined && codUsuarioLogado === id → 403`).
**Problema**: com o parâmetro **opcional**, um segundo call-site que esqueça de passá-lo faz a condição `!== undefined` curto-circuitar para **falso** e a guarda **não dispara** — fail-open silencioso, sem erro de compilação nem de teste (o call-site coberto passa). A regra existe no código e mesmo assim não protege.
**Regra**: quando uma regra de segurança/autorização depende de um argumento, esse argumento é **obrigatório** na assinatura (o compilador força todo call-site a fornecê-lo). Nunca `x !== undefined && <regra>` numa guarda — a ausência do dado deve **falhar fechado**, não pular a checagem. Escreva um teste que **omite** o argumento e assere o bloqueio.
**Origem**: algar/EVALUATION R-02/S-05 da rodada bypass-seguranca-integrador (22/07/2026)

### N-015 — Tabela de lookup compartilhada com labels homônimas: resolvedor simétrico entre leitura e escrita (`escrita ⊆ leitura`), e fixture com o homônimo hostil
**Contexto**: projetos com tabela de domínio/lookup genérica (ex.: `itemdominio` com `descricao` + FK para o domínio) onde **a mesma label** (`PENDENTE`, `ENVIADA`, `DISPONÍVEL`) existe em vários domínios, e uma guarda de idempotência/estado decide por `IN (ids resolvidos)` se dispara um efeito com custo real.
**Problema**: endurecer o resolvedor (**escopar por domínio**) **só na leitura** da guarda, deixando as escritas com `findFirst({ descricao })` solto, cria uma janela fail-**open**: a escrita pode gravar o id homônimo de **outro** domínio, que fica fora do `IN` da guarda — a guarda "não vê" a linha existente e o efeito com custo (compra, cobrança, envio) **repete indefinidamente**. O código 100% solto era imune (casava qualquer homônimo dos dois lados); o endurecimento parcial **introduz** a regressão. A suíte não pega: mocks que devolvem o esperado e fixtures que só modelam o domínio correto passam com o bug.
**Regra**: leitura e escrita do mesmo estado usam o **mesmo resolvedor escopado** — e, em código com histórico de escrita solta (linhas legadas no banco), a leitura da guarda vira a **união** escopado ∪ solto (mais ids = mais bloqueio = fail-closed), garantindo `escrita ⊆ leitura` **por construção**; resolvedor sem resultado ⇒ **bloqueia** (nunca libera). No teste, um **fake do ORM que honra o `where`** (não mock de retorno fixo) com o **homônimo de outro domínio posicionado antes** na fixture (o que um `findFirst` solto pegaria) é o único jeito de reproduzir o bug; asserir literalmente que o id gravado pela escrita pertence ao `IN` que a guarda lê. Ao endurecer lookup legado, endureça os dois lados **na mesma mudança**.
**Origem**: algar/EVALUATION D-01 (ALTA/bloqueante) da rodada solicitacao-chip-por-estoque (23/07/2026) + algar/LESSONS.md L074 (parente da L042)

### N-016 — Leitura de domínio que lança `NotFoundException` com o id na mensagem não pode ser reusada crua em borda pública anti-enumeração
**Contexto**: rota pública (checkout/portal) que deve responder 404 genérico **byte-idêntico** para qualquer ref inválido/inexistente (anti-oráculo), reusando um service de domínio escrito para o painel interno autenticado.
**Problema**: o service interno lança `NotFoundException("Entidade <id> não encontrada")` — ecoa o id e diverge do 404 genérico, criando um **oráculo de existência**. Pior: o `if (!x) throw new NotFoundException(<genérico>)` escrito depois da chamada é **código morto** (a exceção do domínio já subiu) e dá falsa sensação de cobertura. O furo escapa quando o teste de 404 só cobre a rota nova (GET) e as rotas de escrita reusam a leitura antiga por caminho próprio.
**Regra**: na borda pública, envolva a leitura de domínio num wrapper que **captura o `NotFoundException` e relança o genérico** (demais erros propagam). O teste anti-oráculo é **comparativo e por rota**: todas as combinações rota × tipo de ref (numérico/opaco/malformado × existente/inexistente) numa única asserção `Set(JSON.stringify({status, body})).size === 1` + ausência do ref no corpo — nunca apenas "retornou 404". Checklist prévio: toda leitura de domínio reusada em rota pública tem contrato de erro verificado (**lança** ou **devolve null**?).
**Origem**: algar/LESSONS.md L076 — rodada checkout-token-opaco-e-logistica (23/07/2026); it. 1 reprovada no Passo 6 por 404 distinguível nos POST públicos, achado por QA e Security independentemente

### N-017 — Update parcial sem DTO: decidir o ramo de validação pelo tipo do PAYLOAD é bypass — resolver o estado efetivo (`payload ?? banco`)
**Contexto**: endpoint de `update` legado sem DTO (`body: any`) cuja validação de domínio depende de um discriminador do registro (tipo, categoria, estado) que o payload **pode omitir**; Prisma (e ORMs em geral) ignoram `undefined` no update.
**Problema**: decidir o ramo de validação pelo campo do payload (`if (payload.tipo === X) validar()`) faz o `PUT` **parcial** escapar da regra inteira: o campo omitido curto-circuita a condição, o registro mantém o discriminador antigo no banco e os demais campos do payload persistem sem validação — bypass silencioso, comprovável por exploit (rodada real: preço proibido persistido num serviço de tipo travado, S-01). O `create` não sofre disso (payload completo), o que esconde o furo na revisão.
**Regra**: em update sem DTO, a decisão de ramo é sempre sobre o **estado efetivo** — `payload.discriminador ?? (await lerDiscriminadorAtual(id))` — custe uma leitura a mais; e o teste do exploit (`PUT` parcial num registro do tipo travado ⇒ 400, repositório **não** chamado) entra na bateria junto com o de não-regressão (parcial em registro de tipo livre segue gravando). Isso **não substitui** criar o DTO — apenas fecha o bypass enquanto o débito existir.
**Origem**: algar/LESSONS.md L086 — achado S-01 (Security, bloqueante) da rodada servico-bonus-temporario (28/07/2026); exploit reprovado na revalidação.

### N-018 — Migration de rename/correção de valores exibidos: alvo por JOIN + igualdade estrita — `_` é curinga em `LIKE`, e nem toda tabela tem colunas de auditoria
**Contexto**: migration SQL (Postgres/Prisma) que renomeia valores de lookup/catálogo (descrições de domínio, nomes de tela/funcionalidade) exibidos em UI, com módulos vizinhos de prefixo parecido que NÃO devem mudar.
**Problema**: dois reflexos que parecem seguros e não são — (a) mirar por `LIKE 'PREFIXO_%'`: o `_` é curinga de **1 caractere** em `LIKE`, então `'PLANO_%'` casa `PLANO_LOGISTICA_*` e arrasta linhas de outro módulo (no banco real: 9 linhas com o prefixo, só 6 eram alvo); (b) carimbar auditoria (`usuario_alteracao`/`data_alteracao`) por padrão do projeto: se a tabela-alvo **não tem** as colunas, a migration quebra com `42703` — o padrão "auditoria em toda tabela" não vale para todo o catálogo.
**Regra**: alvo resolvido por **JOIN nas chaves estáveis + igualdade estrita no valor antigo** (⇒ idempotência: rerun = 0 linhas); quando há vizinho homônimo, **âncora redundante** (JOIN pelo código-pai + lista explícita de códigos + valor antigo — qualquer uma isolada já exclui o vizinho); **zero** `LIKE`/`SIMILAR TO`/`~` no corpo executável (se `LIKE` for inevitável, escapar `\_`); conferir **no schema** se cada tabela escrita tem as colunas de auditoria antes de carimbá-las (e o spec assere a assimetria); rollback = bloco **inerte** comentado com os valores antigos.
**Origem**: algar/LESSONS.md L048 (atualizada) + L088 — rodada renomeacao-plano-para-assinatura (28/07/2026); migration `20260728_02`, 7 UPDATEs/12 linhas, `PLANO_LOGISTICA` intocado por construção.

### N-019 — Spec de migration executável: ler o `.sql` real e tokenizar os comandos — prosa/grep manual não protege
**Contexto**: projetos que testam migrations com Jest (sem Postgres no CI) e contratos que exigem garantias sobre o SQL (colunas gravadas, larguras, idempotência, escopo de tabelas).
**Problema**: caso de teste que **descreve** o SQL em prosa ("o UPDATE deve…") ou checklist de grep manual não falha quando a migration muda; e regex sobre o arquivo inteiro não distingue corpo executável de comentário/bloco de rollback inerte — as guardas viram ritual.
**Regra**: o spec faz `readFileSync` do `.sql`, **remove comentários** e **tokeniza os comandos** (isolando a cláusula `SET` de cada `UPDATE`). Asserções executáveis: (1) **whitelist** das colunas à esquerda de `=` em `SET` (nenhuma coluna de gating/chave — `codigo`, `rota`, `tabela`, `campo`); (2) todo literal que entra em `varchar(N)` com `[...str].length ≤ N` (**caracteres**, não bytes — acento é multibyte); (3) todo `WHERE` casa o valor **antigo** (rerun = 0); (4) conjunto de tabelas escritas ⊆ esperado; (5) padrões proibidos (`LIKE`, DDL, `DELETE`) ausentes do corpo executável; (6) rollback presente **e 100% comentado**. Rodada real: 99 testes/1,3s substituíram o checklist manual do contrato. A validação continua **estática** — o gate empírico segue sendo aplicar em staging (rows-affected + rerun, ver N-012).
**Origem**: algar/LESSONS.md L080 (padrão evoluído) — rodada renomeacao-plano-para-assinatura (28/07/2026); `renomeacao-plano-para-assinatura.migration.spec.ts`.

### N-020 — FK no Prisma sem **relação declarada** devolve só o id: o objeto que o consumidor espera chega `undefined` em silêncio
**Contexto**: tabela de configuração cujas colunas são FKs (`cod_email_template`, `cod_evento_notificacao`) e cujo consumidor precisa do **conteúdo** referenciado (o alias do template, a chave do evento), não do id.
**Problema**: no `schema.prisma` é perfeitamente válido declarar só a coluna escalar (`cod_email_template Int?`) sem o campo de relação. O `findMany` então **não aceita `include`** daquele nome — e o mapeador que tenta ler `row.email_template.alias` recebe `undefined`. Nada explode: o serviço a jusante segue com o campo vazio e degrada pelo caminho de erro (canal `IGNORADA`/`ERRO`), o que parece funcionamento normal em painel e log. Em rodada real isso deixou **todos os canais de notificação inertes** — e um cast de asserção no mapeador (`as Config[]`) impediu o compilador de apontar a discrepância (ver N-004 e a regra de tipar pelo produtor).
**Regra**: (1) toda FK cujo consumidor espera o **objeto** ganha campo de relação declarado nos **dois** modelos + `include` explícito na consulta — `prisma validate` confirma; (2) o mapeador é tipado pelo **retorno real** da consulta (nunca `as`), de modo que remover o `include` vire erro de compilação; (3) o teste que cobre a leitura parte da **linha crua** (o objeto que o Prisma devolveria, com a relação aninhada) e chega ao consumidor final — fixture montada no shape que o serviço deseja não prova nada sobre a consulta (J-003).
**Origem**: algar/LESSONS.md L090 — BLOQ-1 da rodada esteira-cobranca-inadimplencia (31/07/2026); a feature inteira era inerte com 322 testes verdes no recorte.

### N-021 — Guarda de constraint por `conname` sem `conrelid` falha aberta: o nome de constraint é único POR RELAÇÃO, não global
**Contexto**: migration idempotente (Postgres) que cria FK/constraint dentro de `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_x') … $$` — o padrão canônico para `ADD CONSTRAINT` que não tem `IF NOT EXISTS` nativo.
**Problema**: `pg_constraint.conname` é único **por relação** (`conrelid`), não no banco — dois `fk_pedido` podem coexistir em tabelas diferentes. A guarda que filtra só por `conname` encontra o **homônimo de outra tabela**, conclui "já existe" e **pula a criação da FK em silêncio**: a migration reporta sucesso, a conferência por existência (o mesmo `SELECT`) também passa, e a integridade referencial simplesmente não existe. É o modo de falha mais traiçoeiro de N-012 (no-op silencioso) porque a própria verificação está viciada pelo mesmo predicado.
**Regra**: toda guarda (e toda conferência pós-aplicação) sobre `pg_constraint` filtra por **`conname` E `conrelid = '<tabela>'::regclass`**; o mesmo raciocínio vale para qualquer catálogo com unicidade escopada (`pg_indexes` já embute `tablename` — usar; triggers via `tgrelid`). A conferência por valor confere adicionalmente `confrelid` (a tabela **referenciada**) — nome certo apontando para a tabela errada também é falha silenciosa.
**Origem**: algar, rodada contrato-documento-d4sign (04/08/2026) — finding F-5 do DevOps, corrigido na it.2 nas duas guardas de FK da migration `20260804_01`.

### N-022 — Sonda de "abre transação própria?" por grep de `begin|commit` acusa falso positivo em `DO $$ BEGIN`: decide errado o `--single-transaction`
**Contexto**: runbook que decide se um `.sql` de migration deve ser aplicado com `psql --single-transaction` (o certo quando o arquivo NÃO abre transação própria) usando uma sonda automatizada tipo `grep -Ei '^\s*(begin|commit)'` sobre o arquivo.
**Problema**: todo bloco `DO $$ BEGIN … END $$` (o padrão de guarda idempotente de constraint — N-021) começa a linha com `BEGIN` — que é o início do bloco **PL/pgSQL**, não um `BEGIN` de transação SQL. A sonda acusa "o arquivo já gerencia transação" e induz o operador a aplicar **sem** `--single-transaction`: uma falha no meio do arquivo deixa a migration **pela metade** (metade dos domínios/FKs aplicada), exatamente o cenário que a atomicidade evitaria — e o rerun idempotente mascara o vestígio.
**Regra**: a sonda distingue os contextos — `BEGIN` de transação aparece **fora** de blocos `$$…$$` (e tipicamente como `BEGIN;`/`BEGIN TRANSACTION`); na prática: remover os blocos dollar-quoted antes do grep, ou casar apenas `^\s*BEGIN\s*(;|TRANSACTION|WORK)`. Em caso de dúvida, a decisão default é **com** `--single-transaction` + `-v ON_ERROR_STOP=1` (um `BEGIN` aninhado gera warning inócuo; migration meio-aplicada gera incidente). O runbook registra a decisão e o porquê, nunca só o comando.
**Origem**: algar, rodada contrato-documento-d4sign (04/08/2026) — finding F-1 do DevOps, corrigido no RUNBOOK.md; a migration era `DO $$`-pesada e o falso positivo era certo.

### N-023 — Idempotência conferida antes do lock é corrida aberta — e o teste que a prova exige transações genuinamente simultâneas
**Contexto**: função de banco (plpgsql) ou serviço que implementa efeito idempotente com custo real (débito de créditos, cobrança, contador) no padrão "se `idempotency_key` já existe, retorna ok sem efeito".
**Problema**: checar a key (`EXISTS`) **antes** de tomar o lock da linha-alvo (`SELECT … FOR UPDATE`) é idempotência falsa: duas transações simultâneas com a mesma key passam juntas pelo `EXISTS` (nenhuma vê a outra, que ainda não commitou) e o efeito duplica. O agravante é que o teste clássico ("chama 2×, espera 1 efeito") roda **em série** e passa para sempre contra o código quebrado — foi exatamente assim que um débito duplicado de créditos atravessou uma fase inteira com suíte verde.
**Regra**: (1) a checagem de idempotência vem **depois** do lock que o próprio efeito já toma (serializar por ele custa uma linha e fecha a corrida; a `UNIQUE (scope, idempotency_key)` continua como cinto de segurança); (2) o teste que prova concorrência dispara T2 com a transação de T1 **aberta e segurando o lock** — senão é teste sequencial disfarçado; asserir o estado final **e** a contagem de linhas do efeito (saldo certo com 2 linhas na razão ainda é bug); cronometrar ajuda a provar que T2 esperou a janela; (3) na revalidação, rodar a forma do teste contra a versão **antiga** da função — se não falha contra ela, o teste não prova nada.
**Origem**: iara, rodada 001-auditoria-fase-0 (12/08/2026) — achado ALTA F0-03-c (`fn_debit_credits`/`fn_refund_credits`, `0006`→`0012`); sonda diferencial no EVALUATION §2; lição L001 do projeto.

### N-024 — `set_config(..., true)` é local à TRANSAÇÃO, não à função: SECURITY DEFINER que arma GUC de tenant guarda/restaura e recusa contexto divergente
**Contexto**: multitenancy por RLS com GUC (`current_setting('app.tenant_id')`) e funções `SECURITY DEFINER` que precisam operar em nome de um tenant (sync de auth externo, jobs administrativos).
**Problema**: `set_config(chave, valor, true)` dura até o fim da **transação** — não "volta sozinho" quando a função retorna. Uma função que arma o GUC para o tenant alvo e não restaura deixa o **resto da transação do chamador** rodando como outro tenant: escada de leitura/escrita cross-tenant invisível para a suíte de RLS (que testa policies, não funções). Pior se a função aceita o tenant como parâmetro sem conferir o contexto: qualquer chamador vira `set-tenant` arbitrário.
**Regra**: toda função `SECURITY DEFINER` que arma GUC de tenant: (1) **recusa** chamada cujo parâmetro diverge do GUC vigente (`insufficient_privilege`/`42501`) — a exceção é bootstrap com GUC vazio, explícita no código; (2) captura o valor anterior no início e **restaura no fim** (inclusive no caminho de erro); (3) ganha testes próprios dos 3 casos: divergente recusa sem vazar leitura/escrita, legítimo restaura o GUC, bootstrap volta a `''`. Auditoria de RLS inclui `\df+` das SECURITY DEFINER — as policies não protegem do que roda por dentro delas.
**Origem**: iara, rodada 001-auditoria-fase-0 (12/08/2026) — achado ALTA F0-06-c (`fn_sync_account_from_auth`, `0013`); sonda da Security reproduzida na revalidação; lição L002 do projeto.

### N-025 — Teste de isolamento cross-tenant sem linha semeada é asserção vacuamente verdadeira
**Contexto**: suíte de RLS que varre o catálogo (`pg_catalog`) por tabelas com coluna de tenant e assere "tenant B lê 0 linhas do tenant A" em cada uma.
**Problema**: se a tabela está **vazia**, `count=0` passa sem provar nada — a policy pode nem existir de verdade (ou estar errada) e o teste fica verde. Em rodada real, 73 de 81 tabelas do sweep não recebiam linha semeada: a "cobertura total" comportamental era 10%. O sweep estrutural (exigir `relrowsecurity AND relforcerowsecurity` + ≥1 policy no catálogo) segura a classe, mas não pega policy com predicado errado.
**Regra**: separar as duas garantias e saber qual se tem: (1) **estrutural** — sweep de catálogo, pega tabela sem policy (barato, cobre tudo, entra no CI); (2) **comportamental** — só vale para tabela com linha real do tenant A semeada antes do `count=0` sob B; manter um gerador de linha mínima por tabela (FKs satisfeitas) ou, no mínimo, asserir no próprio teste quantas tabelas foram exercitadas de verdade e tratar a lista das não-semeadas como débito visível, nunca como cobertura.
**Origem**: iara, rodada 001-auditoria-fase-0 (12/08/2026) — achado A-3/N-5 (QA), aberto como débito; `packages/db/test/pg/rls.test.ts`.
**Reforço (12/08/2026, iara, 002-fundacoes-plataforma)**: a classe vale também para **passo de runbook**, não só teste — o passo "prova de isolamento" do runbook de deploy mandava ler `count(*)` da conta B e concluir de `0`, que um banco recém-migrado devolve **com RLS ligado ou desligado** (BL-7, gate de go-live). A prova exige dado dos DOIS lados: semear 2 contas + 1 linha em cada como master, ler como `app_user` com o GUC da conta A e exigir **1** da A e **0** da B — com o doc dizendo que `0/0` = não semeou e `1/1` = RLS desligado. A diferença cabe em duas linhas de runbook; verificação que passa com o sistema desligado é pior que verificação ausente.

### N-026 — Variável obrigatória sem default fora do `.env.example` só quebra em clone limpo: teste de paridade schema×template fecha a classe
**Contexto**: backend Node com schema de env validado (zod/envalid) e um `.env.example` como template de setup.
**Problema**: quem adiciona a variável tem o valor no `.env` local — tudo funciona para o autor, para o CI (secrets) e para quem já clonou. O primeiro clone limpo depois disso morre no fail-fast do schema **sem instrução de recuperação**, e a classe reincide a cada variável nova porque nenhum gate cobre o template (que não é código).
**Regra**: teste de unidade que parseia o `.env.example` e o confronta com o schema: toda chave **obrigatória sem default** do schema precisa existir no template (e, opcionalmente, chave do template desconhecida do schema falha também — pega template apodrecido). Casos do teste incluem o cenário real que motivou (a variável que faltou). Corolário de processo: o valor de exemplo de segredo é explicitamente descartável (`dev-only-…`) para ninguém promovê-lo a staging.
**Origem**: iara, rodada 001-auditoria-fase-0 (12/08/2026) — achado MÉDIA F0-01-d (`AUTH_SECRET`); `packages/config/test/env-example-parity.test.ts`.
