# PWA Limitations - Gol de Ouro

## O que funciona bem

- Android Chrome instala como app.
- Desktop Chrome/Edge instala como app.
- iPhone instala pela opcao `Adicionar a Tela de Inicio`.
- O app abre em modo standalone quando instalado.

## Limitacoes do iPhone

- O Safari nao exibe prompt automatico igual Android.
- O usuario precisa instalar pelo menu Compartilhar.
- Push notification em iOS depende de requisitos adicionais e nao foi ativado nesta etapa.

## Limitacoes offline

O PWA cacheia apenas assets e shell basico.

Nao foi criado modo offline completo para:

- Palpites
- Ranking
- Ligas
- Login
- Dados de usuario

Motivo: esses dados sao autenticados e mudam com frequencia.

## APK

APK continua possivel, mas deixou de ser o canal principal.

Prioridade atual:

1. PWA por URL
2. Instalacao no celular
3. Beta web
4. APK/AAB opcional

