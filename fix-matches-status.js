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

async function fixMatchesStatus() {
  console.log('=== CORRIGINDO STATUS DAS PARTIDAS ===\n');
  
  try {
    const matches = await fetchSupabase('matches');
    console.log(`Total de partidas: ${matches.length}`);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let fixedCount = 0;
    
    for (const match of matches) {
      const matchDate = new Date(match.start_time);
      const isFuture = matchDate >= today;
      const isToday = matchDate.toDateString() === today.toDateString();
      
      // Partidas futuras devem ter status "aberto"
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
        
        console.log(`Corrigido: ${match.home_team} vs ${match.away_team} (${match.start_time}) - encerrado -> aberto`);
        fixedCount++;
      }
      
      // Partidas passadas devem ter status "encerrado"
      if (!isFuture && match.status === 'aberto') {
        await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'encerrado' })
        });
        
        console.log(`Corrigido: ${match.home_team} vs ${match.away_team} (${match.start_time}) - aberto -> encerrado`);
        fixedCount++;
      }
    }
    
    console.log(`\nTotal de correções: ${fixedCount}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

fixMatchesStatus();
