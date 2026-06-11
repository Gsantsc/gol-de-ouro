const fs = require("fs");
const path = require("path");

const htmlPath = path.resolve(process.argv[2] ?? "apps/mobile/dist-pwa/index.html");

if (!fs.existsSync(htmlPath)) {
  console.error(`HTML do PWA nao encontrado: ${htmlPath}`);
  process.exit(1);
}

const pwaHead = [
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<meta name="theme-color" content="#D4AF37" />',
  '<meta name="background-color" content="#0B0F19" />',
  '<meta name="description" content="Palpites, rankings e ligas da Copa do Mundo 2026." />',
  '<meta name="application-name" content="Gol de Ouro" />',
  '<meta name="apple-mobile-web-app-title" content="Gol de Ouro" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta property="og:title" content="Gol de Ouro" />',
  '<meta property="og:description" content="Palpites, rankings e ligas da Copa do Mundo 2026." />',
  '<meta property="og:type" content="website" />'
].join("\n    ");

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace('<html lang="en">', '<html lang="pt-BR">');

if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", `  ${pwaHead}\n  </head>`);
}

fs.writeFileSync(htmlPath, html);
console.log(`PWA HTML atualizado: ${htmlPath}`);
