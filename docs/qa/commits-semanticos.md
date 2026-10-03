# Commits semânticos — Sprint 1

Base `7ce5161`, branch `codex/sprint-1-quality`. Os commits foram criados ao longo das correções, com staging revisado e verificações pertinentes.

| Commit | Descrição |
|---|---|
| `2ffebf3` | `fix(auth): renova a sessão antecipadamente e protege rotas` |
| `5f215c9` | `fix(sync): persiste fila atomicamente e isola dados por conta` |
| `cf2fcad` | `fix(validation): compartilha schemas e prepara controles Material 3` |
| `c69d2cd` | `fix(history): calcula janelas completas e preserva segundos e datas` |
| `3913bc7` | `fix(gps): restaura treino e exclui deslocamentos durante pausas` |
| `d98e83a` | `fix(validation): rejeita timestamps inválidos em rotas e mutações` |
| `e542bb8` | `fix(sync): preserva dados pendentes e limita transações concorrentes` |
| `417e636` | `feat(ui): padroniza telas Android com Material 3` |
| `64f7b4c` | `fix(a11y): identifica destinos na navegação inferior` |
| `e1c52e4` | `test(qa): adiciona smoke Android e retestes da sprint 1` |
| `18da156` | `fix(sync): serializa escritas de treino e fila no SQLite` |
| `a7fda1d` | `fix(ui): amplia acesso ao cadastro com botão Material 3` |

O commit `docs(qa): registra matriz e evidências da sprint 1` inclui este arquivo e os relatórios. Seu hash deve ser consultado por `git log --reverse --oneline 7ce5161..HEAD`; a lista acima contém os commits anteriores à criação da documentação final.

As alterações iniciais de navegação/SafeArea e formulários relacionadas à sprint foram preservadas e integradas. `README.md`, `.idea/` da raiz e `package-lock.json` preexistentes permanecem fora dos commits. A cópia de segurança inicial está em `/tmp/vitalis-sprint1-baseline/`. Nenhum push/PR foi realizado.
