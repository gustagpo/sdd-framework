# Operação (DevOps)

Núcleo genérico de operabilidade que o agente DevOps aplica ao especificar requisitos (Passo 3), implementar infra (Passo 5) e validar deployability (Passo 6). O critério central: **a feature está pronta quando dá para colocá-la em produção, observá-la e desfazê-la sem heroísmo.** O `standards/stacks/<perfil>.md` e o `STACK.md` do projeto dizem as ferramentas concretas (CI/CD, processo, convenção de migrations).

## Princípios

1. **Configuração é contrato.** Todo comportamento que varia por ambiente vem de configuração declarada (env/parâmetro), nunca de código condicional por ambiente. Config nova sem documentação é config que vai derrubar o próximo deploy.
2. **Falha explícita na subida.** Ausência de configuração obrigatória derruba o boot com mensagem clara — nunca um default silencioso que "funciona" errado em produção. Default só quando seguro e documentado.
3. **Migration é código de produção.** Idempotente (rodar 2x não corrompe), com estratégia de rollout pensada (ordem app×migration, necessidade de backfill, compatibilidade com a versão anterior do app durante o deploy) e caminho de reversão conhecido.
4. **Rollback se decide antes do deploy.** Toda mudança sabe como ser desfeita — redeploy da versão anterior, migration reversa, flag. Se a resposta é "não dá para voltar", isso é uma decisão explícita do contrato, não uma descoberta do incidente.
5. **Se não dá para observar, não dá para operar.** Toda feature nova responde: como sei que está funcionando em produção? Logs estruturados nos pontos de decisão e de falha — sem dados sensíveis (ver [`SECURITY.md`](SECURITY.md) SEC-05).
6. **Processos assíncronos são reexecutáveis.** Job/cron/consumidor de fila assume que vai rodar duas vezes, morrer no meio e ser religado: idempotência, lock quando concorrência importa, e falha de um item não derruba o lote.
7. **Build reproduzível.** O artefato de produção nasce do pipeline, com dependências travadas (lockfile) — não da máquina de alguém.
8. **Mudança de infra passa pelo mesmo rigor do código.** CI/CD, configs e templates de ambiente são versionados, revisados no contrato e validados na avaliação.

## Regras verificáveis

- [ ] OPS-01: Toda env var nova/alterada está documentada no template do projeto (`.env.example` ou equivalente) com propósito e default
- [ ] OPS-02: Configuração obrigatória ausente derruba o boot com erro explícito (ou tem default seguro documentado) — comportamento definido no contrato
- [ ] OPS-03: Nenhum comportamento condicional por ambiente hardcoded no código (`if (env === 'prod')` para lógica de negócio)
- [ ] OPS-04: Migration é idempotente — rodar duas vezes não falha nem corrompe (IF NOT EXISTS / ON CONFLICT / guardas)
- [ ] OPS-05: Migration tem estratégia de rollout declarada: ordem app×migration, compatibilidade com a versão anterior durante o deploy, backfill quando necessário
- [ ] OPS-06: Rollback da feature definido antes do deploy (mecanismo + passos); irreversibilidade é decisão explícita do contrato
- [ ] OPS-07: Pontos de decisão e de falha da feature têm log estruturado com contexto suficiente para diagnóstico (ids, estado) — sem dados sensíveis
- [ ] OPS-08: Job/cron/consumidor novo é idempotente, tem tratamento por item (falha de um não derruba o lote) e lock quando duas instâncias não podem rodar juntas
- [ ] OPS-09: Efeito colateral externo disparado por job respeita a fronteira de transação (pós-commit — ver DDD D-07)
- [ ] OPS-10: Dependências travadas por lockfile commitado; build de produção passa no pipeline (não só local)
- [ ] OPS-11: Segredo novo tem local definido (vault/secret manager/env de deploy) e NUNCA entra no repositório — interseção com SEC-04
- [ ] OPS-12: Mudanças em CI/CD e configs de deploy estão no diff da feature, revisadas no contrato e validadas na avaliação

## Antipadrões

| Antipadrão | Por que é ruim | O que fazer em vez disso |
|---|---|---|
| Env nova "que todo mundo sabe" (sem doc) | O próximo deploy em staging/prod quebra sem pista | Documentar no template com propósito e default (OPS-01) |
| Default silencioso para config obrigatória | Sistema "funciona" errado em produção sem ninguém notar | Falha explícita no boot (OPS-02) |
| `if (NODE_ENV === 'production')` na regra de negócio | Comportamento intestável e divergente por ambiente | Config declarada; mesma lógica em todo ambiente (OPS-03) |
| Migration que só roda uma vez "se der certo" | Re-deploy/retry corrompe ou trava o pipeline | Idempotência com guardas (OPS-04) |
| Deploy da migration e do app "juntos e torcendo" | Janela em que app antigo roda contra schema novo (ou vice-versa) | Rollout declarado: expand → deploy → contract (OPS-05) |
| "Rollback? A gente vê se precisar" | Incidente vira improviso às 3h da manhã | Caminho de volta decidido no contrato (OPS-06) |
| Feature sem nenhum log novo | Impossível diagnosticar em produção; suporte vira adivinhação | Logar decisões e falhas com contexto (OPS-07) |
| Cron que quebra no primeiro item com erro | Um registro ruim para o lote inteiro | Tratamento por item + resumo do lote (OPS-08) |
| Pipeline verde só porque não builda nada novo | Artefato de produção nunca exercitado | Build de produção como gate da avaliação (OPS-10) |

## Como o perfil de stack especializa

O `standards/stacks/<perfil>.md` (e o `STACK.md` do projeto) devem definir:

- O pipeline de CI/CD do projeto (arquivos, estágios, como adicionar um gate) e o mecanismo de deploy (PM2, containers, serverless...)
- A convenção de migrations (ferramenta, pasta, nomenclatura, como reverter) e o comando de aplicação
- O template de configuração (`.env.example`/equivalente) e onde vivem os segredos por ambiente
- O padrão de logger estruturado e o scheduler de jobs da stack
- Os comandos de build de produção e de verificação local do pipeline
