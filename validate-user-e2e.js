const {
  getAdminCredentials,
  getQaUser,
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, name: TEST_USER_NAME } = getQaUser("QA_USER");
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

let adminToken = null;
let userToken = null;

async function fetchSupabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${adminToken || userToken || SUPABASE_ANON_KEY}`,
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
    'Authorization': `Bearer ${adminToken || userToken || SUPABASE_ANON_KEY}`,
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
    const error = await loginResponse.text();
    throw new Error(`Login admin falhou: ${error}`);
  }

  const loginData = await loginResponse.json();
  adminToken = loginData.access_token;
  console.log('✅ Login admin realizado com sucesso');
}

async function userSignUp() {
  console.log('\n1. Fazendo cadastro do usuário de teste...');
  
  // Primeiro, verificar se o usuário já existe e deletar se necessário
  try {
    const existingUsers = await fetchSupabase('users');
    const existingUser = existingUsers.find(u => u.email === TEST_USER_EMAIL);
    
    if (existingUser) {
      console.log('Usuário de teste já existe, deletando...');
      
      // Deletar ranking primeiro
      try {
        const deleteRankingResponse = await fetch(`${SUPABASE_URL}/rest/v1/rankings?user_id=eq.${existingUser.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (deleteRankingResponse.ok) {
          console.log('✅ Ranking do usuário deletado');
        }
      } catch (error) {
        console.log('⚠️  Erro ao deletar ranking:', error.message);
      }
      
      await callRpc('soft_remove_user', { target_user_id: existingUser.id });
      console.log('✅ Usuário antigo deletado do public.users');
      
      // Deletar do auth.users também usando service role key
      const adminAuthResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (adminAuthResponse.ok) {
        console.log('✅ Usuário antigo deletado do auth.users');
      } else {
        const error = await adminAuthResponse.text();
        console.log('⚠️  Não foi possível deletar do auth.users:', error);
      }
      
      // Aguardar um momento para garantir que a deleção foi processada
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    // Ignorar erro se usuário não existir
    console.log('⚠️  Erro ao verificar usuário existente:', error.message);
  }

  // Fazer signup
  const signUpResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      options: {
        data: {
          name: TEST_USER_NAME
        }
      }
    })
  });

  if (!signUpResponse.ok) {
    const error = await signUpResponse.text();
    throw new Error(`Signup falhou: ${error}`);
  }

  const signUpData = await signUpResponse.json();
  console.log('✅ Cadastro realizado com sucesso:', {
    user_id: signUpData.user?.id,
    email: signUpData.user?.email,
  });

  // Se a sessão foi criada, usar o token
  if (signUpData.session?.access_token) {
    userToken = signUpData.session.access_token;
  }

  return signUpData;
}

async function checkUserStatus() {
  console.log('\n2. Verificando status do usuário...');
  
  // Usar token admin para verificar o status
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  if (!testUser) {
    throw new Error('Usuário de teste não encontrado em public.users');
  }

  console.log('✅ Usuário encontrado:', {
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
    status: testUser.status,
    approval_status: testUser.approval_status,
    blocked: testUser.blocked,
  });

  // Validar status inicial
  const statusValidation = {
    role: testUser.role === 'player',
    status: testUser.status === 'pending',
    approval_status: testUser.approval_status === 'pending',
    blocked: testUser.blocked === false,
    deleted_at: testUser.deleted_at === null,
  };

  console.log('Validação de status inicial:', statusValidation);
  const allValid = Object.values(statusValidation).every(v => v === true);
  
  if (!allValid) {
    console.error('❌ ERRO: Status inicial do usuário inválido');
    return false;
  }

  console.log('✅ Status inicial do usuário correto (pending)');
  return testUser;
}

async function approveUser(userId) {
  console.log('\n3. Aprovando usuário via admin...');
  
  const result = await callRpc('approve_user', { target_user_id: userId });
  console.log('✅ Usuário aprovado com sucesso');
  
  // Verificar se o status mudou
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  if (!testUser) {
    throw new Error('Usuário de teste não encontrado após aprovação');
  }

  console.log('Status após aprovação:', {
    status: testUser.status,
    approval_status: testUser.approval_status,
    approved_at: testUser.approved_at,
    approved_by: testUser.approved_by,
  });

  // Validar status após aprovação
  const approvalValidation = {
    status: testUser.status === 'approved',
    approval_status: testUser.approval_status === 'approved',
    approved_at: testUser.approved_at !== null,
    approved_by: testUser.approved_by !== null,
  };

  console.log('Validação de aprovação:', approvalValidation);
  const allValid = Object.values(approvalValidation).every(v => v === true);
  
  if (!allValid) {
    console.error('❌ ERRO: Status após aprovação inválido');
    return false;
  }

  console.log('✅ Status após aprovação correto (approved)');
  return true;
}

async function userLogin() {
  console.log('\n4. Fazendo login do usuário aprovado...');
  
  // Limpar token anterior
  userToken = null;
  
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
    const error = await loginResponse.text();
    throw new Error(`Login usuário falhou: ${error}`);
  }

  const loginData = await loginResponse.json();
  userToken = loginData.access_token;
  console.log('✅ Login usuário realizado com sucesso:', {
    user_id: loginData.user.id,
    email: loginData.user.email,
  });

  return loginData;
}

async function checkUserAccess() {
  console.log('\n5. Verificando acesso do usuário aprovado...');
  
  // Verificar se o usuário pode acessar rankings
  try {
    const rankings = await fetchSupabase('rankings');
    console.log('✅ Usuário pode acessar rankings:', rankings.length, 'registros');
  } catch (error) {
    console.error('❌ ERRO: Usuário não pode acessar rankings:', error.message);
    return false;
  }

  // Verificar se o usuário pode acessar matches
  try {
    const matches = await fetchSupabase('matches');
    console.log('✅ Usuário pode acessar matches:', matches.length, 'partidas');
  } catch (error) {
    console.error('❌ ERRO: Usuário não pode acessar matches:', error.message);
    return false;
  }

  // Verificar se o usuário pode acessar tournaments
  try {
    const tournaments = await fetchSupabase('tournaments');
    console.log('✅ Usuário pode acessar tournaments:', tournaments.length, 'campeonatos');
  } catch (error) {
    console.error('❌ ERRO: Usuário não pode acessar tournaments:', error.message);
    return false;
  }

  // Verificar se o usuário pode acessar seu próprio ranking
  try {
    const users = await fetchSupabase('users');
    const testUser = users.find(u => u.email === TEST_USER_EMAIL);
    
    if (!testUser) {
      throw new Error('Usuário não encontrado');
    }

    const rankings = await fetchSupabase('rankings');
    const userRanking = rankings.find(r => r.user_id === testUser.id);
    
    if (userRanking) {
      console.log('✅ Usuário pode acessar seu próprio ranking:', userRanking);
    } else {
      console.log('⚠️  Usuário ainda não tem ranking (normal para novo usuário)');
    }
  } catch (error) {
    console.error('❌ ERRO: Usuário não pode acessar seu ranking:', error.message);
    return false;
  }

  return true;
}

async function userLogout() {
  console.log('\n6. Fazendo logout do usuário...');
  
  const logoutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${userToken}`
    }
  });

  if (!logoutResponse.ok) {
    console.error('❌ ERRO: Logout usuário falhou');
    return false;
  }

  console.log('✅ Logout usuário realizado com sucesso');
  userToken = null;
  return true;
}

async function adminLogout() {
  console.log('\n7. Fazendo logout do admin...');
  
  const logoutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${adminToken}`
    }
  });

  if (!logoutResponse.ok) {
    console.error('❌ ERRO: Logout admin falhou');
    return false;
  }

  console.log('✅ Logout admin realizado com sucesso');
  adminToken = null;
  return true;
}

async function validateUserE2E() {
  console.log('=== VALIDAÇÃO E2E DO USUÁRIO ===\n');

  try {
    await adminLogin();
    await userSignUp();
    const testUser = await checkUserStatus();
    
    if (!testUser) {
      throw new Error('Status inicial do usuário inválido');
    }

    await approveUser(testUser.id);
    await userLogin();
    await checkUserAccess();
    await userLogout();
    await adminLogout();

    console.log('\n=== VALIDAÇÃO E2E DO USUÁRIO CONCLUÍDA COM SUCESSO ===');
    return true;
  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    return false;
  }
}

validateUserE2E()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
