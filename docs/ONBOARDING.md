# Onboarding — do zero à primeira feature

Guia para quem nunca usou o SDD Framework. Ao final você terá o plugin instalado, o projeto configurado e a primeira rodada rodando com painel ao vivo.

---

## 1. Instale o plugin (uma vez por máquina)

```bash
claude plugin marketplace add gustagpo/sdd-framework
claude plugin install sdd-framework@sdd-framework --scope project
claude plugin enable sdd-framework@sdd-framework --scope project
```

Reinicie a sessão do Claude Code. Digite `/` e confirme que `/sdd`, `/sdd-init` e `/sdd-dashboard` aparecem.

> Requisito: **Node.js** no PATH (telemetria, custos e painel ao vivo dependem dele; sem node o fluxo roda, mas sem números).

## 2. Configure o projeto — `/sdd-init`

Dentro do projeto, rode `/sdd-init`. Ele:

1. Verifica o ambiente e **mede o peso dos seus docs** (CLAUDE.md/STATE/LESSONS >40KB geram alerta — esses arquivos entram no contexto de TODO agente em TODA rodada; mantenha-os enxutos movendo detalhe enciclopédico para arquivos referenciados);
2. Detecta a stack (NestJS, Next.js, FastAPI, Spring Boot...) e os comandos de build/teste;
3. Abre o **gate de configuração**: modelos por agente, modo de aprovação default, **preset de fases default** (nem todo mundo quer as 7 fases — veja a tabela abaixo), participação de Security/DevOps, **autonomia de arquivos** (permissões para os agentes trabalharem sem prompts) e fontes de research;
4. Mostra o resumo consolidado, você aprova, e ele gera `specs/` (config, STACK.md, WORKFLOW.md e documentos vivos).

Rodar `/sdd-init` de novo a qualquer momento reabre o gate para reconfigurar.

## 2b. (Opcional, recomendado) Configure o deploy — `/sdd-deploy`

O agente DevOps faz o discovery da infra atual, planeja o deploy com você (alvo: VPS/compose, cloud, k8s...; domínios/TLS, ambientes, CI/CD, secrets) e gera as configurações — Dockerfile, docker-compose, Nginx, Terraform, pipeline — validando o que der localmente. O resultado é o `specs/DEPLOY.md`, que passa a informar todas as rodadas. **Ele prepara e valida; nunca executa deploy/apply real — isso é sempre seu.**

## 3. Entenda as 3 decisões de cada rodada (Gate Inicial)

Toda rodada `/sdd` começa com UMA parada de configuração (o que estiver fixado no config não é perguntado):

| Decisão | Opções |
|---|---|
| **Modo de aprovação** | `supervised` — você aprova spec/design/contrato etapa a etapa · `autonomous` — roda tudo; você confere UMA vez no Gate Final |
| **Fases** | `full` — 7 passos · `lite` — enxuto (testes junto da implementação, avaliação simplificada) · `spec-only` — só especifica (Research+Spec+Design+Contract) e para · `custom` |
| **Autonomia de arquivos** | concedida ⇒ agentes leem/criam/editam sem pedir confirmação DENTRO das fases |

## 4. Rode a primeira feature

```
/sdd minha-feature "Descrição rica: o que faz, para quem, restrições, o que NÃO deve fazer"
```

Recomendação de estreia: feature pequena, modo `supervised`, preset `full` — você calibra a qualidade nos gates antes de liberar autonomia.

**Painel ao vivo**: o orquestrador imprime no início o comando pronto — cole em OUTRO terminal:

```bash
node <plugin>/scripts/sdd-live.mjs --feature specs/features/minha-feature --project-dir "$(pwd)"
```

Você verá em tempo real: agentes em execução (com elapsed), tokens e custo por agente, total da spec, gates e iterações. O painel encerra sozinho quando a rodada fecha.

## 5. Depois da rodada

- `specs/features/<nome>/DASHBOARD.md` — painel completo da rodada (custo por agente, diagrama de interação, gates, artefatos)
- `/sdd-dashboard` — agregado do projeto · `--global` entre projetos · `--learning` lições acumuladas
- O Passo 7 gravou lições classificadas — as de stack/processo propagam para todos os seus projetos via o repo do framework

## Troubleshooting rápido

| Sintoma | Ação |
|---|---|
| Comandos `/sdd*` não aparecem | Plugin enabled? (`claude plugin list`) · reinicie a sessão |
| Custos com `—` | Rode `/sdd-dashboard --feature <nome>` depois da rodada (o matcher re-tenta); confira se o Node está no PATH |
| Sessão estourando contexto | Uma feature por sessão (regra do orquestrador); confira os alertas de peso de docs do `/sdd-init` |
| Agentes pedindo confirmação para editar | Conceda a autonomia de arquivos no Gate Inicial (ou rode a sessão com `claude --permission-mode acceptEdits`) |
| Qual versão está instalada aqui? | `claude plugin list` (é por projeto — cada repo tem a sua) |
| Quero saber se há versão nova | O framework avisa sozinho (1×/dia) no /sdd, /sdd-init e /sdd-dashboard; manual: `node <plugin>/scripts/sdd-version-check.mjs --force` |
| Atualizar este projeto | De dentro do repo: `claude plugin marketplace update sdd-framework && claude plugin update sdd-framework@sdd-framework --scope project` + reinicie a sessão (ver OPERATING → Atualizações) |
| Rodada interrompida | Rode `/sdd` de novo com o mesmo nome em sessão nova — documentos aprovados são reaproveitados |

Guia completo de operação: [OPERATING.md](OPERATING.md).
