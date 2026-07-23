# Knowledge Index — SDD Framework

> Índice da base de conhecimento acumulada entre projetos. **1 linha por lição**, com tags `[stack][papel][passo]`. Os agentes leem ESTE arquivo primeiro e abrem só as lições relevantes. Mantido pelo Team Leader na retrospectiva (Passo 7) de cada rodada — atualizar em vez de duplicar; lição errada é removida; lição que contradiz um standard corrige o standard.

## Processo (PROCESS.md)

- P-001 [processo][telemetria] Custo por agente exige label determinístico na invocação + telemetria em 1 comando por passo
- P-002 [processo][orquestrador] Uma feature por sessão — 2 rodadas na mesma sessão estouram o contexto
- P-003 [processo][gates] Gates consomem DIGEST (≤30 linhas) do agente, nunca o documento inteiro
- P-004 [processo][telemetria] agentType do transcript tem 2 formatos (name livre | subagent_type namespaced) + ruído a filtrar
- P-005 [processo][telemetria] Só registre agent_run se houve invocação real de subagent — trabalho inline não tem transcript
- P-006 [processo][orquestrador] Spawn paralelo (tmux) esgota slots com agentes idle acumulados — limpar slots concluídos entre fases é pré-condição do próximo spawn
- P-007 [processo][gates] Gate supervised reverte propostas: digest leva a proposta E a alternativa descartada com custos — corte de escopo é o mais revertido
- P-008 [processo][qa][passo-6] Baseline de regressão (unit E e2e) se mede no HEAD pré-feature via `git stash -u`, nunca se herda do TESTS.md/documento — senão falha pré-existente conta como regressão
- P-009 [processo][dev-backend][passo-3] O consolidador do CONTRACT deve contradizer o próprio draft quando outro papel traz evidência melhor (a SPEC dizia "sem migration"; o DevOps mostrou migration de dados obrigatória)

## Segurança (PROCESS.md, tags [security])

<!-- - P-1xx [security][passo-6] Título curto — lições do agente Security ficam em PROCESS.md com tag [security] -->

## Ops (PROCESS.md, tags [ops])

<!-- - P-2xx [ops][passo-5] Título curto — lições do agente DevOps ficam em PROCESS.md com tag [ops]; as específicas de stack vão para stacks/<perfil>.md -->

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

## Stack: React + Vite (stacks/react-vite.md)

- R-001 [react][dev-frontend] Flag de feedback visual transitório (`setTimeout` que volta em Ns) nunca serve de flag de permissão de fluxo — dois estados: permanente (`jaCopiou`) × transitório (`mostrandoCheck`); reusar um pelo outro re-desabilita o botão/re-bloqueia o dialog

## Stack: Next.js (stacks/nextjs.md)

## Stack: Python/FastAPI (stacks/python-fastapi.md)

## Stack: Spring Boot (stacks/spring-boot.md)
