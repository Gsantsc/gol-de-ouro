# Auto Sync Validation Report

Status final: aprovado

## Caso 1 - Brasil 2 x 1 Canada

Resultado: aprovado

```json
{
  "points": [
    {
      "predicted_away_score": 1,
      "predicted_home_score": 2,
      "user_id": "usuario-a",
      "points": 18
    },
    {
      "predicted_away_score": 0,
      "predicted_home_score": 1,
      "user_id": "usuario-b",
      "points": 8
    },
    {
      "predicted_away_score": 0,
      "predicted_home_score": 1,
      "user_id": "usuario-c",
      "predicted_winner": "away",
      "points": 3
    }
  ],
  "ranking": [
    {
      "total_points": 18,
      "user_id": "usuario-a"
    },
    {
      "total_points": 8,
      "user_id": "usuario-b"
    },
    {
      "total_points": 3,
      "user_id": "usuario-c"
    }
  ]
}
```

## Caso 2 - Grupo A finalizado

Resultado: aprovado

```json
{
  "groupAStandings": [
    {
      "drawn": 1,
      "form": [
        "W",
        "W",
        "D"
      ],
      "goal_difference": 3,
      "goals_against": 1,
      "goals_for": 4,
      "group_code": "A",
      "lost": 0,
      "played": 3,
      "points": 7,
      "position": 1,
      "team_name": "Mexico",
      "won": 2
    },
    {
      "drawn": 1,
      "form": [
        "D",
        "L",
        "W"
      ],
      "goal_difference": 0,
      "goals_against": 2,
      "goals_for": 2,
      "group_code": "A",
      "lost": 1,
      "played": 3,
      "points": 4,
      "position": 2,
      "team_name": "Korea Republic",
      "won": 1
    },
    {
      "drawn": 0,
      "form": [
        "L",
        "W",
        "L"
      ],
      "goal_difference": -1,
      "goals_against": 3,
      "goals_for": 2,
      "group_code": "A",
      "lost": 2,
      "played": 3,
      "points": 3,
      "position": 3,
      "team_name": "South Africa",
      "won": 1
    },
    {
      "drawn": 2,
      "form": [
        "D",
        "L",
        "D"
      ],
      "goal_difference": -2,
      "goals_against": 4,
      "goals_for": 2,
      "group_code": "A",
      "lost": 1,
      "played": 3,
      "points": 2,
      "position": 4,
      "team_name": "Czechia",
      "won": 0
    }
  ],
  "knockoutUpdated": 3
}
```

## Caso 3 - Oitavas finalizadas

Resultado: aprovado

```json
{
  "knockoutUpdated": 4,
  "quarterfinals": [
    {
      "away_score": 0,
      "away_team": "R16 Home 2",
      "home_score": 0,
      "home_team": "R16 Home 1",
      "match_number": 97,
      "round": "Quarterfinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 97,
        "stage": "quarterfinal"
      }
    },
    {
      "away_score": 0,
      "away_team": "R16 Home 4",
      "home_score": 0,
      "home_team": "R16 Home 3",
      "match_number": 98,
      "round": "Quarterfinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 98,
        "stage": "quarterfinal"
      }
    },
    {
      "away_score": 0,
      "away_team": "R16 Home 6",
      "home_score": 0,
      "home_team": "R16 Home 5",
      "match_number": 99,
      "round": "Quarterfinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 99,
        "stage": "quarterfinal"
      }
    },
    {
      "away_score": 0,
      "away_team": "R16 Home 8",
      "home_score": 0,
      "home_team": "R16 Home 7",
      "match_number": 100,
      "round": "Quarterfinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 100,
        "stage": "quarterfinal"
      }
    }
  ]
}
```

## Caso 4 - Quartas finalizadas

Resultado: aprovado

```json
{
  "knockoutUpdated": 2,
  "semifinals": [
    {
      "away_score": 0,
      "away_team": "QF Home 2",
      "home_score": 0,
      "home_team": "QF Home 1",
      "match_number": 101,
      "round": "Semifinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 101,
        "stage": "semifinal"
      }
    },
    {
      "away_score": 0,
      "away_team": "QF Home 4",
      "home_score": 0,
      "home_team": "QF Home 3",
      "match_number": 102,
      "round": "Semifinal",
      "status": "fechado",
      "stats": {
        "group": null,
        "match_number": 102,
        "stage": "semifinal"
      }
    }
  ]
}
```

## Caso 5 - Semi finalizada

Resultado: aprovado

```json
{
  "final": {
    "away_score": 0,
    "away_team": "Germany",
    "home_score": 0,
    "home_team": "Brazil",
    "match_number": 104,
    "round": "Final",
    "status": "fechado",
    "stats": {
      "group": null,
      "match_number": 104,
      "stage": "final"
    }
  },
  "knockoutUpdated": 2,
  "thirdPlace": {
    "away_score": 0,
    "away_team": "France",
    "home_score": 0,
    "home_team": "Argentina",
    "match_number": 103,
    "round": "Third place",
    "status": "fechado",
    "stats": {
      "group": null,
      "match_number": 103,
      "stage": "third_place"
    }
  }
}
```

## Pendencias encontradas

- Nenhuma pendencia encontrada nas simulacoes offline.
