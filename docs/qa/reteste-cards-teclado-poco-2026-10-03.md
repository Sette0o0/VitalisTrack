# Reteste de cards e teclado — 03/10/2026

Correções verificadas no POCO X5 5G (22111317PG), Android 14/API 34, resolução 1080 × 2400, fonte 100% e tema escuro. App debug 1.0.0, target SDK 36, conectado aos servidores locais por USB. O JavaScript atualizado foi carregado pelo Metro; o APK nativo permaneceu o instalado pelo Android Studio.

SHA-256 do APK instalado: `eb5b17bb6aac678f21cca04217c74379209cdd349dc6a14b77c193ee2a98acfe`.

O componente compartilhado `Card` aceita toque na sua área inteira. No início, água abre Hidratação e calorias abre Alimentação. O botão interno de alimentação foi substituído por texto, mantendo uma única ação de toque no card.

O `Screen` agora usa `KeyboardAvoidingView` com comportamento `height` no Android. O login usa esse ajuste compartilhado. As janelas de água e metas de alimentação usam `FormDialog`, com ajuste ao teclado dentro do Portal, conteúdo rolável e ações que podem quebrar linha.

| Cenário | Resultado observado |
|---|---|
| Card de calorias | Toque próximo ao topo, em (74, 1530), abriu Alimentação. A área clicável cobre o card, em vez de apenas o botão interno anterior. |
| Card de água | Toque no centro, em (540, 1259), abriu Hidratação. |
| Campo Calorias antes | Campo em y=1580–1712 parcialmente coberto pelo teclado, que começa em y=1641. |
| Campo Calorias após | Subiu automaticamente para y=1509–1641, ficando inteiro visível. Digitação confirmada. |
| Rolagem com teclado aberto | Campo em y=1234–1366 e botão Salvar refeição em y=1410–1542, ambos acima do teclado. |
| Janela de metas | Segundo campo em y=873–1005 e ações em y=1096–1228 com teclado aberto. Cancelamento funcionou pelo toque. |
| Janela de água | Campo em y=780–912 e ações em y=1003–1135 com teclado aberto. Cancelamento funcionou pelo toque. |
| Retorno ao início | Teclado fechado, layout restaurado e resumo preservado. Formulários de teste fechados sem salvar. |

Validação automatizada: 103 testes em 17 suítes passaram; TypeScript, ESLint e `git diff --check` passaram. Sem erros ReactNativeJS/AndroidRuntime no log filtrado do processo durante o reteste. Capturas e hierarquias locais: `/tmp/vitalis-cards-keyboard-20261003`.
