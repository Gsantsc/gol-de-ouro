# Demo Simulation Plan

## Objetivo

Validar visualmente o fluxo do usuario sem alterar regras de negocio nem depender de provider externo.

## Cenarios

1. Usuario aprovado.
2. Proximo jogo disponivel para palpite.
3. Liga Familia com participantes.
4. Ranking global com top 3.
5. Ranking de liga.
6. Notificacoes do usuario.
7. Perfil com conquistas derivadas dos dados.

## Scripts Disponiveis

- `npm run seed:demo-user-flow:dry-run`: mostra o plano sem tocar no banco.
- `npm run seed:demo-user-flow`: cria dados temporarios marcados com prefixo `DEMO_USER_FLOW`.
- `npm run cleanup:demo-user-flow:dry-run`: mostra o que sera limpo.
- `npm run cleanup:demo-user-flow`: remove registros demo removiveis.

## Dados Criados

O seed cria usuarios aprovados, liga, participantes, rankings, partidas demo e notificacoes. O email e senha do usuario principal aparecem no output do script.

Antes de recriar o cenario, `npm run seed:demo-user-flow` executa a limpeza dos dados demo existentes com o mesmo prefixo.

## Limitacao Intencional

O seed nao cria registros em `predictions`, porque a regra atual bloqueia exclusao de palpites travados. Criar palpites demo deixaria dados que o cleanup nao conseguiria remover com seguranca.
