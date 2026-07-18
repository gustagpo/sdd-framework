# CI/CD

Padrão de pipeline que o agente DevOps aplica ao gerar ou ajustar workflows de integração e entrega reais (GitHub Actions, GitLab CI, CodeBuild/CodeDeploy, Jenkins…). O critério central: **o artefato é construído uma vez, promovido entre ambientes, sobe por estágios com gate manual para produção e sabe voltar.** O `specs/DEPLOY.md` do projeto fixa a ferramenta de CI, a estratégia de deploy e o mecanismo de rollback.

## Princípios

1. **Estágios em ordem, falha barra cedo.** `lint → test → build → deploy`. O que é barato e pega mais erro roda primeiro; um estágio vermelho impede os seguintes. Deploy nunca parte de um build que não passou pelos testes.
2. **Construir uma vez, promover.** O mesmo artefato/imagem que passou no CI é o que vai para staging e para produção — identificado por digest/tag imutável. Rebuild por ambiente introduz divergência ("passou em staging, quebrou em prod").
3. **Produção tem gate humano.** A promoção para produção exige aprovação manual explícita. Nenhum merge dispara deploy de produção sem um humano no botão.
4. **Segredo vive no cofre do CI.** Credenciais ficam no secret store do provedor (Actions secrets, GitLab CI variables, cofre do Jenkins), injetadas como env efêmera — nunca no YAML, nunca no repo, nunca em log.
5. **Pipeline é código versionado.** O workflow está no repositório, revisado por PR como qualquer código. Configuração de pipeline clicada na UI é invisível e irreproduzível.
6. **Deploy tem estratégia e volta.** Rolling/blue-green/substituição é uma escolha declarada, com rollback documentado E testado — reverter não pode ser descoberto durante o incidente.
7. **Rápido e idempotente.** Cache de dependências mantém o feedback curto; todo job pode ser re-executado com segurança (re-run não duplica release nem corrompe estado).
8. **Menor privilégio e portão de branch.** Credencial de deploy tem só o escopo necessário; `main` é protegida, deployável, e exige checks verdes + PR.
9. **Verde significa verde.** Nenhum teste é pulado, silenciado ou marcado `continue-on-error` para "passar o pipeline". Teste flaky vira issue investigada, não exceção tolerada — um gate que mente é pior que gate nenhum.
10. **Deploy é rastreável.** Cada publicação registra quem disparou, qual versão/digest subiu e quando — base para auditoria, correlação com incidentes e decisão de rollback informada.

## Regras verificáveis

- [ ] CI-01: Pipeline tem estágios explícitos `lint → test → build → deploy`; falha em um estágio impede os seguintes
- [ ] CI-02: Artefato/imagem construído UMA vez e promovido entre ambientes por digest/tag imutável — nenhum rebuild por ambiente
- [ ] CI-03: Deploy para produção exige gate/aprovação manual (`environment` protegido, job `when: manual`, approval step)
- [ ] CI-04: Segredos vêm do secret store do provedor de CI; nenhum segredo no YAML, no repo ou impresso em log
- [ ] CI-05: Definição do pipeline está versionada no repositório e passa por revisão de PR
- [ ] CI-06: Cache de dependências configurado (chaveado por lockfile) para manter o tempo de pipeline curto
- [ ] CI-07: Estratégia de deploy declarada (rolling/blue-green/substituição) e adequada ao serviço
- [ ] CI-08: Procedimento de rollback documentado e testável (redeploy da versão anterior/tag, migration reversa, flag) — não só "reverter o commit"
- [ ] CI-09: Smoke test pós-deploy roda contra o ambiente recém-publicado e falha o deploy se o health/endpoint crítico não responder
- [ ] CI-10: Branch protection ativo em `main`: PR obrigatório, checks verdes obrigatórios, `main` sempre deployável
- [ ] CI-11: Jobs são idempotentes — re-run seguro (release/tag/deploy não duplica nem corrompe; usa `IF NOT EXISTS`/checagem de idempotência onde aplicável)
- [ ] CI-12: Tempo de pipeline monitorado (visível/alertável) para garantir feedback rápido
- [ ] CI-13: Credencial de deploy com menor privilégio (escopo mínimo, idealmente OIDC/role temporária em vez de chave longeva)
- [ ] CI-14: Nenhum teste pulado/`continue-on-error` para forçar verde; suíte flaky é tratada como issue, não mascarada
- [ ] CI-15: Cada deploy é rastreável (autor, versão/digest, timestamp) em log/registro consultável

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer |
|---|---|---|
| `docker build` em cada ambiente | Artefatos divergentes; bug só aparece em prod | Build único promovido por digest/tag (CI-02) |
| Deploy de produção automático no merge | Mudança vai ao ar sem ninguém decidir | Gate manual para produção (CI-03) |
| Segredo hardcoded no YAML do workflow | Vaza no repo e no histórico; qualquer fork lê | Secret store do CI, env efêmera (CI-04) |
| Pipeline configurado só na UI do provedor | Invisível, irreproduzível, sem revisão | Pipeline como código versionado (CI-05) |
| "Rollback é dar revert e esperar o CI" | Lento, e migration/estado não voltam com o commit | Rollback documentado e testado (CI-08) |
| Deploy sem smoke test | Publica quebrado e ninguém percebe até o cliente | Smoke test pós-deploy que falha o deploy (CI-09) |
| Job de release não idempotente | Re-run duplica tag/release/cobrança | Guardas de idempotência; re-run seguro (CI-11) |
| Chave de admin longeva como credencial de deploy | Um vazamento compromete tudo, para sempre | Menor privilégio, OIDC/role temporária (CI-13) |
| `continue-on-error` / teste pulado para "ficar verde" | Gate mente; bug real passa despercebido | Verde honesto; flaky vira issue (CI-14) |
| Deploy sem registro de quem/o quê/quando | Impossível auditar ou correlacionar com incidente | Rastreabilidade por autor/digest/timestamp (CI-15) |

## Exemplo esquemático (estágios + gate)

```yaml
jobs:
  ci:        { steps: [ lint, test, build ] }          # falha barra o deploy
  publish:   { needs: ci, steps: [ push-image-by-digest ] }   # constrói UMA vez
  deploy-staging: { needs: publish, steps: [ deploy@digest, smoke-test ] }
  deploy-prod:
    needs: deploy-staging
    environment: production          # gate manual / aprovação obrigatória
    steps: [ deploy@digest, smoke-test ]   # mesmo digest promovido
```

## Como o plano de deploy especializa

O `specs/DEPLOY.md` do projeto deve definir concretamente:

- A ferramenta de CI/CD e os arquivos reais (ex.: `.github/workflows/*.yml`, `buildspec.yml`/`appspec.yml`), com os estágios e como adicionar um novo gate
- Como o artefato/imagem é identificado e promovido (tag/digest, registro) e o mecanismo de deploy por ambiente (PM2, ECS/CodeDeploy, Kubernetes, serverless)
- A estratégia de deploy escolhida e o procedimento de rollback passo a passo — incluindo como reverter migrations quando houver
- Onde vivem os segredos de cada ambiente no cofre do CI e o modelo de credencial de deploy (OIDC/role, chave de serviço) com o escopo mínimo
- O smoke test pós-deploy (endpoint/health a checar) e as regras de branch protection do repositório
