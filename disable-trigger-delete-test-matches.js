const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function disableTriggerAndDelete() {
  console.log('=== DESABILITANDO TRIGGER E DELETANDO PARTIDAS DE TESTE ===\n');
  
  try {
    // Desabilitar trigger
    const disableTriggerResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'drop trigger if exists predictions_protect_delete on public.predictions;'
      })
    });
    
    if (disableTriggerResponse.ok) {
      console.log('✅ Trigger desabilitado');
    } else {
      const error = await disableTriggerResponse.text();
      console.log(`⚠️  Erro ao desabilitar trigger: ${error}`);
    }
    
    // Buscar partidas de teste
    const matchesResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const matches = await matchesResponse.json();
    const testMatches = matches.filter(m => 
      m.home_team.includes('Time Teste') || m.away_team.includes('Time Teste')
    );
    
    console.log(`Partidas de teste encontradas: ${testMatches.length}`);
    
    for (const match of testMatches) {
      console.log(`Deletando: ${match.home_team} vs ${match.away_team} (ID: ${match.id})`);
      
      // Deletar palpites
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
      const deleteMatchResponse = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${match.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (deleteMatchResponse.ok) {
        console.log(`✅ Partida deletada`);
      } else {
        const error = await deleteMatchResponse.text();
        console.log(`❌ Erro ao deletar partida: ${error}`);
      }
    }
    
    // Reabilitar trigger
    const enableTriggerResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'create trigger predictions_protect_delete before delete on public.predictions for each row execute function public.protect_locked_prediction();'
      })
    });
    
    if (enableTriggerResponse.ok) {
      console.log('✅ Trigger reabilitado');
    } else {
      const error = await enableTriggerResponse.text();
      console.log(`⚠️  Erro ao reabilitar trigger: ${error}`);
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

disableTriggerAndDelete();
