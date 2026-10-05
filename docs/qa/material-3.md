# Checklist Material 3 e acessibilidade

Atualização: [retestes de 04/10/2026](correcoes-sprint-1-2026-10-04.md), APK final `451715f4…`, API 24/36. As caixas integrais abaixo continuam abertas: amostras positivas não aprovam todas as telas e estados.

Os itens de implementação foram revisados em código. A [captura Android do cadastro](evidence/maestro-37127933080/auth-confirm-keyboard.png) mostra a tela clara e a falha do smoke com teclado aberto. Os itens de aprovação Android permanecem pendentes; essa captura isolada não aprova geometria de toque, fonte ampliada, temas ou TalkBack.

Na [execução local inicial em API 36 de 03/10/2026](testes-android-local-2026-10-03.md), foi reproduzido D-12: chips com contêiner de 48 dp e área clicável de 32 dp. O [reteste com OpenStreetMap](reteste-filtros-openstreetmap-2026-10-03.md) confirmou a correção: os quatro filtros têm área clicável real de 48 dp e respondem na borda inferior com fontes 100% e 150%. Mapa, rota e créditos também foram verificados no APK próprio. TalkBack, API 24, outros controles com fonte ampliada e a matriz completa continuam pendentes.

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

Evidências adicionais previstas: `artifacts/android/capturas/API-TEMA-FONTE-TELA.png`, logs e preenchimento dos 89 critérios. A captura atual registra D-11; retestes visuais completos permanecem pendentes. Referências: [Paper MD3](https://oss.callstack.com/react-native-paper/docs/guides/theming) e [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps).

## Amostras da versão final em 04/10

- API 24: Água/fonte 100% com valor, meta, erro, edição/exclusão; perfil escuro/fonte 200% e rolagem do formulário; seleção/recorte de foto, prévia offline/reinício, nascimento futuro bloqueado.
- API 36: perfil/Foto escuros; refeições com teclado, criação/edição/exclusão offline e aviso; peso com linha/barras e duas semanas; descrição nativa de tendência e lista com 1.000 itens.
- Voltar e calendário de nascimento corrigidos para 48 dp. [Bounds atuais](evidence/correcoes-sprint1-2026-10-04/touch-targets.json) incluem apenas controles integralmente visíveis; elementos cortados pela rolagem não são usados para medir alvos.

Capturas/XML estão no [índice final](evidence/correcoes-sprint1-2026-10-04/README.md). Rótulo presente no XML não comprova leitura auditiva, ordem completa de foco nem anúncios de todos os estados pelo TalkBack. Essas verificações, contraste de todas as combinações, tamanho de exibição, navegação em ambos os modos e matriz integral fonte 100/130/200% ainda exigem execução.

Amostras adicionais em celular API 34: cadastro, hidratação, nascimento futuro, foto e reinício/relogin; [evidências](evidence/correcoes-sprint1-2026-10-04/physical-api34/README.md). TalkBack auditivo completo e matriz de todos os estados permanecem abertos.
