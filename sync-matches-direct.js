// LEAGUE AUDIT
const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function fetchSupabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function callRpc(functionName, params = {}) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });
  
  const responseText = await response.text();
  
  if (!response.ok) {
    throw new Error(`RPC Error: ${responseText}`);
  }
  
  if (!responseText) {
    return null;
  }
  
  return JSON.parse(responseText);
}

// LEAGUE AUDIT
// REMOVE MOCK MATCH DATA - Commented out entire sync-matches-direct.js, using API-Football sync only
// Provider local em JavaScript puro
// const CHAMPIONSHIP_KEYS = [
//   'world_cup_2026',
//   'brasileirao_a',
//   'copa_do_brasil',
//   'champions_league',
//   'libertadores',
//   'sul_americana'
// ];
//
// const CHAMPIONSHIP_LABELS = {
//   world_cup_2026: 'Copa do Mundo 2026',
//   brasileirao_a: 'Brasileirão Série A',
//   copa_do_brasil: 'Copa do Brasil',
//   champions_league: 'Champions League',
//   libertadores: 'Libertadores',
//   sul_americana: 'Sul-Americana'
// };
//
// const teamsByChampionship = {
//   world_cup_2026: [
//     ["Brasil", "Mexico", "https://flagcdn.com/w80/br.png", "https://flagcdn.com/w80/mx.png"],
//     ["Estados Unidos", "Canada", "https://flagcdn.com/w80/us.png", "https://flagcdn.com/w80/ca.png"],
//   ],
//   brasileirao_a: [
//     ["Flamengo", "Palmeiras", null, null],
//     ["Sao Paulo", "Gremio", null, null],
//   ],
//   copa_do_brasil: [
//     ["Flamengo", "Corinthians", null, null],
//     ["Cruzeiro", "Vasco", null, null],
//   ],
//   champions_league: [
//     ["Real Madrid", "Manchester City", null, null],
//     ["Bayern de Munique", "PSG", null, null],
//   ],
//   libertadores: [
//     ["Fluminense", "River Plate", null, null],
//     ["Boca Juniors", "Atletico-MG", null, null],
//   ],
//   sul_americana: [
//     ["Athletico-PR", "LDU", null, null],
//     ["Independiente", "Fortaleza", null, null],
//   ],
// };

// REMOVE MOCK MATCH DATA - Commented out buildStats, using API-Football sync only
// const buildStats = (seed) => ({
//   possessionHome: 48 + (seed % 8),
//   possessionAway: 52 - (seed % 8),
//   shotsHome: 8 + seed,
//   shotsAway: 6 + seed,
//   shotsOnGoalHome: 3 + (seed % 3),
//   shotsOnGoalAway: 2 + (seed % 3),
//   cornersHome: 3 + (seed % 4),
//   cornersAway: 2 + (seed % 4),
//   foulsHome: 8 + seed,
//   foulsAway: 9 + seed,
//   yellowCardsHome: seed % 3,
//   yellowCardsAway: (seed + 1) % 3,
//   redCardsHome: 0,
//   redCardsAway: 0,
//   xgHome: Number((1.1 + seed * 0.2).toFixed(2)),
//   xgAway: Number((0.8 + seed * 0.18).toFixed(2)),
// });

// REMOVE MOCK MATCH DATA - Commented out buildAutomaticMatchFixtures, using API-Football sync only
// const buildAutomaticMatchFixtures = () => {
//   const targetDate = new Date('2026-05-20T00:00:00');
//
//   const championshipDates = {
//     world_cup_2026: [
//       new Date('2026-05-20T19:00:00'), // Brasil vs Mexico (hoje)
//       new Date('2026-06-14T13:00:00'), // Estados Unidos vs Canada
//     ],
//     brasileirao_a: [
//       new Date('2026-05-20T21:00:00'), // Flamengo vs Palmeiras (hoje)
//       new Date('2026-05-24T19:00:00'), // Sao Paulo vs Gremio
//     ],
//     copa_do_brasil: [
//       new Date('2026-05-21T19:30:00'), // Flamengo vs Corinthians
//       new Date('2026-06-02T16:00:00'), // Cruzeiro vs Vasco
//     ],
//     champions_league: [
//       new Date('2026-05-21T16:00:00'), // Real Madrid vs Manchester City
//       new Date('2026-05-29T19:00:00'), // Bayern de Munique vs PSG
//     ],
//     libertadores: [
//       new Date('2026-05-20T19:00:00'), // Fluminense vs River Plate (hoje)
//       new Date('2026-05-23T19:00:00'), // Boca Juniors vs Atletico-MG
//     ],
//     sul_americana: [
//       new Date('2026-05-20T21:30:00'), // Athletico-PR vs LDU (hoje)
//       new Date('2026-05-22T21:30:00'), // Independiente vs Fortaleza
//     ],
//   };
//
//   const matches = [];
//
//   for (const championship of CHAMPIONSHIP_KEYS) {
//     const dates = championshipDates[championship] || [];
//     const fixtures = teamsByChampionship[championship];
//
//     for (let fixtureIndex = 0; fixtureIndex < fixtures.length; fixtureIndex++) {
//       const kickoff = dates[fixtureIndex] || new Date(targetDate);
//       kickoff.setHours(kickoff.getHours() - 3);
//
//       const [homeTeam, awayTeam, homeLogoUrl, awayLogoUrl] = fixtures[fixtureIndex];
//       const seed = fixtureIndex + 1;
//
//       matches.push({
//         awayLogoUrl,
//         awayScore: 0,
//         awayTeam,
//         championship,
//         events: [],
//         externalId: `local-${championship}-${fixtureIndex + 1}`,
//         homeLogoUrl,
//         homeScore: 0,
//         homeTeam,
//         kickoff: kickoff.toISOString(),
//         round: fixtureIndex === 0 ? "Rodada 1" : "Rodada 2",
//         stadium: `${CHAMPIONSHIP_LABELS[championship]} Arena`,
//         status: kickoff < new Date() ? "encerrado" : "aberto",
//         stats: buildStats(seed),
//       });
//     }
//   }
//
//   return matches;
// };

// REMOVE MOCK MATCH DATA - Commented out syncMatchesDirect, using API-Football sync only
// async function syncMatchesDirect() {
//   console.log('=== SINCRONIZANDO PARTIDAS COM DATAS REAIS (DIRETO) ===\n');
//
//   try {
//     // Obter partidas do provider local
//     const providerMatches = buildAutomaticMatchFixtures();
//     console.log(`Partidas do provider: ${providerMatches.length}`);
//
//     // Cache de tournaments
//     const tournamentCache = new Map();
//     let insertedCount = 0;
//     let updatedCount = 0;
//
//     for (const providerMatch of providerMatches) {
//       // Garantir tournament existe
//       let tournamentId = tournamentCache.get(providerMatch.championship);
//
//       if (!tournamentId) {
//         const tournaments = await fetchSupabase('tournaments');
//         const existing = tournaments.find(t => t.slug === providerMatch.championship);
//
//         if (existing) {
//           tournamentId = existing.id;
//         } else {
//           // Criar tournament
//           const tournamentLabels = {
//             world_cup_2026: 'Copa do Mundo 2026',
//             brasileirao_a: 'Brasileirão Série A',
//             copa_do_brasil: 'Copa do Brasil',
//             champions_league: 'Champions League',
//             libertadores: 'Libertadores',
//             sul_americana: 'Sul-Americana'
//           };
//
//           const tournamentTypes = {
//             world_cup_2026: 'world_cup',
//             brasileirao_a: 'brasileirao',
//             copa_do_brasil: 'brasileirao',
//             champions_league: 'champions_league',
//             libertadores: 'libertadores',
//             sul_americana: 'libertadores'
//           };
//
//           const newTournament = await fetchSupabase('tournaments', {
//             method: 'POST',
//             body: JSON.stringify({
//               name: tournamentLabels[providerMatch.championship] || providerMatch.championship,
//               slug: providerMatch.championship,
//               type: tournamentTypes[providerMatch.championship] || 'champions_league',
//               active: true
//             })
//           });
//
//           tournamentId = newTournament[0].id;
//         }
//
//         tournamentCache.set(providerMatch.championship, tournamentId);
//       }
//
//       // Verificar se partida já existe
//       const matches = await fetchSupabase('matches', {
//         headers: {
//           'Accept': 'application/json'
//         }
//       });
//
//       const existing = matches.find(m =>
//         m.provider_name === 'local-fixtures' &&
//         m.provider_external_id === providerMatch.externalId
//       );
//
//       const payload = {
//         away_score: providerMatch.awayScore,
//         away_team: providerMatch.awayTeam,
//         away_team_logo_url: providerMatch.awayLogoUrl,
//         championship: providerMatch.championship,
//         home_score: providerMatch.homeScore,
//         home_team: providerMatch.homeTeam,
//         home_team_logo_url: providerMatch.homeLogoUrl,
//         last_synced_at: new Date().toISOString(),
//         live_score: { away: providerMatch.awayScore, home: providerMatch.homeScore },
//         provider_external_id: providerMatch.externalId,
//         provider_name: 'local-fixtures',
//         round: providerMatch.round,
//         stadium: providerMatch.stadium,
//         start_time: providerMatch.kickoff,
//         status: providerMatch.status,
//         tournament_id: tournamentId
//       };
//
//       if (existing) {
//         await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${existing.id}`, {
//           method: 'PATCH',
//           headers: {
//             'apikey': SUPABASE_SERVICE_KEY,
//             'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(payload)
//         });
//         updatedCount++;
//         console.log(`Atualizado: ${providerMatch.homeTeam} vs ${providerMatch.awayTeam} (${providerMatch.kickoff})`);
//       } else {
//         await fetchSupabase('matches', {
//           method: 'POST',
//           body: JSON.stringify(payload)
//         });
//         insertedCount++;
//         console.log(`Inserido: ${providerMatch.homeTeam} vs ${providerMatch.awayTeam} (${providerMatch.kickoff})`);
//       }
//     }
//
//     console.log(`\n=== RESUMO ===`);
//     console.log(`Inseridas: ${insertedCount}`);
//     console.log(`Atualizadas: ${updatedCount}`);
//
//   } catch (error) {
//     console.error('Erro:', error.message);
//   }
// }

// REMOVE MOCK MATCH DATA - Commented out function call, using API-Football sync only
// syncMatchesDirect();
