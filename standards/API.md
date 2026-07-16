# Padrão de API REST

Núcleo genérico de design de API REST que todo agente implementador (Dev Backend, Dev Frontend, QA) lê antes de criar ou revisar um endpoint. Vale para qualquer stack; o arquivo `standards/stacks/<perfil>.md` traduz cada regra para o framework web, a lib de validação e a ferramenta de documentação do projeto. Objetivo: contratos previsíveis, erros consistentes, validação na borda e nada de vazamento de dado sensível.

## Princípios

1. **Recurso, não ação.** A rota nomeia um recurso no **plural**, em kebab-case (`/faturas`, `/planos-logistica`); o verbo é o método HTTP, não a URL (`GET /faturas`, não `/getFaturas`). Ações que não são CRUD viram sub-recurso (`POST /pedidos/{id}/cancelar`).
2. **Verbos HTTP semânticos.** `GET` lê (lista/detalhe, sem efeito), `POST` cria, `PUT` substitui/atualiza idempotente, `PATCH` atualiza parcial, `DELETE` remove ou inativa. Sem efeito colateral em `GET`.
3. **Status codes canônicos.** O código reflete o resultado real; o corpo detalha. Ver tabela abaixo.
4. **Erro em formato consistente.** Todo erro tem a mesma forma (inspirada em Problem Details / RFC 7807): um **código de erro estável** (string), uma **mensagem legível** e, quando validação, **detalhes por campo**. O cliente programa contra o código, não contra a mensagem.
5. **Validação sempre na borda.** Toda entrada (body, query, params) é validada por DTO/schema **antes** de chegar ao caso de uso; entrada inválida nunca alcança o domínio. Ver DDD `D-04`/`D-05`.
6. **Lista com envelope consistente.** Toda coleção paginada responde no mesmo shape (itens + metadados de paginação); o mesmo recurso não alterna formatos entre endpoints.
7. **Versionamento sob prefixo.** Toda rota vive sob um prefixo (`/api`) e uma estratégia de versão declarada; quebra de contrato é versão nova, não mutação silenciosa do endpoint existente.
8. **AuthN/AuthZ declarativos na rota.** Autenticação por Bearer JWT; autorização por recurso+ação (RBAC) declarada na própria rota, não checada ad hoc no corpo do handler.
9. **Idempotência onde importa.** `PUT`/`DELETE` são idempotentes por definição; `POST` que não pode duplicar usa chave de idempotência ou checagem de estado. Webhook reentregue não aplica o efeito duas vezes (ver DDD `D-08`).
10. **Documentação viva.** Todo endpoint é documentado (OpenAPI/Swagger) gerado a partir do código — request, response, códigos de erro e auth. Endpoint sem doc é endpoint incompleto.
11. **Nunca vazar dado sensível.** Segredo, token, PAN, senha e PII não aparecem em resposta de erro nem em log; headers de auth são mascarados no log.

### Status codes

| Código | Quando usar |
|---|---|
| 200 OK | `GET` com resultado; `PUT`/`PATCH` que devolve o recurso |
| 201 Created | `POST` que cria — devolve o id (e/ou o recurso) criado |
| 204 No Content | Sucesso sem corpo (`DELETE`, ação que não retorna dado) |
| 400 Bad Request | Requisição malformada (JSON inválido, tipo errado) |
| 401 Unauthorized | Sem credencial válida / token ausente ou expirado |
| 403 Forbidden | Autenticado, mas sem permissão para o recurso/ação |
| 404 Not Found | Recurso inexistente (ou não visível ao chamador) |
| 409 Conflict | Conflito de estado (duplicidade, versão/optimistic lock) |
| 422 Unprocessable Entity | Sintaxe ok, mas viola regra de validação/negócio |
| 5xx | Falha do servidor/integração — sem detalhe interno vazado ao cliente |

### Formato de erro (conceitual, inspirado em RFC 7807)

O mesmo shape para todo erro; o cliente programa contra `code`, não contra `message`:

```
# 422 — erro de validação (detalhe por campo)
{
  "code": "VALIDACAO_ENTRADA",        # código estável (contrato)
  "message": "Dados do pedido inválidos.",   # legível, não é contrato
  "details": [
    { "field": "email", "message": "e-mail é obrigatório" },
    { "field": "dia_ciclo", "message": "deve ser 1, 5, 10, 15 ou 20" }
  ]
}

# 409 — conflito de estado (sem details por campo)
{ "code": "PEDIDO_JA_FINALIZADO", "message": "Pedido já finalizado." }
```

Nunca serializar stack trace, SQL, segredo ou PII no corpo de erro (A-15).

## Regras verificáveis

- [ ] A-01: Rotas nomeiam recurso no plural em kebab-case; nenhum verbo na URL (grep por `get`/`create`/`update` no path).
- [ ] A-02: O método HTTP casa com a semântica (sem efeito colateral em `GET`; criação por `POST`).
- [ ] A-03: `POST` de criação responde **201** com o id (e/ou recurso) criado.
- [ ] A-04: Ação sem corpo de resposta responde **204**; nunca 200 com corpo vazio ambíguo.
- [ ] A-05: Toda entrada (body/query/params) passa por DTO/schema de validação na borda antes do caso de uso.
- [ ] A-06: Erro segue o formato padrão (código estável + mensagem + detalhes por campo em validação); não retorna string solta nem stack trace.
- [ ] A-07: O status de erro é o canônico da tabela (validação → 422, permissão → 403, ausência → 404, conflito → 409).
- [ ] A-08: Resposta expõe DTO, nunca a entidade de persistência crua (ver DDD `D-05`).
- [ ] A-09: Endpoint de lista responde no envelope de paginação padrão do perfil (itens + total/cursor), idêntico entre recursos.
- [ ] A-10: Toda rota vive sob o prefixo/versão definidos; mudança incompatível cria versão nova.
- [ ] A-11: Rota protegida declara auth (Bearer JWT) e a permissão RBAC (recurso+ação) de forma declarativa; rota pública é explicitamente marcada e justificada.
- [ ] A-12: `POST` sensível a duplicidade e todo webhook são idempotentes (chave de idempotência ou checagem de estado).
- [ ] A-13: Webhook valida assinatura/token do provedor antes de processar, responde rápido e processa de forma idempotente; token inválido → 401.
- [ ] A-14: Todos os endpoints estão documentados (OpenAPI/Swagger) com request, response e códigos de erro.
- [ ] A-15: Nenhum dado sensível (segredo, token, PAN, senha, PII) aparece em resposta de erro ou log; headers de auth são mascarados.

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer em vez disso |
|---|---|---|
| Verbo na URL (`/getFatura`, `/criarPedido`) | Ignora a semântica HTTP; rota imprevisível | Recurso no plural + método HTTP |
| Sempre 200, erro no corpo (`{ ok: false }`) | Cliente/monitoração não distinguem sucesso de falha | Status code canônico + corpo de erro padrão |
| Mensagem de erro como contrato | Muda o texto e quebra o cliente que parseava a string | Código de erro estável; mensagem só para humano |
| Validar dentro do service | Entrada suja alcança o domínio; erro tardio e inconsistente | Validar na borda por DTO/schema |
| Entidade do ORM na resposta | Vaza campos internos/sensíveis e acopla ao schema | Mapear para DTO |
| Lista com shape variável | Cada endpoint reinventa paginação; cliente vira exceção | Envelope de paginação único |
| Quebrar contrato no mesmo endpoint | Cliente em produção quebra sem aviso | Versão nova sob o prefixo |
| Webhook sem validação/idempotência | Spoofing e efeito duplicado (cobrança/entrega em dobro) | Validar assinatura + processar idempotente |
| Segredo/PII em log ou erro | Vazamento de dado e credencial | Mascarar; nunca serializar sensível |

## Como o perfil de stack especializa

O arquivo `standards/stacks/<perfil>.md` deve definir, espelhando as seções acima:
- **Roteamento e versionamento**: como declarar rota/prefixo/versão no framework e a estratégia de versão adotada (path, header).
- **Validação de entrada**: a lib/padrão de DTO ou schema da borda e como as mensagens de erro por campo são produzidas.
- **Formato de erro concreto**: a classe/handler global de exceção, o mapeamento erro-de-domínio → status e o JSON exato do corpo de erro.
- **Paginação**: o shape exato da resposta de lista (page/limit + total, ou cursor) e os defaults/limites.
- **Auth, RBAC e documentação**: os guards/decorators de JWT e permissão declarativa, e a ferramenta OpenAPI/Swagger que gera a doc a partir do código.
