# User Flow Validation - 2026-06-06

## Fluxos Validados

- Cadastro/usuário aprovado via QA.
- Usuários `pending`, `rejected` e `suspended` bloqueados para palpitar.
- Login e criação de perfil via RPCs reais.
- Home com ranking/pontos/próximo jogo/ligas/notificações reais.
- Jogos com partidas reais do banco e botão de palpite.
- Palpite salvo em `predictions`.
- Jogos mostra status de palpite enviado sem expor detalhes completos.
- Aba Palpites mostra mercados completos.
- Jogo encerrado atualiza pontos.
- Ranking, liga, perfil e conquistas atualizados.
- Convite de grupo regenerado/desativado.
- Convite do app criado/aceito/revogado.

## Evidência

O script `npm run qa:user-flow` validou México x Canadá com:

- Primeiro jogador por `predicted_first_scorer_id`.
- Homem do jogo por `predicted_man_of_match_id`.
- Colunas textuais legadas nulas.
- Pontuação principal: 66 pontos.
- Ranking top 3 gerado.
- Liga com 12 participantes.
