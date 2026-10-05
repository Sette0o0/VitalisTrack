# Reteste adicional no celular — API 34

Android 14/modelo 22111317PG, release ARM64 1.0.0 `10fe589f…`, pacote separado com.vitalistrack.qa. O app anterior com.vitalistrack.app e seus dados foram preservados. Conta sintética exclusiva.

[Checks](checks.json) e [servidor sem tokens](server.json): cadastro/Home; três atalhos de água somaram 1.700 mL; nascimento futuro bloqueado com peso/altura válidos; seleção/recorte de PNG conhecido; prévia sobreviveu a force-stop com API indisponível; reconexão gerou uma operação de avatar, sem duplicação; foto permaneceu após novo login. [Refresh real](http.jsonl) às 18:02:37 UTC, cerca de 59,5 s antes da expiração, sem login.

Dez aberturas por tela, cache carregado + layout + dois frames: [Home máximo 2.207 ms](startup-home.json), [login 1.752 ms](startup-login.json). Só se leem logs do PID de QA.

A indisponibilidade foi produzida retirando apenas o túnel da API de QA, sem alterar a rede pessoal. Transporte USB não certifica 4G+. TalkBack integral, caminhada real, fonte/temas e matriz visual integral permanecem pendentes. A identidade do Google não foi incluída nas evidências; o pedido para salvar credenciais de QA foi recusado. A imagem em Download foi criada exclusivamente para este reteste.

## Recuperação para a apresentação

[Incidente e reteste em 04/10](recuperacao-apresentacao-2026-10-04/checks.json): contêiner de QA ausente causou erro interno. Volume disponível tinha apenas o esquema; conta sintética e registros conhecidos restaurados com o mesmo UUID. Novo login reutilizou o cache e a fila; foto/JSON/pull retornaram 200 e o Perfil mostrou Dados sincronizados. As evidências anteriores desta página permanecem históricas.
