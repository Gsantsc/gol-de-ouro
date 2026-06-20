# MATCH TIME AUDIT

Fonte primária usada: ESPN FIFA World Cup scoreboard (`site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`).

Regra de produto: agrupar e exibir jogos no Brasil usando `America/Sao_Paulo`; manter timezone local do estádio nos metadados.

| # | Jogo | Horário antigo UTC | Horário esperado UTC | Exibição BR | Diferença min | Timezone estádio | Fonte correta |
| - | - | - | - | - | -: | - | - |
| 1 | Mexico x South Africa | 2026-06-11T19:00:00.000Z | 2026-06-11T19:00:00.000Z | 11/06/2026, 16:00 | 0 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 2 | Korea Republic x Czechia | 2026-06-12T02:00:00.000Z | 2026-06-12T02:00:00.000Z | 11/06/2026, 23:00 | 0 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 3 | Canada x Bosnia-Herzegovina | 2026-06-12T22:00:00.000Z | 2026-06-12T19:00:00.000Z | 12/06/2026, 16:00 | -180 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 4 | USA x Paraguay | 2026-06-13T16:00:00.000Z | 2026-06-13T01:00:00.000Z | 12/06/2026, 22:00 | -900 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 5 | Qatar x Switzerland | 2026-06-13T01:00:00.000Z | 2026-06-13T19:00:00.000Z | 13/06/2026, 16:00 | 1080 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 6 | Brazil x Morocco | 2026-06-13T01:00:00.000Z | 2026-06-13T22:00:00.000Z | 13/06/2026, 19:00 | 1260 | America/New_York | espn_fifa_world_cup_scoreboard |
| 7 | Haiti x Scotland | 2026-06-13T16:00:00.000Z | 2026-06-14T01:00:00.000Z | 13/06/2026, 22:00 | 540 | America/New_York | espn_fifa_world_cup_scoreboard |
| 8 | Australia x Turkey | 2026-06-13T19:00:00.000Z | 2026-06-14T04:00:00.000Z | 14/06/2026, 01:00 | 540 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 9 | Germany x Curacao | 2026-06-14T19:00:00.000Z | 2026-06-14T17:00:00.000Z | 14/06/2026, 14:00 | -120 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 10 | Netherlands x Japan | 2026-06-14T22:00:00.000Z | 2026-06-14T20:00:00.000Z | 14/06/2026, 17:00 | -120 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 11 | Cote d'Ivoire x Ecuador | 2026-06-14T22:00:00.000Z | 2026-06-14T23:00:00.000Z | 14/06/2026, 20:00 | 60 | America/New_York | espn_fifa_world_cup_scoreboard |
| 12 | Sweden x Tunisia | 2026-06-14T01:00:00.000Z | 2026-06-15T02:00:00.000Z | 14/06/2026, 23:00 | 1500 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 13 | Spain x Cabo Verde | 2026-06-21T16:00:00.000Z | 2026-06-15T16:00:00.000Z | 15/06/2026, 13:00 | -8640 | America/New_York | espn_fifa_world_cup_scoreboard |
| 14 | Belgium x Egypt | 2026-06-23T19:00:00.000Z | 2026-06-15T19:00:00.000Z | 15/06/2026, 16:00 | -11520 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 15 | Saudi Arabia x Uruguay | 2026-06-15T16:00:00.000Z | 2026-06-15T22:00:00.000Z | 15/06/2026, 19:00 | 360 | America/New_York | espn_fifa_world_cup_scoreboard |
| 16 | IR Iran x New Zealand | 2026-06-15T19:00:00.000Z | 2026-06-16T01:00:00.000Z | 15/06/2026, 22:00 | 360 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 17 | France x Senegal | 2026-06-16T19:00:00.000Z | 2026-06-16T19:00:00.000Z | 16/06/2026, 16:00 | 0 | America/New_York | espn_fifa_world_cup_scoreboard |
| 18 | Iraq x Norway | 2026-06-16T22:00:00.000Z | 2026-06-16T22:00:00.000Z | 16/06/2026, 19:00 | 0 | America/New_York | espn_fifa_world_cup_scoreboard |
| 19 | Argentina x Algeria | 2026-06-14T19:00:00.000Z | 2026-06-17T01:00:00.000Z | 16/06/2026, 22:00 | 3240 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 20 | Austria x Jordan | 2026-06-14T22:00:00.000Z | 2026-06-17T04:00:00.000Z | 17/06/2026, 01:00 | 3240 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 21 | Portugal x Congo DR | 2026-06-22T01:00:00.000Z | 2026-06-17T17:00:00.000Z | 17/06/2026, 14:00 | -6240 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 22 | England x Croatia | 2026-06-17T16:00:00.000Z | 2026-06-17T20:00:00.000Z | 17/06/2026, 17:00 | 240 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 23 | Ghana x Panama | 2026-06-17T16:00:00.000Z | 2026-06-17T23:00:00.000Z | 17/06/2026, 20:00 | 420 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 24 | Uzbekistan x Colombia | 2026-06-17T19:00:00.000Z | 2026-06-18T02:00:00.000Z | 17/06/2026, 23:00 | 420 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 25 | Czechia x South Africa | 2026-06-18T01:00:00.000Z | 2026-06-18T16:00:00.000Z | 18/06/2026, 13:00 | 900 | America/New_York | espn_fifa_world_cup_scoreboard |
| 26 | Switzerland x Bosnia-Herzegovina | 2026-06-18T01:00:00.000Z | 2026-06-18T19:00:00.000Z | 18/06/2026, 16:00 | 1080 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 27 | Canada x Qatar | 2026-06-18T01:00:00.000Z | 2026-06-18T22:00:00.000Z | 18/06/2026, 19:00 | 1260 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 28 | Mexico x Korea Republic | 2026-06-18T22:00:00.000Z | 2026-06-19T01:00:00.000Z | 18/06/2026, 22:00 | 180 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 29 | USA x Australia | 2026-06-19T19:00:00.000Z | 2026-06-19T19:00:00.000Z | 19/06/2026, 16:00 | 0 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 30 | Scotland x Morocco | 2026-06-19T19:00:00.000Z | 2026-06-19T22:00:00.000Z | 19/06/2026, 19:00 | 180 | America/New_York | espn_fifa_world_cup_scoreboard |
| 31 | Brazil x Haiti | 2026-06-19T16:00:00.000Z | 2026-06-20T00:30:00.000Z | 19/06/2026, 21:30 | 510 | America/New_York | espn_fifa_world_cup_scoreboard |
| 32 | Turkey x Paraguay | 2026-06-19T22:00:00.000Z | 2026-06-20T03:00:00.000Z | 20/06/2026, 00:00 | 300 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 33 | Netherlands x Sweden | 2026-06-20T22:00:00.000Z | 2026-06-20T17:00:00.000Z | 20/06/2026, 14:00 | -300 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 34 | Germany x Cote d'Ivoire | 2026-06-20T01:00:00.000Z | 2026-06-20T20:00:00.000Z | 20/06/2026, 17:00 | 1140 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 35 | Ecuador x Curacao | 2026-06-20T01:00:00.000Z | 2026-06-21T00:00:00.000Z | 20/06/2026, 21:00 | 1380 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 36 | Tunisia x Japan | 2026-06-20T16:00:00.000Z | 2026-06-21T04:00:00.000Z | 21/06/2026, 01:00 | 720 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 37 | Spain x Saudi Arabia | 2026-06-15T01:00:00.000Z | 2026-06-21T16:00:00.000Z | 21/06/2026, 13:00 | 9540 | America/New_York | espn_fifa_world_cup_scoreboard |
| 38 | Belgium x IR Iran | 2026-06-21T19:00:00.000Z | 2026-06-21T19:00:00.000Z | 21/06/2026, 16:00 | 0 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 39 | Uruguay x Cabo Verde | 2026-06-21T19:00:00.000Z | 2026-06-21T22:00:00.000Z | 21/06/2026, 19:00 | 180 | America/New_York | espn_fifa_world_cup_scoreboard |
| 40 | New Zealand x Egypt | 2026-06-21T22:00:00.000Z | 2026-06-22T01:00:00.000Z | 21/06/2026, 22:00 | 180 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 41 | Argentina x Austria | 2026-06-20T22:00:00.000Z | 2026-06-22T17:00:00.000Z | 22/06/2026, 14:00 | 2580 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 42 | France x Iraq | 2026-06-22T01:00:00.000Z | 2026-06-22T21:00:00.000Z | 22/06/2026, 18:00 | 1200 | America/New_York | espn_fifa_world_cup_scoreboard |
| 43 | Norway x Senegal | 2026-06-22T01:00:00.000Z | 2026-06-23T00:00:00.000Z | 22/06/2026, 21:00 | 1380 | America/New_York | espn_fifa_world_cup_scoreboard |
| 44 | Jordan x Algeria | 2026-06-20T01:00:00.000Z | 2026-06-23T03:00:00.000Z | 23/06/2026, 00:00 | 4440 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 45 | Portugal x Uzbekistan | 2026-06-23T16:00:00.000Z | 2026-06-23T17:00:00.000Z | 23/06/2026, 14:00 | 60 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 46 | England x Ghana | 2026-06-23T19:00:00.000Z | 2026-06-23T20:00:00.000Z | 23/06/2026, 17:00 | 60 | America/New_York | espn_fifa_world_cup_scoreboard |
| 47 | Panama x Croatia | 2026-06-23T19:00:00.000Z | 2026-06-23T23:00:00.000Z | 23/06/2026, 20:00 | 240 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 48 | Colombia x Congo DR | 2026-06-23T22:00:00.000Z | 2026-06-24T02:00:00.000Z | 23/06/2026, 23:00 | 240 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 49 | Bosnia-Herzegovina x Qatar | 2026-06-24T01:00:00.000Z | 2026-06-24T19:00:00.000Z | 24/06/2026, 16:00 | 1080 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 50 | Switzerland x Canada | 2026-06-24T16:00:00.000Z | 2026-06-24T19:00:00.000Z | 24/06/2026, 16:00 | 180 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 51 | Morocco x Haiti | 2026-06-24T22:00:00.000Z | 2026-06-24T22:00:00.000Z | 24/06/2026, 19:00 | 0 | America/New_York | espn_fifa_world_cup_scoreboard |
| 52 | Scotland x Brazil | 2026-06-24T19:00:00.000Z | 2026-06-24T22:00:00.000Z | 24/06/2026, 19:00 | 180 | America/New_York | espn_fifa_world_cup_scoreboard |
| 53 | South Africa x Korea Republic | 2026-06-24T16:00:00.000Z | 2026-06-25T01:00:00.000Z | 24/06/2026, 22:00 | 540 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 54 | Czechia x Mexico | 2026-06-24T01:00:00.000Z | 2026-06-25T01:00:00.000Z | 24/06/2026, 22:00 | 1440 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 55 | Ecuador x Germany | 2026-06-25T22:00:00.000Z | 2026-06-25T20:00:00.000Z | 25/06/2026, 17:00 | -120 | America/New_York | espn_fifa_world_cup_scoreboard |
| 56 | Curacao x Cote d'Ivoire | 2026-06-25T01:00:00.000Z | 2026-06-25T20:00:00.000Z | 25/06/2026, 17:00 | 1140 | America/New_York | espn_fifa_world_cup_scoreboard |
| 57 | Japan x Sweden | 2026-06-25T01:00:00.000Z | 2026-06-25T23:00:00.000Z | 25/06/2026, 20:00 | 1320 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 58 | Tunisia x Netherlands | 2026-06-25T16:00:00.000Z | 2026-06-25T23:00:00.000Z | 25/06/2026, 20:00 | 420 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 59 | Paraguay x Australia | 2026-06-25T01:00:00.000Z | 2026-06-26T02:00:00.000Z | 25/06/2026, 23:00 | 1500 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 60 | Turkey x USA | 2026-06-25T22:00:00.000Z | 2026-06-26T02:00:00.000Z | 25/06/2026, 23:00 | 240 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 61 | Senegal x Iraq | 2026-06-26T19:00:00.000Z | 2026-06-26T19:00:00.000Z | 26/06/2026, 16:00 | 0 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 62 | Norway x France | 2026-06-26T22:00:00.000Z | 2026-06-26T19:00:00.000Z | 26/06/2026, 16:00 | -180 | America/New_York | espn_fifa_world_cup_scoreboard |
| 63 | Cabo Verde x Saudi Arabia | 2026-06-26T22:00:00.000Z | 2026-06-27T00:00:00.000Z | 26/06/2026, 21:00 | 120 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 64 | Uruguay x Spain | 2026-06-26T01:00:00.000Z | 2026-06-27T00:00:00.000Z | 26/06/2026, 21:00 | 1380 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 65 | Egypt x IR Iran | 2026-06-26T01:00:00.000Z | 2026-06-27T03:00:00.000Z | 27/06/2026, 00:00 | 1560 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 66 | New Zealand x Belgium | 2026-06-26T16:00:00.000Z | 2026-06-27T03:00:00.000Z | 27/06/2026, 00:00 | 660 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 67 | Croatia x Ghana | 2026-06-27T16:00:00.000Z | 2026-06-27T21:00:00.000Z | 27/06/2026, 18:00 | 300 | America/New_York | espn_fifa_world_cup_scoreboard |
| 68 | Panama x England | 2026-06-26T22:00:00.000Z | 2026-06-27T21:00:00.000Z | 27/06/2026, 18:00 | 1380 | America/New_York | espn_fifa_world_cup_scoreboard |
| 69 | Colombia x Portugal | 2026-06-27T19:00:00.000Z | 2026-06-27T23:30:00.000Z | 27/06/2026, 20:30 | 270 | America/New_York | espn_fifa_world_cup_scoreboard |
| 70 | Congo DR x Uzbekistan | 2026-06-27T22:00:00.000Z | 2026-06-27T23:30:00.000Z | 27/06/2026, 20:30 | 90 | America/New_York | espn_fifa_world_cup_scoreboard |
| 71 | Jordan x Argentina | 2026-06-25T01:00:00.000Z | 2026-06-28T02:00:00.000Z | 27/06/2026, 23:00 | 4380 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 72 | Algeria x Austria | 2026-06-25T16:00:00.000Z | 2026-06-28T02:00:00.000Z | 27/06/2026, 23:00 | 3480 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 73 | Runner-up Group A x Runner-up Group B | 2026-06-28T16:00:00.000Z | 2026-06-28T19:00:00.000Z | 28/06/2026, 16:00 | 180 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 74 | Winner Group E x Third Place Group A/B/C/D/F | 2026-06-28T19:00:00.000Z | 2026-06-29T17:00:00.000Z | 29/06/2026, 14:00 | 1320 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 75 | Winner Group F x Runner-up Group C | 2026-06-29T22:00:00.000Z | 2026-06-29T20:30:00.000Z | 29/06/2026, 17:30 | -90 | America/New_York | espn_fifa_world_cup_scoreboard |
| 76 | Winner Group C x Third Place Group F/H/I/J/K | 2026-06-29T01:00:00.000Z | 2026-06-30T01:00:00.000Z | 29/06/2026, 22:00 | 1440 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 77 | Winner Group I x Third Place Group C/D/F/G/H | 2026-06-30T16:00:00.000Z | 2026-06-30T17:00:00.000Z | 30/06/2026, 14:00 | 60 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 78 | Runner-up Group E x Runner-up Group I | 2026-06-30T19:00:00.000Z | 2026-06-30T21:00:00.000Z | 30/06/2026, 18:00 | 120 | America/New_York | espn_fifa_world_cup_scoreboard |
| 79 | Winner Group A x Third Place Group C/E/F/H/I | 2026-07-01T22:00:00.000Z | 2026-07-01T01:00:00.000Z | 30/06/2026, 22:00 | -1260 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 80 | Winner Group L x Third Place Group E/H/I/J/K | 2026-07-01T01:00:00.000Z | 2026-07-01T16:00:00.000Z | 01/07/2026, 13:00 | 900 | America/New_York | espn_fifa_world_cup_scoreboard |
| 81 | Winner Group D x Third Place Group B/E/F/I/J | 2026-07-02T16:00:00.000Z | 2026-07-01T20:00:00.000Z | 01/07/2026, 17:00 | -1200 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 82 | Winner Group G x Third Place Group A/E/H/I/J | 2026-07-02T19:00:00.000Z | 2026-07-02T00:00:00.000Z | 01/07/2026, 21:00 | -1140 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 83 | Runner-up Group K x Runner-up Group L | 2026-07-02T22:00:00.000Z | 2026-07-02T19:00:00.000Z | 02/07/2026, 16:00 | -180 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 84 | Winner Group H x Runner-up Group J | 2026-07-02T01:00:00.000Z | 2026-07-02T23:00:00.000Z | 02/07/2026, 20:00 | 1320 | America/Toronto | espn_fifa_world_cup_scoreboard |
| 85 | Winner Group B x Third Place Group E/F/G/I/J | 2026-07-03T16:00:00.000Z | 2026-07-03T03:00:00.000Z | 03/07/2026, 00:00 | -780 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 86 | Winner Group J x Runner-up Group H | 2026-07-03T19:00:00.000Z | 2026-07-03T18:00:00.000Z | 03/07/2026, 15:00 | -60 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 87 | Runner-up Group D x Runner-up Group G | 2026-07-03T22:00:00.000Z | 2026-07-03T22:00:00.000Z | 03/07/2026, 19:00 | 0 | America/New_York | espn_fifa_world_cup_scoreboard |
| 88 | Winner Group K x Third Place Group D/E/I/J/L | 2026-07-03T01:00:00.000Z | 2026-07-04T01:30:00.000Z | 03/07/2026, 22:30 | 1470 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 89 | Winner Match 73 x Winner Match 74 | 2026-07-04T19:00:00.000Z | 2026-07-04T17:00:00.000Z | 04/07/2026, 14:00 | -120 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 90 | Winner Match 75 x Winner Match 76 | 2026-07-04T22:00:00.000Z | 2026-07-04T21:00:00.000Z | 04/07/2026, 18:00 | -60 | America/New_York | espn_fifa_world_cup_scoreboard |
| 91 | Winner Match 77 x Winner Match 78 | 2026-07-05T01:00:00.000Z | 2026-07-05T20:00:00.000Z | 05/07/2026, 17:00 | 1140 | America/New_York | espn_fifa_world_cup_scoreboard |
| 92 | Winner Match 79 x Winner Match 80 | 2026-07-05T16:00:00.000Z | 2026-07-06T00:00:00.000Z | 05/07/2026, 21:00 | 480 | America/Mexico_City | espn_fifa_world_cup_scoreboard |
| 93 | Winner Match 81 x Winner Match 82 | 2026-07-06T19:00:00.000Z | 2026-07-06T19:00:00.000Z | 06/07/2026, 16:00 | 0 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 94 | Winner Match 83 x Winner Match 84 | 2026-07-06T22:00:00.000Z | 2026-07-07T00:00:00.000Z | 06/07/2026, 21:00 | 120 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 95 | Winner Match 85 x Winner Match 86 | 2026-07-07T01:00:00.000Z | 2026-07-07T16:00:00.000Z | 07/07/2026, 13:00 | 900 | America/New_York | espn_fifa_world_cup_scoreboard |
| 96 | Winner Match 87 x Winner Match 88 | 2026-07-07T16:00:00.000Z | 2026-07-07T20:00:00.000Z | 07/07/2026, 17:00 | 240 | America/Vancouver | espn_fifa_world_cup_scoreboard |
| 97 | Winner Match 89 x Winner Match 90 | 2026-07-09T16:00:00.000Z | 2026-07-09T20:00:00.000Z | 09/07/2026, 17:00 | 240 | America/New_York | espn_fifa_world_cup_scoreboard |
| 98 | Winner Match 91 x Winner Match 92 | 2026-07-10T19:00:00.000Z | 2026-07-10T19:00:00.000Z | 10/07/2026, 16:00 | 0 | America/Los_Angeles | espn_fifa_world_cup_scoreboard |
| 99 | Winner Match 93 x Winner Match 94 | 2026-07-11T22:00:00.000Z | 2026-07-11T21:00:00.000Z | 11/07/2026, 18:00 | -60 | America/New_York | espn_fifa_world_cup_scoreboard |
| 100 | Winner Match 95 x Winner Match 96 | 2026-07-11T01:00:00.000Z | 2026-07-12T01:00:00.000Z | 11/07/2026, 22:00 | 1440 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 101 | Winner Match 97 x Winner Match 98 | 2026-07-14T22:00:00.000Z | 2026-07-14T19:00:00.000Z | 14/07/2026, 16:00 | -180 | America/Chicago | espn_fifa_world_cup_scoreboard |
| 102 | Winner Match 99 x Winner Match 100 | 2026-07-15T22:00:00.000Z | 2026-07-15T19:00:00.000Z | 15/07/2026, 16:00 | -180 | America/New_York | espn_fifa_world_cup_scoreboard |
| 103 | Loser Match 101 x Loser Match 102 | 2026-07-18T20:00:00.000Z | 2026-07-18T21:00:00.000Z | 18/07/2026, 18:00 | 60 | America/New_York | espn_fifa_world_cup_scoreboard |
| 104 | Winner Match 101 x Winner Match 102 | 2026-07-19T19:00:00.000Z | 2026-07-19T19:00:00.000Z | 19/07/2026, 16:00 | 0 | America/New_York | espn_fifa_world_cup_scoreboard |
