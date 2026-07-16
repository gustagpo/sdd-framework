# Perfil de Stack: Next.js (App Router)

> Especializa os standards genéricos [`standards/DDD.md`](../DDD.md), [`standards/SOLID.md`](../SOLID.md) e [`standards/API.md`](../API.md) para Next.js 14+ com App Router. As seções DDD/SOLID/API abaixo espelham a checklist "Como o perfil de stack especializa" de cada standard e citam as regras por ID (`D-xx`/`S-xx`/`A-xx`). Leia antes de escrever qualquer código nesta stack.

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5+ (`strict: true`) |
| Framework | Next.js 14/15 — App Router (React Server Components) |
| ORM / dados | Prisma **ou** Drizzle, sempre atrás de uma interface de repositório |
| Validação | Zod (na borda: route handlers e Server Actions) |
| Auth | Middleware (`middleware.ts`) + sessão (NextAuth/Auth.js ou JWT em cookie httpOnly) |
| Testes | Vitest (unit/integração) + Playwright (e2e) |
| Docs de API | OpenAPI gerado de schemas Zod (`zod-to-openapi`) ou rota `/api/openapi` |

**Princípio central desta stack:** o App Router **não** é a arquitetura da aplicação — é a camada de entrega. O domínio vive fora de `app/`. Route handlers, Server Actions e Server Components são casca fina que valida, autentica e delega a casos de uso.

---

## Estrutura de pastas canônica

```
src/
├── domain/                      ← regras de negócio puras (zero import de next/react/prisma)
│   ├── <contexto>/
│   │   ├── entities/            ← entidades e value objects (classes/tipos + invariantes)
│   │   ├── repositories/        ← INTERFACES de repositório (ports)
│   │   └── dtos/                ← schemas Zod de entrada/saída do domínio
├── application/                 ← casos de uso (orquestram domínio + repositórios)
│   └── <contexto>/use-cases/
├── infra/                       ← implementações concretas (adapters)
│   ├── database/                ← client Prisma/Drizzle (singleton)
│   ├── repositories/            ← implementações dos ports com Prisma/Drizzle
│   └── auth/                    ← leitura/validação de sessão
├── composition/                 ← wiring: fábricas que montam casos de uso com deps concretas
└── app/                         ← PRESENTATION (Next.js) — casca fina
    ├── (routes)/                ← páginas (Server Components por padrão)
    ├── api/<recurso>/route.ts   ← route handlers REST
    └── _actions/                ← Server Actions ("use server")
```

Regra de dependência: `app/` → `application/` → `domain/`; `infra/` implementa `domain/`. Nada em `domain/` importa de `app/`, `infra/` ou de qualquer pacote de framework.

---

## DDD nesta stack

> Especializa `D-01..D-12`. Camadas → árvore acima. `D-02`: repositório = `interface` no domínio, impl na infra. `D-05`/`D-12`: entidade de domínio ≠ tipo do Prisma/Drizzle (mapeamento explícito). `D-07` (efeito pós-commit): dispare fila/`after()` do Next **fora** do `prisma.$transaction(...)`, já commitado.

- **Interfaces de repositório** vivem em `domain/<contexto>/repositories/` — TypeScript `interface`, nomeadas pelo domínio (`SubscriberRepository`), sem menção a Prisma.
- **Implementações** vivem em `infra/repositories/` e recebem o client no construtor.
- **Entidades / value objects** em `domain/<contexto>/entities/` — protegem invariantes no construtor/factory; nunca são o tipo gerado pelo Prisma.
- **DTOs** são schemas Zod em `domain/<contexto>/dtos/`; o tipo TS deriva com `z.infer`.
- **Casos de uso** em `application/` recebem repositórios pela interface (injeção por construtor) e não conhecem HTTP nem React.

```typescript
// domain/subscriber/repositories/subscriber.repository.ts
export interface SubscriberRepository {
  findById(id: string): Promise<Subscriber | null>;
  save(subscriber: Subscriber): Promise<void>;
}

// application/subscriber/use-cases/activate-subscriber.ts
export class ActivateSubscriber {
  constructor(private readonly repo: SubscriberRepository) {}

  async execute(input: ActivateInput): Promise<Subscriber> {
    const sub = await this.repo.findById(input.id);
    if (!sub) throw new NotFoundError('subscriber', input.id);
    sub.activate();                 // invariante protegida na entidade
    await this.repo.save(sub);
    return sub;
  }
}
```

---

## SOLID nesta stack

> Especializa `S-01..S-12`. **Limites deste perfil (QA confere):** função ≤ 40 linhas, componente/módulo ≤ 250 linhas (`S-10`); > 3 parâmetros → objeto de opções nomeado (`S-11`). Cálculo puro (`S-06`) em `domain/**` ou `*.util.ts`, sem I/O. DI = `S-05` (factory em `composition/`). Registry/estratégia = `S-02`/`S-04`. Lint que cobre parte: ESLint (`complexity`, `import/no-restricted-paths` para barrar import de infra no domínio).

TypeScript/Next não tem container de DI nativo — a inversão de dependência é feita por **factory functions** em `composition/`. Route handlers e Server Actions importam a factory, nunca instanciam repositórios concretos.

```typescript
// composition/subscriber.factory.ts
import { prisma } from '@/infra/database/client';
import { PrismaSubscriberRepository } from '@/infra/repositories/prisma-subscriber.repository';
import { ActivateSubscriber } from '@/application/subscriber/use-cases/activate-subscriber';

// troque a linha do repo por um fake em testes — DIP sem framework de DI
export const makeActivateSubscriber = () =>
  new ActivateSubscriber(new PrismaSubscriberRepository(prisma));
```

- **DIP:** o caso de uso depende da `interface`; a factory escolhe a implementação. Um teste chama `new ActivateSubscriber(fakeRepo)` direto.
- **OCP / Strategy:** para múltiplos providers (ex.: pagamento), defina um port por capacidade e um registry (`Map<string, Port>`); adicionar provider = 1 classe + 1 entrada no registry, sem tocar nas existentes.
- **SRP:** um caso de uso por operação; nada de "service" com 15 métodos.

---

## API nesta stack

> Especializa `A-01..A-15`. Rota/versão (`A-10`): tudo sob `app/api/` com versão no path (`app/api/v1/...`). Validação na borda (`A-05`): Zod `safeParse`. Erro (`A-06`/`A-07`): Problem Details via `problem()`. RBAC (`A-11`): sessão no middleware + reavaliação no handler. Doc (`A-14`): `zod-to-openapi`. **Envelope de paginação (`A-09`):** `{ items: T[], page, limit, total }` (mesmo shape em toda lista).

- **Route handlers** exportam funções nomeadas por verbo HTTP (`export async function POST`) em `app/api/<recurso>/route.ts`. Recebem `Request`, retornam `Response`/`NextResponse`.
- **Validação na borda:** `schema.safeParse(await req.json())` no início do handler; `success === false` → 400 com os `error.issues`.
- **Formato de erro** padronizado (Problem Details): `{ type, title, status, detail }`. Centralize num helper `problem(status, title, detail)`.
- **Auth/RBAC:** `middleware.ts` protege matchers de rota (autenticação grosseira); a autorização fina (dono do recurso / permissão) é reavaliada **dentro** do handler/caso de uso — middleware não basta.
- **OpenAPI:** registre os schemas Zod com `zod-to-openapi` e sirva o documento em uma rota dedicada.

```typescript
// app/api/subscribers/route.ts
import { z } from 'zod';
import { makeActivateSubscriber } from '@/composition/subscriber.factory';
import { problem } from '@/app/api/_lib/problem';
import { requireSession } from '@/infra/auth/session';

const BodySchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const session = await requireSession(req);            // 401 se ausente
  if (!session.can('SUBSCRIBER', 'write'))
    return problem(403, 'Forbidden', 'sem permissão SUBSCRIBER/write');

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success)
    return problem(400, 'Validation failed', parsed.error.issues[0]?.message);

  try {
    const sub = await makeActivateSubscriber().execute(parsed.data);
    return Response.json({ id: sub.id, status: sub.status }, { status: 200 });
  } catch (e) {
    if (e instanceof NotFoundError) return problem(404, 'Not found', e.message);
    throw e; // erro inesperado → 500 pelo error boundary
  }
}
```

Server Actions seguem o **mesmo** rigor: `"use server"` no topo, `safeParse` do input e checagem de sessão/permissão **dentro** da action (ver Armadilhas).

---

## Testes nesta stack

- **Unit** (Vitest): casos de uso e entidades, injetando um repositório fake que implementa a interface do port. Sem Next, sem banco.
- **Integração**: route handler importado direto (`POST(new Request(...))`) com a factory apontando para um repo em memória.
- **E2E** (Playwright): fluxo real no browser contra o app rodando.
- **Mock da camada de repositório:** implemente a `interface` com um objeto in-memory — nunca faça mock do Prisma client.

```typescript
// application/subscriber/use-cases/activate-subscriber.spec.ts
import { describe, it, expect } from 'vitest';

const fakeRepo = (sub: Subscriber | null): SubscriberRepository => ({
  findById: async () => sub,
  save: async () => {},
});

describe('ActivateSubscriber', () => {
  it('ativa um assinante existente', async () => {
    const uc = new ActivateSubscriber(fakeRepo(makeSubscriber({ status: 'PENDING' })));
    const out = await uc.execute({ id: 'sub-1' });
    expect(out.status).toBe('ACTIVE');
  });
});
```

Comandos: `npx vitest run` (unit/integração), `npx vitest --watch`, `npx playwright test` (e2e).

---

## Armadilhas conhecidas

- **Lógica de negócio no componente/route handler** → mova para um caso de uso em `application/`. O handler só valida, autoriza e delega. Se o arquivo em `app/` importa Prisma e tem `if` de regra de negócio, está errado.
- **`"use client"` desnecessário** → Server Component é o **padrão**; só marque `"use client"` quando o componente usa estado/efeito/handlers do browser. `"use client"` no topo de uma página arrasta a árvore inteira para o cliente e derruba o data fetching no servidor.
- **Acesso direto ao ORM em Server Component** → um Server Component pode buscar dados, mas via caso de uso/repositório, não com `prisma.x.findMany()` inline. Caso contrário a regra de dependência vaza e não há como testar/reusar.
- **Cache de `fetch` do Next mascarando dados stale** → o default de cache de `fetch` GET **mudou entre 14 e 15** (14 cacheia por padrão; 15 não). Não confie no default: seja explícito com `{ cache: 'no-store' }` para dados por-request e `{ next: { revalidate: N } }` para ISR. Para queries de banco (fora de `fetch`), use `revalidatePath`/`revalidateTag` após mutações.
- **Server Action sem validação/authz** → uma Server Action **compila para um endpoint POST público**; qualquer um pode chamá-la com payload arbitrário. `safeParse` do input e checagem de sessão/permissão **dentro** da action são obrigatórios, não defensivos.
- **Segredos vazando para o cliente** → só variáveis `NEXT_PUBLIC_*` vão ao browser. Nunca leia `process.env.DATABASE_URL` em código que possa ser marcado `"use client"`.
- **`prisma` recriado a cada hot-reload em dev** → exporte um singleton global-guarded (`globalThis.prisma ??= new PrismaClient()`) em `infra/database/`, senão esgota as conexões no `next dev`.
