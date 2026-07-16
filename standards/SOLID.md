# SOLID e Função Limpa

Núcleo genérico de SOLID e higiene de função/classe que todo agente implementador (Dev Backend, Dev Frontend, QA) lê antes de escrever ou revisar código de feature. Vale para qualquer stack; o arquivo `standards/stacks/<perfil>.md` traduz cada regra para as construções concretas da linguagem/framework. Objetivo: código que estende por composição, depende de abstração e concentra cálculo em funções puras testáveis.

## Princípios

1. **SRP — um motivo para mudar.** Cada função/classe tem uma responsabilidade. Serviço fino orquestra; a decisão de negócio vira helper puro isolado. Se descrever a função exige "e", ela faz duas coisas.
2. **OCP — aberto a extensão, fechado a modificação.** Comportamento novo entra por composição/estratégia/registry, não engordando `if/else`/`switch` a cada caso. O ponto de extensão é uma interface; casos novos são novas implementações registradas, sem tocar as existentes.
3. **LSP — a implementação honra o contrato.** Toda implementação de uma interface respeita a semântica prometida: mesmo tipo de retorno, mesmos erros/exceções esperados, mesmas pré/pós-condições. Nada de lançar `NotImplemented`, retornar `null` onde o contrato promete valor, ou apertar as pré-condições.
4. **ISP — portas pequenas por capacidade.** Interfaces são segmentadas por capacidade (capability port), não god-interfaces. Um cliente que só lê não depende de método de escrita; quem oferece só uma capacidade implementa só a porta dela — sem método-stub vazio para "cumprir" a interface.
5. **DIP — depender de abstração.** Módulo de alto nível e de baixo nível dependem de abstração; a implementação concreta é **injetada pela interface**, nunca instanciada dentro do serviço (`new Concreto()` acopla e mata o teste). Ver DDD `D-02`.
6. **Função pura para cálculo.** Toda lógica de decisão/cálculo (regra de preço, elegibilidade, pró-rata, mapeamento) é função pura: entrada → saída, sem I/O, sem estado global, sem relógio/aleatório escondido. Assim é testável sem mock.
7. **Efeito colateral explícito e nas bordas.** I/O, escrita, chamada externa e leitura de tempo/ambiente ficam nas bordas do caso de uso e são visíveis na assinatura — nunca enterrados dentro de um "helper" de aparência pura.
8. **Assinatura honesta.** Parâmetros explícitos até um limite; acima disso, um objeto de opções nomeado. Nada de flag booleana que dobra o comportamento da função (`fazer(x, true)` é dois métodos disfarçados).

### OCP por registry (conceitual)

Em vez de `switch` que cresce a cada provedor/variante, registre estratégias por chave e resolva por capacidade:

```
# ANTIPADRÃO (fere OCP): todo caso novo edita este switch
function cobrar(tipo, dados) {
  switch (tipo) { case "PIX": ...; case "CARTAO": ...; }   // e o próximo?
}

# OK: interface pequena por capacidade (ISP) + registry
interface PagamentoPix { gerarCobranca(dados): Cobranca }

registry = Map()                         # chave -> implementação
registry.set("PIX:PROVEDOR_A", provedorA)
registry.set("PIX:PROVEDOR_B", provedorB)

function cobrar(tipo, provedor, dados) {
  const estrategia = registry.resolve(`${tipo}:${provedor}`)   # sem if/else
  return estrategia.gerarCobranca(dados)                        # honra o contrato (LSP)
}
# provedor novo = 1 classe + 1 registro; nenhuma linha existente muda
```

## Regras verificáveis

- [ ] S-01: Nenhuma função/classe acumula responsabilidades díspares (o nome descreve uma única coisa, sem "e"); a decisão de negócio está extraída em helper testável.
- [ ] S-02: Adicionar um novo "tipo/variante" não exige editar um `if/else`/`switch` existente — há ponto de extensão (estratégia/registry) por interface.
- [ ] S-03: Toda implementação de uma interface devolve o tipo prometido e sinaliza erro pela mesma via/semântica do contrato (sem `null` surpresa, sem `throw NotImplemented`).
- [ ] S-04: Interfaces são segmentadas por capacidade; não há método-stub vazio só para satisfazer uma god-interface.
- [ ] S-05: Serviços recebem colaboradores pela **interface** via injeção; não há `new ConcretoDeInfra()` dentro de service/domínio (verificável por grep).
- [ ] S-06: A lógica de cálculo/decisão está em função pura (sem I/O, sem estado global, sem `Date.now`/random interno) e coberta por teste unitário sem mock.
- [ ] S-07: Efeitos colaterais (I/O, escrita, chamada externa, leitura de tempo/env) são visíveis na assinatura/borda, não escondidos em helper de aparência pura.
- [ ] S-08: Funções não recebem flag booleana que troca o comportamento; casos distintos são funções/estratégias distintas.
- [ ] S-09: Funções usam early return para pré-condições em vez de aninhar; sem pirâmide de `if` profunda.
- [ ] S-10: Tamanho de função/classe dentro do limite do perfil de stack; acima disso, extrair.
- [ ] S-11: Acima do limite de parâmetros do perfil, a função recebe um objeto de opções nomeado em vez de lista posicional longa.
- [ ] S-12: Não há dependência de detalhe concreto onde uma abstração serviria (imports apontam para a interface, não para a classe de infra).

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer em vez disso |
|---|---|---|
| God-service que faz tudo | Um motivo qualquer de mudança quebra o resto; intestável | Fatiar por responsabilidade; extrair helpers puros |
| `switch`/`if` que cresce a cada caso | Toda variante nova edita e arrisca o código existente (fere OCP) | Registry/estratégia por interface; caso novo = nova implementação |
| Implementação que quebra o contrato (`null`/`NotImplemented`) | Chamador confia na interface e recebe surpresa em runtime (fere LSP) | Honrar retorno e erros do contrato; se não oferece, não implementa a porta |
| God-interface com métodos vazios | Força stub sem sentido; acopla quem só usa metade | Portas pequenas por capacidade (ISP) |
| `new Concreto()` dentro do service | Acopla a infra, impede substituir/mockar | Injetar pela interface (DIP) |
| Cálculo misturado com I/O | Só testável com mock pesado; regra fica invisível | Função pura para o cálculo; I/O na borda |
| Flag booleana de comportamento | `f(x, true)` esconde dois métodos; ilegível na chamada | Duas funções nomeadas ou estratégia |
| Aninhamento profundo de `if` | Difícil de ler e de cobrir todos os ramos | Early return nas pré-condições; achatar |

## Como o perfil de stack especializa

O arquivo `standards/stacks/<perfil>.md` deve definir, espelhando as seções acima:
- **Construções de extensão da linguagem**: como implementar estratégia/registry no stack (interface + registro), e onde o registry é montado.
- **Mecanismo de injeção**: o container/DI do framework, como injetar pela interface e o token/símbolo que amarra interface→implementação.
- **Limites objetivos**: tamanho máximo de função/classe e número máximo de parâmetros antes de exigir objeto de opções (valores concretos que o QA confere).
- **Onde ficam as funções puras**: convenção de arquivo/pasta para helpers de cálculo (`*.util`, `pure/`, etc.) e a ferramenta/limiar de cobertura desses testes.
- **Ferramentas de verificação**: linter/regras estáticas que já cobrem parte destas regras (complexidade, imports proibidos, no-`new` de infra) no stack.
