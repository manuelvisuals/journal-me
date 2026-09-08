-- 027: l'area Crescita (creata dal pannello admin) ha la sua icona
-- (disegno di Manuel, 8 settembre 2026; chiave "crescita" in area-icon.tsx).
update aree set icona = 'crescita' where chiave = 'Crescita' and icona is null;
