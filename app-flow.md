# Gol de Ouro - Fluxo Oficial do Produto

Atualizado em 2026-06-05.

## Objetivo

Este documento consolida o fluxo funcional oficial do Gol de Ouro sem misturar Admin com Usuario e sem alterar regras fora do escopo validado.

## Fluxo 1 - Cadastro e aprovacao

```mermaid
flowchart TD
  A["Usuario cria cadastro"] --> B["Status pending"]
  B --> C["Admin visualiza em Aprovacoes"]
  C --> D{"Admin aprova?"}
  D -->|"Sim"| E["Status approved"]
  D -->|"Nao"| F["Status rejected ou suspended"]
  E --> G["Usuario pode acessar o app"]
  F --> H["Usuario bloqueado"]
```

Regras implementadas:

- Todo cadastro novo nasce como `pending`.
- Apenas usuario `approved` e nao bloqueado pode acessar fluxos autenticados completos.
- Usuarios `pending`, `rejected` ou `suspended` nao conseguem palpitar.
- O bloqueio tambem existe no banco via `ensure_prediction_submission()`, nao apenas na UI.

## Fluxo 2 - Ciclo da partida

```mermaid
flowchart TD
  A["Partida sincronizada WC2026"] --> B["Status fechado"]
  B --> C{"Faltam 24h para o jogo?"}
  C -->|"Sim"| D["Status aberto"]
  D --> E["Usuario pode palpitar"]
  E --> F{"Falta 1h para o jogo?"}
  F -->|"Sim"| G["Status ao_vivo"]
  G --> H["Palpites bloqueados"]
  H --> I{"Jogo encerrado?"}
  I -->|"Sim"| J["Status encerrado"]
  J --> K["Calcular pontuacao"]
  K --> L["Atualizar ranking"]
```

Regras implementadas:

- `prediction_open_at` abre 24h antes.
- `prediction_close_at` fecha 1h antes.
- `ao_vivo` e `encerrado` bloqueiam novo palpite e edicao.
- `encerrado` dispara recalculo idempotente de pontos.

## Fluxo 3 - Palpite

```mermaid
flowchart TD
  A["Usuario entra em Jogos"] --> B["Seleciona jogo aberto"]
  B --> C["Preenche palpite"]
  C --> D["Placar"]
  C --> E["Vencedor"]
  C --> F["Primeiro jogador a marcar"]
  C --> G["Ambos marcam"]
  C --> H["Homem do jogo"]
  C --> I["Cartao vermelho"]
  D --> J["Enviar palpite"]
  E --> J
  F --> J
  G --> J
  H --> J
  I --> J
  J --> K["Salvar no banco"]
  K --> L["Mostrar Palpite enviado em Jogos"]
  K --> M["Exibir detalhes apenas na aba Palpites"]
```

Regras implementadas:

- Jogos mostra estado resumido: `Palpite enviado`.
- Detalhes completos ficam somente na aba Palpites.
- Mobile tambem nao mostra placar do palpite na tela de detalhes da partida.

## Fluxo 4 - Ligas

```mermaid
flowchart TD
  A["Usuario entra em Ligas"] --> B["Lista de ligas"]
  B --> C["Card da liga"]
  C --> D["Botao Entrar na liga"]
  D --> E["Detalhe da liga"]
  E --> F["Participantes"]
  E --> G["Ranking da liga"]
  E --> H["Pontos por usuario"]
  E --> I["Convites"]
```

Cada liga funciona como mini campeonato, com participantes, ranking e pontuacao agregada dos usuarios envolvidos.

## Validacao

Validado por `npm run qa:user-flow`, cobrindo cadastro, aprovacao, login, palpite, persistencia, bloqueio, encerramento, pontuacao, ranking, conquistas, notificacoes e liga.
