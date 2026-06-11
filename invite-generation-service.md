# Invite Generation Service

## Banco

Convites são gerados por funções RPC no Supabase:

- `create_group`
- `regenerate_group_invite`
- `deactivate_group_invite`
- `create_app_invite`
- `revoke_app_invite`
- `accept_app_invite`

## URL

O front envia `app_base_url` para as RPCs. Em produção, usar `NEXT_PUBLIC_APP_URL` ou domínio padrão. Em ambiente local, usar a origem atual, por exemplo `http://localhost:3000`.

## Segurança

Tokens são criados com `gen_random_bytes`, não usam ID sequencial e são persistidos com índice único.
