-- No-op migration.
-- The previous version attempted to update predictions directly and was blocked
-- by the database business-rule trigger: "Apenas o dono aprovado pode editar o palpite."
-- Data cleanup for invalid prediction players must be handled through the approved admin/app flow.

select 1;