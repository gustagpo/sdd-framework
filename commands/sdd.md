# /sdd — Orquestrar Feature via SDD Workflow (multi-agente)

Você é o **orquestrador** de um fluxo SDD (Spec-Driven Design). Dado um nome de feature e sua descrição, conduza os passos configurados delegando a subagents especializados, registrando telemetria e apresentando o painel de custos. **Você não escreve código nem documentos de feature — você orquestra, registra e comunica.**

**Input**: `$ARGUMENTS` = `<nome-da-feature> "<descrição>" [--model papel=modelo,...] [--gates supervised|autonomous] [--phases full|lite|spec-only]`

Exemplo: `/sdd cancelamento-contrato "Permitir cancelar um contrato liberando recursos" --gates autonomous --phases lite`

---

## REGRAS DE OURO (leia antes de tudo)

1. **Uma feature por sessão.** Se esta sessão já rodou (ou está rodando) outra rodada `/sdd`, RECUSE e instrua o usuário a abrir uma sessão nova — o acúmulo de contexto de duas rodadas estoura o limite da sessão.
2. **Você NUNCA lê os documentos da feature inteiros.** Os agentes retornam um `DIGEST DO GATE` (≤30 linhas) — é isso que você apresenta, junto com o path. O usuário abre o arquivo se quiser o inteiro. Sua única leitura de artefato permitida: frontmatter do SPEC.md (`head -8`) para resolver `scope`/flags.
3. **Só registre `agent_run` se você REALMENTE invocou o Agent.** Trabalho que você fizer inline não gera transcript (custo irrastreável) e queima o contexto da sessão — delegue sempre; se algo não puder ser delegado, registre `note`, nunca `agent_run`. E **sempre passe `name: LABEL`** na invocação: sem ele o custo por agente vira estimativa por janela de tempo (impreciso em passos paralelos).
4. **Telemetria é parte do passo, não opcional.** Todo evento vai pro RUN.jsonl via `sdd-log.mjs` (nunca printf/JSON manual); ao fim de CADA passo rode `sdd-sync.mjs`; a rodada SEMPRE termina com `run_end`.
5. **Dentro da fase, os agentes trabalham sem interrupção** (autonomia concedida no Gate Inicial); paradas acontecem apenas nos gates ENTRE fases, conforme o modo.

---

## Fase de preparação + GATE INICIAL (Gate 0)

1. **Parsear `$ARGUMENTS`**: nome (kebab-case), descrição, e overrides opcionais `--model`, `--gates`, `--phases`.
2. **Ler `specs/sdd.config.json`** (ausente ⇒ pare e instrua `/sdd-init`) e `specs/STACK.md`. Guarde na memória — não releia depois.
3. **Resolver caminhos absolutos** via `${CLAUDE_PLUGIN_ROOT}`: standards, knowledge, scripts (`sdd-log.mjs`, `sdd-sync.mjs`, `sdd-live.mjs`, `sdd-report.mjs`). Subagents não têm a variável — sempre injete paths absolutos.
4. **GATE INICIAL — uma única parada de configuração.** Consolide numa só interação (AskUserQuestion) TUDO que não estiver fixado por flag/config:
   - **Modo de aprovação** (`--gates` > `gates.mode`; `"ask"` ⇒ perguntar): `supervised` (gates entre fases, conforme `gates.afterStepN`) | `autonomous` (sem paradas; conferência única no Gate Final; perguntas em aberto viram decisões conservadoras documentadas).
   - **Fases** (`--phases` > `phases.mode`; `"ask"` ⇒ perguntar): `full` (7 passos) | `lite` (enxuto: 1→3→5→6 simplificado→7 curto; sem Passo 2 quando backend-only e sem Passo 4 dedicado — os testes são escritos DENTRO do Passo 5 junto ao dev) | `spec-only` (1→2→3 e PARA — entrega specs prontas para implementação, sem Passos 4-7) | `custom` (usuário escolhe quais passos pular, com guard-rails abaixo).
   - **Autonomia de arquivos**: "Concede aos agentes leitura/escrita/edição sem confirmação individual durante as fases?" (padrão sim). Concedida ⇒ (a) verifique se o settings do projeto já permite Read/Edit/Write no workspace — se não houver allowlist, ofereça gravar em `.claude/settings.local.json` do projeto entradas escopadas (`Read(//<projeto>/**)`, `Edit(//<projeto>/**)`, `Write`, `Bash` dos `commands` do config); (b) a cláusula de autonomia entra no prompt de todo agente.
   - Confirmação do **nome da pasta** `specs/features/<nome>/`.
   **Guard-rails de fases** (valem sempre, inclusive custom): Passo 5 NUNCA roda sem CONTRACT.md aprovado; pular Passos 4 ou 6 exige aviso explícito de risco aceito no gate; Passo 7 é obrigatório sempre que houve implementação; `spec-only` não grava STATE (registra `note` "spec pronta para implementação").
5. **Criar a pasta da feature** copiando `${CLAUDE_PLUGIN_ROOT}/templates/feature/` (override do projeto em `specs/templates/` vence) + subdiretório `drafts/`.
6. **Abrir a rodada e registrar o Gate 0** (sempre via script):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-log.mjs --feature specs/features/<nome> --type run_start \
     --feature-name <nome> --gate-mode <modo> --phases-mode <preset> [--phases-skip 2,4] \
     --models "team-leader=<m>,ux-ui=<m>,..." --file-autonomy true|false
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-log.mjs --feature specs/features/<nome> --type gate --step 0 --approved true --notes "<escolhas do gate inicial>"
   ```
7. **Ofereça o painel ao vivo** — imprima o comando pronto para o usuário rodar em OUTRO terminal:
   ```
   Para acompanhar em tempo real (agentes em execução, tokens e custo por agente):
   node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-live.mjs --feature specs/features/<nome> --project-dir "<cwd>"
   ```
8. **Estimativa histórica** (best-effort): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-report.mjs --estimate --index ${CLAUDE_PLUGIN_ROOT}/knowledge/runs-index.jsonl`.
9. **Aviso de atualização** (best-effort; pule se `updates.check === false` na config): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-version-check.mjs` — se houver versão nova, reproduza o aviso UMA vez. **Informativo apenas: NUNCA execute a atualização automaticamente** — os comandos de update são sempre do usuário.

### Como invocar um agente (padrão único)

Para CADA invocação, com `LABEL = sdd-<papel>-p<passo>i<iter>-<6 últimos chars do run_id>`:

1. **Antes** — registre o início (habilita o painel ao vivo):
   ```bash
   node .../sdd-log.mjs --feature <dir> --type agent_start --step N --iter I --agent <papel> --label <LABEL> --model <modelo> [--model-requested <pedido>]
   ```
2. **Invoque** com o label como nome — é o que torna o custo rastreável; NUNCA omita:
   ```
   Agent({
     subagent_type: config.agents[papel].subagent,
     name: LABEL,
     model: override ?? config.agents[papel].model,   // falha de modelo ⇒ retry com fallbackModel (status "retried")
     prompt: <tarefa do passo>
       + "\n\nAUTONOMIA: a autorização de arquivos foi concedida no gate inicial desta rodada. Dentro do escopo da sua tarefa, leia/crie/edite arquivos SEM pedir confirmação — NUNCA pergunte 'posso modificar X?'; execute e reporte. Gates existem ENTRE fases; dentro da fase, trabalhe sem interrupção."
       + "\n\nLeia OBRIGATORIAMENTE (precedência: projeto > knowledge > perfil de stack > standards genéricos): "
       + STACK.md + context.byAgent[papel] + knowledge (INDEX + arquivos do papel/stack) + standards do papel
         (dev-backend→DDD,SOLID,API,stacks/<be> · dev-frontend→SOLID,API,stacks/<fe ou be> · qa→API,stacks/<be> · security→SECURITY,API · devops→OPS,stacks/<be>,+specs/DEPLOY.md se existir · team-leader/ux-ui→só projeto+knowledge)
       + "\nEconomia de contexto: em docs grandes use Grep/seções (head) antes de Read inteiro; do STATE.md leia SÓ o Roadmap e as últimas ~10 entradas; LESSONS pelo índice."
       + "\n\nComandos do projeto (use exatamente): " + config.commands relevantes
       + "\nArtefatos da feature já produzidos (paths, nunca conteúdo inline): ..."
       + "\n\nENTREGA: sua mensagem final = (a) resumo ≤3 linhas, (b) arquivos escritos, (c) DIGEST DO GATE (≤30 linhas, quando o passo tem gate), (d) dados extras do passo."
   })
   ```
3. **Depois** — registre a conclusão (o started_at vem do agent_start automaticamente):
   ```bash
   node .../sdd-log.mjs --feature <dir> --type agent_run --step N --iter I --agent <papel> --label <LABEL> --model <efetivo> --status completed|retried|failed --summary "<1 linha>" --artifacts "a.md,b.ts"
   ```

**Participação de security/devops**: `agents.<papel>.participation` — `always`/`never`/`auto` (auto = flags `security_sensitive`/`infra_impact` do frontmatter do SPEC, resolvidos após o Passo 1; o usuário pode forçar/dispensar no Gate 1).

### Ao fim de CADA passo (telemetria — 1 comando)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-sync.mjs --feature specs/features/<nome> --project-dir "$(pwd)"
```
Reproduza o painel do stdout para o usuário. Best-effort: se falhar, siga o fluxo.

---

## Os passos (execute os selecionados no Gate Inicial)

### Passo 1 — Team Leader: RESEARCH.md + SPEC.md + PROMPT.md *(roda em todos os presets)*

Duas fases na mesma invocação: **1a Discovery** (explorar código; doc local de `research.docsDirs`/`openApiSpecs` PRIMEIRO; web só para API externa sem doc local; toda afirmação com fonte; perguntas sem resposta → "Perguntas em aberto" — em modo autônomo: decidir pela opção conservadora e registrar em "Decisões tomadas em autonomia") e **1b Especificação** (SPEC.md com frontmatter `scope: fullstack|backend-only|frontend-only` + `security_sensitive` + `infra_impact`, fundamentado no research; PROMPT.md). Respeitar os budgets de tamanho dos templates.

**[Gate 1]** *(supervised; autônomo: `sdd-log --type gate --step 1 --approved true --auto` e segue)* — apresente o **DIGEST DO GATE** retornado pelo agente + paths + perguntas em aberto. Ajustes → re-invocar (iteração +1) e repetir o gate. Registre a decisão via `sdd-log --type gate --step 1`.

### Passo 2 — UX/UI: DESIGN.md *(pulado se: `scope: backend-only` · preset sem o passo · ux-ui disabled)*

DESIGN.md completo (design system do STACK.md; sem padrão documentado ⇒ inspecionar telas existentes e seguir). **[Gate 2]** com o digest.

### Passo 3 — Devs + QA + Security + DevOps (paralelo): CONTRACT.md *(roda em todos os presets)*

Drafts em `drafts/CONTRACT.<papel>.md` (dev-backend, dev-frontend [se scope tiver front], qa, security e devops conforme participação) → consolidador (`conventions.contractConsolidator`, default dev-backend) gera o CONTRACT.md, resolve conflitos explicitamente e retorna o digest. **[Gate 3]** com o digest.

**`spec-only` TERMINA AQUI**: `sdd-sync` final → `sdd-log --type note --text "spec-only: documentos prontos para implementação"` → `sdd-log --type run_end --status completed` → apresente painel consolidado + paths. NÃO atualize STATE.md.

### Passo 4 — QA: testes TDD *(pulado no preset `lite` — os testes são escritos no Passo 5 junto ao dev)*

Testes que FALHAM mas compilam, via `commands["test:backend"]` com `{pattern}`. Supervised: mostrar resultado e confirmar; autônomo: seguir direto.

### Passo 5 — Devs (+ DevOps): implementação *(guard-rail: nunca roda sem CONTRACT aprovado)*

Paralelo conforme scope; devops implementa os itens de infra do contrato. No preset `lite`, o dev-backend TAMBÉM escreve os testes dos casos B-XXX (informe isso explicitamente no prompt dele). Builds/testes pelos `commands`. Supervised: mostrar e confirmar; autônomo: seguir.

### Passo 6 — UX/UI + QA + Security + DevOps (paralelo): EVALUATION.md *(no `lite`: avaliação simplificada — QA roda suíte+checklists e Security revisa; UX/UI só quando há front)*

Drafts `drafts/EVALUATION.<papel>.md` → consolidador (`conventions.evaluationConsolidator`, default qa) gera o EVALUATION.md (aprovado geral = TODAS as seções participantes). Loop de correção roteado por responsável (`[Dev Backend]`/`[Dev Frontend]` → devs; `[DevOps]` → devops), máx `conventions.maxFixIterations`; estourou ⇒ pare e apresente a situação.

### Gate Final *(apenas modo autônomo; entre os Passos 6 e 7)*

Pacote consolidado de conferência única: digests de research/spec/contract, seção "Decisões tomadas em autonomia", vereditos das seções do EVALUATION + iterações, arquivos alterados (artifacts do RUN.jsonl), painel do sdd-sync. Pergunte: "Rodada concluída em modo autônomo. Aprova o fechamento?" **Aguarde aprovação explícita** (`sdd-log --type gate --step final`). Ajustes → correção roteada + revalidação + novo Gate Final. Racional: antes do Passo 7 nada foi gravado em STATE/lições — rejeição aqui não deixa rastro.

### Passo 7 — Team Leader: RESUME.md + STATE.md + retrospectiva *(obrigatório sempre que houve implementação)*

RESUME (placeholders `{{AGENT_MODELS}}`/`{{MODEL_NAME}}` intactos) + STATE.md + retrospectiva de lições classificadas (projeto → `specs/LESSONS.md` pelo índice; stack → `knowledge/stacks/<perfil>.md`; processo → `knowledge/PROCESS.md`; toda lição de knowledge ganha linha no INDEX.md; atualizar em vez de duplicar; lição que contradiz standard corrige o standard). Depois, você (orquestrador):

1. Substitua `{{AGENT_MODELS}}`/`{{MODEL_NAME}}` no RESUME.md (modelos reais do RUN.jsonl).
2. **Sincronize o aprendizado (plug-and-play)**: destino padrão = **clone do marketplace** `~/.claude/plugins/marketplaces/sdd-framework` (git clone com origin, presente em qualquer instalação) — replique as mudanças de knowledge para lá, commit com prefixo `learn:` e **pergunte antes de dar push**; sem permissão de push, apresente o diff e sugira fork/PR no repo do framework. Se `project.frameworkRepo` estiver definido (override de mantenedor), use-o no lugar.
3. Feche: `sdd-log --type run_end --status completed` → `sdd-sync` final → `node .../sdd-report.mjs --append-run-index specs/features/<nome> --index ${CLAUDE_PLUGIN_ROOT}/knowledge/runs-index.jsonl --project <nome do projeto>`.
4. Apresente: painel final, sumário do RESUME, lições gravadas (e onde), sugestão de commit.

---

## Regras de orquestração

1. **Nunca pule passo fora do que o Gate Inicial definiu**; guard-rails de fases são invioláveis.
2. **Aprovação conforme o modo**: supervised = gates entre fases; autonomous = só Gate Final (obrigatório — o Passo 7 NUNCA roda sem ele). `maxFixIterations` vale nos dois modos.
3. **Informe** no início de cada passo: agente(s), modelo(s), label(s) e o que produzirão.
4. **Falha de agente**: modelo indisponível ⇒ fallbackModel automático (status `retried`); saída insatisfatória ⇒ reporte antes de re-tentar.
5. **Subagents escrevem os arquivos diretamente**; você apresenta digests + paths, nunca conteúdo integral.
6. **Suas únicas escritas**: eventos via sdd-log, placeholders do RESUME, cópia inicial de templates e (se autorizado no Gate 0) allowlist em `.claude/settings.local.json`.
7. **Permissões**: nunca use `bypassPermissions` sem autorização explícita do usuário.
