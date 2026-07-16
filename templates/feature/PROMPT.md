# Prompts de Implementação: [Nome da Feature]

> Gerado pelo Team Leader com base em `RESEARCH.md` + `SPEC.md`. Cada seção é um prompt independente para o teammate correspondente. Caminhos e padrões concretos vêm do `specs/STACK.md` do projeto.

---

## Para o Dev Backend

**Contexto**: [O que o backend precisa saber sobre esta feature. Integrações externas (com referência às seções do RESEARCH.md), modelos afetados, padrões relevantes.]

**Tarefa**:

- [ ] [modelo/migration — o quê]
- [ ] [interface de repositório + implementação — onde, conforme STACK.md]
- [ ] [service/caso de uso — regra de negócio]
- [ ] [DTOs/validação de borda]
- [ ] [endpoint(s) — método, rota, auth/permissão]
- [ ] [registro do módulo, conforme convenção do projeto]

**Arquivos de referência**:

- `[módulo similar existente]` — seguir a mesma estrutura
- `specs/STACK.md` — comandos, convenções e áreas proibidas

**Atenção especial**:

- [Referência a lições relevantes por ID — do LESSONS.md do projeto e do knowledge/ do framework]

---

## Para o Dev Frontend

**Contexto**: [O que o frontend precisa saber. Tela, fluxo, integração com o backend.]

**Tarefa**:

- [ ] [tipos dos dados da API]
- [ ] [serviço de API]
- [ ] [hooks/estado de dados]
- [ ] [componentes]
- [ ] [página + rota]
- [ ] [item de navegação: grupo, ícone, permissão — conforme DESIGN.md]

**Contrato de API** (fechar com o Dev Backend antes de implementar):

| Método | Rota | Request | Response |
|---|---|---|---|
| GET | `/api/...` | `?params` | `[...]` |
| POST | `/api/...` | `{ ... }` | `{ id }` |

**Arquivos de referência**:

- `[página similar existente]` — seguir o mesmo padrão
- `specs/STACK.md` — design system e padrões de serviço/estado/form

**Atenção especial**:

- [Armadilhas conhecidas por ID]

---

## Para o UX/UI (se `scope` incluir frontend)

**Contexto**: [Complexidade visual ou fluxo de UX da feature.]

**Tarefa**:

- [ ] DESIGN.md completo das telas [X, Y]
- [ ] Todos os estados de UI (loading/vazio/erro/sucesso)
- [ ] Consistência com o design system do projeto (STACK.md)

**Entregar antes do Dev Frontend começar a implementação.**
