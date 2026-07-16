# Perfil de Stack: Python / FastAPI

> Especializa os standards genéricos [`standards/DDD.md`](../DDD.md), [`standards/SOLID.md`](../SOLID.md) e [`standards/API.md`](../API.md) para Python 3.12+ com FastAPI. As seções DDD/SOLID/API abaixo espelham a checklist "Como o perfil de stack especializa" de cada standard e citam as regras por ID (`D-xx`/`S-xx`/`A-xx`). Leia antes de escrever qualquer código nesta stack.

| Camada | Tecnologia |
|---|---|
| Linguagem | Python 3.12+ (type hints em tudo; `mypy`/`pyright` strict) |
| Framework | FastAPI (ASGI, async-first) |
| ORM / dados | SQLAlchemy 2.0 **async** (`AsyncSession`), atrás de `Protocol`/ABC |
| Validação | Pydantic **v2** (DTOs de request/response) |
| Auth | OAuth2/JWT via `Depends` + `Security`; RBAC por dependency |
| Testes | pytest + `pytest-asyncio` + httpx `AsyncClient` |
| Docs de API | OpenAPI automático (`/docs`, `/openapi.json`) |
| Migrations | Alembic |

**Princípio central desta stack:** o router FastAPI é presentation. O domínio não conhece FastAPI nem SQLAlchemy. Pydantic valida a **borda**; entidades de domínio são separadas dos models Pydantic e das tabelas ORM.

---

## Estrutura de pastas canônica

```
app/
├── domain/                      ← regras de negócio puras (sem FastAPI/SQLAlchemy/Pydantic)
│   └── <contexto>/
│       ├── entities.py          ← entidades e value objects (dataclasses/objetos ricos)
│       ├── repositories.py      ← Protocol/ABC dos repositórios (ports)
│       └── services.py          ← serviços de domínio (regras que cruzam entidades)
├── application/                 ← casos de uso (orquestram domínio + ports)
│   └── <contexto>/use_cases.py
├── infra/                       ← adapters concretos
│   ├── db/
│   │   ├── session.py           ← engine + async_sessionmaker
│   │   └── models.py            ← models SQLAlchemy (tabelas) — NÃO são entidades
│   └── repositories/            ← implementações dos ports com SQLAlchemy
├── api/                         ← PRESENTATION
│   ├── routers/<recurso>.py     ← APIRouter + endpoints
│   ├── schemas/<recurso>.py     ← DTOs Pydantic v2 (request/response)
│   ├── deps.py                  ← dependências (Depends): session, auth, wiring
│   └── errors.py                ← exception handlers → Problem Details
└── main.py                      ← cria o app, registra routers e handlers
```

Regra de dependência: `api/` → `application/` → `domain/`; `infra/` implementa `domain/`. `domain/` não importa nada de `api/`, `infra/`, `fastapi`, `pydantic` ou `sqlalchemy`.

---

## DDD nesta stack

> Especializa `D-01..D-12`. Camadas → árvore acima. `D-02`: port = `Protocol`/ABC no `domain/`, impl no `infra/`. `D-05`/`D-12`: entidade (dataclass) ≠ model SQLAlchemy ≠ DTO Pydantic (três tipos distintos). `D-07` (efeito pós-commit): dispare via `BackgroundTasks` do FastAPI ou fila (Celery/arq) **depois** de `await session.commit()`.

- **Ports de repositório** são `Protocol` (ou ABC) em `domain/<contexto>/repositories.py`, tipados com entidades de domínio.
- **Implementações** ficam em `infra/repositories/`, recebem `AsyncSession` no `__init__` e traduzem entidade ↔ model ORM.
- **Entidades** em `domain/entities.py` são objetos ricos (dataclass ou classe) com invariantes — **não** são models Pydantic nem tabelas SQLAlchemy.
- **DTOs** são `BaseModel` do Pydantic v2 em `api/schemas/`, usados só na borda HTTP.
- **Casos de uso** em `application/` recebem o port por parâmetro; não importam FastAPI.

```python
# domain/subscriber/repositories.py
from typing import Protocol
from .entities import Subscriber

class SubscriberRepository(Protocol):
    async def find_by_id(self, sub_id: str) -> Subscriber | None: ...
    async def save(self, subscriber: Subscriber) -> None: ...

# application/subscriber/use_cases.py
class ActivateSubscriber:
    def __init__(self, repo: SubscriberRepository) -> None:
        self._repo = repo

    async def execute(self, sub_id: str) -> Subscriber:
        sub = await self._repo.find_by_id(sub_id)
        if sub is None:
            raise NotFoundError("subscriber", sub_id)
        sub.activate()                     # invariante na entidade
        await self._repo.save(sub)
        return sub
```

---

## SOLID nesta stack

> Especializa `S-01..S-12`. **Limites deste perfil (QA confere):** função ≤ 40 linhas, classe ≤ 200 linhas (`S-10`); > 3 parâmetros posicionais → objeto de opções (dataclass/`BaseModel`) (`S-11`). Cálculo puro (`S-06`) em `domain/**/services.py` ou `*_utils.py`, sem I/O. DI = `S-05` (`Depends`). Registry/estratégia = `S-02`/`S-04` (`dict[str, Port]`). Lint que cobre parte: `ruff` (`C901` complexidade, `PLR0913` excesso de args) + `mypy` strict.

Injeção idiomática = **`Depends`**. Cada nível (`session` → `repository` → `use_case`) é uma dependência que compõe a anterior. Trocar a implementação em teste = `app.dependency_overrides[...]`.

```python
# api/deps.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.infra.db.session import async_session
from app.infra.repositories.subscriber import SqlSubscriberRepository
from app.application.subscriber.use_cases import ActivateSubscriber

async def get_session() -> AsyncSession:          # yield: sessão por-request, fechada no fim
    async with async_session() as session:
        yield session

def get_subscriber_repo(s: AsyncSession = Depends(get_session)) -> SubscriberRepository:
    return SqlSubscriberRepository(s)

def get_activate_subscriber(
    repo: SubscriberRepository = Depends(get_subscriber_repo),
) -> ActivateSubscriber:
    return ActivateSubscriber(repo)
```

- **DIP:** o caso de uso e o endpoint dependem do `Protocol`; o `Depends` escolhe a implementação. `app.dependency_overrides[get_subscriber_repo] = lambda: fake` num teste.
- **OCP / Strategy:** múltiplos providers = um `Protocol` por capacidade + um registry `dict[str, Port]`; adicionar um = registrar a chave, sem tocar nos demais.
- **SRP:** um caso de uso por operação; serviços de domínio só para regras que cruzam entidades.

---

## API nesta stack

> Especializa `A-01..A-15`. Rota/versão (`A-10`): `APIRouter(prefix="/api/v1")`. Validação na borda (`A-05`): DTO Pydantic no parâmetro → 422 automático. Erro (`A-06`/`A-07`): `@app.exception_handler` → Problem Details. RBAC (`A-11`): `Security`/`Depends(require_permission(...))`. Doc (`A-14`): OpenAPI automático. **Envelope de paginação (`A-09`):** `{ items: [...], page, size, total }` (ex.: `Page[T]` do `fastapi-pagination`), idêntico em toda lista.

- **Rotas** via `APIRouter` por recurso; o endpoint declara os DTOs no `response_model` e recebe o corpo como model Pydantic (validação automática → 422 em falha).
- **Erros** via `@app.exception_handler(...)` que traduz exceções de domínio para **Problem Details** (`application/problem+json`): `{ type, title, status, detail }`.
- **Auth/RBAC:** autenticação como dependency (`Security(get_current_user)`); autorização fina como dependency que checa permissão e levanta `HTTPException(403)`.
- **OpenAPI:** automático — mantenha os schemas Pydantic precisos (`Field`, exemplos) que a doc sai correta.

```python
# api/routers/subscribers.py
from fastapi import APIRouter, Depends, status
from app.api.schemas.subscriber import ActivateIn, SubscriberOut
from app.api.deps import get_activate_subscriber, require_permission

router = APIRouter(prefix="/subscribers", tags=["subscribers"])

@router.post("", response_model=SubscriberOut, status_code=status.HTTP_200_OK)
async def activate(
    body: ActivateIn,                                        # Pydantic valida → 422 se inválido
    _perm=Depends(require_permission("SUBSCRIBER", "write")),  # 403 se sem permissão
    uc: ActivateSubscriber = Depends(get_activate_subscriber),
) -> SubscriberOut:
    sub = await uc.execute(body.id)                          # NotFoundError → handler → 404 Problem
    return SubscriberOut(id=sub.id, status=sub.status)
```

```python
# api/schemas/subscriber.py — Pydantic v2 (idiomas v2, ver Armadilhas)
from pydantic import BaseModel, ConfigDict, field_validator

class ActivateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")   # não 'class Config'
    id: str

    @field_validator("id")                       # não '@validator'
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("id não pode ser vazio")
        return v
```

---

## Testes nesta stack

- **Unit** (pytest): casos de uso/entidades com um fake que satisfaz o `Protocol` do repositório. Marque `async` com `pytest.mark.asyncio` (ou `asyncio_mode = auto`).
- **E2E/integração**: httpx `AsyncClient` com `ASGITransport(app=app)` e `dependency_overrides` para trocar repositórios por in-memory.
- **Mock do repositório:** implemente o `Protocol` com uma classe in-memory — não faça mock da `AsyncSession`.

```python
# tests/test_activate_subscriber.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import get_subscriber_repo

class InMemoryRepo:                     # satisfaz o Protocol estruturalmente
    def __init__(self, sub): self._sub = sub
    async def find_by_id(self, _): return self._sub
    async def save(self, sub): self._sub = sub

@pytest.mark.asyncio
async def test_activate_ok():
    app.dependency_overrides[get_subscriber_repo] = lambda: InMemoryRepo(make_subscriber("PENDING"))
    transport = ASGITransport(app=app)   # httpx atual exige transport=, não app=
    async with AsyncClient(transport=transport, base_url="http://t") as ac:
        r = await ac.post("/subscribers", json={"id": "sub-1"})
    assert r.status_code == 200 and r.json()["status"] == "ACTIVE"
    app.dependency_overrides.clear()
```

Comandos: `pytest` (tudo), `pytest -k activate` (filtro), `pytest --cov=app` (cobertura), `alembic upgrade head` (migrations).

---

## Armadilhas conhecidas

- **Session do SQLAlchemy vazando entre requests** → nunca use uma `AsyncSession` global de módulo. A dependência `get_session` com `async with ... yield` cria **uma sessão por request** e a fecha no fim — esse é o fix, use-o em todos os repositórios.
- **Mutable default args** (`def f(x=[])`, `def f(cfg={})`) → o default é avaliado uma vez e compartilhado entre chamadas, acumulando estado. Use `x: list | None = None` e `x = x or []` dentro.
- **Model Pydantic usado como entidade de domínio** → acopla o núcleo à borda HTTP e à serialização; mudar o contrato da API passa a exigir mudar a regra de negócio. Mantenha entidade (dataclass no `domain/`), DTO (Pydantic no `api/`) e model ORM (SQLAlchemy no `infra/`) separados.
- **Misturar sync e async** → chamada bloqueante (`requests`, `time.sleep`, driver DB síncrono) dentro de `async def` trava o event loop e serializa o servidor. Use libs async (`httpx`, driver `asyncpg`) ou empurre o bloqueante para `run_in_threadpool`.
- **Dependência circular entre routers e services** → o router importa o caso de uso via `Depends` (em `deps.py`); o caso de uso **nunca** importa o router. Se surgir ciclo, o wiring está no lugar errado — mova para `deps.py`/`application`.
- **Pydantic v1 vs v2** → use idiomas v2: `model_config = ConfigDict(...)` (não `class Config`), `@field_validator` (não `@validator`), `model_validate`/`model_dump` (não `parse_obj`/`dict`). Misturar as APIs quebra em runtime.
- **`Depends` reavaliado com efeito colateral** → dependências rodam a cada request; não coloque trabalho caro/idempotência frágil nelas sem cache (`functools.lru_cache` para singletons de configuração).
