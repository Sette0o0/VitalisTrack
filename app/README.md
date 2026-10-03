# VitalisTrack — aplicativo mobile

Cliente React Native/Expo 54 integrado à API VitalisTrack. A aplicação é Android-first e usa SQLite para cache e fila offline, SecureStore para a sessão, sensores para passos e localização real para atividades ao ar livre.

## Executar

Execute os comandos abaixo em `app/`. O pnpm usa o workspace e o
`pnpm-lock.yaml` da raiz do repositório, incluindo `@vitalis/contracts`.
As dependências de todos os pacotes são instaladas juntas; mantenha apenas
esse lockfile compartilhado.

```bash
pnpm install --frozen-lockfile
ANDROID_QA=true pnpm android
```

Esse comando gera e instala um build Android próprio com Metro. O mapa usa MapLibre e tiles HTTPS do OpenStreetMap, sem chave do Google ou cadastro em um provedor. O módulo nativo exige recompilar o APK; ele não está incluído no Expo Go. Para repetir o desenvolvimento após instalar o APK debug, use `pnpm start` e pressione `a`.

Os créditos do OpenStreetMap ficam visíveis no mapa. As requisições identificam o VitalisTrack e usam o cache nativo; não há download de regiões offline. O GPS e o salvamento do treino continuam independentes da conexão do mapa. O servidor público de tiles tem capacidade limitada e disponibilidade sem garantia; siga a [política de uso do OSM](https://operations.osmfoundation.org/policies/tiles/) e use infraestrutura própria ou outro provedor ao ampliar o tráfego.

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
