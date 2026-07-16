# Ciclo de Aprendizado — SDD Framework

Como o framework "fica mais inteligente" a cada rodada e a cada projeto.

---

## Princípio

O plugin é um repositório git: **todo conhecimento gravado nele propaga** para todos os projetos que o usam (e para outras máquinas, via GitHub). O aprendizado tem dois trilhos: **qualitativo** (lições em markdown) e **quantitativo** (métricas de rodada em `runs-index.jsonl`).

## Taxonomia de lições — onde cada uma vive

| Nível | Onde | Critério | Exemplo |
|---|---|---|---|
| **Projeto** | `specs/LESSONS.md` do repo consumidor | Só faz sentido NESTE repositório (regra de negócio, peculiaridade de schema, integração própria) | "FK invertida na tabela X", "serviço Y não usa interceptor JWT" |
| **Stack** | `knowledge/stacks/<perfil>.md` do plugin | Vale em QUALQUER projeto com essa stack (comportamento de framework/lib) | "Jest 30 só aceita `--testPathPatterns`", "cast TS não converte em runtime p/ Prisma" |
| **Processo** | `knowledge/PROCESS.md` do plugin | Sobre o PRÓPRIO fluxo SDD (o que gera retrabalho, o que previne erro) | "CONTRACT sem exemplos de payload gera 2+ iterações no Passo 6" |

Teste rápido de classificação: *"se eu levasse esta lição para um projeto novo da mesma stack, ela ainda seria verdadeira?"* — sim = stack; *"e para outra stack?"* — sim = processo; não = projeto.

## Como o aprendizado acontece (retrospectiva do Passo 7)

Ao fechar cada feature, o Team Leader analisa `EVALUATION.md`, iterações do Passo 6, surpresas do research e desvios do RESUME, e grava as lições classificadas. Regras anti-inchaço (obrigatórias):

1. **Atualizar em vez de duplicar** — antes de gravar, procurar lição equivalente.
2. **Índice sempre em dia** — toda lição em `knowledge/` ganha 1 linha no `INDEX.md` com tags `[stack][papel][passo]` (agentes leem o índice primeiro).
3. **Lição errada é removida** — não se acumula ruído.
4. **Lição que contradiz um standard corrige o standard** — o conhecimento consolidado vive nos standards; a lição é o mecanismo de correção, não um anexo permanente.
5. No LESSONS.md do projeto, seguir a numeração e o índice existentes.

## Como o aprendizado volta para os agentes

O orquestrador injeta na cadeia de contexto de cada agente: `knowledge/INDEX.md` + os arquivos de knowledge do papel/stack. Precedência final: **projeto > knowledge > perfil de stack > standards genéricos**. Os agentes permanecem imutáveis — a inteligência acumula nos arquivos de knowledge (diffs revisáveis, sem crescimento descontrolado do prompt).

## Trilho quantitativo — calibração por histórico

`knowledge/runs-index.jsonl` acumula 1 linha por rodada concluída (projeto, feature, invocações, custo estimado, tokens, iterações do Passo 6, custo por agente/modelo). Usos:

- **Estimativa pré-rodada**: no início de cada `/sdd`, o orquestrador roda `sdd-report.mjs --estimate` e mostra custo/duração medianos do histórico.
- **Visão entre projetos**: `/sdd-dashboard --global`.
- **Sugestão de downgrade**: quando o histórico mostra que um papel nunca reprova/itera com determinado modelo, o dashboard **sugere** testar um modelo mais barato — a decisão é sempre humana (editar o config).

## Sincronização com o repo fonte

A cópia do plugin que os agentes usam em runtime (`~/.claude/plugins/cache/...`) **não é versionada** e é substituída quando o plugin atualiza. Por isso o orquestrador, ao fim do Passo 7, replica as mudanças de `knowledge/` para o clone fonte apontado por `project.frameworkRepo` no `sdd.config.json`, commita com prefixo `learn:` e pergunta antes de dar push. Fluxo completo:

```
retrospectiva escreve em ${CLAUDE_PLUGIN_ROOT}/knowledge (efeito imediato na máquina)
      → replica no clone fonte (frameworkRepo) → commit "learn: ..." → push (com aprovação)
      → outros projetos/máquinas recebem via: claude plugin marketplace update sdd-framework
        + claude plugin update sdd-framework (ou reinstalação)
```

Sem `frameworkRepo` configurado, o orquestrador apresenta o diff do knowledge para você aplicar manualmente ao repo fonte (github.com/gustagpo/sdd-framework) — uma lição nunca deve existir só na cópia instalada.

## Higiene e auditoria

- `/sdd-dashboard --learning` lista as lições por categoria e destaca candidatas a revisão (antigas, nunca referenciadas, possivelmente supersedidas).
- Commits de aprendizado no plugin usam o prefixo **`learn:`** — `git log --oneline --grep '^learn'` audita o que foi aprendido e quando.
- Revisão periódica recomendada: a cada N rodadas, ler o INDEX e podar/promover lições (promover = virar regra de standard/perfil).
