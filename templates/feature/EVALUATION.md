# Evaluation: [Nome da Feature]

**Data**: YYYY-MM-DD
**Iteração**: 1
**Consolidado por**: QA (a partir de todos os `drafts/EVALUATION.*.md` — qa, ux-ui, security, devops)

---

## Resultado Geral

> APROVADO | REPROVADO

_(Aprovado somente quando **TODAS** as seções participantes — Funcional, UX/UI, Segurança e DevOps — estiverem aprovadas)_

---

## Seção 1 — Avaliação Funcional (QA)

### Testes Backend

| ID | Cenário | Resultado | Observação |
|---|---|---|---|
| B-001 | ... | ✅ PASSOU / ❌ FALHOU | |

### Testes Frontend

| ID | Cenário | Resultado | Observação |
|---|---|---|---|
| F-001 | ... | ✅ PASSOU / ❌ FALHOU | |

### Regressão

| Suite | Resultado |
|---|---|
| Suíte completa | ✅ [N]/[N] passando |
| [Fluxo crítico do projeto] | ✅ / ❌ |

### Segurança

| Item | Resultado |
|---|---|
| Rotas protegidas retornam 401/403 | ✅ / ❌ |
| Entrada inválida rejeitada na borda | ✅ / ❌ |
| Dados sensíveis fora de logs/erros | ✅ / ❌ |

### Resultado Funcional: APROVADO | REPROVADO

---

## Seção 2 — Validação UX/UI

### Checklist Visual / Layout

| Item | Resultado | Observação |
|---|---|---|
| Composição fiel ao DESIGN.md | ✅/❌ | |
| Tipografia (tamanho, peso, cor) | ✅/❌ | |
| Espaçamento (tokens corretos) | ✅/❌ | |
| Cores/tokens do design system (sem hardcode) | ✅/❌ | |
| Ícones corretos | ✅/❌ | |

### Checklist Componentes e Design System

| Item | Resultado | Observação |
|---|---|---|
| Componentes conforme DESIGN.md | ✅/❌ | |
| Sem componente customizado onde existe padrão | ✅/❌ | |
| Padrão de formulário do projeto respeitado | ✅/❌ | |
| Campos obrigatórios sinalizados | ✅/❌ | |

### Checklist Estados de UI

| Estado | Resultado | Observação |
|---|---|---|
| Loading | ✅/❌ | |
| Vazio (mensagem + ação) | ✅/❌ | |
| Erro (feedback legível) | ✅/❌ | |
| Sucesso (feedback + atualização) | ✅/❌ | |

### Checklist UX e Fluxo

| Item | Resultado | Observação |
|---|---|---|
| Ações no destino correto | ✅/❌ | |
| Campos condicionais corretos | ✅/❌ | |
| Dependentes resetam quando pai muda | ✅/❌ | |
| Formulário limpo ao fechar sem salvar | ✅/❌ | |
| Foco pós-ação correto | ✅/❌ | |

### Checklist Acessibilidade Básica

| Item | Resultado | Observação |
|---|---|---|
| Labels associados a inputs | ✅/❌ | |
| Botões de ícone com `aria-label` | ✅/❌ | |
| Tab order lógico | ✅/❌ | |
| Contraste legível | ✅/❌ | |

### Checklist Navegação (se tela nova)

| Item | Resultado | Observação |
|---|---|---|
| Item no grupo/posição corretos | ✅/❌ | |
| Ícone correto | ✅/❌ | |
| Visível apenas com permissão | ✅/❌ | |

### Resultado UX/UI: APROVADO | REPROVADO

---

## Seção 3 — Segurança (Security, se participante)

### Casos SEC-XXX do contrato

| ID | Cenário | Resultado | Observação |
|---|---|---|---|
| SEC-001 | ... | ✅ PASSOU / ❌ FALHOU | |

### Checklist SEC-XX aplicável

| Regra | Resultado | Observação |
|---|---|---|
| SEC-02 authz em toda rota nova | ✅/❌ | |
| SEC-04/05 segredos fora de código e logs | ✅/❌ | |
| SEC-06 acesso a dados parametrizado | ✅/❌ | |
| SEC-07/08 webhook validado e idempotente | ✅/❌ | |

### Findings

| Severidade | Responsável | Arquivo | Problema → Como corrigir |
|---|---|---|---|
| CRÍTICA/ALTA/MÉDIA/BAIXA | [Dev Backend] | `path` | ... |

### Resultado Segurança: APROVADO | REPROVADO

---

## Seção 4 — DevOps (se participante)

### Casos OPS-XXX do contrato

| ID | Cenário | Resultado | Observação |
|---|---|---|---|
| OPS-001 | ... | ✅ PASSOU / ❌ FALHOU | |

### Checklist de deployability

| Item | Resultado | Observação |
|---|---|---|
| Build de produção passa | ✅/❌ | |
| Envs novas documentadas + comportamento sem elas definido | ✅/❌ | |
| Migration idempotente + rollback definido | ✅/❌ | |
| Logs de diagnóstico sem dados sensíveis | ✅/❌ | |

### Resultado DevOps: APROVADO | REPROVADO

---

## Itens de Refatoração

> Preencher apenas se REPROVADO em qualquer seção. Cirúrgico: arquivo, observado, esperado, como corrigir.

### [Dev Backend | Dev Frontend | DevOps] — [ID ou título]

**Problema**: [observado]
**Esperado**: [comportamento correto, com referência ao CONTRACT/DESIGN]
**Arquivo**: `path/arquivo` linha ~XX
**Como corrigir**: [instrução concisa]

---

## Aprendizados

> Bugs novos ou padrões violados recorrentemente. O Team Leader classifica na retrospectiva (projeto / stack / processo).

- [descrição do aprendizado + contexto]
