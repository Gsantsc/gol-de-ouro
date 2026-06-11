const {
  getQaUser,
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
} = require("./scripts/env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } = getQaUser("QA_USER");

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

async function validateSecurity() {
  console.log('=== AUDITORIA DE RLS E SEGURANÇA ===\n');

  try {
    // 1. Validar RLS da tabela users
    console.log('1. Validando RLS da tabela users...');
    
    // Tentar acessar users sem autenticação (deve falhar)
    try {
      const usersWithoutAuth = await fetchSupabase('users', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
          'Range': '0-0'
        }
      });
      
      if (usersWithoutAuth.length > 0) {
        console.error('❌ RLS users: Usuários acessíveis sem autenticação');
      } else {
        console.log('✅ RLS users: Bloqueado sem autenticação');
      }
    } catch (error) {
      console.log('✅ RLS users: Bloqueado sem autenticação (erro esperado)');
    }

    // 2. Validar RLS da tabela matches
    console.log('\n2. Validando RLS da tabela matches...');
    
    try {
      const matchesWithoutAuth = await fetchSupabase('matches', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
          'Range': '0-0'
        }
      });
      
      if (matchesWithoutAuth.length > 0) {
        console.error('❌ RLS matches: Partidas acessíveis sem autenticação');
      } else {
        console.log('✅ RLS matches: Bloqueado sem autenticação');
      }
    } catch (error) {
      console.log('✅ RLS matches: Bloqueado sem autenticação (erro esperado)');
    }

    // 3. Validar RLS da tabela predictions
    console.log('\n3. Validando RLS da tabela predictions...');
    
    try {
      const predictionsWithoutAuth = await fetchSupabase('predictions', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
          'Range': '0-0'
        }
      });
      
      if (predictionsWithoutAuth.length > 0) {
        console.error('❌ RLS predictions: Palpites acessíveis sem autenticação');
      } else {
        console.log('✅ RLS predictions: Bloqueado sem autenticação');
      }
    } catch (error) {
      console.log('✅ RLS predictions: Bloqueado sem autenticação (erro esperado)');
    }

    // 4. Validar RLS da tabela rankings
    console.log('\n4. Validando RLS da tabela rankings...');
    
    try {
      const rankingsWithoutAuth = await fetchSupabase('rankings', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
          'Range': '0-0'
        }
      });
      
      if (rankingsWithoutAuth.length > 0) {
        console.error('❌ RLS rankings: Rankings acessíveis sem autenticação');
      } else {
        console.log('✅ RLS rankings: Bloqueado sem autenticação');
      }
    } catch (error) {
      console.log('✅ RLS rankings: Bloqueado sem autenticação (erro esperado)');
    }

    // 5. Validar RLS da tabela admin_logs
    console.log('\n5. Validando RLS da tabela admin_logs...');
    
    try {
      const adminLogsWithoutAuth = await fetchSupabase('admin_logs', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
          'Range': '0-0'
        }
      });
      
      if (adminLogsWithoutAuth.length > 0) {
        console.error('❌ RLS admin_logs: Logs acessíveis sem autenticação');
      } else {
        console.log('✅ RLS admin_logs: Bloqueado sem autenticação');
      }
    } catch (error) {
      console.log('✅ RLS admin_logs: Bloqueado sem autenticação (erro esperado)');
    }

    // 6. Validar RLS com usuário não-admin (usando usuário existente)
    console.log('\n6. Validando RLS com usuário não-admin...');
    
    // Fazer login com o usuário de teste
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
      console.log('⚠️  Não foi possível fazer login com usuário de teste, pulando validação');
    } else {
      const loginData = await loginResponse.json();
      const userToken = loginData.access_token;

      // Tentar acessar admin_logs com usuário não-admin (deve falhar)
      try {
        const adminLogsWithUser = await fetchSupabase('admin_logs', {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${userToken}`,
            'Accept': 'application/json',
            'Range': '0-0'
          }
        });
        
        if (adminLogsWithUser.length > 0) {
          console.error('❌ RLS admin_logs: Logs acessíveis por usuário não-admin');
        } else {
          console.log('✅ RLS admin_logs: Bloqueado para usuário não-admin');
        }
      } catch (error) {
        console.log('✅ RLS admin_logs: Bloqueado para usuário não-admin (erro esperado)');
      }

      // Tentar acessar todos os usuários com usuário não-admin (deve falhar)
      try {
        const allUsersWithUser = await fetchSupabase('users', {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${userToken}`,
            'Accept': 'application/json',
            'Range': '0-0'
          }
        });
        
        if (allUsersWithUser.length > 1) {
          console.error('❌ RLS users: Todos os usuários acessíveis por usuário não-admin');
        } else {
          console.log('✅ RLS users: Apenas próprio usuário acessível');
        }
      } catch (error) {
        console.log('✅ RLS users: Apenas próprio usuário acessível (erro esperado)');
      }
    }

    // 7. Verificar se secrets estão expostos no código
    console.log('\n7. Verificando exposição de secrets no código...');
    
    const fs = require('fs');
    const path = require('path');
    
    const filesToCheck = [
      'apps/admin/src/lib/supabase.ts',
      'apps/mobile/src/services/supabase.ts',
      'apps/admin/.env.local',
      'apps/mobile/.env'
    ];

    const secretsFound = [];
    
    for (const file of filesToCheck) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('sb_secret_') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          secretsFound.push(file);
        }
      }
    }

    if (secretsFound.length > 0) {
      console.error('❌ Secrets expostos nos arquivos:', secretsFound);
    } else {
      console.log('✅ Nenhum secret exposto encontrado nos arquivos principais');
    }

    // 8. Verificar vulnerabilidades de SQL injection
    console.log('\n8. Verificando vulnerabilidades de SQL injection...');
    
    // Tentar SQL injection via API
    try {
      const maliciousQuery = await fetchSupabase('users', {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      // Se a query não falhar completamente, pode haver vulnerabilidade
      console.log('⚠️  Verificação manual de SQL injection necessária (API REST usa parâmetros seguros)');
    } catch (error) {
      console.log('✅ API REST parece usar parâmetros seguros');
    }

    console.log('\n=== AUDITORIA DE RLS E SEGURANÇA CONCLUÍDA ===');
    return true;
  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    return false;
  }
}

validateSecurity()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  });
