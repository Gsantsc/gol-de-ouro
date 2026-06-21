const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const checks = [];

const add = (id, ok, detail) => {
  checks.push({ id, ok: Boolean(ok), detail });
};

const betaMigration = "supabase/migrations/20260615120000_beta_prediction_settings.sql";
const migration = exists(betaMigration) ? read(betaMigration) : "";
const userApi = read("apps/admin/src/lib/user-api.ts");
const mobileService = read("apps/mobile/src/services/football.service.ts");
const dashboard = read("apps/admin/src/app/dashboard/page.tsx");
const adminPage = read("apps/admin/src/app/admin/page.tsx");
const sharedWindow = read("packages/shared/src/prediction-window-service.ts");
const globals = read("apps/admin/src/app/globals.css");
const inviteMigration = exists("supabase/migrations/20260620120000_group_invite_preview_intents.sql")
  ? read("supabase/migrations/20260620120000_group_invite_preview_intents.sql")
  : "";
const appRoot = read("apps/mobile/src/screens/AppRoot.tsx");
const groupsScreen = read("apps/mobile/src/screens/GroupsScreen.tsx");

add("db.app_settings", migration.includes("create table if not exists public.app_settings"), "Config global persistida no banco.");
add("db.lock_rpc", migration.includes("set_prediction_lock_minutes"), "Admin altera prediction_lock_minutes sem deploy.");
add("db.submit_rpc", migration.includes("create or replace function public.submit_prediction"), "Palpites passam por RPC server-side.");
add("db.deadline_policy", migration.includes("public.prediction_deadline"), "RLS e triggers usam deadline configuravel.");
add("db.allowed_values", /60,\s*90,\s*120,\s*180/.test(migration), "Somente 60/90/120/180 minutos permitidos.");
add("pwa.no_direct_prediction_upsert", !userApi.includes('.from("predictions")\n      .upsert') && userApi.includes('supabase.rpc("submit_prediction"'), "PWA salva palpite via RPC.");
add("mobile.no_direct_prediction_upsert", !mobileService.includes('.from("predictions")\n    .upsert') && mobileService.includes('supabase.rpc("submit_prediction"'), "Mobile salva palpite via RPC.");
add("pwa.settings_loaded", userApi.includes('supabase.rpc("get_app_settings"') && dashboard.includes("predictionLockMinutes"), "PWA carrega regra do banco.");
add("admin.settings_screen", adminPage.includes("Configurações do Bolão") && adminPage.includes("updatePredictionLockMinutes"), "Admin possui tela de regras.");
add("auth.no_refresh_auth_loop", dashboard.includes('event === "SIGNED_IN" || event === "USER_UPDATED"'), "PWA evita refresh em loop de auth.");
add("ui.closed_message", sharedWindow.includes("Palpites encerrados para esta partida."), "Mensagem padronizada de bloqueio.");
add("responsive.global_overflow", globals.includes("overflow-x: hidden") && globals.includes("max-w-full"), "CSS global reduz overflow horizontal.");
add("invites.preview_rpc", inviteMigration.includes("get_group_invite_preview"), "Convites de liga possuem preview server-side.");
add("invites.accept_rpc", inviteMigration.includes("accept_group_invite") && inviteMigration.includes("group_invite_intents"), "Convites salvam intencao para usuarios pending.");
add("invites.clean_url", inviteMigration.includes("else '/invite/'") && groupsScreen.includes("/invite/"), "Links de liga usam /invite/:token.");
add("invites.pwa_route", appRoot.includes("InviteScreen") && appRoot.includes("PENDING_INVITE_STORAGE_KEY"), "PWA preserva convite durante login/cadastro.");

const failed = checks.filter((check) => !check.ok);
const summary = {
  failed: failed.length,
  passed: checks.length - failed.length,
  status: failed.length ? "failed" : "ok",
  checks,
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exitCode = 1;
