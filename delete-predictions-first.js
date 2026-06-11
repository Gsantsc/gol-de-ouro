const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function deletePredictionsFirst() {
  console.log('=== DELETANDO PALPITES PRIMEIRO ===\n');
  
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
      console.log(`Processando: ${match.home_team} vs ${match.away_team} (ID: ${match.id})`);
      
      // Buscar palpites associados
      const predictionsResponse = await fetch(`${SUPABASE_URL}/rest/v1/predictions?match_id=eq.${match.id}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const predictions = await predictionsResponse.json();
      console.log(`  Palpites encontrados: ${predictions.length}`);
      
      // Deletar cada palpite individualmente
      for (const prediction of predictions) {
        const deletePredictionResponse = await fetch(`${SUPABASE_URL}/rest/v1/predictions?id=eq.${prediction.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (deletePredictionResponse.ok) {
          console.log(`  ✅ Palpite deletado: ${prediction.id}`);
        } else {
          const error = await deletePredictionResponse.text();
          console.log(`  ❌ Erro ao deletar palpite: ${error}`);
        }
      }
      
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
      const deleteMatchResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (deleteMatchResponse.ok) {
        console.log(`✅ Partida deletada com sucesso`);
      } else {
        const error = await deleteMatchResponse.text();
        console.log(`❌ Erro ao deletar partida: ${error}`);
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

deletePredictionsFirst();
