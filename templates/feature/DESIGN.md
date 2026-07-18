# Design: [Nome da Feature]

**Criado por**: UX/UI
**Data**: YYYY-MM-DD
**Baseado em**: SPEC.md

> Fonte de verdade visual. **Budget: ≤250 linhas** — telas repetidas referenciam a primeira em vez de duplicar seções. O Dev Frontend não toma nenhuma decisão de design por conta própria — tudo o que ele precisa está aqui. Componentes e tokens concretos vêm do design system do projeto (`specs/STACK.md`).

---

## Telas Envolvidas

- [Nome da Tela 1] — `/rota-1` (nova | modificada)
- [Nome da Tela 2] — `/rota-2` (nova | modificada)

---

## [Nome da Tela 1]

**Rota**: `/rota`
**Acesso**: Autenticado | Público | `PERMISSAO/read`
**Navegação**: Grupo [X] → entre [Item A] e [Item B], ícone `[NomeIcone]`

### Layout

```
┌─────────────────────────────────────────┐
│ Título da Página              [+ Novo]  │
├─────────────────────────────────────────┤
│ [Filtro A]  [Filtro B]  [Buscar]        │
├─────────────────────────────────────────┤
│ Col A | Col B | Col C | Ações           │
│ val1  | val2  | val3  | [✏] [🗑]       │
└─────────────────────────────────────────┘
```

> Descrever em palavras o que o wireframe não captura (alinhamento, proporções, comportamento responsivo, sticky header, etc.)

### Tipografia e Hierarquia

| Elemento | Token/classe (do design system do projeto) |
|---|---|
| Título da página | [ex.: `text-2xl font-bold`] |
| Subtítulo de seção | [...] |
| Labels de form | [...] |
| Texto de tabela | [...] |
| Texto auxiliar | [...] |

### Espaçamento

| Contexto | Token |
|---|---|
| Entre seções | [...] |
| Entre campos de form | [...] |
| Padding de container | [...] |

### Componentes Utilizados

| Componente (design system) | Configuração | Onde |
|---|---|---|
| [Card/container] | padrão | container da listagem |
| [Modal/Dialog] | padrão | formulário de criação/edição |
| [Button primário] | [...] | ação primária |
| [Button destrutivo] | [...] | excluir |
| [Badge/status] | [...] | estado do item |

### Estados de UI

| Estado | Comportamento |
|---|---|
| Carregando | [spinner/skeleton + texto] |
| Lista vazia | Ícone `[X]` + `"Nenhum [entidade] encontrado"` + botão de ação primária |
| Erro de API | [toast/alerta destrutivo] com mensagem do backend |
| Sucesso criar | [feedback] + lista atualizada |
| Sucesso editar | [feedback] + lista atualizada |
| Sucesso excluir | [feedback] + item some da lista |

### Comportamentos Interativos

- **[+ Novo]**: abre [modal] com formulário vazio
- **[Editar]**: abre o mesmo [modal] preenchido
- **[Excluir]**: confirmação destrutiva; ao confirmar, remove e exibe feedback
- **Fechar sem salvar**: limpa o formulário, não persiste nada
- **[Campo B] depende de [Campo A]**: quando A muda, B é resetado e recarregado

### Validações Visíveis no Formulário

| Campo | Obrigatoriedade | Regra de validação |
|---|---|---|
| [Campo A] | Obrigatório (`*`) | mín. 2 caracteres |
| [Campo B] | Obrigatório (`*`) | deve selecionar uma opção |
| [Campo C] | Opcional | máx. 500 caracteres |
| [Campo D] | Condicional (`*` quando X) | só aparece quando [Campo A] = "valor" |

### Acessibilidade

- Todos os inputs têm label associado
- Botões de ícone têm `aria-label` descritivo
- Tab order: sequência natural dos campos
- Contraste legível em todos os textos

---

## [Nome da Tela 2] (se houver)

> Repetir a mesma estrutura acima para cada tela adicional.

---

## Notas de Consistência

> Desvios intencionais do padrão existente (com justificativa) ou pontos de atenção para o Dev Frontend.

- [Ex.: "Esta tela usa painel lateral em vez de modal porque o formulário é longo"]
