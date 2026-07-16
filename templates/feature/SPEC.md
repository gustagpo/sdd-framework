---
scope: fullstack
---

# Spec: [Nome da Feature]

**Status**: DRAFT
**Criado por**: Team Leader
**Data**: YYYY-MM-DD
**Prioridade**: Alta | Média | Baixa
**Baseado em**: `RESEARCH.md`

> `scope` no frontmatter: `fullstack` | `backend-only` | `frontend-only`. Decide quais passos do fluxo rodam (backend-only pula o DESIGN.md).

---

## Contexto

> Por que essa feature existe? Qual problema ela resolve? Quem se beneficia? (fundamentar no RESEARCH.md, citando fontes)

---

## Objetivo

O que deve ser possível fazer após a implementação:

- O usuário pode...
- O sistema faz... automaticamente
- A integração... é disparada quando...

---

## Escopo

### Inclui

- [item 1]

### Não Inclui (explícito)

- [item fora do escopo — evita scope creep]

---

## Fluxo Principal (Happy Path)

1. O usuário...
2. O sistema...
3. O usuário vê...

---

## Fluxos Alternativos e Erros

| Situação | Comportamento esperado |
|---|---|
| X não encontrado | Exibir erro Y |
| Timeout na integração Z | Manter estado PENDENTE e logar |

---

## Regras de Negócio

- **RN-001**: ...
- **RN-002**: ...

---

## Interface (Alto Nível)

> Descrição textual das telas/fluxos. Detalhamento visual é responsabilidade do UX/UI no DESIGN.md.

---

## Critérios de Aceite

- [ ] Critério 1 (verificável: "o sistema exibe X")
- [ ] Critério 2 (verificável)
- [ ] Testes passando (QA aprova)
- [ ] Nenhuma regressão

---

## Referências

- `RESEARCH.md` — seções [X, Y]
- [Docs de API externa, issues, discussões]
