-- Fix invalid prediction players
-- This migration clears player_id fields for predictions where the player
-- does not belong to either team in the match

-- Prediction 7433c9d8-76b1-4529-93e3-64007c5e61de: Netherlands x Sweden
UPDATE predictions SET predicted_first_scorer_id = NULL WHERE id = '7433c9d8-76b1-4529-93e3-64007c5e61de';

-- Prediction bc692149-0821-4d9d-8534-8157e3a830da: Tunisia x Japan
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = 'bc692149-0821-4d9d-8534-8157e3a830da';

-- Prediction 8655a9ed-f0b0-4c1b-9ca9-4dfe0e1b954a: Tunisia x Japan
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = '8655a9ed-f0b0-4c1b-9ca9-4dfe0e1b954a';

-- Prediction 3043c672-7e88-4034-96ff-c48e28729fbe: Tunisia x Japan
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = '3043c672-7e88-4034-96ff-c48e28729fbe';

-- Prediction ef6f1f72-5d79-4242-9214-bd1459e6da0a: Uruguay x Cape Verde
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = 'ef6f1f72-5d79-4242-9214-bd1459e6da0a';

-- Prediction 9e9fc9ce-219d-462f-bbb6-916562748a32: Norway x Senegal
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = '9e9fc9ce-219d-462f-bbb6-916562748a32';

-- Prediction c279d7fe-4f5c-4772-8f09-dca4172b6919: United States x Australia
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = 'c279d7fe-4f5c-4772-8f09-dca4172b6919';

-- Prediction 98cc0bdf-bb19-488a-8b3e-1a2813acaf68: Netherlands x Sweden
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = '98cc0bdf-bb19-488a-8b3e-1a2813acaf68';

-- Prediction 5773a44e-7f93-4d5e-bd10-3d292287726b: New Zealand x Egypt
UPDATE predictions SET predicted_first_scorer_id = NULL, predicted_man_of_match_id = NULL WHERE id = '5773a44e-7f93-4d5e-bd10-3d292287726b';
