const {
  getAdminCredentials,
  getSupabaseAnonKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

let authToken = null;

async function fetchSupabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken || SUPABASE_ANON_KEY}`,
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

async function callRpc(functionName, params = {}) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RPC Error: ${error}`);
  }
  
  return response.json();
}

async function validateAdminE2E() {
  console.log('=== VALIDAÇÃO E2E DO ADMIN ===\n');

  try {
    // 0. Fazer login primeiro para obter token de autenticação
    console.log('0. Fazendo login do admin...');
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
      const error = await loginResponse.text();
      console.error('❌ ERRO: Login falhou:', error);
      return false;
    }

    const loginData = await loginResponse.json();
    authToken = loginData.access_token;
    console.log('✅ Login realizado com sucesso:', {
      user_id: loginData.user.id,
      email: loginData.user.email,
    });

    // 1. Verificar se o usuário admin existe
    console.log('\n1. Verificando usuário admin...');
    const adminUser = await fetchSupabase('users', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Usuários encontrados:', adminUser.length);
    console.log('Primeiro usuário:', adminUser[0]);
    
    const admin = adminUser.find(u => u.email === ADMIN_EMAIL);
    
    if (!admin) {
      console.error('❌ ERRO: Usuário admin não encontrado');
      console.error('Emails encontrados:', adminUser.map(u => u.email));
      return false;
    }

    console.log('✅ Usuário admin encontrado:', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      approval_status: admin.approval_status,
      blocked: admin.blocked,
    });

    // 2. Validar campos do admin
    console.log('\n2. Validando campos do admin...');
    const adminValidation = {
      role: admin.role === 'admin',
      status: admin.status === 'approved',
      approval_status: admin.approval_status === 'approved',
      blocked: admin.blocked === false,
      deleted_at: admin.deleted_at === null,
    };

    console.log('Validação:', adminValidation);
    const allValid = Object.values(adminValidation).every(v => v === true);
    if (allValid) {
      console.log('✅ Todos os campos do admin estão corretos');
    } else {
      console.error('❌ ERRO: Campos do admin inválidos');
      return false;
    }

    // 3. Login já foi feito no passo 0

    // 4. Verificar se o ranking do admin existe
    console.log('\n4. Verificando ranking do admin...');
    const rankings = await fetchSupabase('rankings');
    const adminRanking = rankings.find(r => r.user_id === admin.id);

    if (!adminRanking) {
      console.error('❌ ERRO: Ranking não encontrado');
      return false;
    }

    console.log('✅ Ranking encontrado:', {
      total_points: adminRanking.total_points,
      correct_results: adminRanking.correct_results,
      exact_scores: adminRanking.exact_scores,
    });

    // 5. Verificar métricas do dashboard
    console.log('\n5. Verificando métricas do dashboard...');
    const metrics = await callRpc('admin_dashboard_metrics');

    console.log('✅ Métricas do dashboard:', metrics[0]);

    // 6. Verificar visão geral de usuários
    console.log('\n6. Verificando visão geral de usuários...');
    const userOverview = await callRpc('admin_user_overview');

    console.log('✅ Visão geral de usuários:', userOverview.length, 'usuários');

    // 7. Verificar tournaments
    console.log('\n7. Verificando tournaments...');
    const tournaments = await fetchSupabase('tournaments');

    console.log('✅ Tournaments encontrados:', tournaments.length, 'campeonatos');

    // 8. Verificar matches
    console.log('\n8. Verificando matches...');
    const matches = await fetchSupabase('matches');

    console.log('✅ Matches encontrados:', matches.length, 'partidas');

    // 9. Verificar logs de admin
    console.log('\n9. Verificando logs de admin...');
    const logs = await fetchSupabase('admin_logs');

    console.log('✅ Logs de admin encontrados:', logs.length, 'registros');

    // 10. Logout
    console.log('\n10. Fazendo logout...');
    const logoutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!logoutResponse.ok) {
      console.error('❌ ERRO: Logout falhou');
      return false;
    }

    console.log('✅ Logout realizado com sucesso');

    console.log('\n=== VALIDAÇÃO E2E DO ADMIN CONCLUÍDA COM SUCESSO ===');
    return true;
  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    return false;
  }
}

validateAdminE2E()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
