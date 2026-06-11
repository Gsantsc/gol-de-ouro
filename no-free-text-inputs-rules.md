# No Free Text Inputs Rules

Campos que impactam pontuação, ranking, status, convite, grupo ou liga não devem aceitar texto livre.

## Regras

- Jogadores sempre por `PlayerPicker`.
- Booleanos sempre por controle Sim/Não.
- Vencedor sempre por controle segmentado.
- Campeonato sempre por select/lista.
- Convite sempre gerado por serviço/banco.
- Busca pode usar texto porque não persiste regra de negócio.
- Nome de liga/grupo pode usar texto porque é conteúdo definido pelo usuário.

## Comentários de arquitetura

- `NO FREE TEXT PLAYER INPUT`
- `PLAYER PICKER CONTROLLED FIELD`
- `CONTROLLED PREDICTION FIELDS`
- `UNIQUE GROUP INVITE LINK`
- `UNIQUE APP INVITE LINK`
