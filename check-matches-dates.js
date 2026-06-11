const {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
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

async function checkMatchesDates() {
  console.log('=== VERIFICANDO DATAS DAS PARTIDAS ===\n');
  
  try {
    const matches = await fetchSupabase('matches', {
      headers: {
        'Accept': 'application/json',
        'Prefer': 'return=representation'
      }
    });
    
    // Ordenar por start_time
    matches.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    console.log(`Total de partidas: ${matches.length}\n`);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date('2026-05-20T00:00:00');
    
    console.log('Data atual:', now.toISOString());
    console.log('Data alvo (20/05/2026):', targetDate.toISOString());
    console.log('');
    
    let pastMatches = 0;
    let futureMatches = 0;
    let targetDateMatches = 0;
    
    matches.forEach(match => {
      const matchDate = new Date(match.start_time);
      const isPast = matchDate < today;
      const isFuture = matchDate >= today;
      const isTargetDate = matchDate.toDateString() === targetDate.toDateString();
      
      if (isPast) pastMatches++;
      if (isFuture) futureMatches++;
      if (isTargetDate) targetDateMatches++;
      
      console.log(`${match.championship} - ${match.home_team} vs ${match.away_team}`);
      console.log(`  Data: ${matchDate.toISOString()}`);
      console.log(`  Status: ${match.status}`);
      console.log(`  Passado: ${isPast ? 'SIM' : 'NÃO'}`);
      console.log(`  Futuro: ${isFuture ? 'SIM' : 'NÃO'}`);
      console.log(`  Data alvo: ${isTargetDate ? 'SIM' : 'NÃO'}`);
      console.log('');
    });
    
    console.log('=== RESUMO ===');
    console.log(`Partidas passadas: ${pastMatches}`);
    console.log(`Partidas futuras: ${futureMatches}`);
    console.log(`Partidas em 20/05/2026: ${targetDateMatches}`);
    console.log('');
    
    // Verificar ordenação
    const isChronologicallyOrdered = matches.every((match, index) => {
      if (index === 0) return true;
      const current = new Date(match.start_time);
      const previous = new Date(matches[index - 1].start_time);
      return current >= previous;
    });
    
    console.log(`Ordenação cronológica: ${isChronologicallyOrdered ? 'CORRETA' : 'INCORRETA'}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkMatchesDates();
