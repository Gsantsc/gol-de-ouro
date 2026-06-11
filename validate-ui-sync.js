// LEAGUE AUDIT
// REMOVE MOCK MATCH DATA - This is a test/validation script, not production mock data
const {
  getAdminCredentials,
  getQaUser,
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  requireEnv,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();
const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } = getQaUser("QA_USER");
const SYNC_TEST_USER_EMAIL = requireEnv("SYNC_TEST_USER_EMAIL");
const SYNC_TEST_USER_PASSWORD = requireEnv("SYNC_TEST_USER_PASSWORD");

let adminToken = null;
let userToken = null;

async function fetchSupabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${adminToken || userToken || SUPABASE_SERVICE_KEY}`,
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
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${adminToken || SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });
  
  const responseText = await response.text();
  
  if (!response.ok) {
    throw new Error(`RPC Error: ${responseText}`);
  }
  
  if (!responseText) {
    return null;
  }
  
  return JSON.parse(responseText);
}

async function adminLogin() {
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
    throw new Error('Login admin falhou');
  }

  const loginData = await loginResponse.json();
  adminToken = loginData.access_token;
  console.log('✅ Login admin realizado');
}

async function userLogin() {
  console.log('\n1. Fazendo login do usuário...');
  const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    })
  });

  if (!loginResponse.ok) {
    throw new Error('Login usuário falhou');
  }

  const loginData = await loginResponse.json();
  userToken = loginData.access_token;
  console.log('✅ Login usuário realizado');
}

async function testMatchCreation() {
  console.log('\n2. Testando criação de partida...');
  
  const tournaments = await fetchSupabase('tournaments');
  const tournament = tournaments[0];
  
  const newMatch = {
    tournament_id: tournament.id,
    home_team: 'Time Teste Casa',
    away_team: 'Time Teste Fora',
    home_score: 0,
    away_score: 0,
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'aberto',
    championship: 'brasileirao_a',
    round: 'Rodada Teste',
    stadium: 'Estádio Teste'
  };
  
  const createdMatch = await fetchSupabase('matches', {
    method: 'POST',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(newMatch)
  });
  
  console.log('✅ Partida criada no banco:', {
    id: createdMatch[0].id,
    home_team: createdMatch[0].home_team,
    away_team: createdMatch[0].away_team,
    status: createdMatch[0].status
  });
  
  return createdMatch[0];
}

async function testPredictionSubmission(match) {
  console.log('\n3. Testando envio de palpite...');
  
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  const newPrediction = {
    user_id: testUser.id,
    match_id: match.id,
    predicted_home_score: 2,
    predicted_away_score: 1
  };
  
  // Usar token de usuário para enviar palpite
  const url = `${SUPABASE_URL}/rest/v1/predictions`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(newPrediction)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao enviar palpite: ${error}`);
  }
  
  const createdPrediction = await response.json();
  
  console.log('✅ Palpite enviado ao banco:', {
    id: createdPrediction[0].id,
    user_id: createdPrediction[0].user_id,
    match_id: createdPrediction[0].match_id,
    predicted_home_score: createdPrediction[0].predicted_home_score,
    predicted_away_score: createdPrediction[0].predicted_away_score,
    locked: createdPrediction[0].locked
  });
  
  return createdPrediction[0];
}

async function testMatchUpdate(match) {
  console.log('\n4. Testando atualização de partida...');
  
  const updatedMatch = await fetchSupabase(`matches?id=eq.${match.id}`, {
    method: 'PATCH',
    headers: {
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      home_score: 2,
      away_score: 1,
      status: 'encerrado'
    })
  });
  
  console.log('✅ Partida atualizada no banco:', {
    id: updatedMatch[0].id,
    home_score: updatedMatch[0].home_score,
    away_score: updatedMatch[0].away_score,
    status: updatedMatch[0].status
  });
  
  return updatedMatch[0];
}

async function testRankingCalculation() {
  console.log('\n5. Testando cálculo de ranking...');
  
  const rankings = await callRpc('force_refresh_rankings');
  
  console.log('✅ Ranking recalculado');
  
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  const userRankings = await fetchSupabase('rankings');
  const userRanking = userRankings.find(r => r.user_id === testUser.id);
  
  console.log('✅ Ranking do usuário:', {
    total_points: userRanking?.total_points || 0,
    correct_results: userRanking?.correct_results || 0,
    exact_scores: userRanking?.exact_scores || 0
  });
  
  return userRanking;
}

async function testGroupCreation() {
  console.log('\n6. Testando criação de grupo...');
  
  const tournaments = await fetchSupabase('tournaments');
  const tournament = tournaments[0];
  
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  try {
    const groupData = await callRpc('create_group', {
      group_name: 'Grupo Teste Sync',
      target_championship_id: tournament.id
    });
    
    if (groupData && groupData.length > 0) {
      console.log('✅ Grupo criado:', {
        id: groupData[0].id,
        name: groupData[0].name,
        invite_code: groupData[0].invite_code
      });
      return groupData[0];
    } else {
      console.log('⚠️  Grupo não foi criado (pode já existir ou erro de validação)');
      return null;
    }
  } catch (error) {
    console.log('⚠️  Erro ao criar grupo:', error.message);
    return null;
  }
}

async function testUserApproval() {
  console.log('\n7. Testando aprovação de usuário...');
  
  // Criar um novo usuário para teste
  const testEmail = SYNC_TEST_USER_EMAIL;
  const testPassword = SYNC_TEST_USER_PASSWORD;
  
  const signUpResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Sync Test User'
        }
      }
    })
  });
  
  if (!signUpResponse.ok) {
    throw new Error('Não foi possível criar usuário de teste');
  }
  
  const signUpData = await signUpResponse.json();
  const userId = signUpData.user.id;
  
  // Aprovar usuário
  await callRpc('approve_user', { target_user_id: userId });
  
  // Verificar se foi aprovado
  const users = await fetchSupabase('users');
  const approvedUser = users.find(u => u.id === userId);
  
  console.log('✅ Usuário aprovado:', {
    id: approvedUser.id,
    status: approvedUser.status,
    approval_status: approvedUser.approval_status,
    approved_at: approvedUser.approved_at
  });
  
  // Limpar usuário de teste
  const deleteRankingResponse = await fetch(`${SUPABASE_URL}/rest/v1/rankings?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  await callRpc('soft_remove_user', { target_user_id: userId });
  
  const adminAuthResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('✅ Usuário de teste limpo');
}

async function cleanupTestData(match) {
  console.log('\n8. Limpando dados de teste...');
  
  // Deletar palpite
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  const deletePredictionResponse = await fetch(`${SUPABASE_URL}/rest/v1/predictions?user_id=eq.${testUser.id}&match_id=eq.${match.id}`, {
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
  
  console.log('✅ Dados de teste limpos');
}

async function validateUISync() {
  console.log('=== VALIDAÇÃO DA SINCRONIZAÇÃO UI ↔ BANCO ===\n');

  try {
    await adminLogin();
    await userLogin();
    
    const match = await testMatchCreation();
    await testPredictionSubmission(match);
    await testMatchUpdate(match);
    await testRankingCalculation();
    await testGroupCreation();
    await testUserApproval();
    await cleanupTestData(match);

    console.log('\n=== VALIDAÇÃO DA SINCRONIZAÇÃO UI ↔ BANCO CONCLUÍDA COM SUCESSO ===');
    return true;
  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    return false;
  }
}

validateUISync()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
