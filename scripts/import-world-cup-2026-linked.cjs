const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { buildWorldCup2026Dataset } = require("./world-cup-2026-dataset.cjs");

const dryRun = process.argv.includes("--dry-run");
const dataset = buildWorldCup2026Dataset();

const sqlString = (value) => value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
const sqlJson = (value) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
const statusFor = (match) => {
  const now = new Date();
  if (now < new Date(match.prediction_open_at)) return "fechado";
  if (now < new Date(match.prediction_close_at)) return "aberto";
  return "ao_vivo";
};

const values = dataset.matches.map((match) => `(
  ${match.matchNumber},
  ${sqlString(match.homeTeam)},
  ${sqlString(match.awayTeam)},
  ${sqlString(match.startTime)}::timestamptz,
  ${sqlString(match.kickoffUtc ?? match.startTime)}::timestamptz,
  ${sqlString(match.prediction_open_at)}::timestamptz,
  ${sqlString(match.prediction_close_at)}::timestamptz,
  ${sqlString(statusFor(match))}::public.match_status,
  ${sqlString(dataset.championship)},
  ${sqlString(match.stadium)},
  ${sqlString(match.venueTimezone)},
  ${sqlString(match.venueTimezone)},
  ${sqlString(match.source ?? "espn_fifa_world_cup_scoreboard")},
  ${sqlString(match.kickoffBrt)},
  ${sqlString(match.round)},
  ${sqlString(dataset.providerName)},
  ${sqlString(match.providerExternalId)},
  ${sqlJson({ away: 0, home: 0 })},
  ${sqlJson({ city: match.city, country: match.country, espn_event_id: match.eventId, group: match.group, kickoff_brt: match.kickoffBrt, kickoff_local: match.kickoffLocal, match_number: match.matchNumber, source: match.source ?? "espn_fifa_world_cup_scoreboard", source_away_team: match.sourceAwayTeam, source_home_team: match.sourceHomeTeam, stage: match.stage, venue_timezone: match.venueTimezone })}
)`).join(",\n");

const sql = `
insert into public.tournaments (name, type, active, slug)
values (${sqlString(dataset.tournamentName)}, 'world_cup', true, ${sqlString(dataset.championship)})
on conflict (slug) where slug is not null and deleted_at is null
  do update set name = excluded.name, active = true
returning id;

with tournament as (
  select id from public.tournaments where slug = ${sqlString(dataset.championship)} and deleted_at is null limit 1
), dataset(match_number, home_team, away_team, start_time, start_time_utc, prediction_open_at, prediction_close_at, status, championship, stadium, venue_timezone, source_timezone, kickoff_source, display_time_br, round, provider_name, provider_external_id, live_score, stats) as (
  values
${values}
), normalized_existing as (
  update public.matches m
  set
    provider_external_id = dataset.provider_external_id,
    stats = coalesce(m.stats, '{}'::jsonb) || dataset.stats
  from dataset
  where m.provider_name = dataset.provider_name
    and m.championship = dataset.championship
    and m.deleted_at is null
    and m.stats ->> 'match_number' = dataset.match_number::text
    and m.provider_external_id is distinct from dataset.provider_external_id
  returning m.id
)
insert into public.matches (
  tournament_id,
  home_team,
  away_team,
  home_score,
  away_score,
  start_time,
  start_time_utc,
  prediction_open_at,
  prediction_close_at,
  status,
  championship,
  stadium,
  venue_timezone,
  source_timezone,
  kickoff_source,
  kickoff_verified_at,
  display_time_br,
  round,
  provider_name,
  provider_external_id,
  live_score,
  stats,
  last_synced_at
)
select
  tournament.id,
  dataset.home_team,
  dataset.away_team,
  0,
  0,
  dataset.start_time,
  dataset.start_time_utc,
  dataset.prediction_open_at,
  dataset.prediction_close_at,
  dataset.status,
  dataset.championship,
  dataset.stadium,
  dataset.venue_timezone,
  dataset.source_timezone,
  dataset.kickoff_source,
  now(),
  dataset.display_time_br,
  dataset.round,
  dataset.provider_name,
  dataset.provider_external_id,
  dataset.live_score,
  dataset.stats,
  now()
from dataset
cross join tournament
on conflict (provider_name, provider_external_id) where provider_name is not null and provider_external_id is not null
  do update set
    home_team = excluded.home_team,
    away_team = excluded.away_team,
    start_time = excluded.start_time,
    start_time_utc = excluded.start_time_utc,
    prediction_open_at = excluded.prediction_open_at,
    prediction_close_at = excluded.prediction_close_at,
    status = case when public.matches.status = 'encerrado' then public.matches.status else excluded.status end,
    championship = excluded.championship,
    stadium = excluded.stadium,
    venue_timezone = excluded.venue_timezone,
    source_timezone = excluded.source_timezone,
    kickoff_source = excluded.kickoff_source,
    kickoff_verified_at = excluded.kickoff_verified_at,
    display_time_br = excluded.display_time_br,
    round = excluded.round,
    live_score = case when public.matches.status = 'encerrado' then public.matches.live_score else excluded.live_score end,
    stats = excluded.stats,
    last_synced_at = now();

insert into public.match_sync_queue (match_id, provider, sync_status, next_sync_at)
select id, 'live-results', 'pending', start_time - interval '2 hours'
from public.matches
where provider_name = ${sqlString(dataset.providerName)}
  and championship = ${sqlString(dataset.championship)}
on conflict (match_id, provider)
  do update set
    sync_status = 'pending',
    next_sync_at = excluded.next_sync_at,
    error_message = null;

notify pgrst, 'reload schema';

select
  (select count(*) from public.matches where provider_name = ${sqlString(dataset.providerName)} and championship = ${sqlString(dataset.championship)}) as matches,
  (select count(*) from public.match_sync_queue q join public.matches m on m.id = q.match_id where m.provider_name = ${sqlString(dataset.providerName)} and m.championship = ${sqlString(dataset.championship)}) as queue_items;
`;

const tempDir = path.resolve(__dirname, "..", "supabase", ".temp");
fs.mkdirSync(tempDir, { recursive: true });
const sqlPath = path.join(tempDir, "import-world-cup-2026-linked.sql");
fs.writeFileSync(sqlPath, sql);

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, groups: dataset.groups.length, matches: dataset.matches.length, sqlPath, teams: dataset.teams.length }, null, 2));
  process.exit(0);
}

execSync(`npx supabase db query --linked --file "${sqlPath}"`, { stdio: "inherit", shell: true });
