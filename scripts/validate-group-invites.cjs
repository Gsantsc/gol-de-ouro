const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const checks = [
  {
    file: "supabase/migrations/20260620120000_group_invite_preview_intents.sql",
    patterns: [
      "create table if not exists public.group_invite_intents",
      "create or replace function public.get_group_invite_preview",
      "create or replace function public.accept_group_invite",
      "create or replace function public.apply_pending_group_invites",
      "else '/invite/'"
    ]
  },
  {
    file: "apps/mobile/src/screens/AppRoot.tsx",
    patterns: [
      "InviteScreen",
      "PENDING_INVITE_STORAGE_KEY",
      "extractGroupInviteCode",
      "acceptGroupInvite"
    ]
  },
  {
    file: "apps/mobile/src/screens/GroupsScreen.tsx",
    patterns: [
      "Criar nova liga",
      "Minhas ligas",
      "Convites",
      "https://gol-de-ouro-app.vercel.app/invite/"
    ]
  },
  {
    file: "apps/mobile/src/services/football.service.ts",
    patterns: [
      "getGroupInvitePreview",
      "acceptGroupInvite",
      "get_group_invite_preview",
      "accept_group_invite"
    ]
  }
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      failures.push(`${check.file}: missing "${pattern}"`);
    }
  }
}

if (failures.length) {
  console.error("Group invite validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Group invite validation passed.");
