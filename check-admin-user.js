// QA VALIDATION FIX - Verificar usuário admin no banco
const {
  getAdminCredentials,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: ADMIN_EMAIL } = getAdminCredentials();

async function checkAdminUser() {
  console.log('=== VERIFICANDO USUÁRIO ADMIN NO BANCO ===\n');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${ADMIN_EMAIL}`, {
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
      console.log('Usuário admin NÃO encontrado na tabela users');
      console.log('Isso indica que o trigger handle_new_auth_user não funcionou');
      return;
    }
    
    console.log('Usuário admin encontrado:');
    console.log('ID:', data[0].id);
    console.log('Email:', data[0].email);
    console.log('Role:', data[0].role);
    console.log('Status:', data[0].status);
    console.log('Approval Status:', data[0].approval_status);
    console.log('Blocked:', data[0].blocked);
    
  } catch (error) {
    console.log('ERRO:', error.message);
  }
}

checkAdminUser();
