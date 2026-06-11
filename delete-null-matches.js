// QA VALIDATION FIX - Deletar partidas com tournament null
const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function deleteNullMatches() {
  console.log('=== DELETANDO PARTIDAS COM TOURNAMENT NULL ===\n');
  
  try {
    // Buscar partidas com tournament null
    const response = await fetch(`${SUPABASE_URL}/rest/v1/matches?tournament_id=is.null`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log('ERRO:', error);
      return;
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      console.log('Nenhuma partida com tournament null encontrada');
      return;
    }
    
    console.log(`Partidas com tournament null: ${data.length}`);
    
    // Deletar cada partida
    for (const match of data) {
      console.log(`Deletando: ${match.home_team} vs ${match.away_team}`);
      
      const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!deleteResponse.ok) {
        const error = await deleteResponse.text();
        console.log(`  ERRO AO DELETAR: ${error}`);
      } else {
        console.log(`  ✅ Deletado`);
      }
    }
    
    console.log('\n✅ Partidas com tournament null deletadas');
    
  } catch (error) {
    console.log('ERRO:', error.message);
  }
}

deleteNullMatches();
