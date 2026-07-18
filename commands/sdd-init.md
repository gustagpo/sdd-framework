# /sdd-init — Configurar um projeto para o SDD Framework (com gate de configuração)

Você configura (ou adota) um repositório para rodar o fluxo SDD. Ao final, o projeto terá `specs/sdd.config.json` + `specs/STACK.md` + `specs/WORKFLOW.md` + os documentos vivos, permissões acertadas, e o `/sdd` estará pronto para uso. É o **onboarding** do framework no projeto — trate como uma conversa guiada, não como um formulário.

**Input**: `$ARGUMENTS` = opcional; ignore salvo instrução explícita do usuário.

---

## Passo 0 — Verificação de ambiente

Cheque e reporte (sem parar por avisos):
1. `node --version` disponível (os scripts de telemetria/painel dependem dele; sem node, o fluxo roda mas sem custos/live — avise).
2. Plugin acessível: `${CLAUDE_PLUGIN_ROOT}/scripts/sdd-log.mjs` existe.
3. **Aviso de atualização** (best-effort): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-version-check.mjs` — se houver versão nova, mostre o aviso (informativo; nunca atualize automaticamente).
4. **Peso dos docs do projeto** (impacta TODO agente em TODA rodada): meça `CLAUDE.md`, `specs/STATE.md`, `specs/LESSONS.md` se existirem. Qualquer um **>40KB** ⇒ alerte com o custo real ("este arquivo é carregado em cada invocação de cada agente — em uma rodada de ~25 invocações, são ~25× o arquivo em contexto") e sugira mover detalhe enciclopédico para arquivos referenciados. Não modifique nada sem pedido.

## Passo 1 — Detectar a stack e o estado do projeto

Investigue (sem perguntar o que dá para descobrir):

1. **Backend**: `package.json` (`@nestjs/core`→`nestjs`; `next`→`nextjs`), `pyproject.toml`/`requirements.txt` (`fastapi`→`python-fastapi`), `pom.xml`/`build.gradle*` (→`spring-boot`). Outro → `custom` (STACK.md carrega tudo).
2. **Frontend**: `react`+`vite`→`react-vite`; `next`→`nextjs`; sem frontend → desabilitar `dev-frontend`/`ux-ui`.
3. **Monorepo/workspaces** e **scripts** de build/test — pré-preencha os comandos (lembre do placeholder `{pattern}`).
4. **Fontes de research**: dirs de documentação (`docs/`, `doc/`) e specs OpenAPI.
5. **Permissões atuais**: leia `.claude/settings.json`/`settings.local.json` do projeto — o workspace já tem allowlist de Read/Edit/Write/Bash?
6. **Modo adoção**: `specs/` já existe? Liste o que há; você **não sobrescreve nada existente** — só gera o que falta e propõe diffs.

## Passo 2 — GATE DE CONFIGURAÇÃO (a parada formal)

Apresente o que foi detectado e pergunte **em bloco** (AskUserQuestion; pré-preenchendo com o detectado) tudo que definirá o comportamento do `/sdd` neste projeto:

1. **Perfis de stack** (se ambíguos) e **comandos** de build/teste/e2e.
2. **Modelos por agente** — presets: "máxima qualidade" (team-leader=fable/fallback opus, demais opus), "balanceado" (devs/qa=sonnet), "econômico".
3. **Modo de aprovação default** (`gates.mode`): `ask` (pergunta a cada rodada — recomendado no início) | `supervised` | `autonomous`.
4. **Preset de fases default** (`phases.mode`): `ask` | `full` | `lite` | `spec-only` — explique cada um em 1 linha (nem todo projeto quer as 7 fases sempre).
5. **Participação de Security e DevOps**: `always` | `auto` (pelos flags do SPEC) | `never`.
6. **Autonomia de arquivos** (permissões): se o projeto ainda não tem allowlist, oferecer gravar em `.claude/settings.local.json`: `Read(//<projeto>/**)`, `Edit(//<projeto>/**)`, `Write`, `Bash` — para os agentes trabalharem sem prompts de permissão dentro das fases.
7. **Fontes de research** (docsDirs/openApiSpecs detectados; webSearch).

**Antes de gravar qualquer arquivo, mostre o RESUMO CONSOLIDADO** das escolhas e peça aprovação explícita. Rodar `/sdd-init` de novo reabre este gate para reconfigurar (idempotente; mostra diffs do que mudaria).

## Passo 3 — Gerar os arquivos

De `${CLAUDE_PLUGIN_ROOT}/templates/project/`, substituindo os `{{...}}` com o aprovado no gate:

| Gerar | De | Regra |
|---|---|---|
| `specs/sdd.config.json` | `sdd.config.json.tpl` | sempre (existente ⇒ propor diff, não sobrescrever sem aval) |
| `specs/STACK.md` | `STACK.md.tpl` | sempre; convenções/regras de negócio ficam como placeholder para o time (em adoção: extrair de CLAUDE.md/docs o que for operacional) |
| `specs/WORKFLOW.md` | `WORKFLOW.md.tpl` | sempre que não existir (existente ⇒ propor diff) — documenta Gate Inicial, modos e presets de fases |
| `specs/ARCHITECTURE.md` / `STATE.md` / `LESSONS.md` / `TESTS.md` | `*.tpl` | só se não existirem |
| `specs/features/` | — | criar se não existir |
| `.claude/settings.local.json` | — | só se a autonomia de arquivos foi aprovada no gate e não há allowlist equivalente |

Notas: `DOCS_DIRS_JSON`/`OPENAPI_SPECS_JSON` são arrays JSON reais; projeto sem frontend ⇒ `enabled: false` em dev-frontend/ux-ui.

## Passo 4 — CLAUDE.md

Apender `templates/project/CLAUDE-snippet.md` ao `CLAUDE.md` do projeto (criar se não existir; seção SDD existente ⇒ atualizar, não duplicar).

## Passo 5 — Validar e encerrar o onboarding

1. Valide o `sdd.config.json` (`node -e "JSON.parse(...)"`).
2. Apresente: arquivos gerados, config resolvida, placeholders pendentes no STACK.md, alertas de peso de docs (Passo 0) e os **próximos passos**:
   - `/sdd <feature> "<descrição>"` para a primeira rodada (o Gate Inicial da rodada pergunta modo/fases/autonomia)
   - `/sdd-deploy` (opcional, recomendado) — o agente DevOps planeja o deploy do projeto com você e gera as configurações (Docker, Nginx, Terraform, CI/CD), produzindo o `specs/DEPLOY.md`
   - comando do painel ao vivo (`sdd-live.mjs`) para acompanhar em outro terminal
   - `/sdd-dashboard` para custos; `docs/ONBOARDING.md` do plugin para o guia completo

## Regras

- **Idempotente**: nunca destrói conteúdo existente; completa o que falta e propõe diffs.
- Não invente comandos: sem detecção confiável, deixe placeholder e avise que o `/sdd` precisa dele preenchido.
- Não crie feature nem escreva código — este comando só configura.
