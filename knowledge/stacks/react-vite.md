# Lições de Stack — React + Vite

> Lições genéricas desta stack (React 18 + Vite + TS) aprendidas em rodadas SDD (qualquer projeto). Complementam o perfil `standards/stacks/react-vite.md` — se uma lição contradiz o perfil, corrija o perfil. Cada lição tem 1 linha no `knowledge/INDEX.md`.

### R-001 — Flag de feedback visual transitório com `setTimeout` não pode servir de flag de permissão de fluxo
**Contexto**: um componente que dá feedback efêmero a uma ação (o "Copiado ✓" que aparece por 2 s e volta a "Copiar") e, no mesmo componente, controla se o usuário **já pode avançar** (habilitar "Concluir", liberar ESC/clique-fora num dialog anti-perda).
**Problema**: reusar uma **única** variável (ex.: `copiado`, resetada por `setTimeout(...2000)`) para as duas coisas acopla um estado **transitório** a uma decisão **permanente**. Efeito real observado: o botão "Concluir" habilitava ao copiar e **voltava a desabilitar 2 s depois**; o dialog re-bloqueava a saída de quem já havia copiado. Um clone de página-modelo herda esse padrão sem perceber.
**Regra**: separe sempre **dois** estados — o permanente ("já cumpriu o passo": `jaCopiou`/`confirmou`, nunca resetado por timer) e o transitório ("mostrando o feedback": `mostrandoCheck`, esse sim com `setTimeout`). A permissão de fluxo (`podeConcluir`, `bloquearSaida`) deriva **só** do permanente. O `setTimeout` toca **apenas** o feedback visual (ícone + `aria-live`), nunca a habilitação de controles.
**Origem**: algar/EVALUATION UX#1/R-01 da rodada bypass-seguranca-integrador (22/07/2026)

### R-002 — Estado vazio que AFIRMA algo não pode ser o fallback de dado ausente: distinguir `undefined` (não veio) de `[]` (não há)
**Contexto**: componente que renderiza uma lista opcional vinda da API (`campo?: T[]`) e cujo estado vazio tem **significado afirmativo** no design ("sem bônus", "sem pendências", "nenhum débito") — não é mera omissão visual.
**Problema**: o padrão reflexo `Array.isArray(x) ? x : []` colapsa dois casos semânticos distintos: `[]` ("li o dado; não há") e `undefined` ("o dado **não veio**" — gate de feature OFF, degradação por falha, backend que ainda não implementa o campo). O componente então **afirma** o estado vazio sobre dado que ninguém leu — em rodada real, a coluna disse "sem bônus" para linhas com bônus durante toda a janela em que o campo não existia/estava gateado, sem nenhum erro visível (a ausência de campo opcional é silenciosa em TypeScript).
**Regra**: quando o estado vazio **afirma** (e não apenas omite), a renderização trata `x == null` como "sem informação" (célula vazia, `—` neutro com tooltip, ou skeleton) e reserva a afirmação ("sem X") para `x.length === 0` real. O contrato com o backend acompanha: degradação por falha **omite o campo** (nunca devolve `[]`/valor neutro fabricado) — a distinção só funciona se os dois lados a honrarem.
**Origem**: algar/LESSONS.md L085 — achados Q-8/Q-9 da rodada servico-bonus-temporario (28/07/2026).
