-- Backfill World Cup 2026 knockout matches 73-88 with real teams
-- This migration updates matches 73-88 (Round of 32) with actual team names
-- when they currently have placeholders like "Winner Group", "Runner-up Group", or "A definir"
-- It preserves scores, status, winner_team, and other result-related fields

-- J73: South Africa x Canada
UPDATE matches
SET
  home_team = 'South Africa',
  away_team = 'Canada',
  home_team_code = 'RSA',
  away_team_code = 'CAN',
  bracket_phase = 'round_of_32',
  bracket_order = 73,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 73
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J74: Germany x Paraguay
UPDATE matches
SET
  home_team = 'Germany',
  away_team = 'Paraguay',
  home_team_code = 'GER',
  away_team_code = 'PAR',
  bracket_phase = 'round_of_32',
  bracket_order = 74,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 74
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J75: Netherlands x Morocco
UPDATE matches
SET
  home_team = 'Netherlands',
  away_team = 'Morocco',
  home_team_code = 'NED',
  away_team_code = 'MAR',
  bracket_phase = 'round_of_32',
  bracket_order = 75,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 75
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J76: Brazil x Japan
UPDATE matches
SET
  home_team = 'Brazil',
  away_team = 'Japan',
  home_team_code = 'BRA',
  away_team_code = 'JPN',
  bracket_phase = 'round_of_32',
  bracket_order = 76,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 76
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J77: France x Sweden
UPDATE matches
SET
  home_team = 'France',
  away_team = 'Sweden',
  home_team_code = 'FRA',
  away_team_code = 'SWE',
  bracket_phase = 'round_of_32',
  bracket_order = 77,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 77
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J78: Côte d'Ivoire x Norway
UPDATE matches
SET
  home_team = 'Côte d''Ivoire',
  away_team = 'Norway',
  home_team_code = 'CIV',
  away_team_code = 'NOR',
  bracket_phase = 'round_of_32',
  bracket_order = 78,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 78
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J79: Mexico x Ecuador
UPDATE matches
SET
  home_team = 'Mexico',
  away_team = 'Ecuador',
  home_team_code = 'MEX',
  away_team_code = 'ECU',
  bracket_phase = 'round_of_32',
  bracket_order = 79,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 79
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J80: England x Congo DR
UPDATE matches
SET
  home_team = 'England',
  away_team = 'Congo DR',
  home_team_code = 'ENG',
  away_team_code = 'COD',
  bracket_phase = 'round_of_32',
  bracket_order = 80,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 80
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J81: United States x Bosnia and Herzegovina
UPDATE matches
SET
  home_team = 'United States',
  away_team = 'Bosnia and Herzegovina',
  home_team_code = 'USA',
  away_team_code = 'BIH',
  bracket_phase = 'round_of_32',
  bracket_order = 81,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 81
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J82: Belgium x Senegal
UPDATE matches
SET
  home_team = 'Belgium',
  away_team = 'Senegal',
  home_team_code = 'BEL',
  away_team_code = 'SEN',
  bracket_phase = 'round_of_32',
  bracket_order = 82,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 82
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J83: Portugal x Croatia
UPDATE matches
SET
  home_team = 'Portugal',
  away_team = 'Croatia',
  home_team_code = 'POR',
  away_team_code = 'CRO',
  bracket_phase = 'round_of_32',
  bracket_order = 83,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 83
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J84: Spain x Austria
UPDATE matches
SET
  home_team = 'Spain',
  away_team = 'Austria',
  home_team_code = 'ESP',
  away_team_code = 'AUT',
  bracket_phase = 'round_of_32',
  bracket_order = 84,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 84
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J85: Switzerland x Algeria
UPDATE matches
SET
  home_team = 'Switzerland',
  away_team = 'Algeria',
  home_team_code = 'SUI',
  away_team_code = 'ALG',
  bracket_phase = 'round_of_32',
  bracket_order = 85,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 85
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J86: Argentina x Cape Verde
UPDATE matches
SET
  home_team = 'Argentina',
  away_team = 'Cape Verde',
  home_team_code = 'ARG',
  away_team_code = 'CPV',
  bracket_phase = 'round_of_32',
  bracket_order = 86,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 86
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J87: Colombia x Ghana
UPDATE matches
SET
  home_team = 'Colombia',
  away_team = 'Ghana',
  home_team_code = 'COL',
  away_team_code = 'GHA',
  bracket_phase = 'round_of_32',
  bracket_order = 87,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 87
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );

-- J88: Australia x Egypt
UPDATE matches
SET
  home_team = 'Australia',
  away_team = 'Egypt',
  home_team_code = 'AUS',
  away_team_code = 'EGY',
  bracket_phase = 'round_of_32',
  bracket_order = 88,
  is_bracket_validated = true,
  bracket_validation_error = NULL,
  home_original_placeholder = CASE
    WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%' THEN home_team
    ELSE home_original_placeholder
  END,
  away_original_placeholder = CASE
    WHEN away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%' THEN away_team
    ELSE away_original_placeholder
  END
WHERE championship = 'world_cup_2026'
  AND match_number = 88
  AND deleted_at IS NULL
  AND (
    home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR home_team LIKE '%Third%' OR home_team LIKE '%A definir%'
    OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' OR away_team LIKE '%Third%' OR away_team LIKE '%A definir%'
  );
