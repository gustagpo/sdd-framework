# /sdd-init — Configurar um projeto para o SDD Framework

Você configura (ou adota) um repositório para rodar o fluxo SDD. Ao final, o projeto terá `specs/sdd.config.json` + `specs/STACK.md` + os documentos vivos, e o `/sdd` estará pronto para uso.

**Input**: `$ARGUMENTS` = opcional; ignore salvo instrução explícita do usuário.

---

## Passo 1 — Detectar a stack e o estado do projeto

Investigue o repositório (sem perguntar o que dá para descobrir):

1. **Backend**: `package.json` com `@nestjs/core` → `nestjs`; com `next` → `nextjs`; `pyproject.toml`/`requirements.txt` com `fastapi` → `python-fastapi`; `pom.xml`/`build.gradle*` com spring-boot → `spring-boot`. Outro framework → perfil `custom` (sem arquivo de perfil; o STACK.md carrega tudo).
2. **Frontend**: deps `react`+`vite` → `react-vite`; `next` → `nextjs`; ausência de frontend → desabilitar `dev-frontend`/`ux-ui`.
3. **Monorepo/workspaces** e **scripts** de build/test (do `package.json`, `Makefile`, `pyproject`, etc.) — pré-preencha os comandos.
4. **Fontes de pesquisa**: diretórios de documentação (`docs/`, `doc/`, `documentation/`) e specs OpenAPI (`*.json`/`*.yaml` com `"openapi"`).
5. **Modo adoção**: se `specs/` já existe, liste o que já há (ARCHITECTURE/STATE/LESSONS/TESTS/features) — nesses casos você **não sobrescreve nada existente**, só gera o que falta.

## Passo 2 — Confirmar com o usuário (AskUserQuestion)

Pergunte apenas o que a detecção não resolveu com confiança, pré-preenchendo com o detectado:

- Perfis backend/frontend (se ambíguos)
- Comandos de build/teste/e2e (mostre os detectados; lembre do placeholder `{pattern}` para filtro de teste)
- Modelos por agente — default "máxima qualidade": `team-leader=fable (fallback opus)`, demais `opus`; ofereça também "balanceado" (devs/qa=sonnet) e "econômico"
- Gates de aprovação (default: após Passos 1, 2 e 3)
- Fontes de research (docsDirs/openApiSpecs detectados; webSearch ligado?)

## Passo 3 — Gerar os arquivos

A partir de `${CLAUDE_PLUGIN_ROOT}/templates/project/`, substituindo os placeholders `{{...}}` com o que foi detectado/confirmado:

| Gerar | De | Regra |
|---|---|---|
| `specs/sdd.config.json` | `sdd.config.json.tpl` | sempre (abortar se já existir e o usuário não pedir para recriar) |
| `specs/STACK.md` | `STACK.md.tpl` | sempre; preencher stack/comandos/estrutura detectados; seções de convenções/regras de negócio ficam com placeholders para o time preencher |
| `specs/ARCHITECTURE.md` | `ARCHITECTURE.md.tpl` | só se não existir |
| `specs/STATE.md` | `STATE.md.tpl` | só se não existir |
| `specs/LESSONS.md` | `LESSONS.md.tpl` | só se não existir |
| `specs/TESTS.md` | `TESTS.md.tpl` | só se não existir |
| `specs/features/` | — | criar diretório vazio se não existir |

Notas:
- `DOCS_DIRS_JSON`/`OPENAPI_SPECS_JSON` no config são arrays JSON reais (ex.: `["docs/"]`).
- Projeto sem frontend: `agents["dev-frontend"].enabled = false` e `agents["ux-ui"].enabled = false`.
- **Modo adoção**: se o projeto já tem convenções documentadas (CLAUDE.md, docs internos), extraia para o STACK.md o que for de stack/projeto (comandos, estrutura, áreas proibidas, regras críticas) em vez de deixar placeholders.

## Passo 4 — CLAUDE.md

Apende o conteúdo de `${CLAUDE_PLUGIN_ROOT}/templates/project/CLAUDE-snippet.md` ao `CLAUDE.md` do projeto (crie o arquivo se não existir; se já houver uma seção SDD, atualize-a em vez de duplicar).

## Passo 5 — Validar e reportar

1. Valide o `sdd.config.json` gerado (`node -e "JSON.parse(...)"` via Bash ou leitura direta).
2. Apresente ao usuário: os arquivos gerados, a config resolvida (perfis, comandos, modelos por agente), o que ficou como placeholder no STACK.md para preencher, e o próximo passo: `/sdd <nome-da-feature> "<descrição>"`.

## Regras

- **Idempotente**: rodar de novo nunca destrói conteúdo existente; só completa o que falta e propõe diffs para o que mudaria.
- Não invente comandos: se não conseguir detectar o comando de teste, deixe o placeholder e avise explicitamente que o `/sdd` precisa dele preenchido.
- Não crie feature nem escreva código — este comando só configura.
