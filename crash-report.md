# Beta fechado - crash test

Data: 2026-06-06

## Resultado

Status: aprovado em simulacao automatizada local.

## Cenarios cobertos

- Multiplos usuarios aprovados.
- Multiplos palpites.
- Palpite editado antes do fechamento.
- Edicao rejeitada apos fechamento.
- Encerramento de partida.
- Pontuacao e ranking.
- Convites de grupo/app.
- Limpeza final de massa QA.

## Evidencia

- `npm run qa:user-flow`: aprovado.
- `npm run build`: aprovado.
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado por workspace.

## Nao coberto nesta rodada

- Login simultaneo real por multiplos dispositivos.
- Teste de rede instavel em aparelho fisico.
- Geracao de APK.

