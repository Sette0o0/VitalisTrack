# Formato brasileiro e biometria — 03/10/2026

Reteste no POCO X5 5G, Android 14/API 34, fonte 100%, tema escuro e app debug 1.0.0 com JavaScript atualizado pelo Metro via USB. APK nativo instalado pelo Android Studio, SHA-256 `eb5b17bb6aac678f21cca04217c74379209cdd349dc6a14b77c193ee2a98acfe`.

Datas apresentadas como `dd/MM/yyyy`, sem conversão de fuso horário. Números usam `pt-BR`: vírgula decimal e ponto de milhar. Campos editáveis carregam vírgula, sem separador de milhar nem arredondamento. Peso, IMC, altura, quantidades, calorias, água, passos, distâncias, duração e comparação semanal usam os formatadores compartilhados. Datas permanecem ISO e medidas permanecem números no banco e na API.

O parser aceita `70,5`, `1.000,50` e `1.000`, além do ponto decimal sem agrupamento para entradas antigas como `12.5`. Na ambiguidade `1.234`, prevalece o milhar brasileiro; um decimal dessa precisão deve ser digitado `1,234`. Agrupamentos incorretos e formatos misturados são rejeitados.

| Cenário | Resultado |
|---|---|
| Perfil no aparelho | Peso, altura e IMC mostrados com vírgula decimal. |
| Atividades no aparelho | Registro exibido como `08/04/2026 · 0,00 km · 0,2 min · 2 kcal`. Resumo também com vírgula. |
| Edição de refeição em RNTL | Quantidade `100,25` e data `08/04/2026`; preservado o valor numérico original. |
| Formatadores e parser | Datas reais/bissextas, milhares, negativos, casas decimais, entradas inválidas e ida/volta de valores sem perda testados. |
| Ativação biométrica no aparelho | Controle em Perfil abriu prompt nativo com título em português. Cancelamento manteve a opção de ativar e mostrou erro em português. Usuário confirmou sua digital e o controle passou a Desativar biometria. |
| Reinício do processo | App foi encerrado com `am force-stop` e aberto novamente. Mostrou login com campos vazios e botão Entrar com biometria; o resumo não abriu automaticamente. |
| Entrada com digital no aparelho | Botão abriu prompt nativo. Após confirmação do usuário no sensor lateral, app abriu o início com resumo preservado. |
| Segurança/regressões automatizadas | Cancelamento, ausência/alteração de digital, renovação silenciosa, troca de conta, logout, sessão revogada, logout durante prompt e restauração offline testados. |

A implementação usa o `expo-secure-store` já integrado ao app, com uma prova vinculada à conta protegida por `requireAuthentication` e serviço próprio de chave. A leitura dessa prova exige confirmação biométrica nativa antes de disponibilizar a sessão salva. Tokens continuam no armazenamento seguro existente e podem ser renovados durante uma sessão aberta sem novo prompt. Nenhuma senha é armazenada para esse acesso. Isso atende ao fluxo de US-011 usando a integração nativa do Expo, em lugar da biblioteca `react-native-biometrics` mencionada originalmente na wiki.

Biometria é opcional e ativada após login no Perfil. Protege a entrada após iniciar um novo processo do app; retorno rápido a um processo já autenticado mantém a sessão existente. Sair da conta, troca de usuário ou revogação elimina esse acesso. Senha permanece como alternativa. A configuração de Face ID foi adicionada ao plugin para builds iOS futuros; iOS não foi retestado.

Validação final: **132 testes em 19 suítes**, TypeScript, ESLint e `git diff --check` passaram. Log filtrado do processo Android sem erros ReactNativeJS/AndroidRuntime. App deixado no início, teclado fechado e biometria ativada pelo usuário. Nenhum registro de saúde foi criado, editado ou excluído no aparelho. Capturas/hierarquias pessoais permanecem somente em `/tmp/vitalis-cards-keyboard-20261003`, fora do repositório.
