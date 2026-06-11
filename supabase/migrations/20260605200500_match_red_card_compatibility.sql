alter table public.matches
  add column if not exists red_cards_home integer not null default 0 check (red_cards_home >= 0),
  add column if not exists red_cards_away integer not null default 0 check (red_cards_away >= 0);
