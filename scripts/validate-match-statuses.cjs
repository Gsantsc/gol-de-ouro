// VALIDATE MATCH STATUSES
const { calculateMatchStatus, isMatchLive, isMatchOpenForPrediction, isMatchFinished } = require("../packages/shared/dist/match-status-engine");

const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
const in30Min = new Date(now.getTime() + 30 * 60 * 1000);
const in5Hours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

const scenarios = [
  {
    name: "jogo amanhã",
    match: {
      start_time: tomorrow.toISOString(),
      status: "aguardando"
    },
    expectedStatus: "fechado"
  },
  {
    name: "jogo daqui 2 horas com palpite aberto",
    match: {
      start_time: in2Hours.toISOString(),
      prediction_open_at: new Date(in2Hours.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      prediction_close_at: new Date(in2Hours.getTime() - 60 * 60 * 1000).toISOString(),
      status: "aguardando"
    },
    expectedStatus: "aberto"
  },
  {
    name: "jogo daqui 30 min após prediction_close_at",
    match: {
      start_time: in30Min.toISOString(),
      prediction_open_at: new Date(in30Min.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      prediction_close_at: new Date(in30Min.getTime() - 60 * 60 * 1000).toISOString(),
      status: "aguardando"
    },
    expectedStatus: "fechado"
  },
  {
    name: "jogo começou agora e provider confirmou ao_vivo",
    match: {
      start_time: now.toISOString(),
      status: "ao_vivo"
    },
    expectedStatus: "ao_vivo"
  },
  {
    name: "jogo começou há 5 horas e não está encerrado",
    match: {
      start_time: yesterday.toISOString(),
      status: "ao_vivo"
    },
    expectedStatus: "fechado"
  },
  {
    name: "jogo encerrado",
    match: {
      start_time: yesterday.toISOString(),
      status: "encerrado"
    },
    expectedStatus: "encerrado"
  }
];

console.log("Validando status de jogos...\n");

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
  const computedStatus = calculateMatchStatus(scenario.match, now);
  const isLive = isMatchLive(scenario.match, now);
  const isOpen = isMatchOpenForPrediction(scenario.match, now);
  const isFinished = isMatchFinished(scenario.match);
  
  const statusMatch = computedStatus === scenario.expectedStatus;
  
  console.log(`Cenário: ${scenario.name}`);
  console.log(`  Status esperado: ${scenario.expectedStatus}`);
  console.log(`  Status calculado: ${computedStatus}`);
  console.log(`  isMatchLive: ${isLive}`);
  console.log(`  isMatchOpenForPrediction: ${isOpen}`);
  console.log(`  isMatchFinished: ${isFinished}`);
  console.log(`  Resultado: ${statusMatch ? "PASS" : "FAIL"}`);
  console.log();
  
  if (statusMatch) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\nResumo: ${passed} passaram, ${failed} falharam`);

if (failed > 0) {
  process.exit(1);
}
