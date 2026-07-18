# Docker

Padrão de containerização que o agente DevOps aplica ao gerar ou ajustar `Dockerfile` e `docker-compose.yml` reais nos projetos. O critério central: **a imagem que sobe em produção nasce do pipeline, é mínima, roda sem privilégio e não carrega segredo dentro dela.** O `specs/DEPLOY.md` do projeto fixa a imagem base concreta, a estrutura de estágios e o orquestrador de runtime.

## Princípios

1. **Multi-stage sempre.** Build (compilação, dependências de dev, ferramentas) e runtime são estágios distintos. A imagem final carrega só o artefato e as dependências de produção — compilador, SDK e cache de build ficam para trás.
2. **Base enxuta e pinada.** Escolha a menor base que serve (`slim`/`alpine`/`distroless` quando a stack permite) e trave por versão explícita, tanto no `FROM` da base quanto na tag publicada. `latest` é proibido em produção — quebra reprodutibilidade e esconde mudança de base.
3. **Privilégio mínimo.** O processo roda como usuário non-root criado no Dockerfile. Container que roda como root é escalada de privilégio esperando acontecer.
4. **Segredo nunca vira camada.** `ENV`/`ARG` declaram configuração não-sensível e pontos de injeção; segredo entra em runtime (env de deploy, secret manager, montagem), nunca gravado na imagem — camadas são recuperáveis por qualquer um com a imagem.
5. **Cache é projetado.** Copie o manifesto de dependências (lockfile) e instale antes de copiar o código. Mudança de código não deve invalidar a camada de dependências. Ordene do menos volátil para o mais volátil.
6. **Imagem observável e autossuficiente.** `HEALTHCHECK` declara vivo≠pronto; logs vão para stdout/stderr (o coletor do orquestrador recolhe), nunca para arquivo dentro do container.
7. **Build reproduzível e promovido.** A mesma imagem construída uma vez no CI é promovida entre ambientes por digest/tag imutável — não se reconstrói por ambiente (ver [`ci-cd.md`](ci-cd.md) CI-02).
8. **Compose declara tudo.** Variáveis por `env_file`/bloco declarado, volumes nomeados para dados, redes explícitas, política de restart e nenhuma porta de dado exposta ao host público.

## Regras verificáveis

- [ ] DKR-01: `Dockerfile` usa multi-stage — estágio(s) de build separado(s) do estágio de runtime; a imagem final não contém toolchain de build nem dependências de dev
- [ ] DKR-02: Imagem base pinada por versão explícita (`FROM node:22.11-slim`, não `node` nem `node:latest`); tag publicada também versionada/imutável
- [ ] DKR-03: Um usuário non-root é criado e ativado (`USER app`) antes do `CMD`/`ENTRYPOINT`; o processo não roda como root
- [ ] DKR-04: Existe `.dockerignore` cobrindo ao menos `node_modules`/artefatos locais, `.git` e `.env`/segredos
- [ ] DKR-05: Nenhum segredo em `ENV`/`ARG` ou copiado para a imagem; `ARG` de build sensível não é persistido em camada final
- [ ] DKR-06: Lockfile/manifesto copiado e dependências instaladas ANTES de copiar o código-fonte (camada de deps cacheável)
- [ ] DKR-07: Instala apenas dependências de produção no runtime (`--omit=dev`/`--production` ou equivalente da stack)
- [ ] DKR-08: `HEALTHCHECK` definido (no Dockerfile ou no compose/orquestrador) apontando para um endpoint/comando de readiness real
- [ ] DKR-09: Aplicação loga em stdout/stderr; nenhum log gravado em arquivo interno do container
- [ ] DKR-10: `docker-compose.yml` — cada serviço declara variáveis via `env_file`/bloco explícito; nada de segredo inline versionado
- [ ] DKR-11: Dados persistentes usam volumes nomeados; redes são explícitas; serviços de banco/cache NÃO publicam porta no host público (sem `ports:` externo — só rede interna)
- [ ] DKR-12: Todo serviço de longa duração define `restart: unless-stopped` (ou política equivalente do orquestrador)
- [ ] DKR-13: Imagem construída no CI e promovida por digest/tag entre ambientes — não há `build` reexecutado por ambiente em produção

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer |
|---|---|---|
| `FROM node:latest` | Base muda sem aviso; build de ontem ≠ build de hoje | Pinar versão explícita na base e na tag (DKR-02) |
| Build single-stage carregando compilador | Imagem gorda, superfície de ataque maior, deploy lento | Multi-stage: runtime só com artefato + deps de prod (DKR-01) |
| `ENV DATABASE_PASSWORD=...` no Dockerfile | Segredo vira camada recuperável por quem tiver a imagem | Injetar em runtime via secret manager/env de deploy (DKR-05) |
| Container rodando como root | Falha de app vira comprometimento do host | Criar e ativar usuário non-root (DKR-03) |
| `COPY . .` antes de instalar deps | Toda mudança de código reinstala tudo; cache inútil | Copiar lockfile e instalar antes do código (DKR-06) |
| Log em arquivo dentro do container | Some no restart; coletor não enxerga | stdout/stderr, coletor do orquestrador recolhe (DKR-09) |
| `ports: 5432:5432` do Postgres no compose | Banco exposto na internet do host | Só rede interna; sem publicar porta de dado (DKR-11) |
| `docker build` em cada ambiente | Artefatos divergentes; "funciona em staging, quebra em prod" | Construir uma vez, promover a mesma imagem (DKR-13) |

## Exemplo esquemático (multi-stage)

```dockerfile
FROM node:22.11-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
FROM deps AS build
COPY . .
RUN npm run build
FROM node:22.11-slim AS runtime
WORKDIR /app
RUN useradd -r -u 1001 app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER app
HEALTHCHECK CMD node dist/health.js || exit 1
CMD ["node", "dist/main.js"]
```

## Como o plano de deploy especializa

O `specs/DEPLOY.md` do projeto deve definir concretamente:

- A imagem base e a versão pinada por serviço, e a estrutura de estágios do multi-stage para a stack real (ex.: `deps → build → runtime` para Node, ou `build (jdk) → runtime (jre)` para JVM)
- O registro de imagens (ECR/GCR/GHCR/registry privado), a convenção de tag/digest e como a promoção entre ambientes referencia a imagem imutável
- Onde os segredos são injetados em runtime (secret manager, env de deploy, montagem de arquivo) e quais variáveis o container espera receber
- O comando/endpoint de `HEALTHCHECK` real (readiness) e a política de restart do orquestrador do projeto (Compose, ECS, Kubernetes, Nomad…)
- Se há `docker-compose.yml` para dev/staging: os serviços, volumes nomeados, redes internas e quais portas (se alguma) são publicadas
