# Lições de Stack — React + Vite

> Lições genéricas desta stack (React 18 + Vite + TS) aprendidas em rodadas SDD (qualquer projeto). Complementam o perfil `standards/stacks/react-vite.md` — se uma lição contradiz o perfil, corrija o perfil. Cada lição tem 1 linha no `knowledge/INDEX.md`.

### R-001 — Flag de feedback visual transitório com `setTimeout` não pode servir de flag de permissão de fluxo
**Contexto**: um componente que dá feedback efêmero a uma ação (o "Copiado ✓" que aparece por 2 s e volta a "Copiar") e, no mesmo componente, controla se o usuário **já pode avançar** (habilitar "Concluir", liberar ESC/clique-fora num dialog anti-perda).
**Problema**: reusar uma **única** variável (ex.: `copiado`, resetada por `setTimeout(...2000)`) para as duas coisas acopla um estado **transitório** a uma decisão **permanente**. Efeito real observado: o botão "Concluir" habilitava ao copiar e **voltava a desabilitar 2 s depois**; o dialog re-bloqueava a saída de quem já havia copiado. Um clone de página-modelo herda esse padrão sem perceber.
**Regra**: separe sempre **dois** estados — o permanente ("já cumpriu o passo": `jaCopiou`/`confirmou`, nunca resetado por timer) e o transitório ("mostrando o feedback": `mostrandoCheck`, esse sim com `setTimeout`). A permissão de fluxo (`podeConcluir`, `bloquearSaida`) deriva **só** do permanente. O `setTimeout` toca **apenas** o feedback visual (ícone + `aria-live`), nunca a habilitação de controles.
**Origem**: algar/EVALUATION UX#1/R-01 da rodada bypass-seguranca-integrador (22/07/2026)
