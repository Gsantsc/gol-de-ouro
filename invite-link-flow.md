# Invite Link Flow

## Grupo/Liga

1. Usuário aprovado cria uma liga.
2. Banco gera `invite_code`, `invite_token`, `invite_url`, `invite_created_at` e `invite_active`.
3. UI mostra o link gerado e ações de copiar/compartilhar.
4. Regenerar link troca token/código e invalida o link anterior.
5. Desativar link marca `invite_active = false`.
6. Entrada por link usa `/join/group/:invite_token`.

## App

1. Usuário aprovado clica em convidar amigo.
2. Banco cria registro em `app_invites` com token não previsível e URL única.
3. UI mostra o link e ações de copiar/compartilhar/revogar.
4. Link usa `/invite/app/:invite_token`.
5. Usuário convidado sem conta segue para cadastro e mantém status pending até aprovação.
6. Convite aceito atualiza `status = accepted` quando o usuário autenticado usa o token.
