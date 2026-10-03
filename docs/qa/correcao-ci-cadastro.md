# Reteste do smoke — confirmação de senha fora da área visível

Data: 03/10/2026. Execução GitHub
[37127933080](https://github.com/Sette0o0/VitalisTrack/actions/runs/37127933080),
commit `cf81ec540a53fc811d0f39c81b0e323b59ad8e5f`, Maestro 2.11.0,
AVD Pixel 2 / API 36 / Google APIs / x86_64.

O emulador iniciou e o APK release foi instalado. O smoke falhou ao tocar
`auth-confirm`, depois de preencher nome, e-mail e senha.

O artefato `android-qa` (ID 11275334268) foi obtido pela integração GitHub.
A [captura original](evidence/maestro-37127933080/auth-confirm-keyboard.png)
mostra Senha focada, parcialmente coberta pelo teclado. A hierarquia
visível contém `auth-name`, `auth-email` e `auth-password`, sem
`auth-confirm`. O [resumo da evidência](evidence/maestro-37127933080/failure-summary.json)
preserva os bounds, estados dos comandos e hashes de captura/APK.

O identificador existe no componente de cadastro e é encaminhado ao
TextInput do Paper. O fluxo tocava diretamente no próximo campo sem
ocultar o teclado ou rolar. Foi ajustado para ocultar o teclado após cada
entrada e executar `scrollUntilVisible` antes de tocar em cada campo e
no botão de cadastro. A confirmação continua obrigatória e nenhum passo
foi tornado opcional.

A CI agora concentra capturas, hierarquias e logs do Maestro em
`artifacts/maestro`, incluído no upload mesmo quando o smoke falha.

Verificações locais: YAML do flow/workflow válido; identificadores
correspondem ao cadastro; sequência de ocultar teclado/rolar verificada;
os quatro testes RNTL de formulários/atalhos passaram; `git diff --check`
passou. **O smoke corrigido ainda não foi executado no Android.**

O APK da execução foi preservado localmente em
`artifacts/android/github-37127933080/app-release.apk` (ignorado pelo Git).
Ele é evidência do build anterior, não um APK aprovado. Retestar o flow
com a correção e obter cadastro, hidratação, reinício offline e logout
concluídos antes de aprovar US-009/US-065 ou a sprint.

Referências: [scrollUntilVisible](https://docs.maestro.dev/reference/commands-available/scrolluntilvisible),
[hideKeyboard](https://docs.maestro.dev/reference/commands-available/hidekeyboard)
e [artefatos do Maestro](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts).
