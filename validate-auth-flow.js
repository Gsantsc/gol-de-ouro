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

const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, name: TEST_USER_NAME } = getQaUser("AUTH_TEST_USER");
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

let adminToken = null;

async function fetchSupabase(table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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
  console.log('0. Fazendo login do admin para limpeza...');
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

async function cleanupTestUser() {
  console.log('\n1. Limpando usuário de teste anterior...');
  try {
    const existingUsers = await fetchSupabase('users');
    const existingUser = existingUsers.find(u => u.email === TEST_USER_EMAIL);
    
    if (existingUser) {
      console.log('Usuário de teste encontrado, deletando...');
      
      // Deletar ranking
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
          console.log('✅ Ranking deletado');
        }
      } catch (error) {
        console.log('⚠️  Erro ao deletar ranking:', error.message);
      }
      
      await callRpc('soft_remove_user', { target_user_id: existingUser.id });
      
      const adminAuthResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (adminAuthResponse.ok) {
        console.log('✅ Usuário deletado do auth.users');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.log('⚠️  Erro ao limpar usuário:', error.message);
  }
}

async function testSignUp() {
  console.log('\n2. Testando signUp...');
  
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
  console.log('✅ SignUp realizado com sucesso:', {
    user_id: signUpData.user?.id,
    email: signUpData.user?.email,
    has_session: !!signUpData.session,
    session_user_id: signUpData.session?.user?.id
  });

  // Verificar se o usuário foi criado em public.users
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  if (!testUser) {
    throw new Error('Usuário não foi criado em public.users');
  }

  console.log('✅ Usuário criado em public.users:', {
    id: testUser.id,
    role: testUser.role,
    status: testUser.status,
    approval_status: testUser.approval_status
  });

  // Validar trigger handle_new_auth_user
  const triggerValidation = {
    role: testUser.role === 'player',
    status: testUser.status === 'pending',
    approval_status: testUser.approval_status === 'pending',
    blocked: testUser.blocked === false,
  };

  console.log('Validação do trigger handle_new_auth_user:', triggerValidation);
  const allValid = Object.values(triggerValidation).every(v => v === true);
  
  if (!allValid) {
    console.error('❌ Trigger handle_new_auth_user não funcionou corretamente');
    return false;
  }

  console.log('✅ Trigger handle_new_auth_user funcionou corretamente');

  return signUpData;
}

async function testSignIn() {
  console.log('\n3. Testando signIn...');
  
  const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
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

  if (!signInResponse.ok) {
    const error = await signInResponse.text();
    throw new Error(`SignIn falhou: ${error}`);
  }

  const signInData = await signInResponse.json();
  console.log('✅ SignIn realizado com sucesso:', {
    user_id: signInData.user.id,
    email: signInData.user.email,
    has_access_token: !!signInData.access_token,
    has_refresh_token: !!signInData.refresh_token,
    expires_in: signInData.expires_in
  });

  return signInData;
}

async function testSession(sessionData) {
  console.log('\n4. Testando session...');
  
  // Verificar se a session é válida
  const sessionResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${sessionData.access_token}`
    }
  });

  if (!sessionResponse.ok) {
    const error = await sessionResponse.text();
    throw new Error(`Session validation falhou: ${error}`);
  }

  const sessionUser = await sessionResponse.json();
  console.log('✅ Session válida:', {
    user_id: sessionUser.id,
    email: sessionUser.email,
    aud: sessionUser.aud
  });

  // Verificar se o profile foi criado/atualizado
  const users = await fetchSupabase('users');
  const testUser = users.find(u => u.email === TEST_USER_EMAIL);
  
  if (!testUser) {
    throw new Error('Profile não encontrado em public.users');
  }

  console.log('✅ Profile sincronizado com auth:', {
    last_login_at: testUser.last_login_at,
    updated_at: testUser.updated_at
  });

  return sessionData;
}

async function testLogout(sessionData) {
  console.log('\n5. Testando logout...');
  
  const logoutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${sessionData.access_token}`
    }
  });

  if (!logoutResponse.ok) {
    const error = await logoutResponse.text();
    throw new Error(`Logout falhou: ${error}`);
  }

  console.log('✅ Logout realizado com sucesso');

  // Verificar se a session foi invalidada
  const sessionResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${sessionData.access_token}`
    }
  });

  if (sessionResponse.ok) {
    console.error('❌ Session ainda válida após logout');
    return false;
  }

  console.log('✅ Session invalidada corretamente após logout');
  return true;
}

async function testInvalidCredentials() {
  console.log('\n6. Testando credenciais inválidas...');
  
  const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: 'wrong_password'
    })
  });

  if (signInResponse.ok) {
    console.error('❌ Login com senha errada deveria falhar');
    return false;
  }

  console.log('✅ Login com senha errada falhou corretamente');
  return true;
}

async function testDuplicateEmail() {
  console.log('\n7. Testando cadastro com email duplicado...');
  
  const signUpResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: 'AnotherPassword123@',
      options: {
        data: {
          name: 'Duplicate User'
        }
      }
    })
  });

  if (signUpResponse.ok) {
    console.error('❌ Cadastro com email duplicado deveria falhar');
    return false;
  }

  console.log('✅ Cadastro com email duplicado falhou corretamente');
  return true;
}

async function validateAuthFlow() {
  console.log('=== VALIDAÇÃO DO FLUXO DE AUTH ===\n');

  try {
    await adminLogin();
    await cleanupTestUser();
    
    const signUpData = await testSignUp();
    const signInData = await testSignIn();
    await testSession(signInData);
    await testLogout(signInData);
    await testInvalidCredentials();
    await testDuplicateEmail();

    console.log('\n=== VALIDAÇÃO DO FLUXO DE AUTH CONCLUÍDA COM SUCESSO ===');
    return true;
  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    return false;
  }
}

validateAuthFlow()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
