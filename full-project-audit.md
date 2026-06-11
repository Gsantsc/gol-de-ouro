# Full Project Audit - 2026-06-06

## Escopo Mapeado

- `apps/admin`: Admin, dashboard web do usuário, rotas API de sync WC2026.
- `apps/mobile`: app Expo, telas de usuário, services, hooks e tema.
- `packages/shared`: tipos, regras de status, pontuação, QR e provider local.
- `supabase`: schema, RLS, RPCs, migrations, seeds.
- `scripts`: QA ponta a ponta, seed WC2026, jobs de partidas, utilitários de demo/limpeza.

## Diagnóstico

P0: projeto compila, roda e migrations sobem do zero.

P1: Home, Jogos, Palpites, Ranking, Perfil, Ligas e Admin usam dados reais do Supabase. Não foi encontrado mock permanente em tela de produção. Scripts `demo-*` existem, mas são utilitários explicitamente isolados e limpáveis.

P2/P3: fluxo de palpites salva mercados avançados por ID de jogador, bloqueia usuários não aprovados, bloqueia edição fora da janela, calcula pontos de forma idempotente e atualiza ranking/conquistas.

P4: convites de grupo/app agora são gerados automaticamente com token/URL únicos, podem ser regenerados/desativados/revogados e são validados no banco.

P5: ranking/perfil são derivados de `predictions` e `rankings`. O QA validou pontos, acertos, placares exatos, conquistas e ranking da liga.

P6: UI principal está funcional e responsiva nas validações de build/export. Evidência visual automática ainda não foi gerada nesta rodada.

P7: pendências técnicas não bloqueantes: `sync-matches` ainda tem TODO para standings/lineups; scripts demo seguem no repo por serem ferramentas de validação manual.

## Correções Executadas Nesta Auditoria

- Removido input manual de convite em Home/Ligas.
- Adicionados convites únicos de grupo e app.
- Admin criação manual de partida passou a selecionar times conhecidos em vez de texto livre.
- Corrigida saída do seed de jogadores para reportar `rosterTeams` e `syncedTeams`.
- Fluxo de deep link mobile preserva convite aberto antes de login e processa depois da aprovação.

## Evidência Principal

- `artifacts/qa-user-flow-evidence.json`
- `npx supabase db reset` executado com sucesso.
- `npm run qa:user-flow` executado com sucesso após reset e seed.
