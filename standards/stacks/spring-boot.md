# Perfil de Stack: Java / Spring Boot 3

> Especializa os standards genéricos [`standards/DDD.md`](../DDD.md), [`standards/SOLID.md`](../SOLID.md) e [`standards/API.md`](../API.md) para Java 21 com Spring Boot 3. As seções DDD/SOLID/API abaixo espelham a checklist "Como o perfil de stack especializa" de cada standard e citam as regras por ID (`D-xx`/`S-xx`/`A-xx`). Leia antes de escrever qualquer código nesta stack.

| Camada | Tecnologia |
|---|---|
| Linguagem | Java 21 (records, sealed, pattern matching) |
| Framework | Spring Boot 3.x (Spring Framework 6, Jakarta EE) |
| ORM / dados | Spring Data JPA (Hibernate) |
| Validação | Bean Validation — `jakarta.validation` (`@Valid`, `@NotNull`, ...) |
| Auth | Spring Security 6 + method security (`@PreAuthorize`) |
| Testes | JUnit 5 + Mockito + MockMvc + Testcontainers |
| Docs de API | springdoc-openapi (`/swagger-ui`, `/v3/api-docs`) |
| Migrations | Flyway |

**Princípio central desta stack:** ports-and-adapters. Interfaces (ports) vivem no `domain`; adapters (`@Repository`, clients HTTP) vivem em `infra`. O controller é casca fina; a entidade JPA **nunca** cruza a fronteira do controller.

---

## Estrutura de pastas canônica

```
com.empresa.<contexto>/            ← um pacote raiz por bounded context
├── domain/                        ← núcleo puro (sem Spring/JPA)
│   ├── model/                     ← entidades e value objects de domínio (invariantes)
│   ├── repository/                ← INTERFACES (ports) de repositório
│   └── service/                   ← serviços de domínio (regra que cruza entidades)
├── application/                   ← casos de uso (orquestram domínio + ports)
│   └── usecase/
├── infra/                         ← adapters concretos
│   ├── persistence/
│   │   ├── entity/                ← @Entity JPA (tabelas) — NÃO são o modelo de domínio
│   │   ├── jpa/                   ← interfaces JpaRepository (Spring Data)
│   │   └── adapter/               ← implementa os ports do domain com JPA
│   └── client/                    ← clients de integração externa
└── api/                           ← PRESENTATION
    ├── controller/                ← @RestController
    ├── dto/                       ← records de request/response
    └── error/                     ← @RestControllerAdvice → ProblemDetail
```

Regra de dependência: `api` → `application` → `domain`; `infra` implementa `domain`. O `domain` não importa `org.springframework.*` nem `jakarta.persistence.*`.

---

## DDD nesta stack

> Especializa `D-01..D-12`. Camadas → pacotes acima. `D-02`: port = `interface` no `domain/repository`, adapter `@Repository` no `infra`. `D-05`/`D-12`: modelo de domínio ≠ `@Entity` JPA ≠ DTO `record` (mapper explícito). `D-06`: transação por caso de uso com `@Transactional` (atenção à self-invocation — ver Armadilhas). `D-07` (efeito pós-commit): `@TransactionalEventListener(phase = AFTER_COMMIT)`.

- **Ports de repositório** são `interface` Java em `domain/repository/`, tipados com o modelo de domínio (não com `@Entity`).
- **Adapters** em `infra/persistence/adapter/` implementam o port, delegam a um `JpaRepository` e mapeiam `@Entity` ↔ modelo de domínio.
- **Modelo de domínio** em `domain/model/` protege invariantes; **separado** da `@Entity` JPA (que é detalhe de persistência).
- **DTOs** são `record` em `api/dto/`, com anotações Bean Validation.
- **Casos de uso** em `application/usecase/` recebem o port por construtor.

```java
// domain/repository/SubscriberRepository.java
public interface SubscriberRepository {
    Optional<Subscriber> findById(String id);
    void save(Subscriber subscriber);
}

// application/usecase/ActivateSubscriber.java
@Service
public class ActivateSubscriber {
    private final SubscriberRepository repo;
    public ActivateSubscriber(SubscriberRepository repo) { this.repo = repo; } // constructor injection

    @Transactional
    public Subscriber execute(String id) {
        Subscriber sub = repo.findById(id)
            .orElseThrow(() -> new NotFoundException("subscriber", id));
        sub.activate();                      // invariante no modelo de domínio
        repo.save(sub);
        return sub;
    }
}
```

---

## SOLID nesta stack

> Especializa `S-01..S-12`. **Limites deste perfil (QA confere):** método ≤ 40 linhas, classe ≤ 250 linhas (`S-10`); > 4 parâmetros → `record` de comando/opções (`S-11`). Cálculo puro (`S-06`) em serviço de domínio / `*Calculator`, sem I/O. DI = `S-05` (constructor injection). Registry/estratégia = `S-02`/`S-04` (`List<Strategy>`/`Map<String, Strategy>`). Lint que cobre parte: Checkstyle/PMD (tamanho, complexidade) + ArchUnit (barrar import de infra no domínio).

Injeção idiomática = **constructor injection** (o Spring resolve pelos parâmetros do construtor; sem `@Autowired` em campo). O container liga a `interface` (port) ao `@Component`/`@Repository` que a implementa.

```java
// infra/persistence/adapter/JpaSubscriberRepository.java
@Repository
public class JpaSubscriberRepository implements SubscriberRepository {
    private final SubscriberJpaRepository jpa;   // Spring Data
    private final SubscriberMapper mapper;
    public JpaSubscriberRepository(SubscriberJpaRepository jpa, SubscriberMapper mapper) {
        this.jpa = jpa; this.mapper = mapper;
    }
    @Override public Optional<Subscriber> findById(String id) {
        return jpa.findById(id).map(mapper::toDomain);
    }
    @Override public void save(Subscriber s) { jpa.save(mapper.toEntity(s)); }
}
```

- **DIP:** o caso de uso depende de `SubscriberRepository` (port); o Spring injeta o adapter JPA. Em teste, passe um Mockito mock ou fake pelo construtor — sem contexto Spring.
- **OCP / Strategy:** para múltiplos providers, defina uma `interface` de estratégia e injete `List<Strategy>` ou `Map<String, Strategy>` (o Spring popula pelo nome do bean); adicionar um = um `@Component` novo, sem tocar nos existentes.
- **SRP:** um caso de uso por operação; controllers e adapters sem regra de negócio.

---

## API nesta stack

> Especializa `A-01..A-15`. Rota/versão (`A-10`): `@RequestMapping("/api/v1/...")`. Validação na borda (`A-05`): `@Valid` no `@RequestBody` → 400/422 no advice. Erro (`A-06`/`A-07`): `@RestControllerAdvice` + `ProblemDetail`. RBAC (`A-11`): `@PreAuthorize` (exige `@EnableMethodSecurity` — ver Armadilhas). Doc (`A-14`): springdoc-openapi. **Envelope de paginação (`A-09`):** `Page<T>` (Spring Data) → `{ content, number, size, totalElements, totalPages }`, idêntico em toda lista.

- **Controllers** com `@RestController` + `@RequestMapping`; recebem/retornam **DTOs** (records), nunca `@Entity`.
- **Validação na borda:** `@Valid` no `@RequestBody`; violação → `MethodArgumentNotValidException`, tratada no advice.
- **Erros** via `@RestControllerAdvice` + `ProblemDetail` (Spring 6, RFC 7807) — um `@ExceptionHandler` por tipo de exceção de domínio.
- **Auth/RBAC:** Spring Security 6 + `@EnableMethodSecurity` habilita `@PreAuthorize("hasAuthority('SUBSCRIBER_WRITE')")` no controller/caso de uso.
- **OpenAPI:** springdoc gera de `@RestController` + DTOs; anote com `@Operation`/`@Schema` quando útil.

```java
// api/controller/SubscriberController.java
@RestController
@RequestMapping("/subscribers")
public class SubscriberController {
    private final ActivateSubscriber activate;
    public SubscriberController(ActivateSubscriber activate) { this.activate = activate; }

    @PostMapping
    @PreAuthorize("hasAuthority('SUBSCRIBER_WRITE')")            // 403 se sem permissão
    public ResponseEntity<SubscriberResponse> activate(@Valid @RequestBody ActivateRequest req) {
        Subscriber sub = activate.execute(req.id());            // NotFoundException → advice → 404
        return ResponseEntity.ok(new SubscriberResponse(sub.getId(), sub.getStatus().name()));
    }
}

// api/dto/ActivateRequest.java
public record ActivateRequest(@NotBlank String id) {}           // Bean Validation → 400/422 via advice

// api/error/GlobalExceptionHandler.java
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    ProblemDetail onNotFound(NotFoundException e) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        pd.setTitle("Recurso não encontrado");
        return pd;
    }
}
```

---

## Testes nesta stack

- **Unit** (JUnit 5 + Mockito): caso de uso com o port mockado (`@Mock SubscriberRepository`); sem subir o Spring.
- **Web slice** (`@WebMvcTest` + MockMvc): controller isolado, com o caso de uso mockado (`@MockBean`).
- **Integração** (Testcontainers): `@SpringBootTest` com Postgres real em container — valida mapeamento JPA e migrations Flyway.
- **Mock do repositório:** mocke o **port** do domínio (`SubscriberRepository`), não o `JpaRepository` nem o `EntityManager`.

```java
// application/usecase/ActivateSubscriberTest.java
@ExtendWith(MockitoExtension.class)
class ActivateSubscriberTest {
    @Mock SubscriberRepository repo;
    @InjectMocks ActivateSubscriber useCase;

    @Test
    void ativaAssinanteExistente() {
        when(repo.findById("sub-1")).thenReturn(Optional.of(subscriber("PENDING")));
        var out = useCase.execute("sub-1");
        assertThat(out.getStatus()).isEqualTo(Status.ACTIVE);
        verify(repo).save(any());
    }
}
```

Comandos: `./mvnw test` (unit + slices), `./mvnw verify` (inclui integração/Testcontainers), `./mvnw -Dtest=ActivateSubscriberTest test` (filtro). Gradle: `./gradlew test`.

---

## Armadilhas conhecidas

- **`javax.*` em vez de `jakarta.*`** → Spring Boot 3 migrou para Jakarta EE. Use `jakarta.validation.*`, `jakarta.persistence.*`. Import `javax.*` é o erro nº 1 de compilação ao portar/gerar código para Boot 3.
- **`@Entity` JPA exposta no controller** → serializa lazy proxies (LazyInitializationException fora da transação), vaza o schema do banco no contrato da API e acopla persistência a apresentação. Sempre mapeie para um `record` DTO na borda.
- **`@Transactional` em método privado / self-invocation** → o proxy do Spring só intercepta chamadas **externas** a métodos `public`. `@Transactional` em método `private`, ou chamado por `this.outroMetodo()` dentro da mesma classe, **não abre transação**. Extraia para outro bean ou torne o ponto de entrada público.
- **N+1 em lazy loading** → iterar uma coleção `@OneToMany` LAZY dispara uma query por item. Use `JOIN FETCH` na `@Query`, `@EntityGraph` ou projeção DTO; ative `spring.jpa.properties.hibernate.generate_statistics` em dev para detectar.
- **Field injection (`@Autowired` em campo)** → esconde dependências, impede `final`, dificulta teste sem contexto Spring e permite objetos meio-construídos. Use **constructor injection** (ou `@RequiredArgsConstructor` do Lombok em campos `final`).
- **Lógica de negócio no controller** → o controller só valida, autoriza e delega ao caso de uso. Regra de negócio no controller não é testável por unit nem reutilizável.
- **`@PreAuthorize` sem `@EnableMethodSecurity`** → em Spring Security 6, sem `@EnableMethodSecurity` (na classe de config) as anotações são **silenciosamente ignoradas** e o endpoint fica aberto. `@EnableGlobalMethodSecurity` está **depreciado** — não use.
- **Flyway e `ddl-auto=update` juntos** → deixe o Flyway dono do schema; use `spring.jpa.hibernate.ddl-auto=validate` (nunca `update`/`create` fora de teste) para o Hibernate só conferir, não alterar tabelas por baixo das migrations.
