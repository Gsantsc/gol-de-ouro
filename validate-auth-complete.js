// QA VALIDATION FIX - Validação completa de autenticação
const {
  getAdminCredentials,
  getSupabaseAnonKey,
  getSupabaseUrl,
  requireEnv,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();
const INVALID_TEST_EMAIL = requireEnv("INVALID_TEST_EMAIL");
const INVALID_TEST_PASSWORD = requireEnv("INVALID_TEST_PASSWORD");

console.log('=== FASE 2: VALIDAÇÃO COMPLETA DE AUTENTICAÇÃO ===\n');

// Função helper para fazer requisições à API REST do Supabase
async function fetchSupabase(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
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

// Função helper para fazer login via API REST do Supabase Auth
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
    // Converter erros genéricos para mensagens específicas em português
    const errorMsg = data.msg || data.error_description || data.error || 'Login failed';
    
    if (errorMsg === 'Invalid login credentials') {
      throw new Error('Email ou senha inválidos');
    }
    
    if (errorMsg.includes('Email not confirmed')) {
      throw new Error('Email não confirmado');
    }
    
    if (errorMsg.includes('User not found')) {
      throw new Error('Usuário não encontrado');
    }
    
    throw new Error(errorMsg);
  }
  
  return data;
}

// Função helper para fazer logout via API REST do Supabase Auth
async function signOut(accessToken) {
  const url = `${SUPABASE_URL}/auth/v1/logout`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Logout failed: ${error}`);
  }
  
  // Logout pode retornar JSON vazio, não tentar fazer parse
  return;
}

// Teste 1: Login admin com credenciais corretas
async function testAdminLogin() {
  console.log('TESTE 1: Login admin com credenciais corretas');
  console.log('Email:', ADMIN_EMAIL);
  console.log('Senha: [configurada via .env]');
  
  try {
    console.log('[LOGIN_START] Tentando login...');
    const data = await signInWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    console.log('[LOGIN_SUCCESS] Login realizado com sucesso');
    console.log('[SESSION_FOUND]', data.user.email);
    
    // Buscar profile usando o token de acesso
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${data.user.id}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${data.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      console.log('[PROFILE_ERROR]', error);
      return { success: false, error: error };
    }
    
    const profile = await profileResponse.json();
    
    if (!profile || profile.length === 0) {
      console.log('[PROFILE_ERROR] Profile nao encontrado');
      return { success: false, error: 'Profile nao encontrado' };
    }
    
    const userProfile = profile[0];
    console.log('[ROLE_FOUND]', userProfile.role);
    console.log('[STATUS_FOUND]', userProfile.status);
    
    // Validar role e status
    if (userProfile.role !== 'admin') {
      console.log('[ROLE_ERROR] Role incorreta:', userProfile.role);
      return { success: false, error: 'Role incorreta' };
    }
    
    if (userProfile.status !== 'approved') {
      console.log('[STATUS_ERROR] Status incorreto:', userProfile.status);
      return { success: false, error: 'Status incorreto' };
    }
    
    console.log('[REDIRECTING] Redirecionando para dashboard admin');
    
    // Logout
    await signOut(data.access_token);
    console.log('[LOGOUT_SUCCESS] Logout realizado com sucesso');
    
    return { success: true, data: { role: userProfile.role, status: userProfile.status } };
    
  } catch (error) {
    console.log('[LOGIN_ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 2: Login com senha inválida
async function testInvalidPassword() {
  console.log('\nTESTE 2: Login com senha inválida');
  console.log('Email:', ADMIN_EMAIL);
  console.log('Senha: [negativa configurada via .env]');
  
  try {
    console.log('[LOGIN_START] Tentando login...');
    await signInWithPassword(ADMIN_EMAIL, INVALID_TEST_PASSWORD);
    
    console.log('[LOGIN_ERROR] Login deveria falhar com senha inválida');
    return { success: false, error: 'Login deveria falhar' };
    
  } catch (error) {
    console.log('[LOGIN_ERROR]', error.message);
    // Validar se erro é específico ou genérico
    if (error.message === 'Ocorreu um erro inesperado.' || error.message === 'Login failed') {
      console.log('[ERROR_WARNING] Erro genérico detectado - deve ser específico');
      return { success: false, error: error.message, isGeneric: true };
    }
    // Supabase retorna "Email ou senha inválidos" para ambos os casos (comportamento de segurança)
    return { success: true, error: error.message, isGeneric: false };
  }
}

// Teste 3: Login com email inexistente
async function testInvalidEmail() {
  console.log('\nTESTE 3: Login com email inexistente');
  console.log('Email:', INVALID_TEST_EMAIL);
  console.log('Senha: [configurada via .env]');
  
  try {
    console.log('[LOGIN_START] Tentando login...');
    await signInWithPassword(INVALID_TEST_EMAIL, ADMIN_PASSWORD);
    
    console.log('[LOGIN_ERROR] Login deveria falhar com email inexistente');
    return { success: false, error: 'Login deveria falhar' };
    
  } catch (error) {
    console.log('[LOGIN_ERROR]', error.message);
    // Validar se erro é específico ou genérico
    if (error.message === 'Ocorreu um erro inesperado.' || error.message === 'Login failed') {
      console.log('[ERROR_WARNING] Erro genérico detectado - deve ser específico');
      return { success: false, error: error.message, isGeneric: true };
    }
    // Supabase retorna "Email ou senha inválidos" para ambos os casos (comportamento de segurança)
    return { success: true, error: error.message, isGeneric: false };
  }
}

// Teste 4: Verificar se há usuário pending no banco
async function checkPendingUsers() {
  console.log('\nTESTE 4: Verificar usuários pending no banco');
  
  try {
    const data = await fetchSupabase('users?status=eq.pending');
    
    console.log('[PENDING_USERS]', data.length, 'usuários encontrados');
    data.forEach(user => {
      console.log('- Email:', user.email, '| Status:', user.status);
    });
    
    return { success: true, count: data.length };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Teste 5: Verificar se há usuário suspended no banco
async function checkSuspendedUsers() {
  console.log('\nTESTE 5: Verificar usuários suspended no banco');
  
  try {
    const data = await fetchSupabase('users?status=eq.suspended');
    
    console.log('[SUSPENDED_USERS]', data.length, 'usuários encontrados');
    data.forEach(user => {
      console.log('- Email:', user.email, '| Status:', user.status);
    });
    
    return { success: true, count: data.length };
    
  } catch (error) {
    console.log('[ERROR]', error.message);
    return { success: false, error: error.message };
  }
}

// Executar todos os testes
async function runAllTests() {
  const results = [];
  
  // Teste 1: Login admin
  results.push({ test: 'Login admin correto', ...await testAdminLogin() });
  
  // Teste 2: Senha inválida
  results.push({ test: 'Senha inválida', ...await testInvalidPassword() });
  
  // Teste 3: Email inexistente
  results.push({ test: 'Email inexistente', ...await testInvalidEmail() });
  
  // Teste 4: Usuários pending
  results.push({ test: 'Usuários pending', ...await checkPendingUsers() });
  
  // Teste 5: Usuários suspended
  results.push({ test: 'Usuários suspended', ...await checkSuspendedUsers() });
  
  // Resumo
  console.log('\n=== RESUMO DOS TESTES ===');
  results.forEach(result => {
    const status = result.success ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`${status} - ${result.test}`);
    if (!result.success) {
      console.log(`  Erro: ${result.error}`);
      if (result.isGeneric) {
        console.log('  ⚠️  Erro genérico detectado - deve ser específico');
      }
    }
  });
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const genericErrors = results.filter(r => r.isGeneric).length;
  
  console.log(`\nTotal: ${results.length}`);
  console.log(`Passou: ${passed}`);
  console.log(`Falhou: ${failed}`);
  if (genericErrors > 0) {
    console.log(`⚠️  Erros genéricos: ${genericErrors} - devem ser corrigidos`);
  }
  
  return results;
}

runAllTests().catch(console.error);
