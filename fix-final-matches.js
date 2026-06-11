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

async function fixFinalMatches() {
  console.log('=== CORREÇÃO FINAL DAS PARTIDAS ===\n');
  
  try {
    const matches = await fetchSupabase('matches');
    console.log(`Total de partidas: ${matches.length}`);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let deletedCount = 0;
    let statusFixedCount = 0;
    
    for (const match of matches) {
      // Deletar partidas de teste
      if (match.home_team.includes('Time Teste') || match.away_team.includes('Time Teste')) {
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
        deletedCount++;
        continue;
      }
      
      // Corrigir status das partidas em 20/05/2026
      const matchDate = new Date(match.start_time);
      const isFuture = matchDate >= today;
      
      if (isFuture && match.status === 'encerrado') {
        await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'aberto' })
        });
        
        console.log(`Status corrigido: ${match.home_team} vs ${match.away_team} - encerrado -> aberto`);
        statusFixedCount++;
      }
    }
    
    console.log(`\n=== RESUMO ===`);
    console.log(`Partidas deletadas: ${deletedCount}`);
    console.log(`Status corrigidos: ${statusFixedCount}`);
    
    // Verificar total final
    const finalMatches = await fetchSupabase('matches');
    console.log(`Total de partidas final: ${finalMatches.length}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

fixFinalMatches();
