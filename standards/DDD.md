# Domain-Driven Design

Núcleo genérico de DDD pragmático que todo agente implementador (Dev Backend, Dev Frontend, QA) lê antes de escrever ou revisar código de feature. Vale para qualquer stack; o arquivo `standards/stacks/<perfil>.md` traduz cada regra para os caminhos, libs e ferramentas concretas do projeto. Objetivo: manter regras de negócio isoladas de framework/persistência, com fronteiras de módulo e transação explícitas.

## Princípios

1. **Bounded context primeiro.** Cada contexto de negócio é uma fronteira com linguagem própria (ubiquitous language). Um termo (ex.: "assinante", "cobrança") só tem um significado dentro do seu contexto; não empurre um modelo para servir dois contextos.
2. **Módulo autocontido por entidade/contexto.** Um módulo agrupa domínio + aplicação + infra + apresentação da sua entidade e declara explicitamente o que expõe e o que consome. Nada de utilitário-esponja que todo mundo importa.
3. **Quatro camadas com dependência unidirecional.** `domínio → aplicação → infra/apresentação`. As setas de dependência apontam **para dentro**: infra e apresentação conhecem o domínio; o domínio não conhece nenhuma das duas.
   - **Domínio**: regras de negócio puras — entidades, value objects, serviços de domínio e **interfaces** de repositório/porta. Sem ORM, sem HTTP, sem SDK.
   - **Aplicação (services / casos de uso)**: orquestra o caso de uso — chama repositórios (pela interface), coordena a transação, dispara efeitos. Fina; a regra mora no domínio.
   - **Infra**: implementações concretas de persistência e integrações (ORM, clientes HTTP, filas, provedores).
   - **Apresentação (http/controllers)**: adapta entrada/saída (rota, DTO, status) e delega ao caso de uso. **Sem lógica de negócio.**
4. **Inversão de dependência na fronteira de persistência.** O repositório é uma **interface no domínio**; a implementação vive na infra e é injetada pela interface (ver SOLID `S-05`). O domínio nunca fala com o ORM.
5. **Entidades vs. value objects.** Entidade tem identidade e ciclo de vida; value object é imutável e comparado por valor (ex.: dinheiro, documento, período). Prefira value objects para encapsular invariantes de dados.
6. **Agregado = fronteira de consistência e de transação.** O agregado tem uma raiz que é o único ponto de entrada; invariantes internos são garantidos dentro dele. Uma transação altera **um** agregado; consistência entre agregados é eventual, via evento/efeito pós-commit.
7. **DTOs nas bordas.** A API e as integrações trocam DTOs, nunca a entidade de persistência crua (ver API `A-08`). O mapeamento entidade↔DTO é explícito, não vazamento do shape do ORM.
8. **Efeitos colaterais depois do commit.** Notificações, filas, webhooks, e-mails e chamadas a terceiros rodam **fora** da transação que persistiu o estado — best-effort, com falha logada, sem reverter o commit já feito.
9. **Idempotência nos re-processos.** Todo consumidor de evento/webhook e todo caso de uso reexecutável verifica se o trabalho já foi feito antes de refazê-lo (ver API `A-11`).

### Direção de dependência e repositório (conceitual)

```
apresentação ─▶ aplicação ─▶ domínio ◀─ infra
  (http)         (caso de uso)   (regras +     (impl. concreta:
                                  interfaces)    ORM, HTTP, fila)

# domínio: só o contrato
interface PedidoRepository {
  buscarPorId(id): Pedido | null
  salvar(pedido: Pedido): void
}

# infra: a implementação (conhece o ORM), registrada contra a interface
class PedidoRepositoryOrm implements PedidoRepository { ... }
bind(PedidoRepository -> PedidoRepositoryOrm)

# aplicação: recebe a interface, nunca a classe concreta
class CriarPedido {
  constructor(private repo: PedidoRepository) {}   // injetado (ver SOLID S-05)
  executar(dto) {
    const pedido = Pedido.criar(dto)               // invariantes na entidade (D-10)
    tx(() => this.repo.salvar(pedido))             // 1 agregado = 1 transação (D-06)
    apos_commit(() => publicar(PedidoCriado))      // efeito fora da tx (D-07)
    return toDTO(pedido)                            // DTO na borda (D-05)
  }
}
```

## Regras verificáveis

- [ ] D-01: Nenhum arquivo da camada de domínio importa infra, ORM, cliente HTTP, SDK de terceiro ou framework web (verificável por grep dos imports).
- [ ] D-02: Todo repositório é declarado como **interface** na camada de domínio; a implementação concreta vive na infra e é registrada por injeção pela interface.
- [ ] D-03: Serviço de domínio/aplicação não acessa o ORM diretamente — toda persistência passa por repositório.
- [ ] D-04: Controller/rota não contém regra de negócio: só valida entrada, chama o caso de uso e mapeia a resposta.
- [ ] D-05: A borda da API expõe DTO, nunca a entidade de persistência crua; existe mapeamento explícito nos dois sentidos.
- [ ] D-06: Cada caso de uso que escreve estado delimita a transação em torno de **um** agregado; alterações a outros agregados ocorrem pós-commit.
- [ ] D-07: Efeitos colaterais externos (fila, e-mail, webhook, terceiro) são disparados fora da transação e sua falha não reverte o commit.
- [ ] D-08: Casos de uso reexecutáveis e consumidores de evento são idempotentes (checam estado antes de reprocessar).
- [ ] D-09: Cada módulo é autocontido e declara suas dependências explicitamente; não há import de detalhe interno de outro módulo (só da interface pública).
- [ ] D-10: Invariantes de uma entidade/value object são garantidos na própria classe (construtor/factory), não espalhados pelos serviços que a usam.
- [ ] D-11: Nomenclatura de módulo, arquivo e pasta segue a convenção do perfil de stack e reflete a entidade/contexto (não o padrão técnico genérico).
- [ ] D-12: O domínio não depende de tipos gerados por ferramenta de persistência (ex.: tipos do ORM) — usa tipos próprios do domínio.

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer em vez disso |
|---|---|---|
| Lógica de negócio no controller | Acopla regra ao transporte HTTP; impossível testar sem subir a rota | Mover a regra para serviço de domínio/aplicação; controller só adapta |
| Serviço chamando o ORM direto | Fura a inversão de dependência; troca de persistência vira reescrita | Injetar o repositório pela interface e chamar por ele |
| Entidade de persistência devolvida na API | Vaza o shape do banco, campos sensíveis e acopla cliente ao schema | Mapear para DTO na borda |
| Modelo anêmico + serviço gigante | Regras espalhadas; invariantes quebram em silêncio | Empurrar invariantes para a entidade/value object; manter o serviço fino |
| Transação abraçando chamada a terceiro | Lock longo, rollback por falha externa, estado inconsistente | Commitar o estado local e disparar o efeito externo pós-commit |
| "Shared" que tudo importa | Vira acoplamento oculto entre contextos; muda um, quebra dez | Módulos autocontidos; compartilhar só contratos/interfaces estáveis |
| Um agregado editado por transação que toca vários | Contenção e inconsistência parcial | Uma transação por agregado; consistência eventual entre eles |
| Reprocesso de webhook duplicando efeito | Cobrança/entrega em dobro | Guardar idempotência (checar estado antes de aplicar) |

## Como o perfil de stack especializa

O arquivo `standards/stacks/<perfil>.md` deve definir, espelhando as seções acima:
- **Onde cada camada vive**: caminhos concretos de pastas para domínio, aplicação, infra e apresentação, e a convenção de nomes de módulo/arquivo do framework (ex.: sufixos, estrutura de pastas por entidade).
- **Como a injeção de dependência é feita**: mecanismo de DI do framework, como registrar a implementação do repositório contra a interface e o token/símbolo usado.
- **Como a transação é delimitada**: API transacional do ORM/driver e como escopar `um agregado = uma transação` (ex.: unit of work, transação por caso de uso).
- **Como DTOs e mapeamento são feitos**: lib/padrão de DTO, validação de entrada na borda e ferramenta de mapeamento entidade↔DTO.
- **Como efeitos pós-commit são disparados**: mecanismo de fila/evento/hook pós-transação disponível no stack e o padrão de idempotência recomendado.
