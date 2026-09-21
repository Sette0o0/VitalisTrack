# VitalisTrack — aplicativo mobile

Cliente React Native/Expo 54 integrado à API VitalisTrack. A aplicação é Android-first e usa SQLite para cache e fila offline, SecureStore para a sessão, sensores para passos e localização real para atividades ao ar livre.

## Executar

```bash
pnpm install
pnpm start
```

No terminal do Expo, pressione `a` para abrir no Android/Expo Go.

## Verificações

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Fluxos incluídos

- login, cadastro e renovação segura de sessão;
- resumo diário compartilhado;
- hidratação com meta e CRUD;
- alimentação com metas, alertas e CRUD;
- atividades manuais, histórico e treino com GPS/mapa;
- perfil, idade, IMC, meta e evolução de peso;
- painel de progresso diário, semanal e mensal;
- tema claro e escuro.
- operação offline com sincronização automática.

Consulte o `README.md` da raiz para iniciar o PostgreSQL, a API e configurar `EXPO_PUBLIC_API_URL`.
