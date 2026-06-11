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

async function cleanupTestMatches() {
  console.log('=== LIMPANDO PARTIDAS DE TESTE ===\n');
  
  try {
    const matches = await fetchSupabase('matches');
    console.log(`Total de partidas antes: ${matches.length}`);
    
    // Deletar apenas partidas com "Time Teste" no nome
    const testMatches = matches.filter(m => 
      m.home_team.includes('Time Teste') || m.away_team.includes('Time Teste')
    );
    console.log(`Partidas de teste encontradas: ${testMatches.length}`);
    
    for (const match of testMatches) {
      // Deletar estatísticas
      await fetch(`${SUPABASE_URL}/rest/v1/match_statistics?match_id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Deletar eventos
      await fetch(`${SUPABASE_URL}/rest/v1/match_events?match_id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Deletar palpites
      await fetch(`${SUPABASE_URL}/rest/v1/predictions?match_id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Deletar partida
      await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Deletado: ${match.home_team} vs ${match.away_team}`);
    }
    
    const remainingMatches = await fetchSupabase('matches');
    console.log(`\nTotal de partidas após limpeza: ${remainingMatches.length}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

cleanupTestMatches();
