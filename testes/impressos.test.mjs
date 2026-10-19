// Impressos no padrão da Liga: check-list de IRAS, folha de balanço hídrico e ocorrência.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUNDLES_IRAS, adesaoBundle, irasInicial, resumoIras, bundlesAplicaveis, camposBH, camposOcorrencia, preencherModelo,
  dataExtenso, diaDaSemana, juntarEvolucoes, CHECKLISTS_INSERCAO,
  itensInsercao, tipoChecklistDe, novoChecklistInsercao, avaliarInsercao, validarInsercao,
} from '../js/regras/impressos.js';
import { BH_PAGINA_1, BH_PAGINA_2, OCORRENCIA } from '../js/impressos/modelos.js';

const internacao = {
  paciente: { nome: 'ANA EXEMPLO FICTICIA', dataNascimento: '1958-03-12', registro: 'DEMO-1', convenio: 'sus' },
  leitoId: 'uti1_01', admissaoUti: '2026-10-14T14:20', admissaoHospital: '2026-10-12', tipo: 'clinico', especialidade: 'Oncologia clínica', pulseira: true,
  diagnosticoMedico: 'Choque séptico', alergias: { situacao: 'possui', descricao: 'Dipirona' }, isolamento: { tipo: 'contato', motivo: 'x' },
};
const ev = {
  data: '2026-10-17',
  dados: {
    respiratorio: { suporte: 'vmi_tot' },
    renal: { modo: 'cvd' },
    gi: { via: ['sne'], estomias: [{ tipo: 'colostomia' }] },
    infusoes: { itens: [{ grupo: 'hv', medicamento: 'SORO FISIOLÓGICO 0,9%', vazao: '40' }, { grupo: 'dva', medicamento: 'NORADRENALINA', vazao: '18' }, { grupo: 'sedo', medicamento: 'CETAMINA', vazao: '5' }] },
    pele: { lesoes: [{ tipo: 'lpp', local: 'sacral', estagio: '2' }] },
    dispositivos: { itens: [
      { tipo: 'cvc', local: 'JUGULAR INTERNA', lado: 'D', lumens: '3', insercao: '2026-10-14', curativoTipo: 'filme', curativoData: '2026-10-15' },
      { tipo: 'avp', local: 'CEFÁLICA', lado: 'E', insercao: '2026-10-12' },
      { tipo: 'tot', numero: '7,5', fixacao: '22', insercao: '2026-10-14' },
      { tipo: 'cvd', insercao: '2026-10-14' },
      { tipo: 'sne', insercao: '2026-10-15' },
      { tipo: 'dreno', subtipo: 'BLAKE', insercao: '2026-10-16' },
      { tipo: 'picc', insercao: '2026-10-01', retirada: '2026-10-10' },
    ] },
    antimicrobianos: { itens: [{ nome: 'Meropeném', inicio: '2026-10-15', previsto: '7' }], culturas: [{ material: 'Hemocultura', coleta: '2026-10-11', resultado: 'Negativa' }, { material: 'Swab retal' }] },
    pendencias: { itens: [{ descricao: '13/10 - Parecer da nefrologia (ok)', situacao: 'aberta' }, { descricao: 'Retirou dreno', situacao: 'resolvida' }, { descricao: 'Não chamar visitante X' }] },
  },
};

test('adesão ao bundle: só conforme quando todas as boas práticas foram cumpridas', () => {
  const pav = BUNDLES_IRAS[0];
  const tudo = (v) => Object.fromEntries(pav.itens.map(([id]) => [id, v]));
  assert.equal(adesaoBundle(pav, tudo('1')), '1');
  assert.equal(adesaoBundle(pav, { ...tudo('1'), cuff: '0' }), '0');
  assert.equal(adesaoBundle(pav, { ...tudo('1'), cuff: 'NA' }), '1', 'NA não conta');
  assert.equal(adesaoBundle(pav, tudo('NA')), 'NA');
  assert.equal(adesaoBundle(pav, { decubito: '1' }), '', 'incompleto');
  assert.equal(adesaoBundle(pav, { decubito: '0' }), '0', 'um não conforme já define');
  assert.deepEqual(BUNDLES_IRAS.map((b) => b.itens.length), [6, 4, 4], 'itens do formulário da Liga');
});

test('IRAS: leito vago e bundle sem dispositivo já vêm marcados', () => {
  const leitos = [{ numero: '01', internacaoId: 'i1' }, { numero: '02' }, { numero: '03', internacaoId: 'i3' }];
  const r = irasInicial(leitos, { i1: ev, i3: { dados: { renal: { modo: 'espontanea' } } } });
  assert.deepEqual(r['02'], { vago: true });
  assert.deepEqual(r['01'].pav, {}, 'em VMI: PAV a avaliar');
  assert.equal(r['03'].pav.decubito, 'NA');
  assert.equal(r['03'].cvd.meato, 'NA');
  assert.deepEqual(bundlesAplicaveis(ev), { pav: true, cvc: true, cvd: true });
  r['01'].pav = Object.fromEntries(BUNDLES_IRAS[0].itens.map(([id]) => [id, '1']));
  const s = resumoIras(r);
  assert.deepEqual(s.pav, { avaliados: 1, conformes: 1, pendentes: 0 });
  assert.equal(s.cvc.pendentes, 1);
});

test('balanço hídrico: cabeçalho e dias de permanência contados para a data da folha', () => {
  const c = camposBH(internacao, ev, { leitoNum: '01', dataFolha: '2026-10-18' });
  assert.equal(c.dataExtenso, 'domingo, 18 de outubro de 2026');
  assert.equal(c.leito, 'L01');
  assert.equal(c.convenio, 'SUS');
  assert.equal(c.isolamento, 'CONTATO');
  assert.equal(c.alergias, 'DIPIRONA');
  assert.equal(c.diasUti, 'D4');
  assert.equal(c.diasAvc, 'D4');
  assert.equal(c.diasAvp, 'D6');
  assert.equal(c.diasVmi, 'D4');
  assert.equal(c.sondaRotulo, 'SNE');
  assert.equal(c.diasSonda, 'D3');
  assert.equal(c.diasDreno, 'D2', 'dreno Blake');
  assert.equal(c.diasSvd, 'D4');
  assert.equal(c.atb0, 'MEROPENÉM I: 15/10');
  assert.equal(c.atbDias0, 'D3/7');
});

test('ocorrência: identificação, dispositivos, infusões e marcações vêm do sistema', () => {
  const c = camposOcorrencia(internacao, ev, { leitoNum: '01', data: '2026-10-17' });
  assert.equal(c.idade, '68a');
  assert.equal(c.xClinico, '☒', 'caixa de seleção marcada');
  assert.equal(c.xCirurgico, '☐');
  assert.equal(c.viaAerea, 'TOT 7,5 - 22CM - 14/10 (D3)', 'linha abaixo de BIPAP');
  assert.equal(c.dCurAvc, 'D3/8', 'dia do curativo do CVC no padrão Liga (aplicação = D1; filme até D8)');
  assert.equal(c.dCurCvti, '');
  assert.equal(c.oc0, '11/10 - HEMOCULTURA: NEGATIVA');
  assert.ok(!Object.values(c).some((v) => String(v).includes('RETIROU DRENO')), 'ocorrência resolvida sai do papel');
  const oc = [0, 1, 2, 3, 4, 5].map((k) => c[`oc${k}`]).join(' | ');
  assert.ok(oc.includes('SWAB RETAL: EM ANDAMENTO') && oc.includes('13/10 - PARECER DA NEFROLOGIA (OK)') && oc.includes('NÃO CHAMAR VISITANTE X'), oc);
  assert.equal(c.pulseiraS, ' X ');
  assert.equal(c.dih, '12/10/2026');
  assert.equal(c.diasUti, 'D3');
  assert.equal(c.avcLocal, 'JUGULAR INTERNA D');
  assert.equal(c.avpData, '12/10');
  assert.equal(c.vNORADRENALINA, '18 mL/h');
  assert.equal(c.vHV, '40 mL/h SF 0,9%');
  assert.equal(c.outraInf0, 'CETAMINA 5 mL/h', 'fora da folha vai para as linhas livres');
  assert.equal(c.viaSne, ' X ');
  assert.equal(c.eSvd, ' X ');
  assert.equal(c.eColost, ' X ');
  assert.equal(c.cAvc, ' X ');
  assert.equal(c.cLpp, ' X ');
  assert.equal(c.dOutroNome, 'BLAKE');
  assert.deepEqual(c.lesoes, ['LPP - SACRAL - ESTÁGIO 2']);
  assert.equal(c.medicos, 'ONCOLOGIA CLÍNICA');
});

test('ocorrências: distribuídas nas 6 linhas do papel, sem perder texto à toa', async () => {
  const { ocorrenciasEmLinhas } = await import('../js/regras/impressos.js');
  assert.deepEqual(ocorrenciasEmLinhas([]), ['']);
  assert.deepEqual(ocorrenciasEmLinhas(['A', 'B']), ['A / B'], 'itens curtos dividem a linha');
  const longo = 'PALAVRA '.repeat(20).trim();
  const r = ocorrenciasEmLinhas([longo], { primeira: 46, demais: 62 });
  assert.ok(r.length > 1 && r.every((t, k) => t.length <= (k ? 62 : 46)), 'item longo continua na linha seguinte');
  assert.equal(r.join(' '), longo, 'quebra entre palavras, sem perder texto');
  const muitos = ocorrenciasEmLinhas(Array.from({ length: 12 }, (_, k) => `ITEM ${k} ${'X'.repeat(40)}`));
  assert.equal(muitos.length, 6);
  assert.ok(muitos[5].endsWith('…'), 'o que não cabe termina em reticências');
});

test('modelos: todo marcador é preenchido e o texto é escapado', () => {
  const marcadores = (m) => [...new Set([...m.matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]))];
  const bh = camposBH(internacao, ev, { leitoNum: '01', dataFolha: '2026-10-18' });
  const oc = camposOcorrencia(internacao, ev, { leitoNum: '01', data: '2026-10-17' });
  const semValorPossivel = new Set(['logo', 'boneco', 'prato0', 'prato50', 'prato75', 'prato100', 'garrafa0', 'garrafa50', 'garrafa75', 'garrafa100', 'outraInf1', 'outraInf2', 'atb1', 'atb2', 'atb3', 'atb4', 'atbDias1', 'atbDias2', 'atbDias3', 'atbDias4']);
  for (const k of marcadores(BH_PAGINA_1 + BH_PAGINA_2)) assert.ok(k in bh || semValorPossivel.has(k), `BH: ${k}`);
  for (const k of marcadores(OCORRENCIA)) assert.ok(k in oc || semValorPossivel.has(k), `ocorrência: ${k}`);
  assert.equal(preencherModelo('<td>{{a}}</td><td>{{logo}}</td>', { a: '<b>&' }, { logo: '<img>' }), '<td>&lt;b&gt;&amp;</td><td><img></td>');
  assert.ok(!/\{\{/.test(preencherModelo(BH_PAGINA_2, bh, { logo: '', prato0: '', prato50: '', prato75: '', prato100: '', garrafa0: '', garrafa50: '', garrafa75: '', garrafa100: '' })), 'nada sobra sem preencher');
});

test('datas por extenso e dia da semana', () => {
  assert.equal(diaDaSemana('2026-10-08'), 'QUINTA-FEIRA');
  assert.equal(dataExtenso('2026-10-17'), 'sábado, 17 de outubro de 2026');
});

test('dados mais recentes: cada subbloco vem da evolução mais nova que o registrou', () => {
  const hoje = { id: 'h', data: '2026-10-17', dados: { dispositivos: ev.dados.dispositivos, infusoes: { itens: [] }, herdado: { de: '2026-10-16' } } };
  const ontem = { id: 'o', data: '2026-10-16', dados: { infusoes: ev.dados.infusoes, gi: ev.dados.gi } };
  const j = juntarEvolucoes([hoje, ontem]);
  assert.equal(j.id, 'h');
  assert.equal(j.dados.infusoes.itens.length, 3, 'infusões de hoje ainda vazias: vale a de ontem');
  assert.equal(j.dados.gi.via[0], 'sne');
  assert.equal(juntarEvolucoes([]), null);
});

test('check-lists de inserção: modelo atual da Liga, preenchimento a partir do dispositivo e conformidade', () => {
  assert.deepEqual(Object.keys(CHECKLISTS_INSERCAO), ['cvc', 'cvd']);
  assert.equal(itensInsercao('cvc').length, 15);
  assert.equal(itensInsercao('cvd').length, 17);
  assert.equal(tipoChecklistDe('cateter_dialise'), 'cvc');
  assert.equal(tipoChecklistDe('cvd'), 'cvd');
  assert.equal(tipoChecklistDe('avp'), null);
  const r = novoChecklistInsercao('cvc', { dispositivo: { tipo: 'cateter_dialise', local: 'FEMORAL', lado: 'D', lumens: '2', insercao: '2026-10-16', implantadoUti: 'sim' }, data: '2026-10-17' });
  assert.deepEqual([r.cateter, r.lumens, r.local, r.lado, r.naUti, r.data], ['hd', 'duplo', 'femoral', 'D', 'sim', '2026-10-16']);
  // Tudo SIM, menos as perguntas de falha (quebra de técnica, mais de uma punção, mudou o sítio), que são conformes com NÃO.
  r.respostas = Object.fromEntries(itensInsercao('cvc').map((i) => [i.id, i.esperado || 'sim']));
  assert.equal(avaliarInsercao(r).status, 'conforme');
  r.respostas.maisPuncao = 'sim';
  assert.equal(avaliarInsercao(r).status, 'nao_conforme');
  r.respostas.quebra = 'sim';
  r.situacao = 'nova'; r.responsavel = 'Enf. Teste';
  assert.ok(validarInsercao(r).some((e) => /Especifique/.test(e)), 'quebra de técnica pede especificação');
  r.detalhes = { quebra: 'contaminação do fio-guia' };
  assert.deepEqual(validarInsercao(r), []);
  const cvd = novoChecklistInsercao('cvd', { setor: 'UTI 1', data: '2026-10-17' });
  assert.ok(validarInsercao(cvd).some((e) => /indicação/.test(e)));
  delete r.respostas.raioX;
  assert.equal(avaliarInsercao(r).status, 'incompleto');
});

test('capa: reservas em texto livre, uma por paciente, a partir do aviso do NIR', async () => {
  const { normalizarReservas, MAX_RESERVAS } = await import('../js/regras/impressos.js');
  const aviso = 'Reservas de UTI 17/10\n\n1.Paciente Fictícia Um /71 anos/GEAP / CIRURGIA DE JOELHO / Dr. EXEMPLO  (Pré às 08h00)\n\n2.Paciente Fictício Dois/ 91 anos/ SUS /RESSECÇÃO\nDE TUMOR / DR TESTE (Pré às 18h00).\n';
  assert.deepEqual(normalizarReservas(aviso), [
    'Paciente Fictícia Um /71 anos/GEAP / CIRURGIA DE JOELHO / Dr. EXEMPLO (Pré às 08h00)',
    'Paciente Fictício Dois/ 91 anos/ SUS /RESSECÇÃO DE TUMOR / DR TESTE (Pré às 18h00).',
  ], 'tira cabeçalho, numeração e junta a linha quebrada ao item');
  assert.deepEqual(normalizarReservas('Paciente A / HD turno da tarde\nPaciente B / cirurgia'), ['Paciente A / HD turno da tarde', 'Paciente B / cirurgia'], 'sem numeração: uma linha por paciente');
  assert.deepEqual(normalizarReservas(['1. Paciente A', '  ', { paciente: 'Paciente B', detalhe: 'Cirurgia', horario: '14:00' }]), ['Paciente A', 'Paciente B / Cirurgia / às 14:00']);
  assert.equal(normalizarReservas(Array.from({ length: 30 }, (_, k) => `P${k}`).join('\n')).length, MAX_RESERVAS);
  assert.deepEqual(normalizarReservas('Paciente A / cirurgia\n\nPaciente B / HD\n\nReservas de UTI 18/10\n1. Paciente C / cirurgia\ncontinua aqui'),
    ['Paciente A / cirurgia', 'Paciente B / HD', 'Paciente C / cirurgia continua aqui'], 'aviso novo colado depois das reservas já salvas');
  assert.deepEqual(normalizarReservas(undefined), []);
});
