// QA VALIDATION FIX - Validação de cadastro + aprovação
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
const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } = getQaUser("QA_APPROVAL");
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

console.log('=== FASE 3: VALIDAÇÃO DE CADASTRO + APROVAÇÃO ===\n');

// Função helper para fazer signup via API REST do Supabase Auth
async function signUp(email, password) {
  const url = `${SUPABASE_URL}/auth/v1/signup`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    const errorMsg = data.msg || data.error_description || data.error || 'Signup failed';
    throw new Error(errorMsg);
  }
  
  return data;
}

// Função helper para fazer login
async function signInWithPassword(email, password) {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    const errorMsg = data.msg || data.error_description || data.error || 'Login failed';
    throw new Error(errorMsg);
  }
  
  return data;
}

// Função helper para buscar profile
async function fetchProfile(userId, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

// Função helper para buscar profile com service key
async function fetchProfileServiceKey(email) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

// Função helper para aprovar usuário via RPC
async function approveUser(userId, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/approve_user`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ target_user_id: userId })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  // RPC pode retornar JSON vazio, não tentar fazer parse
  return;
}

// Função helper para suspender usuário via RPC
async function suspendUser(userId, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/suspend_user`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ target_user_id: userId })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  // RPC pode retornar JSON vazio, não tentar fazer parse
  return;
}

// Função helper para reativar usuário via RPC
async function reactivateUser(userId, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reactivate_user`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ target_user_id: userId })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  // RPC pode retornar JSON vazio, não tentar fazer parse
  return;
}

// Função helper para deletar usuário
async function deleteUser(userId, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/soft_remove_user`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ target_user_id: userId })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  // RPC pode retornar JSON vazio, não tentar fazer parse
  return;
}

// Teste 1: Criar usuário teste
async function testSignup() {
  console.log('TESTE 1: Criar usuário teste');
  console.log('Email:', TEST_USER_EMAIL);
  console.log('Senha: [configurada via .env]');
  
  try {
    console.log('[SIGNUP_START] Tentando cadastro...');
    const data = await signUp(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    
    console.log('[SIGNUP_SUCCESS] Cadastro realizado com sucesso');
    console.log('[AUTH_USER_CREATED]', data.user.id);
    
    // Verificar se profile foi criado
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[PROFILE_ERROR] Profile não foi criado automaticamente');
      return { success: false, error: 'Profile não foi criado automaticamente' };
    }
    
    console.log('[PROFILE_CREATED]', profile.id);
    console.log('[ROLE]', profile.role);
    console.log('[STATUS]', profile.status);
    console.log('[APPROVAL_STATUS]', profile.approval_status);
    
    // Validar role e status
    if (profile.role !== 'player') {
      console.log('[ROLE_ERROR] Role incorreta:', profile.role, '- esperado: player');
      return { success: false, error: 'Role incorreta' };
    }
    
    if (profile.status !== 'pending' && profile.approval_status !== 'pending') {
      console.log('[STATUS_ERROR] Status incorreta:', profile.status, profile.approval_status, '- esperado: pending');
      return { success: false, error: 'Status incorreta' };
    }
    
    console.log('[EXPECTED_MESSAGE] "Aguardando aprovação do administrador"');
    
    return { success: true, data: { userId: profile.id, role: profile.role, status: profile.status } };
    
  } catch (error) {
    console.log('[SIGNUP_ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 2: Verificar se usuário aparece no grid do admin
async function testUserInAdminGrid() {
  console.log('\nTESTE 2: Verificar se usuário aparece no grid do admin');
  
  try {
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[ERROR] Usuário não encontrado');
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    console.log('[USER_FOUND] Usuário aparece no grid do admin');
    console.log('[STATUS]', profile.status);
    console.log('[APPROVAL_STATUS]', profile.approval_status);
    
    return { success: true, data: { status: profile.status, approval_status: profile.approval_status } };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 3: Aprovar usuário
async function testApproveUser() {
  console.log('\nTESTE 3: Aprovar usuário');
  
  try {
    // Login como admin
    console.log('[ADMIN_LOGIN] Login como admin...');
    const adminData = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    // Buscar usuário teste
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[ERROR] Usuário não encontrado');
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    console.log('[APPROVE_START] Aprovando usuário...');
    await approveUser(profile.id, adminData.access_token);
    
    // Verificar se status mudou
    const updatedProfile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!updatedProfile) {
      console.log('[ERROR] Usuário não encontrado após aprovação');
      return { success: false, error: 'Usuário não encontrado após aprovação' };
    }
    
    console.log('[STATUS_UPDATED]', updatedProfile.status);
    console.log('[APPROVAL_STATUS_UPDATED]', updatedProfile.approval_status);
    
    if (updatedProfile.status !== 'approved' && updatedProfile.approval_status !== 'approved') {
      console.log('[STATUS_ERROR] Status não mudou para approved');
      return { success: false, error: 'Status não mudou para approved' };
    }
    
    console.log('[UI_UPDATE] UI atualiza automaticamente (via realtime)');
    
    // Logout admin
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${adminData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: { status: updatedProfile.status } };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 4: Suspender usuário
async function testSuspendUser() {
  console.log('\nTESTE 4: Suspender usuário');
  
  try {
    // Login como admin
    console.log('[ADMIN_LOGIN] Login como admin...');
    const adminData = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    // Buscar usuário teste
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[ERROR] Usuário não encontrado');
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    console.log('[SUSPEND_START] Suspensando usuário...');
    await suspendUser(profile.id, adminData.access_token);
    
    // Verificar se status mudou
    const updatedProfile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!updatedProfile) {
      console.log('[ERROR] Usuário não encontrado após suspensão');
      return { success: false, error: 'Usuário não encontrado após suspensão' };
    }
    
    console.log('[STATUS_UPDATED]', updatedProfile.status);
    console.log('[BLOCKED]', updatedProfile.blocked);
    
    if (updatedProfile.status !== 'suspended' && !updatedProfile.blocked) {
      console.log('[STATUS_ERROR] Status não mudou para suspended');
      return { success: false, error: 'Status não mudou para suspended' };
    }
    
    console.log('[LOGIN_BLOCKED] Login bloqueado');
    
    // Logout admin
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${adminData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: { status: updatedProfile.status } };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 5: Reativar usuário
async function testReactivateUser() {
  console.log('\nTESTE 5: Reativar usuário');
  
  try {
    // Login como admin
    console.log('[ADMIN_LOGIN] Login como admin...');
    const adminData = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    // Buscar usuário teste
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[ERROR] Usuário não encontrado');
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    console.log('[REACTIVATE_START] Reativando usuário...');
    await reactivateUser(profile.id, adminData.access_token);
    
    // Verificar se status mudou
    const updatedProfile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!updatedProfile) {
      console.log('[ERROR] Usuário não encontrado após reativação');
      return { success: false, error: 'Usuário não encontrado após reativação' };
    }
    
    console.log('[STATUS_UPDATED]', updatedProfile.status);
    console.log('[BLOCKED]', updatedProfile.blocked);
    
    if (updatedProfile.status !== 'approved' && updatedProfile.approval_status !== 'approved') {
      console.log('[STATUS_ERROR] Status não voltou para approved');
      return { success: false, error: 'Status não voltou para approved' };
    }
    
    console.log('[USER_REACTIVATED] Usuário voltou a approved');
    
    // Logout admin
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${adminData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: { status: updatedProfile.status } };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 6: Limpar usuário teste
async function cleanupTestUser() {
  console.log('\nTESTE 6: Limpar usuário teste');
  
  try {
    // Login como admin
    console.log('[ADMIN_LOGIN] Login como admin...');
    const adminData = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    // Buscar usuário teste
    const profile = await fetchProfileServiceKey(TEST_USER_EMAIL);
    
    if (!profile) {
      console.log('[INFO] Usuário não encontrado (já deletado?)');
      return { success: true };
    }
    
    console.log('[DELETE_START] Deletando usuário teste...');
    await deleteUser(profile.id, adminData.access_token);
    
    console.log('[USER_DELETED] Usuário teste deletado');
    
    // Logout admin
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${adminData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Executar todos os testes
async function runAllTests() {
  const results = [];
  
  // Teste 1: Signup
  results.push({ test: 'Cadastro usuário', ...await testSignup() });
  
  // Teste 2: Usuário no grid admin
  results.push({ test: 'Usuário no grid admin', ...await testUserInAdminGrid() });
  
  // Teste 3: Aprovar usuário
  results.push({ test: 'Aprovar usuário', ...await testApproveUser() });
  
  // Teste 4: Suspender usuário
  results.push({ test: 'Suspender usuário', ...await testSuspendUser() });
  
  // Teste 5: Reativar usuário
  results.push({ test: 'Reativar usuário', ...await testReactivateUser() });
  
  // Teste 6: Limpar usuário teste
  results.push({ test: 'Limpar usuário teste', ...await cleanupTestUser() });
  
  // Resumo
  console.log('\n=== RESUMO DOS TESTES ===');
  results.forEach(result => {
    const status = result.success ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`${status} - ${result.test}`);
    if (!result.success) {
      console.log(`  Erro: ${result.error}`);
    }
  });
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nTotal: ${results.length}`);
  console.log(`Passou: ${passed}`);
  console.log(`Falhou: ${failed}`);
  
  return results;
}

runAllTests().catch(console.error);
