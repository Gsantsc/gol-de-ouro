alter table public.competition_rosters
  add column if not exists position_group text,
  add column if not exists position text,
  add column if not exists shirt_number integer,
  add column if not exists is_reserve boolean not null default false,
  add column if not exists roster_order integer;

alter table public.competition_rosters
  alter column is_reserve set default false;

update public.competition_rosters
set is_reserve = false
where is_reserve is null;

alter table public.competition_rosters
  alter column is_reserve set not null;

update public.competition_rosters
set
  position_group = upper(nullif(trim(position_group), '')),
  is_reserve = true
where upper(coalesce(position_group, '')) = 'RS';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_rosters_position_group_check'
      and conrelid = 'public.competition_rosters'::regclass
  ) then
    alter table public.competition_rosters
      add constraint competition_rosters_position_group_check
      check (
        position_group is null
        or upper(position_group) in ('GOL', 'DEF', 'MEI', 'ATA', 'RS')
      );
  end if;
end $$;

create index if not exists competition_rosters_position_group_idx
  on public.competition_rosters (position_group);

create index if not exists competition_rosters_is_reserve_idx
  on public.competition_rosters (is_reserve);

create index if not exists competition_rosters_roster_order_idx
  on public.competition_rosters (roster_order);
