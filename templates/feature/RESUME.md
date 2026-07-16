# Resume: [Nome da Feature]

**Concluído em**: YYYY-MM-DD
**Status**: CONCLUÍDO | CONCLUÍDO COM DÉBITOS
**Modelos utilizados**: {{AGENT_MODELS}}

---

## O que foi implementado

- [bullet 1 — backend]
- [bullet 2 — frontend]
- [bullet 3 — testes]

---

## Ajustes realizados

> Decisões tomadas durante a implementação que divergiram do spec original.

| Ajuste | Justificativa |
|---|---|
| [o que mudou] | [por que mudou] |

---

## Integridade do projeto

- [ ] Testes existentes: 0 regressões (suíte completa via `commands` do config)
- [ ] `ARCHITECTURE.md` atualizado (se houve mudança arquitetural)
- [ ] `LESSONS.md` / `knowledge/` atualizados (retrospectiva feita)
- [ ] `STATE.md` atualizado

---

## Retrospectiva de aprendizado

| Lição | Classificação | Destino |
|---|---|---|
| [o que a rodada ensinou] | Projeto / Stack / Processo | `LESSONS.md` / `knowledge/stacks/<perfil>.md` / `knowledge/PROCESS.md` |

---

## Débitos técnicos identificados

| Item | Impacto | Sugestão |
|---|---|---|
| [débito] | Alto/Médio/Baixo | [próxima ação] |

---

## Sugestão de mensagem de commit

```
feat(nome-feature): descrição concisa do que foi feito

- detalhe técnico 1
- detalhe técnico 2

Co-Authored-By: {{MODEL_NAME}} <noreply@anthropic.com>
```

> `{{AGENT_MODELS}}` e `{{MODEL_NAME}}` são preenchidos pelo orquestrador com os modelos reais da rodada (do RUN.jsonl).

---

## Atualização do `STATE.md`

> Texto exato adicionado na seção "Implementado" do STATE.md:

- [x] **[Nome da Feature]** — [descrição de uma linha do que foi entregue]
