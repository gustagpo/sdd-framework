# Contract: [Nome da Feature]

**Criado em**: YYYY-MM-DD
**Participantes**: Dev Backend, Dev Frontend, QA
**Consolidado por**: [conforme `conventions.contractConsolidator` da config]
**Baseado em**: `SPEC.md` — Status [APPROVED] + `DESIGN.md`

> Consolidação dos rascunhos em `drafts/CONTRACT.<agente>.md`. Conflitos entre rascunhos são resolvidos aqui, com a decisão registrada.

---

## O que será implementado

### Backend

- [ ] [endpoint / modelo / lógica — descrição concisa]
- [ ] Migration: [tabelas/colunas afetadas]

### Frontend

- [ ] [página / componente / serviço — descrição concisa]
- [ ] Navegação: grupo [X], ícone [Y], permissão [ENTIDADE/read]
- [ ] Viabilidade do DESIGN.md confirmada pelo Dev Frontend: SIM | ajustes solicitados ao UX/UI: [...]

### Segurança (requisitos — do threat model)

> Superfícies expostas, dados sensíveis e requisitos rastreáveis (SEC-XX/A-XX). Feature de baixo risco: declarar isso explicitamente.

- [ ] [ex.: rota X exige permissão Y; webhook Z valida token antes de processar — SEC-07]

### Operação / Deploy

> Requisitos operacionais (OPS-XX). Feature sem impacto de infra: declarar isso explicitamente.

- [ ] Env vars novas: [nome, propósito, default, documentada em .env.example]
- [ ] Migration: [estratégia de rollout + reversão]
- [ ] Jobs/observabilidade/rollback: [...]
- [ ] Itens de infra a implementar pelo DevOps no Passo 5: [... | nenhum]

---

## Como será implementado

### Decisões Técnicas

| Decisão | Justificativa |
|---|---|
| [decisão 1] | [por que] |

### Contrato de API

**`GET /api/entidade`**
- Auth: `Bearer JWT` + `ENTIDADE/read`
- Response `200`:
```json
[{ "id": 1, "nome": "..." }]
```

**`POST /api/entidade`**
- Auth: `Bearer JWT` + `ENTIDADE/write`
- Request:
```json
{ "campo_a": "string", "campo_b": 123 }
```
- Response `201`:
```json
{ "id": 1 }
```
- Erros: `400` se campo_a vazio; `404` se dependência não existe; `409` se duplicado

---

## Como será testado

### Casos de Teste Backend

| ID | Cenário | Entrada | Esperado |
|---|---|---|---|
| B-001 | Happy path criar | dados válidos | retorna `{ id }`, persiste |
| B-002 | Campo obrigatório ausente | `campo_a` vazio | `400` |
| B-003 | Recurso dependente inexistente | id inexistente | `404` |
| B-004 | Idempotência | mesmos dados 2x | não duplica |
| B-005 | Auth — sem credencial | sem header | `401` |
| B-006 | Auth — sem permissão | credencial sem permissão | `403` |

### Casos de Teste Frontend

| ID | Cenário | Ação | Esperado |
|---|---|---|---|
| F-001 | Carregamento | navegar para `/rota` | lista renderiza sem erro |
| F-002 | Estado vazio | API retorna `[]` | mensagem "Nenhum X encontrado" |
| F-003 | Criar item | preencher form e enviar | feedback de sucesso + lista atualizada |
| F-004 | Validação de form | enviar sem campo obrigatório | erro no campo |
| F-005 | Erro de API | API retorna 500 | feedback de erro descritivo |

### Casos de Teste de Segurança (se Security participante)

| ID | Cenário | Ataque simulado | Esperado |
|---|---|---|---|
| SEC-001 | Authz — recurso de outro usuário | GET com id alheio | `403`/`404`, nunca o dado |
| SEC-002 | Entrada maliciosa na borda | payload com injeção | rejeitado com `400`, sem efeito |
| SEC-003 | Webhook sem assinatura válida | POST sem/soma token errado | `401`, nada processado |

### Casos de Verificação Operacional (se DevOps participante)

| ID | Cenário | Verificação esperada |
|---|---|---|
| OPS-001 | Boot sem a env nova | falha explícita (ou default seguro documentado) |
| OPS-002 | Migration executada 2x | idempotente — sem erro nem corrupção |

### Critérios de Regressão

- [ ] Suíte completa (`commands.test:backend` do config) — 0 regressões
- [ ] [Fluxos críticos do projeto que precisam continuar funcionando — ver STACK.md]

---

## Fora do Escopo (desta iteração)

- [item explicitamente excluído]
