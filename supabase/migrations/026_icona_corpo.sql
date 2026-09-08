-- 026: l'area Corpo ha la sua icona (disegno di Manuel, 8 settembre 2026).
-- Il disegno vive nel codice (src/modules/oggi/components/area-icon.tsx,
-- chiave "corpo"): qui si aggancia il nome. Idempotente.
update aree set icona = 'corpo' where chiave = 'Corpo' and icona is null;
