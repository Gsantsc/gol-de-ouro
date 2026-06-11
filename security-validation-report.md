# Beta fechado - seguranca

Data: 2026-06-06

## Resultado

Status: aprovado para beta local.

## Validacoes

- Usuario `pending`, `rejected` e `suspended` nao consegue palpitar.
- RLS de `predictions` exige usuario aprovado e dono do registro.
- RLS de `rankings` nao permite alteracao por usuario comum.
- RLS de `matches` e resultados preserva alteracao via admin/servico.
- RLS de `app_feedback` permite insert/select do proprio usuario e update por admin.
- `audit_logs` permanece restrito a admin.
- `app_invites` e convites de grupo validam token ativo/revogado.

## Evidencia

- `npm run qa:user-flow` rejeitou os 3 perfis nao aprovados.
- `npm audit --audit-level=high`: 0 vulnerabilidades.

## Risco restante

- O ambiente beta real precisa usar chaves separadas de producao e `NEXT_PUBLIC_APP_URL`/deep links finais.
- APK beta depende de build Android/EAS ou Android local configurado fora deste repositorio.

