# DEPLOY — {{PROJECT_NAME}}

> **Perfil de deploy do projeto**, produzido/mantido pelo `/sdd-deploy` (agente DevOps) e aprovado pelo usuário. Injetado no contexto do DevOps (e do research) em toda rodada `/sdd` — os requisitos operacionais das features se referem a ESTA topologia. Atualizar quando a infra mudar. **Nenhum valor real de secret aqui.**

**Alvo**: {{DEPLOY_TARGET}} <!-- VPS+docker-compose · cloud gerenciada/PaaS · Kubernetes · serverless -->
**Última revisão**: {{DATE}}

---

## Topologia

```
[diagrama textual: cliente → DNS/TLS → proxy (nginx) → app(s) → banco/serviços]
```

| Componente | O que é | Onde roda |
|---|---|---|
| [app backend] | [imagem/serviço] | [host/serviço] |
| [frontend] | [estáticos/SSR] | [...] |
| [banco] | [gerenciado? container?] | [...] |
| [proxy/TLS] | [nginx/caddy/LB] | [...] |

## Ambientes

| Ambiente | URL | Infra | Deploy disparado por |
|---|---|---|---|
| dev | [local] | docker-compose | manual |
| staging | [...] | [...] | [branch/tag] |
| prod | [...] | [...] | [gate manual do pipeline] |

## Artefatos de infra (o que existe e onde)

- [ ] `Dockerfile` / `docker-compose.yml` / `.dockerignore` — [paths]
- [ ] Nginx — [paths das configs]
- [ ] Terraform — [dir, backend de state, como rodar plan]
- [ ] Pipeline CI/CD — [arquivo, estágios]
- [ ] `.env.example` por ambiente — [paths]

## Pipeline (fluxo)

```
push → lint → test → build (artefato/imagem ÚNICO, tag imutável) → deploy staging → smoke → [GATE MANUAL] → promover a prod
```

## Secrets e configuração

| Item | Onde vive | Quem configura |
|---|---|---|
| [DATABASE_URL etc.] | [cofre do CI / secret manager / env do host] | [pessoa/papel] |

## Rollback

- **Aplicação**: [como voltar — redeploy da tag anterior / compose pull tag anterior]
- **Migrations**: [estratégia — expand/contract; reversão]
- **Infra (Terraform)**: [plan da revisão anterior; NUNCA apply automático]

## Observabilidade

- Logs: [onde ver] · Healthchecks: [endpoints] · Alertas: [o que existe]

## Checklist de go-live / próximos passos manuais

- [ ] [DNS apontado]
- [ ] [Secrets configurados no provedor]
- [ ] [Primeira execução do pipeline validada em staging]
- [ ] [Primeiro `terraform apply` executado PELO USUÁRIO após revisar o plan]

## Decisões e histórico

| Data | Decisão | Motivo |
|---|---|---|
| {{DATE}} | [alvo escolhido etc.] | [...] |
