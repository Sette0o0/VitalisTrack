# Reteste da CI — lockfile do prebuild Android

Data: 03/10/2026. Node local: 24.19.0. pnpm: 11.19.0.

O erro informado no GitHub foi reproduzido em `app/` com
`pnpm install --lockfile-only --frozen-lockfile --offline --ignore-scripts`.
A verificação encontrou 1.069 entradas no lockfile e terminou com
`ERR_PNPM_OUTDATED_LOCKFILE`, listando as mesmas 11 dependências ausentes.

O workspace aninhado `app/pnpm-workspace.yaml` fazia o pnpm selecionar
`app/pnpm-lock.yaml`, anterior às dependências da sprint. A instalação na
raiz passava, mas não detectava essa configuração duplicada. Ambos os
arquivos aninhados foram removidos; app, contratos e servidor passam a
compartilhar somente o workspace e o lockfile da raiz.

Retestes após a correção, executados em `app/`:

- `CI=1 pnpm install --lockfile-only --frozen-lockfile --offline --ignore-scripts`:
  passou, reconhecendo os quatro projetos do workspace.
- `CI=1 pnpm exec expo prebuild --platform android --no-install`:
  passou, reconhecendo os quatro projetos, sem mudanças no manifest de
  dependências e com `Finished prebuild`.
- YAML dos workflows `CI` e `Android QA`: válido; ambos verificam a
  instalação congelada a partir de `app/` antes dos demais comandos.
- As resoluções do lockfile compartilhado permaneceram iguais. A mudança
  automática de formatação do pnpm foi removida após comparar o conteúdo
  YAML com a versão existente.

`--frozen-lockfile` permanece habilitado na CI. Nenhuma versão de pacote
foi alterada e não foi usado `--no-frozen-lockfile` para contornar o erro.
Esta execução local valida o prebuild; não compila ou aprova o APK.
O workflow no GitHub deve ser executado novamente com a correção; não foi
disparado nesta verificação.
