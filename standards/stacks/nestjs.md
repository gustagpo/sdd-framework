# Perfil de Stack: NestJS

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5+ |
| Framework | NestJS 10/11 |
| ORM/Data | Prisma (+ adapter pg) ou TypeORM |
| Validação | class-validator + class-transformer |
| Testes | Jest + Supertest (e2e) |
| Docs de API | Swagger/OpenAPI (`@nestjs/swagger`) |

## Estrutura de pastas canônica

```
src/
├── domain/                          # regras de negócio (NUNCA importa infra)
│   └── {entidade}/
│       ├── repositories/{entidade}.repository.ts   # INTERFACE do repositório
│       ├── services/{entidade}.service.ts          # casos de uso
│       ├── dtos/create-{entidade}.dto.ts           # DTOs com class-validator
│       └── {entidade}.module.ts                    # módulo autocontido
├── infra/                           # implementações concretas
│   ├── database/                    # PrismaService / conexão
│   ├── repositories/{entidade}.repository.ts       # implementação Prisma
│   ├── guards/                      # JwtGuard, PermissionsGuard
│   ├── http/                        # clientes de APIs externas
│   └── jobs/                        # cron jobs (@nestjs/schedule)
└── presentation/
    └── api/{entidade}/{entidade}.controller.ts     # controllers finos
```

Módulos novos são registrados no módulo de domínio agregador e o repositório no módulo de repositórios (convenção exata no STACK.md do projeto).

## DDD nesta stack

- **Interface no domínio, implementação na infra** (DIP via token de injeção):

```typescript
// src/domain/pedido/repositories/pedido.repository.ts
export interface IPedidoRepository {
  criar(data: CreatePedidoData, usuario: string): Promise<number>;
  obter(id: number): Promise<Pedido | null>;
}
export const PEDIDO_REPOSITORY = Symbol('IPedidoRepository');

// src/domain/pedido/services/pedido.service.ts — service NÃO acessa ORM
@Injectable()
export class PedidoService {
  constructor(@Inject(PEDIDO_REPOSITORY) private repo: IPedidoRepository) {}
}
```

- **Services não acessam Prisma diretamente** — só via repositório. Conversões de tipo (bool↔char, decimal↔string) acontecem NO repositório, nunca com casts (`as unknown as`) que não convertem em runtime.
- **Fronteira de transação**: `prisma.$transaction` no repositório/serviço de aplicação; efeitos colaterais (cobranças, notificações, verificação de estoque) rodam **pós-commit, fora da transação** — falha neles não reverte o dado.
- Entidade de persistência (row do Prisma) não vaza para a API: o repositório mapeia para o tipo do domínio; o controller devolve DTOs.

## SOLID nesta stack

- **Injeção pela abstração**: `provide: TOKEN, useClass: Impl` no módulo; nunca `new Impl()` dentro de service.
- **OCP via registry/strategy**: capacidades variantes (ex.: provedores de pagamento) viram capability ports pequenos (`ICardPaymentPort`, `IPixPaymentPort`) indexados num Registry — adicionar provider novo = 1 classe + 1 linha de registro, sem tocar nas estratégias existentes.

```typescript
@Injectable()
export class PaymentRegistry implements IPaymentRegistry {
  private map = new Map<string, IPixPaymentPort>();
  constructor(/* estratégias injetadas */) { /* monta o map por `${tipo}:${provider}` */ }
  resolvePix(provider: string): IPixPaymentPort { /* lookup + erro claro */ }
}
```

## API nesta stack

Controller fino: valida na borda (DTO), delega ao service, retorna shape estável.

```typescript
@ApiTags('pedido')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('pedido')
export class PedidoController {
  constructor(private service: PedidoService) {}

  @Post()
  @RequirePermission('PEDIDO', 'write')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePedidoDto, @Req() req) {
    const loggedUser = (req['user'] as { login: string }).login;
    return { id: await this.service.criar(dto, loggedUser) };
  }
}
```

- **Erros**: `BadRequestException`(400) validação de negócio, `NotFoundException`(404), `ConflictException`(409), `UnprocessableEntityException`(422) regra externa; erros de integração externa viram exceção tipada mapeada para 422/502 — nunca vazar stack trace.
- **Swagger**: `@ApiProperty` em todo campo de DTO; todos os endpoints documentados.
- **RBAC declarativo**: guard global + decorator por rota (`@RequirePermission('RECURSO', 'read'|'write')`).

## Testes nesta stack

- Unit: `src/domain/{entidade}/**/*.spec.ts` — mock do repositório com `jest.fn()` pela interface; arrange → act → assert; erros com `expect(...).rejects.toThrow(TipoDoErro)`.
- E2E: `test/e2e/{entidade}.e2e-spec.ts` com Supertest + helper de bootstrap do app (ver TESTS.md do projeto).

```typescript
const repo: jest.Mocked<IPedidoRepository> = { criar: jest.fn(), obter: jest.fn() };
const service = new PedidoService(repo);
it('B-003 lança NotFound quando dependência não existe', async () => {
  repo.obter.mockResolvedValue(null);
  await expect(service.atualizar(99, dto, 'user')).rejects.toThrow(NotFoundException);
});
```

- Comandos exatos vêm do `sdd.config.json` do projeto — nunca invente flags.

## Armadilhas conhecidas

- **Jest 30**: a flag é `--testPathPatterns` (**plural**); o singular `--testPathPattern` foi removido e aborta a execução.
- **`this.logger` sem declaração**: usar `this.logger` num `*RepositoryImp` sem `private readonly logger = new Logger(Classe.name)` causa `TS2339` e trava a recompilação no watch mode (o servidor continua rodando código antigo).
- **Prisma `$transaction` (array-form)** não aceita `{ timeout }` — só `isolationLevel`; timeout global via `transactionOptions` no PrismaService.
- **Cliente Prisma gerado defasado**: após mudar `schema.prisma` ou usar colunas novas, rodar o `db:generate` do projeto — senão `TS2353` no build.
- **Casts não convertem em runtime**: `as unknown as string` num boolean que o banco espera como `Char(1)` estoura no Prisma (`Expected String, provided Boolean`) — converter explicitamente no repositório.
- **`console.log` em produção**: usar `Logger` do Nest — `util.inspect` trunca objetos aninhados em profundidade 2; para payloads de webhook logar `JSON.stringify(obj, null, 2)`.
- **Efeito colateral dentro da transação**: chamada HTTP externa dentro de `$transaction` segura a conexão e reverte pagamento já efetuado — sempre pós-commit.
- **Migrations não idempotentes**: sempre `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`; sequences dessincronizadas exigem `setval(pg_get_serial_sequence(...))` antes de INSERT com PK explícita.
