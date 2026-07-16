# Testes — {{PROJECT_NAME}}

> Critérios obrigatórios de qualidade e como rodar os testes NESTE projeto. Lido pelo QA em toda rodada.

## Como rodar

| Ação | Comando |
|---|---|
| Suíte completa (backend) | `{{CMD_TEST_BACKEND_FULL}}` |
| Testes de uma feature | `{{CMD_TEST_BACKEND}}` |
| E2E | `{{CMD_TEST_E2E}}` |
| Build (gate de tipos) | `{{CMD_BUILD_BACKEND}}` |

## Estrutura dos arquivos de teste

- Unit: [onde vivem, convenção de nome]
- E2E: [onde vivem, helpers disponíveis]

## Regras obrigatórias

1. Todo caso B-XXX/F-XXX do CONTRACT.md vira teste (ou roteiro de verificação estruturada, no caso de F-XXX sem automação)
2. TDD: testes escritos e falhando ANTES da implementação
3. Zero regressões: a suíte completa passa antes de qualquer entrega
4. Testes de erro assertam o tipo/código do erro, não só a falha
5. Idempotência testada explicitamente em toda operação de escrita
6. Auth testada em toda rota protegida (sem credencial → 401; sem permissão → 403)

## Critérios de aprovação

### Backend
- [ ] Todos os B-XXX passando
- [ ] Suíte completa: 0 falhas
- [ ] Build sem erros

### Frontend
- [ ] Todos os F-XXX passando/verificados
- [ ] Estados de UI (loading/vazio/erro/sucesso) verificados

### Segurança
- [ ] 401/403 nas rotas protegidas
- [ ] Entrada inválida rejeitada na borda
- [ ] Dados sensíveis fora de logs

## Baseline atual

> Atualizado pelo QA a cada feature: N suítes / N testes / 0 falhas (YYYY-MM-DD)
