# Reteste da CI — bundle release e Expo Router

Data: 03/10/2026. Expo 54.0.37; Expo Router 6.0.24;
babel-preset-expo 54.0.12; Node local 24.19.0; pnpm 11.19.0.

O log enviado do GitHub confirma que o prebuild passou. A tarefa
`:app:createBundleReleaseJsAndAssets` falhou com
`Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT`.

O workflow herdava `NODE_ENV=test` para todo o job. O plugin do Router no
preset instalado verifica esse valor e omite a transformação da raiz das
rotas em testes. A etapa `export:embed`, usada pelo Gradle, mantém um
`NODE_ENV` já definido. O comando abaixo, executado em `app/` com
`NODE_ENV=test BABEL_ENV=test CI=1`, reproduziu o mesmo erro, após 952
módulos e 17.791 ms de bundling:

```bash
pnpm exec expo export:embed --platform android --dev false \
  --bundle-output /tmp/vitalis-ci-router-before/index.android.bundle \
  --assets-dest /tmp/vitalis-ci-router-before/assets \
  --sourcemap-output /tmp/vitalis-ci-router-before/index.android.bundle.map
```

O workflow agora define `NODE_ENV=production` e `BABEL_ENV=production`
somente nas etapas de bundle/build release. `NODE_ENV=test` permanece na
API de QA. O script local de build também define os dois valores de
produção. `ANDROID_QA=true` e a URL `http://10.0.2.2:3000` continuam
configurando o APK de QA independentemente do modo de compilação.

Uma etapa de bundle antes do Gradle detecta falhas JavaScript sem esperar
pela compilação de todas as bibliotecas nativas. Seu comando foi executado
localmente com `NODE_ENV=production BABEL_ENV=production CI=1`:

```bash
pnpm exec expo export:embed --platform android --dev false \
  --minify false --max-workers 2 \
  --bundle-output ../artifacts/android/index.android.bundle \
  --assets-dest ../artifacts/android/assets \
  --sourcemap-output ../artifacts/android/index.android.bundle.map
```

Resultado: **passou**, com 1.827 módulos, 27 assets e 33.927 ms de
bundling. O bundle não contém a expressão não transformada
`process.env.EXPO_ROUTER_APP_ROOT`; o source map inclui login, início e
treino GPS. YAML e escopo das variáveis do workflow foram verificados;
`bash -n scripts/build-android-qa.sh` e `git diff --check` passaram.

Não foi necessário mudar o ponto de entrada, adicionar o plugin Babel
legado ou fixar manualmente o caminho das rotas. Não houve mudanças nas
dependências. O reteste comprova a correção da etapa de bundle; o build do
APK e o workflow completo no GitHub ainda precisam de nova execução.

Referência: [variáveis de ambiente e NODE_ENV no Expo](https://docs.expo.dev/guides/environment-variables/#environment-variables-and-node_env).
