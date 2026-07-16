# Research: [Nome da Feature]

**Criado por**: Team Leader
**Data**: YYYY-MM-DD
**Status**: EM ANDAMENTO | CONCLUÍDO

> Discovery profundo pré-spec. **Toda afirmação tem fonte** (path de arquivo com linha, ou URL). Perguntas sem resposta vão para "Perguntas em aberto" — elas serão levadas ao usuário no gate de aprovação.

---

## Pedido original

> Transcrição/resumo do que foi pedido, sem interpretação.

---

## Requisitos identificados

| # | Requisito | Origem | Explícito/Implícito |
|---|---|---|---|
| R-01 | [o que precisa acontecer] | [pedido / fonte] | Explícito |

---

## O que já existe no código

> Módulos, entidades, endpoints, telas e padrões que a feature toca ou pode reutilizar. **Nunca propor código novo onde já existe implementação adequada.**

| Área | Arquivo(s) | O que faz hoje | Relação com a feature |
|---|---|---|---|
| [módulo X] | `path/arquivo:linha` | [comportamento atual] | [reutilizar / estender / substituir] |

---

## Arquitetura afetada

- Camadas/módulos que mudam: [...]
- Modelos de dados afetados (tabelas/colunas novas ou alteradas): [...]
- Migrações necessárias: [...]

---

## Integrações externas

> Para cada API/serviço externo envolvido. Fonte primária = documentação local do repo (docsDirs/openApiSpecs); web só quando não houver doc local.

### [Nome da integração]

- **Fonte consultada**: `docs/...` | https://... (data da consulta)
- **Autenticação**: [método]
- **Endpoints relevantes**:

| Método | Endpoint | Request (essencial) | Response (essencial) | Erros conhecidos |
|---|---|---|---|---|
| POST | `/...` | `{...}` | `{...}` | 4xx quando... |

- **Observações/limitações**: [...]

---

## Riscos e restrições

| Risco | Impacto | Mitigação proposta |
|---|---|---|
| [risco] | Alto/Médio/Baixo | [como mitigar] |

---

## Perguntas em aberto (para o gate)

- [ ] [pergunta que só o usuário pode responder]

---

## Fontes consultadas

- `path/arquivo` — [o que foi extraído]
- https://... — [o que foi extraído]
