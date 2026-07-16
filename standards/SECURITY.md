# Segurança

Núcleo genérico de segurança de aplicação que o agente Security aplica no threat model (Passo 3) e na revisão (Passo 6), e que todo implementador deve conhecer. Vale para qualquer stack; o `standards/stacks/<perfil>.md` e o `STACK.md` do projeto dizem os mecanismos concretos (guards, libs de validação, vault de segredos). Complementa [`API.md`](API.md) (A-04/A-05 auth, A-03 validação) — aqui o recorte é adversarial: o que um atacante tentaria.

## Princípios

1. **Nunca confie na borda.** Toda entrada externa (usuário, integração, webhook, upload, query param) é hostil até validada. Validação acontece **no servidor**, na borda — validação só no cliente é UX, não segurança.
2. **Authz em toda rota, sempre pelo recurso.** Autenticação diz *quem é*; autorização diz *o que pode* — e é verificada por recurso/ação em cada rota. O id vindo do cliente nunca é prova de posse: consultas filtram pelo dono/tenant da sessão (anti-IDOR).
3. **Segredos não vivem no código.** Credenciais, tokens e chaves vêm de ambiente/vault; nunca em código, repositório, log, mensagem de erro ou resposta de API. Um segredo commitado é considerado vazado — rotacionar, não apenas remover.
4. **Menor privilégio.** Cada credencial, permissão e integração tem o escopo mínimo necessário. Rota nova nasce fechada e é aberta explicitamente — nunca o contrário.
5. **O que vem de fora se prova.** Webhook valida assinatura/token ANTES de processar; callback externo é idempotente (replay não duplica efeito); redirect/URL vinda de fora é validada contra allowlist.
6. **Dados sensíveis têm ciclo de vida.** PII, credenciais e dados financeiros: coletar só o necessário, mascarar em logs, não devolver além do que a tela precisa, saber onde ficam armazenados.
7. **Criptografia é commodity, não artesanato.** Hash de senha com algoritmo de custo adaptativo padrão; TLS para trânsito; primitivas de biblioteca — nunca cripto caseira, nunca hash rápido para senha.
8. **Falha segura e silenciosa para o atacante.** Erro não vaza stack trace, SQL, paths ou versões; mensagens de auth não distinguem "usuário não existe" de "senha errada" (anti-enumeration); rate limit nas rotas de credencial.
9. **Dependência é superfície.** Cada pacote novo é código de terceiros rodando com seus privilégios — auditar vulnerabilidades conhecidas ao adicionar e manter o lockfile íntegro.

## Regras verificáveis

- [ ] SEC-01: Toda entrada externa é validada no servidor, na borda (DTO/schema), com tipo, formato e limites — inclusive query params e path params
- [ ] SEC-02: Toda rota nova declara autenticação E autorização explícitas (recurso/ação); rota pública é exceção justificada no contrato
- [ ] SEC-03: Consultas a recursos de usuário/tenant filtram pela identidade da sessão — nunca só pelo id vindo do cliente (anti-IDOR)
- [ ] SEC-04: Nenhum segredo em código, repositório ou histórico; configuração sensível vem de ambiente/vault
- [ ] SEC-05: Nenhum dado sensível (senha, token, documento, cartão, PII) em logs, mensagens de erro ou respostas além do necessário; headers de auth mascarados em logs de request
- [ ] SEC-06: Acesso a dados usa mecanismo parametrizado do ORM/driver — string de query nunca é concatenada com entrada externa (SQL/NoSQL/command injection)
- [ ] SEC-07: Webhook/callback valida assinatura ou token ANTES de qualquer processamento; retorno inválido = rejeição logada, não exceção vazada
- [ ] SEC-08: Processamento de webhook/evento externo é idempotente — replay do mesmo evento não duplica efeito
- [ ] SEC-09: Senhas com hash adaptativo padrão (bcrypt/argon2/scrypt); tokens comparados em tempo constante; nada de cripto caseira
- [ ] SEC-10: Respostas de erro não vazam stack trace, SQL, paths internos ou versões; auth não permite enumeration de usuários
- [ ] SEC-11: Dependência nova é auditada (vulnerabilidades conhecidas) antes de entrar; lockfile commitado e íntegro
- [ ] SEC-12: Upload/arquivo externo: tipo e tamanho validados, nome sanitizado (anti path traversal), nunca executado/servido do local de upload
- [ ] SEC-13: Saída renderizada em HTML escapa conteúdo de origem externa (anti-XSS); URLs de redirect validadas contra allowlist

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer em vez disso |
|---|---|---|
| Validar só no frontend | Atacante chama a API direto; a borda real é o servidor | Validação servidor na borda (SEC-01); front valida por UX |
| Rota "esqueceu" o guard de permissão | Endpoint exposto a qualquer autenticado (ou a todos) | Authz declarativa em TODA rota (SEC-02); revisar o diff por rotas sem guard |
| `WHERE id = :idDoCliente` sem filtro de dono | IDOR — usuário lê/edita recurso alheio trocando o id | Filtrar pela identidade da sessão (SEC-03) |
| Segredo em código "só para testar" | Vai para o histórico do git; considerado vazado | Ambiente/vault (SEC-04) + rotacionar o que vazou |
| `log(request.headers)` / logar payload inteiro | Tokens e PII acabam em log retido e pesquisável | Mascarar sensíveis antes de logar (SEC-05) |
| Concatenar entrada em query/comando | Injeção — o clássico que ainda funciona | Parametrização do ORM/driver (SEC-06) |
| Processar webhook e validar token depois | Efeito colateral já aconteceu quando a validação falha | Validar assinatura primeiro (SEC-07) |
| Tratar replay de webhook como caso raro | Provedores REENVIAM; efeito duplicado (cobrança 2x) | Idempotência por id do evento (SEC-08) |
| MD5/SHA1 para senha, "cripto própria" | Quebrável por hardware comum; erros sutis fatais | Primitivas padrão (SEC-09) |
| Erro 500 com stack trace na resposta | Mapa do sistema de graça para o atacante | Erro padronizado sem interno (SEC-10, A-06) |

## Como o perfil de stack especializa

O `standards/stacks/<perfil>.md` (e o `STACK.md` do projeto) devem definir:

- O mecanismo concreto de authn/authz (guards, middleware, decorators) e como declarar permissão por rota
- A lib de validação de borda e o padrão de DTO/schema
- Onde vivem os segredos (env, vault, secret manager) e o template de documentação (`.env.example`)
- O padrão de logger e o mecanismo de mascaramento de campos sensíveis
- O comando de auditoria de dependências da stack (npm audit, pip-audit, owasp dependency-check...)
- Como validar assinatura de webhook nos provedores usados pelo projeto
