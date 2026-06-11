# Beta fechado - auditoria inicial

Data: 2026-06-06

## Estado observado antes de alteracoes

- Supabase local rodando em `http://127.0.0.1:54321`.
- `npm audit --audit-level=high`: 0 vulnerabilidades encontradas.
- Banco local sem massa demo/QA ativa:
  - usuarios demo: 0
  - usuarios QA: 0
  - partidas demo: 0
  - partidas QA: 0
  - grupos demo: 0
  - grupos QA: 0
- Jogadores ativos para selecao visual: 240.
- Aprovacao antes de acesso continua aplicada por `status`, `approval_status` e `blocked`.
- Palpites novos usam IDs de jogadores para primeiro marcador e homem do jogo.
- Convites de grupo/app usam token/link persistente via banco.
- `audit_logs` e `prediction_audit_logs` existem no banco; `prediction_audit_logs` registra mudancas de palpites.

## Lacunas de beta fechado

- Nao havia coleta persistente de feedback do usuario no Perfil mobile.
- O admin ainda nao carregava uma fila simples de feedback beta.
- `APP_ENV=beta` ainda nao estava documentado no `.env.example`.
- A limpeza demo existe e e idempotente, mas precisava ser executada e validada nesta rodada.

## Plano seguro

1. Executar limpeza demo idempotente.
2. Criar persistencia de feedback beta com RLS.
3. Adicionar envio de feedback no Perfil mobile.
4. Exibir feedback beta no admin.
5. Documentar ambiente beta.
6. Rodar validacoes: lint, typecheck, build, QA de fluxo e inventario final do banco.
