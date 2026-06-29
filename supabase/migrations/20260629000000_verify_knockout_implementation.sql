-- Verification SQL for ESPN-first knockout implementation
-- This script validates that the knockout bracket is correctly populated from ESPN

-- Scenario 1: Check matches with real teams from ESPN (should have is_bracket_validated = true)
SELECT 
  id,
  match_number,
  bracket_phase,
  home_team,
  away_team,
  is_bracket_validated,
  bracket_validation_error
FROM matches
WHERE bracket_phase IS NOT NULL 
  AND bracket_phase != 'group_stage'
  AND home_team IS NOT NULL 
  AND away_team IS NOT NULL
  AND home_team NOT LIKE '%Winner%'
  AND home_team NOT LIKE '%Runner-up%'
  AND away_team NOT LIKE '%Winner%'
  AND away_team NOT LIKE '%Runner-up%'
  AND deleted_at IS NULL
ORDER BY bracket_order;

-- Scenario 2: Check matches with placeholders (should have seed fields populated)
SELECT 
  id,
  match_number,
  bracket_phase,
  home_team,
  away_team,
  home_seed,
  away_seed,
  home_original_placeholder,
  away_original_placeholder,
  is_bracket_validated
FROM matches
WHERE bracket_phase IS NOT NULL 
  AND bracket_phase != 'group_stage'
  AND (home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%')
  AND deleted_at IS NULL
ORDER BY bracket_order;

-- Scenario 3: Verify bracket_phase normalization by match number ranges
SELECT 
  match_number,
  bracket_phase,
  round,
  home_team,
  away_team
FROM matches
WHERE match_number BETWEEN 73 AND 104
  AND deleted_at IS NULL
ORDER BY match_number;

-- Expected mapping:
-- 73-88: round_of_32
-- 89-96: round_of_16
-- 97-100: quarter_final
-- 101-102: semi_final
-- 103: third_place
-- 104: final

-- Scenario 4: Check that ESPN sync preserved real teams when provider sent placeholder
SELECT 
  id,
  match_number,
  home_team,
  away_team,
  home_original_placeholder,
  away_original_placeholder,
  home_seed,
  away_seed
FROM matches
WHERE bracket_phase IS NOT NULL 
  AND bracket_phase != 'group_stage'
  AND (home_original_placeholder IS NOT NULL OR away_original_placeholder IS NOT NULL)
  AND deleted_at IS NULL
ORDER BY bracket_order;

-- Scenario 5: Count matches by bracket phase
SELECT 
  bracket_phase,
  COUNT(*) as match_count,
  COUNT(CASE WHEN home_team NOT LIKE '%Winner%' AND home_team NOT LIKE '%Runner-up%' AND away_team NOT LIKE '%Winner%' AND away_team NOT LIKE '%Runner-up%' THEN 1 END) as real_teams_count,
  COUNT(CASE WHEN home_team LIKE '%Winner%' OR home_team LIKE '%Runner-up%' OR away_team LIKE '%Winner%' OR away_team LIKE '%Runner-up%' THEN 1 END) as placeholder_count
FROM matches
WHERE bracket_phase IS NOT NULL 
  AND bracket_phase != 'group_stage'
  AND deleted_at IS NULL
GROUP BY bracket_phase
ORDER BY bracket_order;

-- Scenario 6: Verify sync-matches populated bracket fields
SELECT 
  COUNT(*) as total_knockout_matches,
  COUNT(bracket_phase) as with_bracket_phase,
  COUNT(bracket_order) as with_bracket_order,
  COUNT(match_number) as with_match_number,
  COUNT(home_seed) as with_home_seed,
  COUNT(away_seed) as with_away_seed,
  COUNT(home_original_placeholder) as with_home_original_placeholder,
  COUNT(away_original_placeholder) as with_away_original_placeholder
FROM matches
WHERE bracket_phase IS NOT NULL 
  AND bracket_phase != 'group_stage'
  AND deleted_at IS NULL;
