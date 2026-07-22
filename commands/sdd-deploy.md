# /sdd-deploy — Planejar e configurar o deploy do projeto (com o agente DevOps)

Você orquestra o **planejamento de deploy no nível do PROJETO** (não de uma feature): o agente DevOps descobre o estado atual, planeja com o usuário, gera as configurações (Docker, Nginx, Terraform, CI/CD...) e valida o que der localmente. O resultado vivo é o **`specs/DEPLOY.md`** — o perfil de deploy que passa a informar todas as rodadas `/sdd`.

**Input**: `$ARGUMENTS` = opcional (ex.: foco específico — "só docker", "migrar para terraform"). Sem argumentos = fluxo completo.

---

## FRONTEIRA DE SEGURANÇA (regra inviolável)

**Este comando PREPARA e VALIDA — nunca EXECUTA.** Proibido em qualquer fase, mesmo com autonomia de arquivos concedida: `terraform apply`/`destroy`, provisionar recursos em cloud, `docker push`, deploy real, alterar DNS, criar/rotacionar secrets em provedores. Essas execuções só acontecem se o usuário pedir explicitamente NAQUELE momento, fora do fluxo automático — e o padrão é entregá-las como "próximos passos manuais" no resumo.

## Pré-requisitos e telemetria

- Exige `specs/sdd.config.json` (senão: instrua `/sdd-init`).
- Telemetria reutiliza a infraestrutura padrão sobre a pasta **`specs/deploy/`**: abra com `sdd-log --feature specs/deploy --type run_start --feature-name deploy --gate-mode supervised`, registre `agent_start`/`agent_run` com labels (`sdd-devops-p<fase>i<iter>-<sufixo>`), rode `sdd-sync` ao fim de cada fase e feche com `run_end`. Ofereça o `sdd-live` como nas rodadas normais.
- Invoque o **devops** (`agents.devops` da config) com o padrão de invocação do `/sdd` (autonomia intra-fase, digest, economia de contexto).

## Fase 1 — Discovery do estado atual (devops)

O devops investiga e reporta (sem perguntar o que dá para descobrir):
- Conteinerização: `Dockerfile*`, `docker-compose*`, `.dockerignore`
- Proxy/web: configs nginx/caddy/traefik no repo
- IaC: `*.tf`, `terraform/`, CDK, Pulumi
- CI/CD: `.github/workflows/`, `buildspec*`, `Jenkinsfile`, `.gitlab-ci*`, `appspec*`
- Deploy atual: scripts, PM2/systemd, docs de deploy existentes; envs (`.env.example`)
- Stack e comandos do `sdd.config.json`/STACK.md

Saída: digest do estado atual (o que existe, o que falta, riscos evidentes).

## Fase 2 — Entrevista + Plano de deploy [GATE]

1. **Entrevista** (AskUserQuestion, pré-preenchida pelo discovery): alvo de execução (VPS com docker-compose · cloud gerenciada/PaaS · Kubernetes · serverless), domínios/TLS, banco (gerenciado? no compose?), ambientes (dev/staging/prod), provedor de CI/CD, onde vivem os secrets, orçamento/simplicidade vs escala.
2. O devops lê os **standards de infra relevantes ao alvo** (`${CLAUDE_PLUGIN_ROOT}/standards/infra/`: `docker.md`, `nginx.md`, `terraform.md`, `ci-cd.md` — só os aplicáveis) e produz **`specs/DEPLOY.md`** a partir de `templates/project/DEPLOY.md.tpl`: topologia (diagrama textual), ambientes, artefatos a criar/ajustar, pipeline, estratégia de secrets, plano de rollback, checklist de go-live e próximos passos manuais.
3. **[Gate]** — apresente o DIGEST do plano + path; aprovação explícita antes de tocar em qualquer arquivo de infra. Ajustes → revisar plano → novo gate.

## Fase 3 — Implementação assistida (devops, autonomia intra-fase)

Gerar/ajustar SOMENTE o que o plano aprovado lista, seguindo os checklists dos standards (DKR/NGX/TF/CI):
- `Dockerfile` (multi-stage, non-root, healthcheck) + `docker-compose.yml` + `.dockerignore`
- Configs Nginx (reverse proxy, TLS/redirect, gzip, headers de segurança, estáticos/SPA)
- Terraform (estrutura por ambiente, providers pinados, state remoto DOCUMENTADO — sem tocar em state real)
- Pipeline CI/CD (estágios, artefato único promovido, gate manual p/ prod)
- `.env.example` por ambiente (toda env documentada; NENHUM valor real de secret)
Mudanças respeitam o repo existente (adaptar > substituir); áreas proibidas do STACK.md valem aqui.

## Fase 4 — Validação local + entrega

1. Valide o que a máquina permitir (pule com aviso o que não der): `docker build`/`docker compose config`; `nginx -t` (ou parse sintático); `terraform fmt -check` + `terraform validate` (sem backend real: `-backend=false`); parse dos YAMLs de pipeline.
2. Atualize o `DEPLOY.md` com o que foi efetivamente criado e o **checklist de go-live** (itens manuais: DNS, secrets no provedor, primeira execução do pipeline, primeiro `terraform apply` — sempre pelo usuário).
3. Feche a telemetria (`run_end` + `sdd-sync`) e apresente: digest final, arquivos criados/alterados, validações (passou/pulou), próximos passos manuais numerados.

## Encerramento de fase

Como no `/sdd`: ao fechar cada fase, **encerre o agente concluído (limpar slot)** antes do gate/da próxima fase, e só então rode o `sdd-sync`. Ver knowledge `P-006`.

## Integração com o fluxo por feature

Com `specs/DEPLOY.md` existente, as rodadas `/sdd` passam a injetá-lo no contexto do devops (e do team-leader no research) — os requisitos OPS-XXX referem-se à topologia real, e features com impacto de infra atualizam o DEPLOY.md como parte do Passo 5.

## Regras

1. Fronteira de segurança acima é inviolável — prepara ≠ executa.
2. Idempotente: rodar de novo revisita o plano (diff) sem destruir configs existentes não geradas por ele.
3. Nada de secret real em NENHUM arquivo gerado — placeholders + instrução de onde configurar.
4. Você (orquestrador) não escreve configs — o devops escreve; você orquestra, registra telemetria e apresenta digests.
