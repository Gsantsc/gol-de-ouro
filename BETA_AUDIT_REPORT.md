# Gol de Ouro - Beta 1.0 Audit Report

Data: 2026-06-20

## Status executivo

Status atual: **Beta candidato validado por bateria automatizada e E2E remoto**.

Esta rodada priorizou estabilidade, consistencia de deploy, convites/ligas, horarios, palpites e seguranca basica de exposicao de secrets. Nao foram adicionadas features fora do escopo; as alteracoes corrigem fluxo quebrado ou inconsistente.

## Achados por severidade

### Critico

1. **Convites de liga ainda dependiam do fluxo antigo `/join/group/` em alguns pontos.**
   - Impacto: links inconsistentes entre PWA, Admin e testes; risco de usuario abrir convite e cair em fluxo errado.
   - Correcao: fluxo padronizado para `/invite/:token`, mantendo compatibilidade com links antigos.

2. **Convite de usuario pending nao tinha intencao persistida no banco.**
   - Impacto: usuario cadastrado por convite poderia ficar aprovado depois sem ser adicionado automaticamente na liga correta.
   - Correcao: criada `group_invite_intents` e trigger para aplicar convite quando o admin aprovar.

3. **Fallback de URL no banco ainda podia gerar dominio antigo.**
   - Impacto: RPC chamada sem `app_base_url` geraria link fora do dominio esperado.
   - Correcao: `normalize_invite_base_url` agora usa `https://gol-de-ouro-app.vercel.app` como fallback.

4. **RPC de aceitar convite tinha referencia ambigua de `group_id`.**
   - Impacto: usuario aprovado nao conseguia entrar na liga pelo convite em E2E remoto.
   - Correcao: adicionada migration `20260621100000_fix_group_invite_accept_ambiguity.sql` com referencias qualificadas e fluxo idempotente sem `ON CONFLICT (group_id, user_id)` dentro da funcao.

### Alto

1. **Teste E2E ainda validava URL antiga.**
   - Impacto: `qa:user-flow` reprovaria mesmo com comportamento correto.
   - Correcao: atualizado para validar `/invite/:token`.

2. **Admin gerava deeplink antigo para liga.**
   - Impacto: compartilhamento por Admin ficava inconsistente com o PWA.
   - Correcao: deeplink ajustado para `goldeouro://invite/:token`.

3. **Arquivos gerados do Admin aparecem modificados apos build.**
   - Impacto: risco de commitar `next-env.d.ts` e `tsconfig.tsbuildinfo` indevidamente.
   - Acao: nao stagear estes arquivos.

4. **Teste E2E nao reconhecia a mensagem padronizada de palpite encerrado.**
   - Impacto: marcava como falha mesmo quando o backend rejeitava corretamente a edicao depois do fechamento.
   - Correcao: regex do teste atualizada para aceitar `Palpites encerrados para esta partida.`

### Medio

1. **`beta:check` nao cobria convites.**
   - Impacto: regressao em convites poderia passar na checagem Beta.
   - Correcao: adicionadas validacoes de preview RPC, accept RPC, intencao pending, URL limpa e rota PWA.

2. **Fallbacks de URL em libs do Admin apontavam para dominio antigo.**
   - Impacto: ambiente sem `NEXT_PUBLIC_APP_URL` poderia gerar links incorretos.
   - Correcao: fallback atualizado para o dominio Vercel do PWA.

### Baixo

1. **Dataset da Copa ainda contem nomes dinamicos como `Winner Match`.**
   - Observacao: isso e esperado para mata-mata antes da definicao das equipes; o PlayerPicker ja bloqueia jogadores quando a equipe nao esta definida.
   - Risco residual: validar visualmente as fases eliminatorias quando o bracket for preenchido.

## Fluxos auditados

- Login/cadastro/aprovacao: AuthProvider evita loops agressivos; pending continua bloqueado; botao de verificar aprovacao existe.
- Convites/ligas: preview, aceite, pending intent, already member e revoke/regenerate cobertos por migration e PWA.
- Palpites: backend via `submit_prediction`; janela 24h antes e fechamento configuravel, padrao 60 minutos.
- Horarios: dataset validado em UTC; exibicao America/Sao_Paulo validada por script.
- Ranking/pontuacao: validacao server-side permanece em migrations existentes.
- Admin: rotas administrativas usam bearer token e service role somente server-side.
- Auto-sync/providers: scripts e migrations presentes; simulacao ainda deve ser rodada nesta rodada final.
- Secrets: nao foi encontrado `sb_secret` em arquivos rastreados; chaves publishable aparecem apenas como public env.

## Arquivos alterados nesta estabilizacao

- `BETA_AUDIT_REPORT.md`
- `apps/admin/src/app/admin/page.tsx`
- `apps/admin/src/lib/admin-api.ts`
- `apps/admin/src/lib/user-api.ts`
- `apps/mobile/src/screens/AppRoot.tsx`
- `apps/mobile/src/screens/GroupsScreen.tsx`
- `apps/mobile/src/screens/InviteScreen.tsx`
- `apps/mobile/src/services/football.service.ts`
- `apps/mobile/src/shared/types.ts`
- `packages/shared/src/types.ts`
- `scripts/beta-readiness-check.cjs`
- `scripts/qa-user-flow.cjs`
- `scripts/validate-group-invites.cjs`
- `package.json`
- `supabase/migrations/20260615120000_beta_prediction_settings.sql`
- `supabase/migrations/20260620120000_group_invite_preview_intents.sql`
- `supabase/migrations/20260621100000_fix_group_invite_accept_ambiguity.sql`

## Validacoes executadas

- `npm run validate:group-invites`: passou
- `npm run validate:match-rules`: passou
- `npm run validate:world-cup-times`: passou
- `npm run beta:check`: passou, 16/16 checks
- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou
- `npm run pwa:export`: passou apos limpeza segura do diretorio gerado `apps/mobile/dist-pwa`
- `npm run simulate:auto-sync`: passou
- `npm run qa:user-flow`: passou em ambiente remoto, com criacao de liga, convite, usuarios, palpites, bloqueio apos fechamento, ranking e limpeza final
- `npx supabase db push`: passou
- `npx supabase migration list`: local e remoto alinhados ate `20260621100000`

## Pendencias antes de chamar Beta pronto

1. Fazer redeploy no Vercel depois do push para testar a interface publicada.

2. Validar manualmente no navegador/celular:
   - abrir `/invite/:token` em aba anonima
   - entrar/cadastrar
   - aprovar no Admin
   - conferir redirecionamento para liga

3. No commit, nao incluir:
   - `.env`
   - `.env.local`
   - `.next`
   - `dist-pwa`
   - `node_modules`
   - `supabase/.temp`
   - `*.tsbuildinfo`
   - `apps/admin/next-env.d.ts`
   - `apps/admin/tsconfig.tsbuildinfo`
