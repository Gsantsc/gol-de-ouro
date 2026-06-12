const fs = require("fs");
const {
  getSupabaseServiceKey,
  getSupabaseUrl,
  optionalEnv,
} = require("./env.cjs");

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_SERVICE_KEY = getSupabaseServiceKey();
const dryRun = process.argv.includes("--dry-run");
const externalSeedFile = optionalEnv("PLAYER_SEED_FILE", "");

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const normalizeTeamCode = (teamName) =>
  String(teamName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isPlaceholderTeam = (teamName) =>
  /^(TBD|Winner |Loser |Runner-up |Third Place )/i.test(String(teamName).trim());

const readJson = async (response) => {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const rest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  return readJson(response);
};

const roster = {
  Algeria: ["Riyad Mahrez", "Ismail Bennacer", "Said Benrahma", "Amine Gouiri", "Ramy Bensebaini"],
  Argentina: ["Julian Alvarez", "Enzo Fernandez", "Alexis Mac Allister", "Lautaro Martinez", "Emiliano Martinez"],
  Australia: ["Mathew Ryan", "Jackson Irvine", "Craig Goodwin", "Ajdin Hrustic", "Harry Souttar"],
  Austria: ["Marko Arnautovic", "Marcel Sabitzer", "Christoph Baumgartner", "David Alaba", "Michael Gregoritsch"],
  Belgium: ["Kevin De Bruyne", "Romelu Lukaku", "Jeremy Doku", "Leandro Trossard", "Youri Tielemans"],
  "Bosnia-Herzegovina": ["Edin Dzeko", "Miralem Pjanic", "Ermedin Demirovic", "Rade Krunic", "Sead Kolasinac"],
  Brazil: ["Vinicius Jr", "Rodrygo", "Endrick", "Bruno Guimaraes", "Marquinhos"],
  "Cabo Verde": ["Ryan Mendes", "Bebe", "Jovane Cabral", "Garry Rodrigues", "Logan Costa"],
  Canada: ["Alphonso Davies", "Jonathan David", "Cyle Larin", "Stephen Eustaquio", "Tajon Buchanan"],
  Colombia: ["Luis Diaz", "James Rodriguez", "Jhon Arias", "Rafael Santos Borre", "Davinson Sanchez"],
  "Congo DR": ["Cedric Bakambu", "Yoane Wissa", "Chancel Mbemba", "Arthur Masuaku", "Gael Kakuta"],
  Croatia: ["Luka Modric", "Mateo Kovacic", "Andrej Kramaric", "Marcelo Brozovic", "Josko Gvardiol"],
  Curacao: ["Leandro Bacuna", "Juninho Bacuna", "Vurnon Anita", "Brandley Kuwas", "Rangelo Janga"],
  Czechia: ["Patrik Schick", "Tomas Soucek", "Vladimir Coufal", "Adam Hlozek", "Antonin Barak"],
  "Cote d'Ivoire": ["Sebastien Haller", "Franck Kessie", "Simon Adingra", "Nicolas Pepe", "Evan Ndicka"],
  Ecuador: ["Enner Valencia", "Moises Caicedo", "Piero Hincapie", "Pervis Estupinan", "Kendry Paez"],
  Egypt: ["Mohamed Salah", "Mostafa Mohamed", "Trezeguet", "Omar Marmoush", "Mohamed Elneny"],
  England: ["Harry Kane", "Jude Bellingham", "Bukayo Saka", "Phil Foden", "Declan Rice"],
  France: ["Kylian Mbappe", "Antoine Griezmann", "Ousmane Dembele", "Eduardo Camavinga", "William Saliba"],
  Germany: ["Jamal Musiala", "Florian Wirtz", "Kai Havertz", "Joshua Kimmich", "Antonio Rudiger"],
  Ghana: ["Mohammed Kudus", "Thomas Partey", "Inaki Williams", "Jordan Ayew", "Antoine Semenyo"],
  Haiti: ["Frantzdy Pierrot", "Duckens Nazon", "Derrick Etienne", "Bryan Alceus", "Danley Jean Jacques"],
  "IR Iran": ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh", "Saman Ghoddos", "Saeid Ezatolahi"],
  Iraq: ["Aymen Hussein", "Ali Al-Hamadi", "Ibrahim Bayesh", "Zidane Iqbal", "Bashar Resan"],
  Japan: ["Takefusa Kubo", "Kaoru Mitoma", "Daichi Kamada", "Wataru Endo", "Takumi Minamino"],
  Jordan: ["Musa Al-Taamari", "Yazan Al-Naimat", "Ali Olwan", "Nizar Al-Rashdan", "Ehsan Haddad"],
  "Korea Republic": ["Son Heung-min", "Lee Kang-in", "Hwang Hee-chan", "Kim Min-jae", "Cho Gue-sung"],
  Mexico: ["Santiago Gimenez", "Raul Jimenez", "Hirving Lozano", "Edson Alvarez", "Luis Chavez"],
  Morocco: ["Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri", "Sofyan Amrabat", "Azzedine Ounahi"],
  Netherlands: ["Cody Gakpo", "Memphis Depay", "Virgil van Dijk", "Frenkie de Jong", "Xavi Simons"],
  "New Zealand": ["Chris Wood", "Liberato Cacace", "Sarpreet Singh", "Ryan Thomas", "Joe Bell"],
  Norway: ["Erling Haaland", "Martin Odegaard", "Alexander Sorloth", "Oscar Bobb", "Sander Berge"],
  Panama: ["Jose Fajardo", "Adalberto Carrasquilla", "Anibal Godoy", "Cecilio Waterman", "Michael Murillo"],
  Paraguay: ["Miguel Almiron", "Julio Enciso", "Gustavo Gomez", "Ramon Sosa", "Adam Bareiro"],
  Portugal: ["Cristiano Ronaldo", "Bruno Fernandes", "Bernardo Silva", "Rafael Leao", "Joao Felix"],
  Qatar: ["Akram Afif", "Almoez Ali", "Hassan Al-Haydos", "Abdulaziz Hatem", "Boualem Khoukhi"],
  "Saudi Arabia": ["Salem Al-Dawsari", "Saleh Al-Shehri", "Firas Al-Buraikan", "Mohamed Kanno", "Ali Al-Bulaihi"],
  Scotland: ["Scott McTominay", "John McGinn", "Andy Robertson", "Che Adams", "Billy Gilmour"],
  Senegal: ["Sadio Mane", "Nicolas Jackson", "Ismaila Sarr", "Kalidou Koulibaly", "Idrissa Gueye"],
  "South Africa": ["Percy Tau", "Themba Zwane", "Teboho Mokoena", "Evidence Makgopa", "Ronwen Williams"],
  Spain: ["Lamine Yamal", "Pedri", "Nico Williams", "Alvaro Morata", "Rodri"],
  Sweden: ["Viktor Gyokeres", "Alexander Isak", "Dejan Kulusevski", "Emil Forsberg", "Victor Lindelof"],
  Switzerland: ["Granit Xhaka", "Xherdan Shaqiri", "Breel Embolo", "Manuel Akanji", "Ruben Vargas"],
  Tunisia: ["Wahbi Khazri", "Youssef Msakni", "Ellyes Skhiri", "Hannibal Mejbri", "Montassar Talbi"],
  Turkey: ["Hakan Calhanoglu", "Arda Guler", "Kenan Yildiz", "Kerem Akturkoglu", "Cengiz Under"],
  USA: ["Christian Pulisic", "Weston McKennie", "Tyler Adams", "Gio Reyna", "Folarin Balogun"],
  Uruguay: ["Federico Valverde", "Darwin Nunez", "Luis Suarez", "Ronald Araujo", "Manuel Ugarte"],
  Uzbekistan: ["Eldor Shomurodov", "Jaloliddin Masharipov", "Abdukodir Khusanov", "Oston Urunov", "Odiljon Hamrobekov"],
};

const positionForIndex = (index) => {
  if (index === 0 || index === 1) return "forward";
  if (index === 2 || index === 3) return "midfielder";
  return "defender";
};

const loadExternalRoster = () => {
  if (!externalSeedFile) return {};
  const content = fs.readFileSync(externalSeedFile, "utf8");
  return JSON.parse(content);
};

const mergeRosters = () => ({
  ...roster,
  ...loadExternalRoster(),
});

const main = async () => {
  const matches = await rest("matches?select=home_team,away_team,championship&championship=eq.world_cup_2026&deleted_at=is.null");
  const teams = [...new Set((matches ?? []).flatMap((match) => [match.home_team, match.away_team]).filter(Boolean))]
    .filter((teamName) => !isPlaceholderTeam(teamName))
    .sort();
  const seedRoster = mergeRosters();
  const rosterTeams = Object.keys(seedRoster).length;
  const missingTeams = teams.filter((teamName) => !seedRoster[teamName]);
  const players = Object.entries(seedRoster).flatMap(([teamName, names]) => {
    const teamCode = normalizeTeamCode(teamName);
    return names.map((name, index) => ({
      active: true,
      name,
      position: positionForIndex(index),
      shirt_number: index + 7,
      source: externalSeedFile ? "external_seed" : "seed_world_cup_2026",
      team_code: teamCode,
      team_name: teamName,
    }));
  });

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      missingTeams,
      players: players.length,
      rosterTeams,
      syncedTeams: teams.length,
    }, null, 2));
    return;
  }

  const inserted = await rest("players?on_conflict=team_code,name", {
    body: players,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });

  console.log(JSON.stringify({
    missingTeams,
    players: inserted?.length ?? 0,
    rosterTeams,
    syncedTeams: teams.length,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
