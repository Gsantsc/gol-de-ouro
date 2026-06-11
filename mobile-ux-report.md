# Beta fechado - UX mobile

Data: 2026-06-06

## Resultado

Status: aprovado para beta fechado inicial.

## Validado

- `npm run typecheck -w @gol-de-ouro/mobile`: aprovado.
- `npx expo export --platform web --output-dir dist-beta-validation`: aprovado.
- Perfil agora possui canal de feedback beta persistente.
- Player picker remove digitacao livre de jogadores.
- Abas principais mantidas: Home, Jogos, Palpites, Ranking, Ligas, Perfil.
- Loading, empty states, toasts, erro e retry ja existem no fluxo principal.

## Ajuste aplicado

- Adicionado bloco "Beta fechado" no Perfil com:
  - Reportar problema
  - Enviar sugestao
  - Persistencia em `app_feedback`

## Riscos restantes

- Validacao em aparelhos fisicos Android ainda e recomendada antes de distribuir APK.
- Video navegando pelo app nao foi gerado nesta rodada.

