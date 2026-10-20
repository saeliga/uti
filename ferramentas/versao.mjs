// Atualiza o número da versão e o "mapa de importação" do index.html.
// Uso (na raiz do repositório): node ferramentas/versao.mjs 0.2.2
//
// Por quê: o GitHub Pages e o navegador guardam os arquivos .js em cache por
// alguns minutos. Sem isto, depois de uma publicação o navegador pode misturar
// módulos novos e antigos, e o sistema fica parado em "Carregando…". O mapa faz
// cada módulo ser pedido como "arquivo.js?v=VERSÃO", então uma versão nova
// sempre baixa o conjunto inteiro, e a mesma versão continua usando o cache.
import fs from 'node:fs';
import path from 'node:path';

const versao = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(versao || '')) {
  console.error('Informe a versão, ex.: node ferramentas/versao.mjs 0.2.2');
  process.exit(1);
}
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const lerJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? lerJs(p) : e.name.endsWith('.js') ? [p] : [];
});
const arquivos = lerJs(path.join(raiz, 'js')).map((p) => `./${path.relative(raiz, p).split(path.sep).join('/')}`).sort((a, b) => a.localeCompare(b));
const mapa = { imports: Object.fromEntries(arquivos.map((a) => [a, `${a}?v=${versao}`])) };

let html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const bloco = `<script type="importmap">\n${JSON.stringify(mapa, null, 2)}\n  </script>`;
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, bloco);
if (!html.includes('type="importmap"')) html = html.replace('<script type="module"', `${bloco}\n  <script type="module"`);
html = html.replace(/<script type="module" src="js\/main\.js[^"]*"><\/script>/, `<script type="module" src="js/main.js?v=${versao}"></script>`);

// Pré-carregamento dos módulos importados de forma estática a partir de main.js
// (depois do mapa de importação: antes dele, o Chrome ignoraria o mapa):
// o navegador baixa todos em paralelo, em vez de descobrir um por um (tela de
// entrada aparece mais cedo, sobretudo no tablet e no celular).
const estaticos = new Set();
const visitar = (rel) => {
  if (estaticos.has(rel)) return;
  estaticos.add(rel);
  const txt = fs.readFileSync(path.join(raiz, rel), 'utf8');
  for (const m of txt.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'|^\s*import\s+'([^']+)'/gm)) {
    const alvo = m[1] || m[2];
    if (!alvo.startsWith('.')) continue;
    visitar(`./${path.posix.normalize(path.posix.join(path.posix.dirname(rel), alvo))}`);
  }
};
visitar('./js/main.js');
const pre = [...estaticos].sort((a, b) => a.localeCompare(b)).map((a) => `  <link rel="modulepreload" href="${a}?v=${versao}">`).join('\n');
const blocoPre = `<!-- pré-carregamento (gerado por ferramentas/versao.mjs) -->\n${pre}\n  <!-- /pré-carregamento -->`;
if (html.includes('<!-- pré-carregamento')) html = html.replace(/<!-- pré-carregamento[\s\S]*?<!-- \/pré-carregamento -->/, blocoPre);
else html = html.replace('<script type="module" src="js/main.js', `${blocoPre}\n  <script type="module" src="js/main.js`);
html = html.replace(/href="css\/([a-z-]+)\.css(\?v=[^"]*)?"/g, (_, nome) => `href="css/${nome}.css?v=${versao}"`);
fs.writeFileSync(path.join(raiz, 'index.html'), html);

const cfg = path.join(raiz, 'js', 'config.js');
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/export const VERSAO = '[^']*';/, `export const VERSAO = '${versao}';`));
fs.writeFileSync(path.join(raiz, 'versao.json'), `{ "versao": "${versao}" }\n`);
console.log(`Versão ${versao}: ${arquivos.length} módulos no mapa de importação; ${estaticos.size} pré-carregados.`);
