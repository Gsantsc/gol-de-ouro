// QA VALIDATION FIX - Deletar partidas com tournament null por nome
const {
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();

async function deleteNullMatchesByName() {
  console.log('=== DELETANDO PARTIDAS COM TOURNAMENT NULL POR NOME ===\n');
  
  const matchesToDelete = [
    'Espanha vs Inglaterra',
    'Brasil vs Argentina',
    'Franca vs Alemanha'
  ];
  
  try {
    for (const matchName of matchesToDelete) {
      console.log(`Buscando: ${matchName}`);
      
      // Buscar partida
      const response = await fetch(`${SUPABASE_URL}/rest/v1/matches?home_team=ilike.${matchName.split(' vs ')[0]}&away_team=ilike.${matchName.split(' vs ')[1]}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.log(`  ERRO AO BUSCAR: ${error}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.length === 0) {
        console.log(`  Não encontrada`);
        continue;
      }
      
      const match = data[0];
      console.log(`  Encontrada: ID ${match.id}`);
      
      // Deletar
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
        console.log(`  ✅ Deletada`);
      }
    }
    
    console.log('\n✅ Partidas deletadas');
    
  } catch (error) {
    console.log('ERRO:', error.message);
  }
}

deleteNullMatchesByName();
