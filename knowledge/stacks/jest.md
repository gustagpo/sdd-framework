# Lições de Stack — Jest (transversal)

> Comportamentos do **Jest** que valem em QUALQUER projeto que teste com ele, independente do framework backend (Express, NestJS…). Lições atreladas a um framework específico vivem no arquivo daquela stack (ex.: `nestjs.md`, que também tem lições `[jest]` acopladas ao NestJS/Prisma). Cada lição tem 1 linha no `INDEX.md`.

### J-001 — A fila de `mock*Once` NÃO é limpa por `jest.clearAllMocks()`

**Contexto**: specs que programam mocks com retornos únicos (`mockResolvedValueOnce`/`mockRejectedValueOnce`/`mockImplementationOnce`) e confiam em `clearAllMocks()`/`mockClear()` no `beforeEach` para isolar testes.
**Problema**: `clearAllMocks()`/`mockClear()` limpam `mock.calls`/`instances`/`results`, mas **não** a fila FIFO de implementações `*Once`. Um teste que empilha um retorno "por precaução" num caminho que nunca executa deixa o item na fila; o próximo teste que usar o mesmo mock consome o resíduo e falha — ou passa — de forma **dependente de ordem**. Em rodada real, um `mockRejectedValueOnce` consumido por resíduo do teste anterior produziu um falso vermelho inicialmente lido como bypass de segurança ("OTP inválido redefine senha"); o diagnóstico custou uma investigação com 3 evidências independentes.
**Regra**: para todo mock alimentado com `*Once` que um teste possa legitimamente não consumir, usar `mockReset()` explícito no `beforeEach` (ele SIM descarta a fila, além de `calls`). E nunca empilhar retorno em caminho que a própria asserção prova não ser chamado — `expect(fn).not.toHaveBeenCalled()` no mesmo teste que fez `fn.mockResolvedValueOnce(...)` é contradição e fonte garantida de resíduo.
**Origem**: rodada real permissao-criacao-senha-usuario (horus, 22/07/2026) — falso vermelho B-007, mesma conclusão alcançada por QA e Security independentemente.
