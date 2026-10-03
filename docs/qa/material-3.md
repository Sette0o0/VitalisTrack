# Checklist Material 3 e acessibilidade

Os itens de implementação foram revisados em código. Os itens Android permanecem pendentes; não foram observadas telas reais do aplicativo nesta execução.

## Implementação verificada

- [x] Paper 5 com MD3LightTheme/MD3DarkTheme; cores Vitalis e temas de navegação adaptados.
- [x] Preferência sistema/claro/escuro persistida por conta.
- [x] Appbar e BottomNavigation.Bar; texto Paper com variantes de tipografia.
- [x] Botões MD3 e indicadores de carregamento; campos outlined e HelperText; cards/Surface, Portal/Dialog, RadioButton/SegmentedButtons e FAB.
- [x] DateTimePickerAndroid para calendário e horário; nascimento com máximo na data atual.
- [x] Botões/ícones/seletores com dimensões mínimas configuradas de 48 dp; data/horário de 52 dp; tipo de atividade em linhas para acomodar rótulos.
- [x] Campos de data/hora e peso/altura em coluna; cartões e ações com wrap quando necessário.
- [x] Screen usa insets e rolagem; teclado Android em resize; diálogos bloqueiam fechamento enquanto salvam.
- [x] Rótulos de ícones, valores acessíveis de barras/anéis e dados textuais de gráficos; mensagens de erro relevantes com live region.
- [x] 22 pares de texto/fundo dos tokens claro/escuro atendem contraste ≥ 4,5:1 nos testes.
- [x] Loading, erro, offline, pendência, lista vazia, IMC indisponível e dados ausentes representados.
- [x] Voltar tem fallback de rota; treino confirma saída salvando pausa.

## Aprovação no APK — executar em API 24 compacto e API 36

- [ ] Capturar todas as telas e estados nos temas claro/escuro/sistema.
- [ ] Conferir insets de status/navigation bars com gestos e três botões.
- [ ] Conferir fonte 1,0/1,3/2,0 e configuração de tamanho de exibição ampliada; não aceitar cortes/sobreposições.
- [ ] Medir as áreas reais de toque ≥ 48 × 48 dp, inclusive ícones, seleção de unidade/período, tabs, limpar filtro e ações de diálogo.
- [ ] Abrir/fechar teclado em cada formulário; campo focado, erro e ação de salvar devem permanecer acessíveis.
- [ ] Abrir calendário/horário; confirmar/cancelar, nascimento futuro bloqueado e filtro limpo.
- [ ] Testar TalkBack: ordem de foco, nomes, estados selecionados/desabilitados, anúncio de erro/loading e valores dos anéis/gráficos.
- [ ] Conferir foco do diálogo, retorno ao controle de origem e bloqueio de múltiplos envios.
- [ ] Testar acesso por navegação física/gesto Voltar, deep link e reinício sem sessão.
- [ ] Conferir contraste renderizado, ícones/contornos, gráficos e texto sobre todos os cartões e estados.
- [ ] Validar loading com API lenta, erros de validação, API indisponível, modo avião, lista vazia e reconexão.
- [ ] Verificar fotos, mapa, marcadores/polilinhas e permisos nativos em APK próprio.
- [ ] Conferir lista virtualizada com 1.000 atividades: ordenação, busca, rolagem e abertura de edição.

Evidências previstas: `artifacts/android/capturas/API-TEMA-FONTE-TELA.png`, logs e preenchimento dos 89 critérios. Nenhuma captura do app foi obtida. Referências: [Paper MD3](https://oss.callstack.com/react-native-paper/docs/guides/theming) e [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps).
