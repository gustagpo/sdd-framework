# Estendendo o SDD Framework

Como adicionar perfis de stack, customizar agentes/templates e ajustar preços.

---

## Criar um perfil de stack novo

1. Crie `standards/stacks/<perfil>.md` **espelhando o sumário dos perfis existentes** (use `nestjs.md` como referência):
   1. Tabela da stack (linguagem, framework, ORM, validação, testes, docs de API)
   2. Estrutura de pastas canônica (DDD aplicado)
   3. DDD nesta stack (interfaces × implementações, snippets curtos)
   4. SOLID nesta stack (injeção pela abstração, composição idiomática)
   5. API nesta stack (rotas, validação na borda, erros, auth, OpenAPI)
   6. Testes nesta stack (framework, estrutura, mocks de repositório)
   7. Armadilhas conhecidas (reais e específicas)
2. Crie o par `knowledge/stacks/<perfil>.md` (vazio, com o cabeçalho padrão) e a seção correspondente no `knowledge/INDEX.md`.
3. Referencie o perfil no `sdd.config.json` do projeto: `stack.backendProfile` (ou `frontendProfile`).
4. Regra de altitude: o **perfil** diz como a stack materializa os princípios; regras de UM projeto vão no `STACK.md` do projeto, nunca no perfil.

## Customizar um agente

- Os 5 agentes em `agents/` são genéricos por design — antes de editar, pergunte: isso é (a) regra do projeto → `specs/STACK.md`; (b) regra da stack → `standards/stacks/`; (c) lição → `knowledge/` via retrospectiva. Só o que for **papel/processo** pertence ao corpo do agente.
- Para um agente novo (ex.: `sdd-security`): crie `agents/sdd-security.md` com frontmatter (`name`, `description`, `model`, `tools`) + corpo com identidade, "o que NÃO faz" e o **contrato de entrega** padrão (resumo ≤3 linhas + arquivos + dados do passo). Depois adicione o papel em `agents` do `sdd.config.json` e insira a invocação no passo adequado do `commands/sdd.md`.
- Frontmatter `model` fica `opus`; modelos por projeto/rodada vêm do config (fable só via parâmetro, com fallback).

## Sobrescrever templates por projeto

O orquestrador copia os templates de `templates/feature/` do plugin; se o projeto tiver `specs/templates/<DOC>.md`, **o do projeto vence** (arquivo homônimo). Use para, por exemplo, adicionar seções obrigatórias ao CONTRACT.md de um time específico. Mantenha os placeholders `{{AGENT_MODELS}}`/`{{MODEL_NAME}}` do RESUME.md — o orquestrador os preenche.

## Ajustar preços

- Global (framework): edite `scripts/pricing.json` (USD/MTok: `input`, `output`, `cache_read`, `cache_write_5m`, `cache_write_1h`).
- Por projeto: `dashboard.pricingOverrides` no `sdd.config.json` — mesclado por cima do pricing.json (`node sdd-tokens.mjs --overrides '<json>'` é o mecanismo).
- Modelos novos: adicione a entrada exata do model ID (os transcripts registram IDs completos, ex. `claude-opus-4-8`); prefixos são resolvidos por melhor match.

## Publicar para outros times/máquinas

1. Suba este repo para o GitHub (`git remote add origin ... && git push`).
2. Nos outros ambientes: `claude plugin marketplace add <org>/<repo>` + `claude plugin install sdd-framework@sdd-framework`.
3. Atualizações: commits aqui (lições com prefixo `learn:`) chegam aos projetos via `claude plugin marketplace update` / reinstalação.
4. Versione: bump de `version` em `.claude-plugin/plugin.json` a cada mudança de comportamento.
