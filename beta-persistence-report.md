# Beta fechado - persistencia

Data: 2026-06-06

## Resultado

Status: aprovado para beta local.

## Persistencia validada

- Cadastro e perfil: `users` via `ensure_user_profile`.
- Aprovacao e bloqueio: `users.status`, `users.approval_status`, `users.blocked`.
- Login: `record_user_login` atualiza atividade do usuario.
- Palpites: `predictions` persiste placar, vencedor, ambos marcam, cartao vermelho e IDs de jogadores.
- Ranking: `rankings` atualizado apos pontuacao.
- Ligas: `groups` e `group_members`.
- Convites: `groups.invite_token`, `groups.invite_url`, `app_invites`.
- Feedback beta: `app_feedback` com trilha em `audit_logs`.
- Auditoria de palpites: `prediction_audit_logs`.

## Evidencia executada

- `npm run qa:user-flow`: aprovado.
- `artifacts/qa-user-flow-evidence.json`: evidencia de 12 palpites, ranking, conquistas, convite de grupo e convite do app.
- Teste real de feedback beta: inseriu 1 feedback como usuario aprovado e criou 1 `audit_logs`.
- Limpeza final: massa temporaria removida.

## Inventario final local

- usuarios demo: 0
- usuarios QA: 0
- partidas demo/QA: 0
- grupos demo/QA: 0
- feedback temporario: 0
- jogadores ativos: 240

