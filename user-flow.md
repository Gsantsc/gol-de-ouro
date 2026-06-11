# Gol de Ouro - Fluxos do Usuario

Atualizado em 2026-06-05.

## Home

A Home nao deve ser copia da tela Jogos. Ela serve como resumo acionavel:

- resumo do usuario;
- proximo jogo disponivel;
- meus numeros;
- minhas ligas;
- ultimos resultados;
- notificacoes.

## Jogos

Objetivo: leitura rapida e acao direta.

Fluxo esperado:

1. Usuario entra em Jogos.
2. Filtra por Todos, Abertos, Ao vivo ou Encerrados.
3. Em jogo aberto, usa `Palpitar`.
4. Depois do envio, Jogos exibe apenas `Palpite enviado`.
5. Jogos nao exibe os detalhes completos do palpite.

## Palpites

Objetivo: historico e detalhamento.

Conteudo exibido:

- placar previsto;
- vencedor;
- primeiro jogador a marcar;
- ambos marcam;
- homem do jogo;
- cartao vermelho;
- status do palpite;
- pontos quando pontuado.

## Ligas

Objetivo: mini campeonato social.

Fluxo esperado:

1. Usuario acessa Ligas.
2. Visualiza ligas vinculadas.
3. Entra no detalhe da liga.
4. Ve participantes.
5. Ve ranking da liga.
6. Usa convites quando aplicavel.

## Perfil

Objetivo: progresso pessoal.

Conteudo esperado:

- pontos;
- aproveitamento;
- conquistas;
- streak;
- ranking;
- evolucao semanal;
- campeonatos/ligas ganhos quando houver dados.

## Bloqueios de acesso

Usuarios com `pending`, `rejected` ou `suspended` nao podem palpitar. A UI bloqueia o fluxo e o banco rejeita a escrita.
