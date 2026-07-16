# Knowledge Index — SDD Framework

> Índice da base de conhecimento acumulada entre projetos. **1 linha por lição**, com tags `[stack][papel][passo]`. Os agentes leem ESTE arquivo primeiro e abrem só as lições relevantes. Mantido pelo Team Leader na retrospectiva (Passo 7) de cada rodada — atualizar em vez de duplicar; lição errada é removida; lição que contradiz um standard corrige o standard.

## Processo (PROCESS.md)

<!-- - P-001 [processo][passo-3] Título curto -->

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

## Stack: Next.js (stacks/nextjs.md)

## Stack: Python/FastAPI (stacks/python-fastapi.md)

## Stack: Spring Boot (stacks/spring-boot.md)
