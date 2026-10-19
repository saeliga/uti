// Relatório de qualidade por versão (ISO/IEC 25010:2023), a partir dos resultados do CI.
// Uso (na raiz do repositório): node ferramentas/relatorio_qualidade.mjs
// Lê o que existir na pasta (testes, cobertura, acessibilidade, desempenho, análise
// estática, disponibilidade, varredura de segurança) e escreve um Markdown com a
// tabela característica → métrica → valor → critério → situação.
import fs from 'node:fs';
import path from 'node:path';

// Caminhos fixos (sem argumentos de linha de comando): lê e escreve só em resultados/.
const DIR = path.resolve('resultados');
const SAIDA = path.join(DIR, 'relatorio.md');
const ler = (f) => { try { return fs.readFileSync(path.join(DIR, f), 'utf8'); } catch { return null; } };
const json = (f) => { const t = ler(f); try { return t ? JSON.parse(t) : null; } catch { return null; } };
const arquivos = (re) => { try { return fs.readdirSync(DIR).filter((f) => re.test(f)); } catch { return []; } };
const pct = (x, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
const num = (x, d = 0) => Number(x).toFixed(d).replace('.', ',');

const versao = (() => { try { return JSON.parse(fs.readFileSync('versao.json', 'utf8')).versao; } catch { return '?'; } })();
const commit = (process.env.GITHUB_SHA || '').slice(0, 7);
const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

const linhas = []; // [característica, métrica, valor, critério, situação]
const SIT = { sim: 'Atende', nao: 'Não atende', sem: 'Sem dados', info: 'Informativo' };
const add = (c, m, v, crit, s) => linhas.push([c, m, v, crit, SIT[s]]);
const detalhes = [];

// ------------------------------------------------------------------ testes (TAP do node)
function tap(f) {
  const t = ler(f);
  if (!t) return null;
  const n = (k) => Number((t.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] || 0);
  return { total: n('tests'), pass: n('pass'), fail: n('fail'), skip: n('skipped') };
}
const unidade = tap('unidade.tap');
const regras = tap('regras.tap');

// ------------------------------------------------------------------ E2E
const e2e = arquivos(/^e2e-.*\.json$/).map((f) => json(f)).filter(Boolean);
const todos = e2e.flatMap((r) => r.testes.map((t) => ({ ...t, onde: `${r.navegador}/${r.perfil}` })));
const grupo = (mod) => todos.filter((t) => t.id.includes(mod) && t.situacao !== 'pulado');
const resumo = (lista) => ({ total: lista.length, ok: lista.filter((t) => t.situacao === 'aprovado').length });
const confi = json('confiabilidade.json');

// Adequação funcional
{
  const f = resumo(grupo('test_funcional'));
  const u = unidade;
  const tot = (u?.total || 0) + f.total;
  const ok = (u?.pass || 0) + f.ok;
  add('Adequação funcional', 'Testes unitários e casos de uso ponta a ponta aprovados', tot ? `${ok}/${tot}` : '—', '100%', tot ? (ok === tot ? 'sim' : 'nao') : 'sem');
  const lcov = ler('lcov.info');
  if (lcov) {
    let lf = 0, lh = 0;
    for (const bloco of lcov.split('end_of_record')) {
      const sf = (bloco.match(/^SF:(.*)$/m) || [])[1] || '';
      if (!/js[\\/]regras[\\/]/.test(sf)) continue;
      lf += Number((bloco.match(/^LF:(\d+)/m) || [])[1] || 0);
      lh += Number((bloco.match(/^LH:(\d+)/m) || [])[1] || 0);
    }
    add('Adequação funcional', 'Cobertura de linhas das regras clínicas (js/regras)', lf ? pct(lh / lf) : '—', '≥ 80%', lf ? (lh / lf >= 0.8 ? 'sim' : 'nao') : 'sem');
  } else add('Adequação funcional', 'Cobertura de linhas das regras clínicas (js/regras)', '—', '≥ 80%', 'sem');
}

// Segurança da informação
{
  add('Segurança da informação', 'Testes das regras de acesso no simulador do Firestore', regras ? `${regras.pass}/${regras.total}` : '—', '100%', regras ? (regras.fail === 0 && regras.total > 0 ? 'sim' : 'nao') : 'sem');
  const zap = json('zap/report_json.json');
  if (zap) {
    const alertas = (zap.site || []).flatMap((s) => s.alerts || []);
    const por = (r) => alertas.filter((a) => String(a.riskcode) === r).length;
    add('Segurança da informação', 'Varredura OWASP ZAP do site publicado (alertas alto/médio/baixo)', `${por('3')}/${por('2')}/${por('1')}`, 'nenhum alerta alto', por('3') === 0 ? 'sim' : 'nao');
    detalhes.push(['Varredura OWASP ZAP', alertas.map((a) => `- [${['Info', 'Baixo', 'Médio', 'Alto'][a.riskcode] || a.riskcode}] ${a.name} (${a.count || a.instances?.length || 1})`).join('\n') || 'Nenhum alerta.']);
  } else add('Segurança da informação', 'Varredura OWASP ZAP do site publicado', '—', 'nenhum alerta alto', 'sem');
}

// Segurança operacional
{
  const s = resumo(grupo('test_seguranca_operacional'));
  const srv = unidade ? 'incluídos nos testes unitários (servidor de IA)' : '';
  add('Segurança operacional', 'Falha da IA (resposta inválida, demora, sem internet) sem bloquear o trabalho', s.total ? `${s.ok}/${s.total}` : '—', '100%', s.total ? (s.ok === s.total ? 'sim' : 'nao') : 'sem');
  if (srv) add('Segurança operacional', 'Códigos inexistentes devolvidos pela IA são descartados no servidor', 'ver testes unitários', 'nenhum item inventado', unidade.fail === 0 ? 'sim' : 'nao');
}

// Confiabilidade
{
  const t = confi?.testes?.filter((x) => x.situacao !== 'pulado') || [];
  const ok = t.filter((x) => x.situacao === 'aprovado').length;
  add('Confiabilidade', 'Sem perda de registro: Wi-Fi instável e dois aparelhos ao mesmo tempo (simuladores do Firebase)', t.length ? `${ok}/${t.length}` : '—', '100%', t.length ? (ok === t.length ? 'sim' : 'nao') : 'sem');
  const csv = ler('disponibilidade.csv');
  if (csv) {
    const corte = Date.now() - 30 * 864e5;
    const reg = csv.trim().split('\n').slice(1).map((l) => l.split(',')).filter((c) => Date.parse(c[0]) >= corte);
    const ok2 = reg.filter((c) => c[1] === '200').length;
    add('Confiabilidade', `Disponibilidade do site nos últimos 30 dias (${reg.length} verificações)`, reg.length ? pct(ok2 / reg.length, 2) : '—', '≥ 99%', reg.length ? (ok2 / reg.length >= 0.99 ? 'sim' : 'nao') : 'sem');
  } else add('Confiabilidade', 'Disponibilidade do site (verificação de hora em hora)', '—', '≥ 99%', 'sem');
}

// Eficiência de desempenho
for (const perfil of ['desktop', 'celular']) {
  const man = json(`lighthouse-${perfil}/manifest.json`);
  const rep = man?.find((r) => r.isRepresentativeRun) || man?.[0];
  if (!rep) { add('Eficiência de desempenho', `Lighthouse (${perfil})`, '—', 'desempenho ≥ 0,80', 'sem'); continue; }
  let lcp = null;
  try { lcp = JSON.parse(fs.readFileSync(path.join(DIR, `lighthouse-${perfil}`, path.basename(rep.jsonPath)), 'utf8')).audits['largest-contentful-paint'].numericValue; } catch { /* sem detalhe */ }
  add('Eficiência de desempenho', `Pontuação de desempenho do Lighthouse (${perfil})`, num(rep.summary.performance, 2), '≥ 0,80', rep.summary.performance >= 0.8 ? 'sim' : 'nao');
  if (lcp != null) add('Eficiência de desempenho', `Maior elemento visível carregado, LCP (${perfil})`, `${num(lcp / 1000, 2)} s`, '≤ 2,5 s', lcp <= 2500 ? 'sim' : 'nao');
}

// Capacidade de interação (acessibilidade)
{
  const axe = arquivos(/^axe-.*\.json$/).map((f) => ({ f, d: json(f) })).filter((x) => x.d);
  if (axe.length) {
    const ocorr = axe.flatMap((x) => x.d.flatMap((t) => t.violacoes.map((v) => ({ ...v, tela: t.tela, onde: x.f.replace(/^axe-|\.json$/g, '') }))));
    const graves = ocorr.filter((v) => ['serious', 'critical'].includes(v.impacto));
    add('Capacidade de interação', 'Violações WCAG 2.1 A/AA (axe-core) nas telas principais — graves/críticas', `${graves.length} (total de regras violadas: ${new Set(ocorr.map((v) => v.id)).size})`, 'nenhuma grave ou crítica', graves.length === 0 ? 'sim' : 'nao');
    const porRegra = {};
    for (const v of ocorr) (porRegra[v.id] ||= { ...v, telas: new Set() }).telas.add(`${v.tela} (${v.onde})`);
    const exemplos = {};
    for (const v of ocorr) for (const e of v.exemplos || []) (exemplos[v.id] ||= new Set()).add(e);
    detalhes.push(['Acessibilidade (axe-core)', Object.values(porRegra).map((v) => `- **${v.id}** (${v.impacto}): ${v.ajuda} — telas: ${[...new Set([...v.telas].map((t) => t.replace(/ \(.*\)$/, '')))].join('; ')}\n${[...(exemplos[v.id] || [])].slice(0, 8).map((e) => `    - ${e}`).join('\n')}`).join('\n') || 'Nenhuma violação.']);
  } else add('Capacidade de interação', 'Violações WCAG 2.1 A/AA (axe-core)', '—', 'nenhuma grave ou crítica', 'sem');
  const man = json('lighthouse-celular/manifest.json');
  const rep = man?.find((r) => r.isRepresentativeRun) || man?.[0];
  if (rep) add('Capacidade de interação', 'Pontuação de acessibilidade do Lighthouse (celular)', num(rep.summary.accessibility, 2), '≥ 0,90', rep.summary.accessibility >= 0.9 ? 'sim' : 'nao');
  add('Capacidade de interação', 'Usabilidade percebida (System Usability Scale)', 'Fase 5 da pesquisa', '—', 'info');
}

// Manutenibilidade
{
  const es = json('eslint.json');
  if (es) {
    const erros = es.reduce((a, f) => a + f.errorCount, 0);
    const avisos = es.reduce((a, f) => a + f.warningCount, 0);
    const complex = es.flatMap((f) => f.messages).filter((m) => m.ruleId === 'complexity').length;
    add('Manutenibilidade', 'Análise estática (ESLint): erros', String(erros), '0', erros === 0 ? 'sim' : 'nao');
    add('Manutenibilidade', 'Funções com complexidade ciclomática acima de 20', String(complex), 'informativo', 'info');
    const regrasC = {};
    for (const m of es.flatMap((f) => f.messages.map((x) => ({ ...x, arq: path.relative(process.cwd(), f.filePath) })))) (regrasC[m.ruleId || 'sintaxe'] ||= []).push(`${m.arq}:${m.line}`);
    detalhes.push(['Análise estática (ESLint)', `${erros} erro(s), ${avisos} aviso(s).\n\n` + Object.entries(regrasC).sort((a, b) => b[1].length - a[1].length).map(([r, l]) => `- **${r}** (${l.length}): ${l.slice(0, 5).join(', ')}${l.length > 5 ? '…' : ''}`).join('\n')]);
  } else add('Manutenibilidade', 'Análise estática (ESLint)', '—', '0 erros', 'sem');
  const cp = json('jscpd/jscpd-report.json');
  const p = cp?.statistics?.total?.percentage;
  add('Manutenibilidade', 'Código duplicado (jscpd)', p != null ? `${num(p, 2)}%` : '—', '≤ 3%', p != null ? (p <= 3 ? 'sim' : 'nao') : 'sem');
}

// SonarCloud (análise automática do repositório)
{
  const so = json('sonar.json');
  const m = Object.fromEntries((so?.component?.measures || []).map((x) => [x.metric, x.value ?? x.period?.value]));
  const nota = (v) => (v ? 'ABCDE'[Math.round(Number(v)) - 1] : null);
  const linha = (c, metrica, chave, extra) => {
    const n = nota(m[chave]);
    add(c, `${metrica} (SonarCloud)`, n ? `${n}${extra ? ` (${extra})` : ''}` : '—', 'A', n ? (n === 'A' ? 'sim' : 'nao') : 'sem');
  };
  linha('Manutenibilidade', 'Nota de manutenibilidade', 'sqale_rating', m.code_smells != null ? `${m.code_smells} code smells` : '');
  linha('Segurança da informação', 'Nota de segurança do código', 'security_rating', m.vulnerabilities != null ? `${m.vulnerabilities} vulnerabilidades, ${m.security_hotspots ?? '?'} pontos a revisar` : '');
  linha('Confiabilidade', 'Nota de confiabilidade do código', 'reliability_rating', m.bugs != null ? `${m.bugs} bugs` : '');
  const pr = json('sonar-problemas.json');
  if (pr?.issues?.length) {
    detalhes.push(['SonarCloud: vulnerabilidades e bugs', pr.issues.map((i) => `- [${i.type === 'BUG' ? 'bug' : 'vulnerabilidade'}, ${i.severity}] ${String(i.component).replace(/^saeliga_uti:/, '')}:${i.line ?? '?'} — ${i.message} (${i.rule})`).join('\n')]);
  }
}

// Flexibilidade
{
  const combos = e2e.map((r) => {
    const t = r.testes.filter((x) => x.situacao !== 'pulado');
    return { onde: `${r.navegador}/${r.perfil}`, ok: t.length > 0 && t.every((x) => x.situacao === 'aprovado'), n: t.length };
  });
  add('Flexibilidade', 'Casos de uso aprovados por navegador e tipo de tela', combos.length ? combos.map((c) => `${c.onde} ${c.ok ? '✓' : '✗'}`).join(' · ') : '—', 'todas as combinações', combos.length ? (combos.every((c) => c.ok) ? 'sim' : 'nao') : 'sem');
  add('Flexibilidade', 'Implantação das regras de acesso num projeto vazio (simulador)', regras ? 'ver testes das regras' : '—', 'sem erro', regras ? (regras.fail === 0 ? 'sim' : 'nao') : 'sem');
}

// Compatibilidade
{
  const c = resumo(grupo('test_compatibilidade'));
  add('Compatibilidade', 'Cópia para o PEP (com e sem formatação) e impressos', c.total ? `${c.ok}/${c.total}` : '—', '100%', c.total ? (c.ok === c.total ? 'sim' : 'nao') : 'sem');
  add('Compatibilidade', 'Colagem no PEP real da instituição', 'conferência manual', 'documentada', 'info');
}

// ------------------------------------------------------------------ saída
const tab = (cab, ls) => [`| ${cab.join(' | ')} |`, `| ${cab.map(() => '---').join(' | ')} |`, ...ls.map((l) => `| ${l.map((x) => String(x).replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');
const atende = linhas.filter((l) => l[4] === SIT.sim).length;
const avaliados = linhas.filter((l) => [SIT.sim, SIT.nao].includes(l[4])).length;
const md = [
  `# Relatório de qualidade — versão ${versao}`,
  '',
  `Gerado automaticamente em ${data}${commit ? ` (commit ${commit})` : ''}, segundo características selecionadas da ISO/IEC 25010:2023. Dados fictícios em todos os testes.`,
  '',
  `**${atende} de ${avaliados} critérios avaliados atendidos.**`,
  '',
  tab(['Característica', 'Métrica', 'Valor', 'Critério', 'Situação'], linhas),
  '',
  '## Casos de uso ponta a ponta',
  '',
  todos.length ? tab(['Teste', 'Navegador/tela', 'Situação', 'Tempo (s)'], todos.map((t) => [t.descricao, t.onde, t.situacao, num(t.segundos, 1)])) : 'Sem resultados.',
  ...detalhes.flatMap(([t, c]) => ['', `## ${t}`, '', c]),
  '',
].join('\n');
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(`::notice title=Qualidade ${versao}::${atende} de ${avaliados} critérios atendidos`);
for (const l of linhas.filter((x) => x[4] === SIT.nao)) console.log(`::warning title=${l[0]}::${l[1]}: ${l[2]} (critério ${l[3]})`);
// Detalhes também como uma anotação (lidos no resumo do PR).
const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
for (const [t, c] of detalhes) console.log(`::notice title=Detalhe: ${t}::${esc(c.slice(0, 3500))}`);
