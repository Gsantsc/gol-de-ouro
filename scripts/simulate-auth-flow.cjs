const assert = (condition, message, details = {}) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const createAuthHarness = (initialStatus = "pending", options = {}) => {
  let currentStatus = initialStatus;
  let session = null;
  let profile = null;
  let submitting = false;
  let signInError = options.signInError ?? null;
  const calls = {
    fetchProfile: 0,
    getSession: 0,
    signIn: 0,
    signOut: 0
  };

  const readProfile = async () => {
    calls.fetchProfile += 1;
    profile = {
      approval_status: currentStatus,
      blocked: currentStatus === "suspended",
      id: "user-1",
      role: "player",
      status: currentStatus
    };
    return profile;
  };

  const signIn = async () => {
    if (submitting) return;
    submitting = true;
    try {
      calls.signIn += 1;
      if (signInError) throw signInError;
      session = { user: { id: "user-1" } };
      await readProfile();
    } finally {
      submitting = false;
    }
  };

  const verifyApproval = async () => {
    if (!session) throw new Error("No active session.");
    await readProfile();
  };

  const boot = async (hasSession = true) => {
    calls.getSession += 1;
    session = hasSession ? { user: { id: "user-1" } } : null;
    if (session) await readProfile();
  };

  const signOut = async () => {
    calls.signOut += 1;
    session = null;
    profile = null;
  };

  return {
    boot,
    calls,
    get accessAllowed() {
      return Boolean(profile && profile.status === "approved" && !profile.blocked);
    },
    setSignInError: (error) => {
      signInError = error;
    },
    setStatus: (status) => {
      currentStatus = status;
    },
    signIn,
    signOut,
    verifyApproval
  };
};

const runCase = async (name, run) => {
  try {
    const result = await run();
    return { name, ok: true, result };
  } catch (error) {
    return {
      details: error.details,
      error: error.message,
      name,
      ok: false
    };
  }
};

const expectReject = async (promise, expectedMessage) => {
  let rejected = false;
  try {
    await promise;
  } catch (error) {
    rejected = true;
    assert(
      error.message.includes(expectedMessage),
      `Erro esperado "${expectedMessage}", recebido "${error.message}".`,
    );
  }
  assert(rejected, "A chamada deveria falhar.");
};

const cases = [
  runCase("usuario pending tenta login", async () => {
    const auth = createAuthHarness("pending");
    await auth.signIn();
    assert(auth.calls.signIn === 1, "Pending deveria chamar signIn uma vez.", auth.calls);
    assert(auth.calls.fetchProfile === 1, "Pending deveria buscar profile uma vez.", auth.calls);
    assert(!auth.accessAllowed, "Pending nao deve acessar.");
    return auth.calls;
  }),
  runCase("usuario approved tenta login", async () => {
    const auth = createAuthHarness("approved");
    await auth.signIn();
    assert(auth.calls.signIn === 1, "Approved deveria chamar signIn uma vez.", auth.calls);
    assert(auth.accessAllowed, "Approved deve acessar.");
    return auth.calls;
  }),
  runCase("usuario rejected tenta login", async () => {
    const auth = createAuthHarness("rejected");
    await auth.signIn();
    assert(auth.calls.signIn === 1, "Rejected deveria chamar signIn uma vez.", auth.calls);
    assert(!auth.accessAllowed, "Rejected nao deve acessar.");
    return auth.calls;
  }),
  runCase("usuario suspended tenta login", async () => {
    const auth = createAuthHarness("suspended");
    await auth.signIn();
    assert(auth.calls.signIn === 1, "Suspended deveria chamar signIn uma vez.", auth.calls);
    assert(auth.calls.fetchProfile === 1, "Suspended deveria buscar profile uma vez.", auth.calls);
    assert(!auth.accessAllowed, "Suspended nao deve acessar.");
    return auth.calls;
  }),
  runCase("senha incorreta", async () => {
    const auth = createAuthHarness("approved", { signInError: new Error("Invalid login credentials") });
    await expectReject(auth.signIn(), "Invalid login credentials");
    assert(auth.calls.signIn === 1, "Senha incorreta deve chamar signIn uma vez.", auth.calls);
    assert(auth.calls.fetchProfile === 0, "Senha incorreta nao deve buscar profile.", auth.calls);
    assert(!auth.accessAllowed, "Senha incorreta nao deve acessar.");
    return auth.calls;
  }),
  runCase("email inexistente", async () => {
    const auth = createAuthHarness("approved", { signInError: new Error("User not found") });
    await expectReject(auth.signIn(), "User not found");
    assert(auth.calls.signIn === 1, "Email inexistente deve chamar signIn uma vez.", auth.calls);
    assert(auth.calls.fetchProfile === 0, "Email inexistente nao deve buscar profile.", auth.calls);
    assert(!auth.accessAllowed, "Email inexistente nao deve acessar.");
    return auth.calls;
  }),
  runCase("pending aprovado clica verificar aprovacao", async () => {
    const auth = createAuthHarness("pending");
    await auth.signIn();
    auth.setStatus("approved");
    await auth.verifyApproval();
    assert(auth.calls.signIn === 1, "Verificar aprovacao nao deve chamar signIn novamente.", auth.calls);
    assert(auth.calls.fetchProfile === 2, "Verificar aprovacao deve buscar profile exatamente mais uma vez.", auth.calls);
    assert(auth.accessAllowed, "Usuario aprovado deve acessar apos verificacao.");
    return auth.calls;
  }),
  runCase("duplo clique no botao entrar", async () => {
    const auth = createAuthHarness("approved");
    await Promise.all([auth.signIn(), auth.signIn()]);
    assert(auth.calls.signIn === 1, "Duplo clique deve produzir apenas uma chamada de signIn.", auth.calls);
    return auth.calls;
  }),
  runCase("reload da pagina apos login", async () => {
    const auth = createAuthHarness("approved");
    await auth.boot(true);
    assert(auth.calls.getSession === 1, "Reload deve chamar getSession uma vez.", auth.calls);
    assert(auth.calls.fetchProfile === 1, "Reload deve buscar profile uma vez.", auth.calls);
    assert(auth.accessAllowed, "Approved deve acessar apos reload.");
    return auth.calls;
  }),
  runCase("logout e novo login", async () => {
    const auth = createAuthHarness("approved");
    await auth.signIn();
    await auth.signOut();
    await auth.signIn();
    assert(auth.calls.signIn === 2, "Logout/login deve permitir um signIn por tentativa real.", auth.calls);
    assert(auth.calls.signOut === 1, "Logout deveria ser registrado uma vez.", auth.calls);
    assert(auth.accessAllowed, "Approved deve acessar apos novo login.");
    return auth.calls;
  })
];

Promise.all(cases).then((results) => {
  const approved = results.every((result) => result.ok);
  console.log(JSON.stringify({ approved, results }, null, 2));
  if (!approved) process.exit(1);
});
