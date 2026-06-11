import { createClient } from '@supabase/supabase-js';

const {
  getAdminCredentials,
  getSupabaseAnonKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs") as {
  getAdminCredentials: () => { email: string; password: string };
  getSupabaseAnonKey: () => string;
  getSupabaseUrl: () => string;
};

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function validateAdminE2E() {
  console.log('=== VALIDAÇÃO E2E DO ADMIN ===\n');

  // 1. Verificar se o usuário admin existe
  console.log('1. Verificando usuário admin...');
  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (adminError) {
    console.error('❌ ERRO: Usuário admin não encontrado:', adminError.message);
    return false;
  }

  console.log('✅ Usuário admin encontrado:', {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
    approval_status: adminUser.approval_status,
    blocked: adminUser.blocked,
  });

  // 2. Validar campos do admin
  console.log('\n2. Validando campos do admin...');
  const adminValidation = {
    role: adminUser.role === 'admin',
    status: adminUser.status === 'approved',
    approval_status: adminUser.approval_status === 'approved',
    blocked: adminUser.blocked === false,
    deleted_at: adminUser.deleted_at === null,
  };

  console.log('Validação:', adminValidation);
  const allValid = Object.values(adminValidation).every(v => v === true);
  if (allValid) {
    console.log('✅ Todos os campos do admin estão corretos');
  } else {
    console.error('❌ ERRO: Campos do admin inválidos');
    return false;
  }

  // 3. Testar login do admin
  console.log('\n3. Testando login do admin...');
  const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (loginError) {
    console.error('❌ ERRO: Login falhou:', loginError.message);
    return false;
  }

  console.log('✅ Login realizado com sucesso:', {
    user_id: authData.user.id,
    email: authData.user.email,
  });

  // 4. Verificar se o ranking do admin existe
  console.log('\n4. Verificando ranking do admin...');
  const { data: ranking, error: rankingError } = await supabase
    .from('rankings')
    .select('*')
    .eq('user_id', adminUser.id)
    .single();

  if (rankingError) {
    console.error('❌ ERRO: Ranking não encontrado:', rankingError.message);
    return false;
  }

  console.log('✅ Ranking encontrado:', {
    total_points: ranking.total_points,
    correct_results: ranking.correct_results,
    exact_scores: ranking.exact_scores,
  });

  // 5. Verificar métricas do dashboard
  console.log('\n5. Verificando métricas do dashboard...');
  const { data: metrics, error: metricsError } = await supabase.rpc('admin_dashboard_metrics');

  if (metricsError) {
    console.error('❌ ERRO: Métricas não encontradas:', metricsError.message);
    return false;
  }

  console.log('✅ Métricas do dashboard:', metrics[0]);

  // 6. Verificar visão geral de usuários
  console.log('\n6. Verificando visão geral de usuários...');
  const { data: userOverview, error: overviewError } = await supabase.rpc('admin_user_overview');

  if (overviewError) {
    console.error('❌ ERRO: Visão geral não encontrada:', overviewError.message);
    return false;
  }

  console.log('✅ Visão geral de usuários:', userOverview.length, 'usuários');

  // 7. Verificar tournaments
  console.log('\n7. Verificando tournaments...');
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('*')
    .order('name');

  if (tournamentsError) {
    console.error('❌ ERRO: Tournaments não encontrados:', tournamentsError.message);
    return false;
  }

  console.log('✅ Tournaments encontrados:', tournaments.length, 'campeonatos');

  // 8. Verificar matches
  console.log('\n8. Verificando matches...');
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(5);

  if (matchesError) {
    console.error('❌ ERRO: Matches não encontrados:', matchesError.message);
    return false;
  }

  console.log('✅ Matches encontrados:', matches.length, 'partidas');

  // 9. Verificar logs de admin
  console.log('\n9. Verificando logs de admin...');
  const { data: logs, error: logsError } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logsError) {
    console.error('❌ ERRO: Logs não encontrados:', logsError.message);
    return false;
  }

  console.log('✅ Logs de admin encontrados:', logs.length, 'registros');

  // 10. Logout
  console.log('\n10. Fazendo logout...');
  const { error: logoutError } = await supabase.auth.signOut();
  if (logoutError) {
    console.error('❌ ERRO: Logout falhou:', logoutError.message);
    return false;
  }

  console.log('✅ Logout realizado com sucesso');

  console.log('\n=== VALIDAÇÃO E2E DO ADMIN CONCLUÍDA COM SUCESSO ===');
  return true;
}

validateAdminE2E()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
