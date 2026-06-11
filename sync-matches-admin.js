const {
  getAdminCredentials,
  getSupabaseAnonKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

async function syncMatches() {
  console.log('=== SINCRONIZANDO PARTIDAS COM DATAS REAIS ===\n');
  
  try {
    // Login admin
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Login admin falhou');
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token;

    // Sincronizar partidas via API
    const syncResponse = await fetch(`${SUPABASE_URL}/api/admin/sync-matches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!syncResponse.ok) {
      const error = await syncResponse.text();
      throw new Error(`Sincronização falhou: ${error}`);
    }

    const syncData = await syncResponse.json();
    console.log('✅ Sincronização concluída:', syncData);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

syncMatches();
