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

### N-014 — Parâmetro opcional numa guarda de autorização fura a regra em silêncio
**Contexto**: um service aplica uma regra de segurança condicionada a um argumento (ex.: `generateBypassSecret(id, codUsuarioLogado?)` que proíbe auto-emissão com `codUsuarioLogado !== undefined && codUsuarioLogado === id → 403`).
**Problema**: com o parâmetro **opcional**, um segundo call-site que esqueça de passá-lo faz a condição `!== undefined` curto-circuitar para **falso** e a guarda **não dispara** — fail-open silencioso, sem erro de compilação nem de teste (o call-site coberto passa). A regra existe no código e mesmo assim não protege.
**Regra**: quando uma regra de segurança/autorização depende de um argumento, esse argumento é **obrigatório** na assinatura (o compilador força todo call-site a fornecê-lo). Nunca `x !== undefined && <regra>` numa guarda — a ausência do dado deve **falhar fechado**, não pular a checagem. Escreva um teste que **omite** o argumento e assere o bloqueio.
**Origem**: algar/EVALUATION R-02/S-05 da rodada bypass-seguranca-integrador (22/07/2026)
