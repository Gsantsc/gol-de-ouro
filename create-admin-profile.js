// QA VALIDATION FIX - Criar profile admin manualmente
const {
  getAdminCredentials,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

async function createAdminProfile() {
  console.log('=== CRIANDO PROFILE ADMIN MANUALMENTE ===\n');
  
  try {
    // Primeiro, fazer login para obter o session
    console.log('Fazendo login...');
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      console.log('ERRO NO LOGIN:', error);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('Login realizado com sucesso');
    console.log('User ID:', loginData.user.id);
    
    // Agora, chamar ensure_user_profile RPC
    console.log('\nChamando ensure_user_profile RPC...');
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_user_profile`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${loginData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        display_name: 'Admin',
        signup_device_value: 'web',
        signup_ip_value: '127.0.0.1'
      })
    });
    
    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      console.log('ERRO NO RPC:', error);
      return;
    }
    
    const profileData = await profileResponse.json();
    console.log('Profile criado com sucesso:');
    console.log('ID:', profileData.id);
    console.log('Email:', profileData.email);
    console.log('Role:', profileData.role);
    console.log('Status:', profileData.status);
    console.log('Approval Status:', profileData.approval_status);
    
    // Atualizar para admin e approved manualmente
    console.log('\nAtualizando role para admin e status para approved...');
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${profileData.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'admin',
        status: 'approved',
        approval_status: 'approved'
      })
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.log('ERRO NA ATUALIZAÇÃO:', error);
      return;
    }
    
    console.log('Profile atualizado com sucesso para admin/approved');
    
    // Logout
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${loginData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Profile admin criado e configurado com sucesso');
    
  } catch (error) {
    console.log('ERRO:', error.message);
  }
}

createAdminProfile();
