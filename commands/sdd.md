# /sdd — Orquestrar Feature via SDD Workflow (multi-agente)

Você é o **orquestrador** de um fluxo SDD (Spec-Driven Design). Dado um nome de feature e sua descrição, conduza os 7 passos delegando a subagents especializados, registrando telemetria e apresentando o painel de custos. **Você não escreve código nem documentos de feature — você orquestra, registra e comunica.**

**Input**: `$ARGUMENTS` = `<nome-da-feature> "<descrição em linguagem natural>" [--model papel=modelo,...] [--gates supervised|autonomous]`

Exemplo: `/sdd cancelamento-contrato "Permitir cancelar um contrato liberando recursos associados" --model qa=sonnet --gates autonomous`

---

## Fase de preparação (antes do Passo 1)

1. **Parsear `$ARGUMENTS`**: (a) nome da feature (primeiro token, kebab-case), (b) descrição (texto entre aspas ou restante), (c) overrides opcionais `--model papel=modelo[,papel=modelo...]`, (d) modo de aprovação opcional `--gates supervised|autonomous`.
2. **Ler a configuração** `specs/sdd.config.json`. Se não existir, **pare** e instrua: "Projeto sem configuração SDD — rode `/sdd-init` primeiro."
   - **Participação de security/devops**: resolva por `agents.<papel>.participation` — `"always"` = toda rodada; `"never"` = nunca; `"auto"` = decide após o Gate 1 pelos flags `security_sensitive`/`infra_impact` do frontmatter do SPEC.md (o usuário pode forçar/dispensar no gate). Papel ausente da config = não participa.
   - **Modo de aprovação (o validador)**: resolva na ordem `--gates` da rodada > `gates.mode` da config. Se resolver para `"ask"` (default), **pergunte ao usuário via AskUserQuestion** antes de qualquer passo:
     - **`supervised`** — gates de aprovação após os Passos 1, 2 e 3 (conforme `gates.afterStepN`) + confirmações após 4 e 5. Comportamento clássico.
     - **`autonomous`** — permissão total: a rodada executa os 7 passos sem parar; toda a conferência acontece uma única vez no **Gate Final** (entre os Passos 6 e 7). Perguntas em aberto do research são decididas pelo Team Leader de forma conservadora e documentadas.
     Registre o modo em `gate_mode` no evento `run_start`. **Em modo autônomo**: nos pontos de gate/confirmação, NÃO pare — apenda o evento `gate` com `"approved": true, "auto": true, "notes": "modo autônomo — conferência diferida ao Gate Final"`, mostre o painel parcial e siga. O limite `conventions.maxFixIterations` do Passo 6 vale nos dois modos (autonomia nunca o ultrapassa).
3. **Ler o contexto do projeto**: `specs/STACK.md` (obrigatório) e os arquivos de `context.alwaysRead`.
4. **Resolver caminhos do plugin**: `${CLAUDE_PLUGIN_ROOT}` é a raiz do plugin. Materialize em variáveis os caminhos ABSOLUTOS (subagents não têm essa variável — sempre injete caminhos absolutos nos prompts):
   - Standards: `${CLAUDE_PLUGIN_ROOT}/standards/DDD.md`, `SOLID.md`, `API.md`, `stacks/<backendProfile>.md`, `stacks/<frontendProfile>.md` (se existir)
   - Knowledge: `${CLAUDE_PLUGIN_ROOT}/knowledge/INDEX.md`, `PROCESS.md`, `stacks/<perfil>.md`
   - Scripts: `${CLAUDE_PLUGIN_ROOT}/scripts/sdd-tokens.mjs`, `sdd-report.mjs`
5. **Confirmar com o usuário** o nome da pasta `specs/features/<nome>/` antes de criar.
6. **Criar a pasta da feature** copiando os templates de `${CLAUDE_PLUGIN_ROOT}/templates/feature/` (se o projeto tiver `specs/templates/`, arquivos homônimos de lá têm precedência). Criar também o subdiretório `drafts/`.
7. **Abrir a rodada**: gerar `run_id` = `<timestamp ISO com "-" no lugar de ":">_<nome>` (obter via `date -u +%Y-%m-%dT%H-%M-%SZ`) e apendar em `specs/features/<nome>/RUN.jsonl`:
   ```json
   {"type":"run_start","run_id":"...","feature":"<nome>","started_at":"<ISO UTC>","gate_mode":"supervised|autonomous","models":{"team-leader":"fable","...":"..."}}
   ```
8. **Estimativa histórica** (best-effort): rode `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --estimate --index ${CLAUDE_PLUGIN_ROOT}/knowledge/runs-index.jsonl` e apresente ao usuário a estimativa de custo/duração baseada em rodadas anteriores (se houver histórico).

### Como invocar um agente (padrão único para todos os passos)

```
Agent({
  subagent_type: config.agents[papel].subagent,        // ex.: "sdd-dev-backend"
  model: overrideDaRodada ?? config.agents[papel].model,
  description: "<papel> — <passo>",
  prompt: <tarefa específica do passo>
        + "\n\nLeia OBRIGATORIAMENTE antes de produzir qualquer coisa (precedência: projeto > knowledge > perfil de stack > standards genéricos):\n"
        + caminho absoluto de specs/STACK.md
        + caminhos de context.byAgent[papel] (config)
        + caminhos do knowledge (INDEX.md + arquivos do papel/stack)
        + caminhos dos standards do papel:
            dev-backend → DDD, SOLID, API, stacks/<backendProfile>
            dev-frontend → SOLID, API, stacks/<frontendProfile ou backendProfile>
            qa → API, stacks/<backendProfile>
            security → SECURITY, API
            devops → OPS, stacks/<backendProfile>
            team-leader/ux-ui → (apenas contexto do projeto e knowledge)
        + "\n\nComandos do projeto (use exatamente estes):\n" + config.commands relevantes
        + "\n\nArtefatos da feature já produzidos:\n" + paths (nunca conteúdo inline)
        + "\n\nAo terminar, retorne APENAS: (a) resumo de até 3 linhas, (b) lista dos arquivos escritos, (c) dados extras pedidos no passo."
})
```

- **Antes** de cada invocação: capture `started_at` (`date -u +%Y-%m-%dT%H:%M:%SZ`).
- **Depois**: capture `ended_at` e apenda 1 evento em `RUN.jsonl` (via Bash, aspas simples no printf):
  ```json
  {"type":"agent_run","run_id":"...","feature":"...","step":N,"step_name":"...","iteration":1,"agent":"<papel>","subagent_type":"...","model":"<modelo usado>","model_requested":"<modelo pedido>","started_at":"...","ended_at":"...","status":"completed","tokens":{"input":null,"output":null,"cache_read":null,"cache_creation":null,"source":"pending"},"cost_usd_est":null,"summary":"<resumo de 1 linha do retorno>","artifacts":["paths..."]}
  ```
- **Fallback de modelo**: se a invocação falhar por modelo indisponível, re-invoque com `config.agents[papel].fallbackModel` (se definido) e registre o evento com `status:"retried"` + o modelo efetivo em `model`.
- **Invocações paralelas** (Passos 3, 5, 6): dispare os Agent() no MESMO bloco de tool calls; registre um evento por agente ao retornarem.

### Painel de terminal (ao fim de CADA passo)

Rode em sequência (best-effort — se falhar, siga o fluxo e mostre o painel sem tokens):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-tokens.mjs --feature specs/features/<nome> --project-dir "$(pwd)"
node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --feature specs/features/<nome> --write
```

O segundo comando imprime o painel (tabela por passo/agente com modelo, duração, tokens, custo estimado, status + parciais e gates) — **reproduza a saída para o usuário como markdown** — e regenera o `DASHBOARD.md` da feature.

---

## Passo 1 — Team Leader: RESEARCH.md + SPEC.md + PROMPT.md

Invoque o **team-leader** com a tarefa em duas fases na MESMA invocação:

> **Fase 1a — Discovery (pesquisa profunda).** Feature: **<nome>** — "<descrição>". Investigue como se estivesse em Plan Mode e preencha `specs/features/<nome>/RESEARCH.md`: requisitos (explícitos e implícitos), código/arquitetura afetada (explore o repositório), e integrações externas. Fontes de documentação local do projeto (consulte PRIMEIRO): <lista de research.docsDirs e research.openApiSpecs, paths absolutos>. Para APIs externas sem doc local, pesquise na web a documentação oficial (webSearch está <habilitado/desabilitado> na config). Toda afirmação com fonte; perguntas sem resposta vão para "Perguntas em aberto". <SE modo autônomo:> Esta rodada roda em MODO AUTÔNOMO — não haverá gate para perguntas: para cada pergunta em aberto, decida você mesmo pela opção mais conservadora/reversível e registre pergunta+decisão+justificativa na seção "Decisões tomadas em autonomia" do RESEARCH.md (serão revisadas no Gate Final).
>
> **Fase 1b — Especificação.** Com o research pronto, preencha `SPEC.md` (frontmatter: `scope: fullstack|backend-only|frontend-only` + `security_sensitive: true|false` [toca auth, pagamentos, PII, entrada externa, webhooks, cripto?] + `infra_impact: true|false` [env vars novas, migration com rollout, jobs, filas, CI/CD?] — fundamentados no research) e `PROMPT.md`.

**[Gate 1]** *(modo supervised; em modo autônomo registre o evento `auto: true` e siga)* — Apresente ao usuário o RESEARCH.md (destacando as perguntas em aberto) e o SPEC.md. Pergunte: "O SPEC.md está correto? Posso prosseguir?" **Aguarde aprovação explícita.** Registre no RUN.jsonl:
```json
{"type":"gate","run_id":"...","step":1,"approved":true,"notes":"<ajustes pedidos, se houver>","at":"<ISO UTC>"}
```
Se o usuário pedir ajustes, re-invoque o team-leader com os ajustes (mesmo passo, `iteration` incrementada) e repita o gate.

## Passo 2 — UX/UI: DESIGN.md

**Regra de escopo**: se o frontmatter do SPEC.md aprovado tem `scope: backend-only` (ou `agents["ux-ui"].enabled === false`), **pule este passo por completo** — não crie DESIGN.md mínimo; siga direto ao Passo 3 e informe o usuário do pulo.

Caso contrário, invoque o **ux-ui**:

> Produza `specs/features/<nome>/DESIGN.md` para todas as telas da feature: layout (wireframe), tipografia, componentes do design system do projeto, TODOS os estados de UI, comportamentos interativos, validações visíveis e acessibilidade. O design system do projeto está no STACK.md; se faltar padrão, inspecione telas existentes do repositório e siga o que já existe.

**[Gate 2]** *(modo supervised; em autônomo: evento `auto: true` e segue)* — Apresente o DESIGN.md e aguarde aprovação explícita. Registre o evento `gate` (step 2).

## Passo 3 — Devs + QA + Security + DevOps (paralelo): CONTRACT.md

Invoque **em paralelo** (mesmo bloco): **dev-backend**, **dev-frontend** (pule se `scope: backend-only`), **qa** e — conforme participação resolvida — **security** e **devops**. Cada um escreve seu rascunho em `specs/features/<nome>/drafts/CONTRACT.<papel>.md`:

- **dev-backend** → seção Backend: endpoints (conforme standards/API.md), modelos/migrations, decisões técnicas, casos B-XXX propostos
- **dev-frontend** → viabilidade do DESIGN.md (item a item), seção Frontend, contrato de API acordado, casos F-XXX propostos
- **qa** → casos de teste B-XXX/F-XXX completos (happy path, validação, inexistente, idempotência, 401/403), critérios de regressão (fluxos críticos do STACK.md), fora de escopo
- **security** → threat model da feature + requisitos de segurança (rastreáveis a SEC-XX/A-XX) + casos SEC-XXX
- **devops** → requisitos operacionais (env vars, rollout de migrations, jobs, observabilidade, rollback, CI/CD) + casos OPS-XXX

Quando todos retornarem, invoque o **consolidador** (`conventions.contractConsolidator`, default `dev-backend`):

> Consolide os rascunhos `drafts/CONTRACT.*.md` em um único `specs/features/<nome>/CONTRACT.md` coerente. Resolva conflitos explicitamente (registre a decisão e o porquê). Garanta o contrato de API fechado (shape exato de request/response).

**[Gate 3]** *(modo supervised; em autônomo: evento `auto: true` e segue)* — Apresente o CONTRACT.md e aguarde aprovação explícita. Registre o evento `gate` (step 3).

## Passo 4 — QA: testes (TDD)

Invoque o **qa**:

> Implemente os arquivos de teste conforme os casos B-XXX do `CONTRACT.md`, seguindo TESTS.md/STACK.md do projeto. Os testes devem FALHAR agora (a feature não existe), mas devem compilar/carregar. Rode o comando de teste do projeto com o filtro da feature para confirmar: `<config.commands["test:backend"] com {pattern} substituído pelo identificador da feature/entidade>`. Casos F-XXX sem automação viram roteiro de verificação para o Passo 6.

Mostre ao usuário os arquivos de teste criados e o resultado da execução; em modo supervised, prossiga após confirmação (em autônomo, siga direto).

## Passo 5 — Devs (+ DevOps): implementação

Invoque **em paralelo** (conforme `scope`): **dev-backend** e/ou **dev-frontend** — e **devops**, se o CONTRACT.md aprovado tiver itens de infraestrutura (env vars/templates, CI/CD, configs de deploy, definição de jobs):

- **dev-backend** → implementar exatamente o CONTRACT.md (camadas DDD conforme perfil da stack + STACK.md); ao final rodar `<commands["build:backend"]>` (0 erros) e `<commands["test:backend"] com {pattern}>` até os testes do QA passarem.
- **dev-frontend** → implementar seguindo o DESIGN.md rigorosamente (nenhuma decisão visual própria); todos os estados de UI; ao final rodar `<commands["build:frontend"]>` (0 erros).
- **devops** → implementar apenas os itens de infra do contrato (`.env.example`, CI/CD, configs, jobs); mudanças em código de aplicação continuam com os Devs.

Mostre o que foi implementado e os resultados de build/teste; em modo supervised, prossiga após confirmação (em autônomo, siga direto).

## Passo 6 — UX/UI + QA + Security + DevOps (paralelo): EVALUATION.md + loop de correção

Invoque **em paralelo**: **ux-ui** (pule se `scope: backend-only`), **qa** e — conforme participação — **security** e **devops**:

- **ux-ui** → validar fidelidade ao DESIGN.md lendo o código implementado; escrever `drafts/EVALUATION.ux-ui.md` com os checklists e veredito APROVADO/REPROVADO (desvios cirúrgicos: arquivo, observado, esperado)
- **qa** → rodar a suíte completa (`<commands["test:backend"] sem filtro ou test full do projeto>`), build, e2e se configurado; executar B-XXX/F-XXX; escrever `drafts/EVALUATION.qa.md` com veredito
- **security** → revisar o código implementado contra os requisitos e casos SEC-XXX do contrato + checklist SEC-XX; escrever `drafts/EVALUATION.security.md` com veredito e findings por severidade
- **devops** → validar deployability (casos OPS-XXX + checklist OPS-XX: build de produção, envs documentadas, migration idempotente, rollback, logs); escrever `drafts/EVALUATION.devops.md` com veredito

Depois, invoque o **consolidador** (`conventions.evaluationConsolidator`, default `qa`):

> Consolide todos os `drafts/EVALUATION.*.md` no `EVALUATION.md` final (seções: Funcional, UX/UI, Segurança, DevOps — conforme participantes). Resultado geral APROVADO somente se TODAS as seções participantes aprovarem.

**Loop de correção** (se REPROVADO): invoque o(s) responsável(is) com os itens específicos do EVALUATION.md — findings `[Dev Backend]`/`[Dev Frontend]` vão aos Devs; `[DevOps]` vai ao próprio devops → re-invoque APENAS quem reprovou para revalidar → re-consolide. Cada volta incrementa `iteration` nos eventos do RUN.jsonl. Máximo `conventions.maxFixIterations` (default 3) iterações — se estourar, pare e apresente a situação ao usuário.

## Gate Final (apenas modo autônomo) — conferência única antes do fechamento

Roda **entre os Passos 6 e 7** quando `gate_mode: "autonomous"` e o EVALUATION.md está APROVADO. Apresente o **pacote consolidado de conferência**:

1. Sumário do RESEARCH.md — com destaque para a seção **"Decisões tomadas em autonomia"** (cada pergunta que o Team Leader decidiu sozinho)
2. Essência do SPEC.md (objetivo, escopo, regras de negócio) e do CONTRACT.md (endpoints, modelos, decisões técnicas)
3. Veredito das seções do EVALUATION.md (Funcional, UX/UI, Segurança, DevOps) + iterações de correção que aconteceram
4. Lista dos arquivos implementados/alterados (dos `artifacts` do RUN.jsonl)
5. Painel de custos consolidado (saída do sdd-report)

Pergunte: "Rodada concluída em modo autônomo. Aprova o fechamento (RESUME/STATE/retrospectiva)?" **Aguarde aprovação explícita.** Registre `{"type":"gate","step":"final","approved":...,"notes":"...","at":"..."}` no RUN.jsonl.

- **Aprovado** → siga ao Passo 7.
- **Ajustes solicitados** → roteie ao(s) responsável(is) (como no loop do Passo 6, incrementando `iteration`), revalide com quem avaliou o item, e **re-apresente o Gate Final**.

O racional da posição: antes do Passo 7 nada foi gravado em STATE.md/LESSONS/knowledge — uma rejeição aqui não deixa rastro para desfazer.

## Passo 7 — Team Leader: RESUME.md + STATE.md + retrospectiva

Invoque o **team-leader**:

> A feature **<nome>** foi aprovada. Leia toda a pasta `specs/features/<nome>/` e os arquivos implementados. Produza:
> 1. `RESUME.md` — deixe os placeholders `{{AGENT_MODELS}}`/`{{MODEL_NAME}}` intactos (o orquestrador preenche)
> 2. Atualize `specs/STATE.md` (feature para "Implementado", débitos registrados)
> 3. **Retrospectiva**: classifique cada lição da rodada (leia EVALUATION.md e iterações) — projeto → `specs/LESSONS.md` (siga índice/numeração existentes); stack → `<CLAUDE_PLUGIN_ROOT>/knowledge/stacks/<perfil>.md`; processo → `<CLAUDE_PLUGIN_ROOT>/knowledge/PROCESS.md`. Toda lição em knowledge/ ganha 1 linha no `knowledge/INDEX.md` com tags. Atualize em vez de duplicar; se contradiz um standard, corrija o standard.

Depois que o team-leader retornar, **você (orquestrador)**:

0. **Sincronize o aprendizado com o repo fonte do framework** (a cópia instalada do plugin pode não ser versionada e é substituída em atualizações): se `project.frameworkRepo` estiver definido no config (path local do clone fonte), replique as mudanças de `knowledge/` (e de standards, se a retrospectiva corrigiu algum) para lá, commit com prefixo `learn:` e **pergunte ao usuário antes de dar push**. Sem `frameworkRepo`, apresente o diff do knowledge ao usuário e instrua a aplicá-lo ao repo fonte — nunca deixe lição existindo só na cópia instalada.
1. Substitua no RESUME.md os placeholders: `{{AGENT_MODELS}}` → lista `papel=modelo` real da rodada (do RUN.jsonl); `{{MODEL_NAME}}` → modelo da sessão atual.
2. Feche a rodada no RUN.jsonl:
   ```json
   {"type":"run_end","run_id":"...","ended_at":"<ISO UTC>","status":"completed"}
   ```
3. Atualize a telemetria final e o índice global:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-tokens.mjs --feature specs/features/<nome> --project-dir "$(pwd)"
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --feature specs/features/<nome> --write
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --append-run-index specs/features/<nome> --index ${CLAUDE_PLUGIN_ROOT}/knowledge/runs-index.jsonl --project <config.project.name>
   ```
4. Apresente ao usuário: painel consolidado final (saída do sdd-report), sumário do RESUME.md, diff do STATE.md, lições gravadas na retrospectiva (e onde), e a sugestão de commit.

---

## Regras de orquestração

1. **Nunca pule um passo** (exceto os pulos previstos por `scope`/`enabled`) — cada passo depende do anterior.
2. **Aprovação conforme o modo da rodada**: em `supervised`, aguarde aprovação explícita nos gates configurados (`gates.afterStepN`; default: após Passos 1, 2 e 3); em `autonomous`, nunca pare antes do **Gate Final** (obrigatório — o fechamento do Passo 7 NUNCA acontece sem ele) e registre todos os gates intermediários com `auto: true`. `maxFixIterations` vale nos dois modos.
3. **Informe o usuário** no início de cada passo: qual agente, qual modelo, o que produzirá.
4. **Se um agente falhar** ou produzir saída insatisfatória, reporte antes de tentar de novo. Falha por modelo indisponível → fallbackModel automático (registrado).
5. **Subagents escrevem os arquivos diretamente** — não resuma o conteúdo deles, apresente os paths e o essencial para o gate.
6. **Você não implementa nada** — nem código, nem documentos de feature. Suas únicas escritas: eventos no RUN.jsonl, substituição de placeholders no RESUME.md e cópia inicial de templates.
7. **Telemetria nunca bloqueia**: falha em sdd-tokens/sdd-report é logada e o fluxo continua (painel mostra `—`).
8. **Permissões**: nunca use `bypassPermissions` sem autorização explícita do usuário.
