# STACK — {{PROJECT_NAME}}

> **Perfil do projeto para o SDD Framework.** Este arquivo tem a MAIOR precedência na cadeia de contexto dos agentes: o que está aqui vence o perfil de stack (`standards/stacks/{{BACKEND_PROFILE}}.md`) e os standards genéricos. Mantenha-o atualizado — é lido em TODA rodada `/sdd`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | {{BACKEND_STACK}} |
| Frontend | {{FRONTEND_STACK}} |
| Banco / ORM | {{DATABASE_STACK}} |
| Testes | {{TEST_STACK}} |

**Perfis do framework**: backend = `{{BACKEND_PROFILE}}`, frontend = `{{FRONTEND_PROFILE}}`

---

## Comandos

> Os agentes usam SEMPRE estes comandos (nunca inventam flags). Placeholder `{pattern}` = filtro de arquivos de teste da feature.

| Ação | Comando |
|---|---|
| Build backend | `{{CMD_BUILD_BACKEND}}` |
| Testes backend (filtrado) | `{{CMD_TEST_BACKEND}}` |
| Testes e2e (filtrado) | `{{CMD_TEST_E2E}}` |
| Build frontend | `{{CMD_BUILD_FRONTEND}}` |

---

## Estrutura do repositório

```
{{REPO_TREE}}
```

## Estrutura de módulo novo (backend)

> Onde cada camada vive NESTE projeto (se divergir do perfil da stack, o daqui vale).

```
[preencher: caminho de domain/interfaces, infra/implementações, presentation/rotas, registro de módulos]
```

## Convenções do projeto

- **Nomenclatura de banco**: [snake_case? prefixos? PK padrão?]
- **Campos de auditoria**: [quais campos toda tabela nova precisa]
- **Migrations**: [onde vivem, convenção de nome, idempotência]
- **Autenticação/RBAC**: [como rotas são protegidas; como registrar nova permissão/tela]

## Design system (frontend)

- **Biblioteca de componentes**: [qual + versão]
- **Tokens**: [onde estão definidos; principais tokens de cor/espaçamento]
- **Padrões visuais estabelecidos**: [campo obrigatório, callouts, ações destrutivas, valores somente leitura...]
- **Navegação**: [estrutura de menu/sidebar — grupos e ordem; como adicionar item novo]

## Fontes de pesquisa (discovery do Team Leader)

- Documentação local: {{DOCS_DIRS}}
- Specs OpenAPI: {{OPENAPI_SPECS}}

## Áreas proibidas (NUNCA modificar)

- [ex.: diretórios legados somente leitura, arquivos com exceções intencionais]

## Regras de negócio críticas do domínio

> Peculiaridades que TODO agente precisa saber antes de tocar no código (schemas com armadilhas, integrações com comportamentos não óbvios, campos depreciados). Referencie IDs do LESSONS.md quando existirem.

- [preencher conforme o projeto evolui]

## Fluxos críticos de regressão

> O que precisa continuar funcionando após QUALQUER feature (base dos critérios de regressão do CONTRACT.md).

- [ex.: login/auth, fluxo de pagamento, ...]
