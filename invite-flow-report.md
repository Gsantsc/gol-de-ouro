# Invite Flow Report - 2026-06-06

## Grupo/Liga

Implementado:

- `groups.invite_token`
- `groups.invite_url`
- `groups.invite_created_at`
- `groups.invite_expires_at`
- `groups.invite_active`
- RPC `regenerate_group_invite`
- RPC `deactivate_group_invite`
- `join_group_by_invite` aceita token/URL e bloqueia link inativo/expirado.

Validado:

- Link antigo rejeitado após regeneração.
- Link novo funciona.
- Link inativo bloqueia entrada.
- UI não permite editar link manualmente.

## Convite Do App

Implementado:

- Tabela `app_invites`.
- RPC `create_app_invite`.
- RPC `accept_app_invite`.
- RPC `revoke_app_invite`.
- URL `/invite/app/:invite_token`.

Validado:

- Convite criado com URL única.
- Convite aceito.
- Convite revogado.
