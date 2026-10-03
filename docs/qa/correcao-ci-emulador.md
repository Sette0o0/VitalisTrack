# Reteste da CI — perfil de hardware do emulador

Data: 03/10/2026.

O log enviado do GitHub interrompeu a criação do AVD com
`No device found matching --device pixel_8`. O `avdmanager` daquele
runner não oferece esse perfil. Os avisos sobre XML aparecem antes,
mas a falha determinante é o perfil ausente. O erro de conexão ao
encerrar o emulador é posterior: o AVD não chegou a ser iniciado.

O workflow passou a usar `profile: pixel_2`. Android API 36, Google APIs,
x86_64, KVM e os comandos de instalação/teste permanecem configurados.
O perfil de hardware não determina a versão do Android do system image.

Verificação local com SDK Command-line Tools 22.0:

- `avdmanager list device -c` contém `pixel_2`.
- `avdmanager create avd` criou o AVD temporário
  `Vitalis_CI_Pixel2_API36` em `/tmp`, com saída zero.
- O `config.ini` gerado corresponde ao perfil, arquitetura e API do
  workflow. Veja a [configuração observada](evidence/android-avd-pixel2.txt).
- YAML do workflow e `git diff --check` passaram.

O SDK local também emitiu mensagens sobre arquivos `devices.xml`
ausentes em alguns system images, mas criou a configuração do AVD.
Não houve boot ou execução Maestro local. Este reteste não reproduz a
versão antiga do SDK do runner; a execução completa no GitHub continua
necessária para confirmar boot, instalação do APK e smoke.

Referência: [configuração de profile e inventário com avdmanager na action](https://github.com/ReactiveCircus/android-emulator-runner#configurations).
