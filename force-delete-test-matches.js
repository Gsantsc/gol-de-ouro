const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function forceDeleteTestMatches() {
  console.log('=== FORÇANDO DELEÇÃO DE PARTIDAS DE TESTE ===\n');
  
  try {
    // Buscar todas as partidas
    const response = await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const matches = await response.json();
    console.log(`Total de partidas: ${matches.length}`);
    
    // Encontrar partidas de teste
    const testMatches = matches.filter(m => 
      m.home_team.includes('Time Teste') || m.away_team.includes('Time Teste')
    );
    
    console.log(`Partidas de teste encontradas: ${testMatches.length}`);
    
    for (const match of testMatches) {
      console.log(`Deletando: ${match.home_team} vs ${match.away_team} (ID: ${match.id})`);
      
      // Deletar palpites primeiro
      await fetch(`${SUPABASE_URL}/rest/v1/predictions?match_id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
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
      
      // Deletar partida
      const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (deleteResponse.ok) {
        console.log(`✅ Deletado com sucesso`);
      } else {
        const error = await deleteResponse.text();
        console.log(`❌ Erro ao deletar: ${error}`);
      }
    }
    
    // Verificar total final
    const finalResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const finalMatches = await finalResponse.json();
    console.log(`\nTotal de partidas final: ${finalMatches.length}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

forceDeleteTestMatches();
