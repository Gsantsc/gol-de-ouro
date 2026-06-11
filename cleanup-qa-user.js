// QA VALIDATION FIX - Deletar usuário QA manualmente
const {
  getAdminCredentials,
  getQaUser,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();
const { email: QA_EMAIL } = getQaUser("QA_APPROVAL");

async function cleanupQAUser() {
  console.log('=== DELETANDO USUÁRIO QA MANUALMENTE ===\n');
  
  try {
    // Login como admin
    console.log('Login como admin...');
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
    
    // Buscar usuário
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${QA_EMAIL}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log('ERRO:', error);
      return;
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      console.log('Usuário QA não encontrado');
      return;
    }
    
    const user = data[0];
    console.log('Usuário encontrado:', user.email);
    console.log('ID:', user.id);
    console.log('Status:', user.status);
    
    // Deletar via soft_remove_user RPC com token de admin
    console.log('\nDeletando usuário...');
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/soft_remove_user`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${loginData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target_user_id: user.id })
    });
    
    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.log('ERRO AO DELETAR:', error);
      return;
    }
    
    console.log('✅ Usuário QA deletado com sucesso');
    
    // Deletar rankings primeiro
    console.log('\nDeletando rankings do usuário...');
    const rankingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/rankings?user_id=eq.${user.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rankingsResponse.ok) {
      const error = await rankingsResponse.text();
      console.log('ERRO AO DELETAR RANKINGS:', error);
    } else {
      console.log('✅ Rankings deletados');
    }
    
    // Deletar de auth.users também
    console.log('\nDeletando usuário de auth.users...');
    const authDeleteResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!authDeleteResponse.ok) {
      const error = await authDeleteResponse.text();
      console.log('ERRO AO DELETAR DE AUTH.USERS:', error);
    } else {
      console.log('✅ Usuário deletado de auth.users');
    }
    
    // Logout
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${loginData.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.log('ERRO:', error.message);
  }
}

cleanupQAUser();
