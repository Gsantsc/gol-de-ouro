const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../packages/shared/src/services/matches-provider/static-wc2026-data.ts");
const flagsPath = path.join(__dirname, "../apps/mobile/src/shared/team-flags.ts");

const content = fs.readFileSync(dataPath, "utf8");
const teams = new Set();
for (const key of ["homeTeam", "awayTeam", "sourceHomeTeam", "sourceAwayTeam"]) {
  const re = new RegExp(`"${key}": "([^"]+)"`, "g");
  for (const m of content.matchAll(re)) teams.add(m[1]);
}

const flags = fs.readFileSync(flagsPath, "utf8");
const normalize = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const parseRecord = (name) => {
  const start = flags.indexOf(`export const ${name}`);
  const block = flags.slice(start, flags.indexOf("};", start) + 2);
  const record = {};
  for (const m of block.matchAll(/"([^"]+)": "([^"]+)"/g)) record[m[1]] = m[2];
  return record;
};

const aliases = parseRecord("TEAM_ALIASES");
const isos = parseRecord("TEAM_ISO_CODES");

const resolveFlagUrl = (teamName) => {
  const canonical = aliases[normalize(teamName)] || teamName;
  const iso = isos[canonical];
  return iso ? `https://flagcdn.com/w80/${iso}.png` : null;
};

const missing = [];
const groupTeams = new Set();
const fixtureBlocks = content.match(/\{[\s\S]*?"stage": "group"[\s\S]*?\}/g) ?? [];
for (const block of fixtureBlocks) {
  for (const key of ["homeTeam", "awayTeam"]) {
    const match = block.match(new RegExp(`"${key}": "([^"]+)"`));
    if (match) groupTeams.add(match[1]);
  }
}

for (const team of [...teams].sort()) {
  if (!resolveFlagUrl(team)) {
    const canonical = aliases[normalize(team)] || team;
    missing.push({ team, canonical, group: groupTeams.has(team) });
  }
}

console.log(`Teams: ${teams.size}`);
console.log(`Group-stage teams: ${groupTeams.size}`);
console.log(`Missing flags: ${missing.length}`);
console.log("\nGroup-stage flag coverage:");
for (const team of [...groupTeams].sort()) {
  const url = resolveFlagUrl(team);
  console.log(`${url ? "OK " : "MISS"} ${team}`);
}
console.log("\nOther missing (placeholders/knockout):");
missing.filter((item) => !item.group).slice(0, 20).forEach((item) => console.log(`- ${item.team}`));
if (missing.filter((item) => !item.group).length > 20) {
  console.log(`... and ${missing.filter((item) => !item.group).length - 20} more`);
}
