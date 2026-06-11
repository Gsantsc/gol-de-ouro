# API-FOOTBALL Integration - Implementation Summary

## Overview
Integrated API-FOOTBALL into GOL DE OURO to sync real football data including matches, teams, logos, standings, lineups, and live events.

## Changes Made

### 1. Enhanced Sync Route (`apps/admin/src/app/api/admin/sync-matches/route.ts`)
- **Added caching strategy**: In-memory cache with configurable durations
  - Fixtures: 6 hours
  - Live matches: 60 seconds
  - Events: 60 seconds
  - Teams: Once (Infinity)
  - Standings: 6 hours

- **Added logging**: Detailed sync operation logs
  - SYNC START
  - SYNC PROVIDER
  - SYNC TEAMS START/COMPLETE
  - SYNC FIXTURES START/FETCHED/COMPLETE
  - SYNC SUCCESS
  - Error logging with timestamps

- **Added teams sync**: Syncs teams from API-Football and links them to matches
  - Fetches teams for each championship/league
  - Upserts teams with external_id, name, logo_url
  - Links teams to matches via home_team_id and away_team_id

- **Enhanced SyncSummary**: Returns detailed sync metrics
  - insertedCount, updatedCount
  - teamsSynced, standingsSynced, lineupsSynced
  - cacheHits, cacheMisses

### 2. Updated Admin Matches Page (`apps/admin/src/app/admin/page.tsx`)
- **Improved UI**: Enhanced matches panel with logos and better grid view
  - Shows team logos (home_team_logo_url, away_team_logo_url)
  - Live badge with animation for "ao_vivo" matches
  - Sorted matches: live first, then upcoming, then finished
  - Card-based layout instead of table
  - Manual creation collapsed by default (toggle button)

- **API-FOOTBALL INTEGRATION comments**: Added clear comments for maintenance

### 3. Environment Variables (`apps/admin/.env.local.example`)
Added API-FOOTBALL configuration:
```env
API_FOOTBALL_KEY=your_api_key_here
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
MATCHES_PROVIDER=api-football
API_FOOTBALL_INCLUDE_DETAILS=true
API_FOOTBALL_SEASON=2025
MATCHES_PROVIDER_TIMEZONE=America/Sao_Paulo
```

### 4. Database Migration (`supabase/migrations/20260520210000_api_football_tables.sql`)
Already created by user with:
- `teams` table (external_id, name, logo_url, country, stadium, founded_year)
- `standings` table (tournament standings with position, points, goal difference)
- `match_lineups` table (lineups with formation, players, starter/captain flags)
- Added `home_team_id` and `away_team_id` columns to matches table

## Existing Infrastructure (No Changes Needed)

### API-FOOTBALL Provider (`packages/shared/src/services/matches-provider/api-football-provider.ts`)
- Already fully implemented
- Supports all required endpoints: leagues, teams, fixtures, statistics, events
- Proper error handling and timeout configuration
- Status mapping from API to internal format

### Mobile MatchCard (`apps/mobile/src/components/MatchCard.tsx`)
- Already supports team logos via `logoUrl` prop
- Displays logo if available, otherwise shows initials
- Will automatically display synced logos from API-Football

## Configuration Instructions

### Step 1: Get API-Football Key
1. Go to https://api-football.com/
2. Sign up and get your API key
3. Choose a plan (Free tier has limits but works for testing)

### Step 2: Configure Environment Variables
Add to `apps/admin/.env.local`:
```env
API_FOOTBALL_KEY=your_actual_api_key_here
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
MATCHES_PROVIDER=api-football
API_FOOTBALL_INCLUDE_DETAILS=true
API_FOOTBALL_SEASON=2025
MATCHES_PROVIDER_TIMEZONE=America/Sao_Paulo
```

### Step 3: Apply Database Migration
Run the migration to create teams, standings, and match_lineups tables:
```bash
supabase db push
```

Or apply manually:
```sql
-- The migration is already in: supabase/migrations/20260520210000_api_football_tables.sql
```

## Validation Steps

### 1. Admin Sync Test
1. Login as admin using `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` from `.env`
2. Navigate to "Partidas" tab
3. Click "Sincronizar Jogos" button
4. Check console logs for:
   - SYNC START
   - SYNC PROVIDER: api-football
   - SYNC TEAMS START/COMPLETE
   - SYNC FIXTURES START/FETCHED/COMPLETE
   - SYNC SUCCESS
5. Verify matches appear with logos
6. Verify live matches show "AO VIVO" badge
7. Verify matches are sorted: live → upcoming → finished

### 2. Mobile Display Test
1. Open mobile app
2. Navigate to matches screen
3. Verify team logos appear (from synced data)
4. Verify match details show correctly
5. Verify predictions work as before

### 3. Database Validation
Check Supabase directly:
```sql
-- Verify teams were synced
SELECT COUNT(*) FROM teams;

-- Verify teams are linked to matches
SELECT m.home_team, t.name as home_team_name, t.logo_url
FROM matches m
LEFT JOIN teams t ON m.home_team_id = t.id
LIMIT 10;

-- Verify sync logs
SELECT * FROM match_provider_runs
ORDER BY created_at DESC
LIMIT 5;
```

## Features Implemented

### ✅ Completed
- Teams sync with logos
- Match sync with team linking
- Caching strategy (fixtures 6h, live 60s, events 60s, teams 1x)
- Detailed logging for sync operations
- Admin UI with logos and live badges
- Match sorting (live first, then upcoming, then finished)
- Environment variable configuration
- Database migration for teams, standings, lineups

### ⏳ TODO (Future Enhancements)
- Standings sync (placeholder in code, needs implementation)
- Lineups sync (placeholder in code, needs implementation)
- Live match auto-refresh (60s interval via polling or webhook)
- Events sync for live matches only

## Architecture Notes

### Decoupled Provider Pattern
The system uses a decoupled provider pattern:
- `MatchesProvider` interface in `packages/shared/src/services/matches-provider/types.ts`
- `api-football-provider.ts` implements the interface
- `local-provider.ts` provides mock data for testing
- Sync route uses `createMatchesProvider()` factory

This allows easy switching between providers without changing UI or database logic.

### Server-Side Only
All API-Football calls are made server-side via the Next.js API route:
- Never exposes API key to client
- Uses environment variables for configuration
- Proper error handling and timeouts

### Caching Strategy
Simple in-memory cache for sync operations:
- Reduces API calls
- Configurable durations per data type
- Cache hits/misses tracked in sync summary

## Troubleshooting

### Sync Fails with 401 Error
- Check API_FOOTBALL_KEY is correct
- Verify API key is active at api-football.com

### Sync Fails with 429 Error
- Rate limit exceeded (Free tier: 100 requests/day)
- Wait before retrying or upgrade plan

### Logos Not Showing
- Check if teams were synced (check teams table)
- Verify logo_url is not null
- Check console for image load errors

### Matches Not Appearing
- Check MATCHES_PROVIDER=api-football is set
- Verify API_FOOTBALL_KEY is configured
- Check sync logs for errors
- Verify tournaments exist in database

## Security Notes

- API key is server-side only (never exposed to client)
- All sync operations require admin authentication
- RLS policies protect data access
- No hardcoded credentials in code

## Performance Considerations

- Sync is sequential (teams first, then matches)
- Cache reduces API calls significantly
- Timeout of 30 seconds per API request
- In-memory cache resets on server restart

## Next Steps

1. Configure API_FOOTBALL_KEY in .env.local
2. Apply database migration
3. Test sync in admin panel
4. Verify mobile displays logos
5. Monitor sync logs for errors
6. Consider implementing standings and lineups sync
