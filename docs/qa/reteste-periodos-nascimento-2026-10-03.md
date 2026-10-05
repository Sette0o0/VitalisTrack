# Períodos e nascimento — 03/10/2026

Reteste no POCO X5 5G, Android 14/API 34, fonte 100%, tema escuro e app debug 1.0.0 atualizado pelo Metro via USB. APK instalado pelo Android Studio, SHA-256 `eb5b17bb6aac678f21cca04217c74379209cdd349dc6a14b77c193ee2a98acfe`. Metro e API local acessíveis pelo redirecionamento USB existente.

Atividades e Alimentação abrem com os últimos sete dias. Os atalhos Hoje, 7 dias, 30 dias e Todas as datas coexistem com o intervalo personalizado. O diálogo oferece Período, com início e fim inclusivos, ou Um dia. As datas só são aplicadas ao confirmar; cancelar descarta o rascunho e intervalos invertidos bloqueiam a aplicação. Os chips mantêm área de toque de 48 dp.

O resumo de atividades corresponde aos registros filtrados; passos correspondem ao período. Alimentação apresenta contagem e calorias do período junto da lista, incluindo a data brasileira em cada registro. O card da meta diária permanece explicitamente como Resumo de hoje. A ordenação não altera os arrays armazenados no estado.

Nascimento aceita digitação numérica com máscara `dd/mm/aaaa` e oferece seletor nativo com dia, mês e ano separados. O ano pode ser digitado diretamente. Datas impossíveis, incompletas e futuras continuam rejeitadas pela validação; uma entrada inválida não salva silenciosamente o valor anterior. O banco e a API continuam recebendo datas ISO válidas.

| Cenário | Resultado |
|---|---|
| Nascimento no Poco | Ícone abriu seletor com três colunas editáveis. Ano alterado diretamente de 2026 para 2000; Cancelar preservou o campo anterior. Nenhum perfil salvo no aparelho. |
| Um dia no Poco | Escolhido 08/04/2026, aplicado o filtro e encontrado o registro existente nessa data. |
| Período no Poco | Aplicado 02/04/2026 a 08/04/2026; registro na extremidade final permaneceu incluído e o resumo acompanhou a seleção. |
| Atalhos no Poco | Hoje excluiu a atividade antiga; Todas as datas voltou a incluí-la. |
| Alimentação no Poco | 7 dias e Todas as datas exibiram a refeição existente e o total correspondente. Resumo de hoje permaneceu com o consumo diário. |
| Intervalos automatizados | Inclusão das extremidades, seleção de um dia, cancelamento, intervalo invertido, presets e viradas de mês/ano e ano bissexto passaram. |
| Nascimento automatizado | Máscara, seletor separado, cancelamento, rejeição de data impossível e salvamento de nascimento antigo em ISO passaram. |
| Regressões automatizadas | Filtro de refeições preservou o resumo diário e a ordem dos registros armazenados; formulários existentes continuaram passando. |

A atualização por Fast Refresh preservou o antigo estado local da tela Alimentação, que era uma string de data antes da troca para intervalo. Selecionar 7 dias iniciou o novo intervalo; o estado inicial atual é coberto pelo teste de montagem da tela. Este reteste usou o processo já autenticado e não repetiu a entrada biométrica após reinício.

Validação: **142 testes em 21 suítes** passaram na execução completa. Após o ajuste dos rótulos no singular, os **17 testes relacionados em três suítes**, TypeScript, ESLint e `git diff --check` passaram. Log filtrado do processo Android sem erros ReactNativeJS/AndroidRuntime. App deixado no início, sem diálogo ou teclado aberto. Nenhum registro de saúde ou perfil foi criado, editado ou excluído no aparelho. Capturas e hierarquias pessoais permanecem em `/tmp/vitalis-cards-keyboard-20261003`, fora do repositório. Fonte ampliada, TalkBack, demais APIs Android e iOS não foram retestados nesta execução.
