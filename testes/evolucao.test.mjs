// Testes das escalas, cálculos, turnos e regras da evolução.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { glasgow, camIcu, bps, evn } from '../js/regras/escalas.js';
import { pam, checarSinal, diureseReal, debitoUrinario } from '../js/regras/calculos.js';
import { diaAssistencial, diaAnterior, turnoDe, idEvolucao } from '../js/regras/turnos.js';
import { validarFinalizacao, pendenciasAutomaticas, situacaoEvolucao, textoParaPEP, htmlParaPEP, estruturaPEP, pendenciasAbertas, dadosIniciais, resumoSubbloco } from '../js/regras/evolucao.js';
import { alertasDispositivo, textoDispositivo, dispositivosParaNovoDia } from '../js/regras/dispositivos.js';
import { textoInfusoes, normalizarInfusoes, MEDICAMENTOS_FIXOS } from '../js/regras/infusoes.js';
import { BLOCOS, camDe, visivel, contextoEvolucao } from '../js/regras/evolucao-esquema.js';

test('Glasgow com verbal não testável (T)', () => {
  assert.deepEqual(glasgow({ ocular: 4, verbal: 5, motora: 6 }).texto, '15');
  assert.equal(glasgow({ ocular: 2, verbal: 'T', motora: 5 }).texto, '7T');
  assert.equal(glasgow({ ocular: 2, motora: 5 }).completo, false);
});

test('CAM-ICU', () => {
  assert.equal(camIcu({ rass: '-4' }).resultado, 'nao_aplicavel');
  assert.equal(camIcu({ rass: '0', agudo: 'nao' }).resultado, 'negativo');
  assert.equal(camIcu({ rass: '-1', agudo: 'sim', desatencao: 'sim' }).resultado, 'positivo', 'RASS ≠ 0 já fecha o critério 3');
  assert.equal(camIcu({ rass: '0', agudo: 'sim', desatencao: 'sim' }).resultado, '', 'falta o critério 4');
  assert.equal(camIcu({ rass: '0', agudo: 'sim', desatencao: 'sim', desorganizado: 'nao' }).resultado, 'negativo');
  assert.equal(camIcu({ rass: '0', agudo: 'sim', desatencao: 'sim', desorganizado: 'sim' }).resultado, 'positivo');
});

test('BPS e EVN: escore e classificação calculados', () => {
  assert.equal(bps({ facial: 2, membros: 2, ventilacao: 2 }).comDor, true);
  assert.equal(bps({ facial: 1, membros: 1, ventilacao: 1 }).classe, 'Sem dor');
  assert.equal(evn(0).classe, 'Sem dor');
  assert.equal(evn(5).comDor, true);
});

test('Braden e Morse não fazem parte do sistema (ficam no PEP oficial)', () => {
  const campos = BLOCOS.flatMap((b) => b.subblocos.flatMap((x) => x.campos.map((c) => c.rotulo))).join(' ');
  assert.doesNotMatch(campos, /Braden|Morse/);
});

test('PAM, faixas, diurese real e débito', () => {
  assert.equal(pam(120, 60), 80);
  assert.equal(checarSinal('fc', 300), 'implausivel');
  assert.equal(checarSinal('fc', 140), 'alerta');
  assert.equal(checarSinal('spo2', '96'), 'ok');
  assert.equal(checarSinal('t', '36,8'), 'ok', 'aceita vírgula');
  assert.equal(diureseReal(3000, 2400), 600);
  assert.equal(diureseReal(1000, 2400), 0, 'nunca negativa');
  assert.equal(debitoUrinario(600, 60, 10), 1);
});

test('dia assistencial: das 07h às 07h; uma evolução por dia', () => {
  assert.equal(diaAssistencial(new Date(2026, 9, 16, 7, 0)), '2026-10-16');
  assert.equal(diaAssistencial(new Date(2026, 9, 16, 22, 0)), '2026-10-16');
  assert.equal(diaAssistencial(new Date(2026, 9, 17, 6, 59)), '2026-10-16', 'madrugada ainda é o dia anterior');
  assert.equal(diaAssistencial(new Date(2026, 9, 17, 7, 0)), '2026-10-17');
  assert.equal(diaAnterior('2026-11-01'), '2026-10-31');
  assert.equal(turnoDe(new Date(2026, 9, 16, 14, 0)), 'T');
  assert.equal(idEvolucao('abc', '2026-10-16'), 'abc_2026-10-16');
});

const internacao = {
  paciente: { nome: 'ANA EXEMPLO FICTICIA', dataNascimento: '1958-03-12', registro: 'DEMO-1' },
  leitoId: 'uti1_01', admissaoUti: '2026-10-13T14:20', diagnosticoMedico: 'Choque séptico',
  alergias: { situacao: 'possui', descricao: 'Dipirona' }, isolamento: { tipo: 'contato', motivo: 'Vigilância' },
};

function evolucaoCompleta() {
  return {
    data: '2026-10-16', turnoInicio: 'M', status: 'rascunho', versao: 1,
    dados: {
      cuidado: { limitacao: 'nao', objetivos: 'curativo' },
      sinais: { horario: '08:00', estadoGeral: 'grave', t: '37,8', fc: '112', fr: '24', pas: '96', pad: '58', spo2: '94', hgt: '180' },
      neuro: { consciencia: 'sedado', rass: '-4', metaRass: '-3', pupilas: 'isocoricas', fotoD: 'presente', fotoE: 'presente' },
      dor: { escala: 'bps', bpsFacial: '2', bpsMembros: '2', bpsVentilacao: '2', conduta: ['farmacologica'] },
      respiratorio: { suporte: 'vmi_tot', modo: 'PCV', peep: '8', fio2: '40', ausculta: ['mv_diminuidos', 'roncos'], mvDiminuidosLocal: ['base_d', 'base_e'] },
      hemodinamica: { ritmo: 'sinusal', auscultaCardiaca: ['bnf2t'], edemaLocais: ['mmii'], edemaGrau: '2' },
      abdome: { exame: ['globoso', 'flacido'], rha: 'presentes', ascite: 'nao' },
      infusoes: { itens: [{ grupo: 'dva', medicamento: 'NORADRENALINA', vazao: '15' }, { grupo: 'sedo', medicamento: 'PROPOFOL', vazao: '12' }] },
      renal: { modo: 'cvd', volume: '600', horas: '6', peso: '70', terapiaRenal: 'hemodialise', hdUf: '1500', hdDuracao: '4', hdHeparina: 'sem' },
      gi: { evacuou: 'sim', bristol: '6', fezesAspecto: ['habitual'], estomias: [{ tipo: 'colostomia', estoma: 'vermelho vivo, úmido' }, { tipo: 'ileostomia', volume: '300' }] },
      pele: { inspecao: ['normocorada', 'integra'] },
      dispositivos: { itens: [
        { id: 'a', tipo: 'cvc', local: 'JUGULAR INTERNA', lado: 'D', lumens: '3', insercao: '2026-10-13', necessario: 'sim', curativoTipo: 'filme', curativoData: '2026-10-13', sitio: ['sem_alteracoes'] },
        { id: 'b', tipo: 'avp', local: 'ANTEBRAÇO', lado: 'E', insercao: '2026-10-11' },
        { id: 'c', tipo: 'sne', numero: '12', insercao: '2026-10-14', retirada: '2026-10-16' },
      ] },
      pendencias: { itens: [{ descricao: 'Coletar hemocultura', situacao: 'aberta' }, { descricao: 'Trocar curativo', situacao: 'resolvida' }] },
      narrativa: { texto: 'Paciente grave, em desmame de sedação.' },
    },
    confirmados: {},
  };
}

test('validação para finalizar: obrigatórios e pendências automáticas', () => {
  const ev = evolucaoCompleta();
  assert.ok(validarFinalizacao(ev).erros.some((e) => e.startsWith('Processo de Enfermagem')), 'sem PE concluído não finaliza');
  ev.dados.sae = { status: 'concluido', diagnosticos: [] };
  const r2 = validarFinalizacao(ev);
  assert.deepEqual(r2.erros, []);
  assert.ok(r2.avisos.some((a) => a.includes('Dor sem reavaliação')));
  assert.ok(r2.avisos.some((a) => a.includes('Avaliar necessidade de permanência: AVP')), 'dispositivo sem avaliação de necessidade');
  assert.ok(!r2.avisos.some((a) => a.includes('SNE')), 'dispositivo retirado não gera pendência');
  assert.ok(r2.avisos.some((a) => a.includes('96 h ou mais')), 'AVP com 5 dias');
  delete ev.dados.sinais.fc;
  ev.dados.sinais.t = '3';
  const r3 = validarFinalizacao(ev);
  assert.ok(r3.erros.some((e) => e.includes('FC')));
  assert.ok(r3.avisos.some((a) => a.includes('Temperatura = 3')), 'valor improvável vira aviso, não bloqueio');
  const v = { data: '2026-10-16', dados: {}, confirmados: { neuro: { hora: '08:10' } } };
  assert.ok(!validarFinalizacao(v).erros.some((e) => e.startsWith('Neurológico')), 'confirmado sem alteração dispensa os campos');
});

test('formulário: ajustes do exame físico pedidos em 17/10/2026', () => {
  const subs = BLOCOS.flatMap((b) => b.subblocos);
  const ids = subs.map((x) => x.id);
  const campo = (sid, n) => subs.find((x) => x.id === sid).campos.find((c) => c.nome === n);
  assert.ok(!ids.includes('prevencao'), 'medidas preventivas ficam no Processo de Enfermagem');
  const campos = subs.flatMap((x) => x.campos.map((c) => c.nome));
  assert.ok(!campos.includes('tendencia') && !campos.includes('cuff'), 'sem tendência e sem pressão do cuff');
  assert.ok(!('eva' in campo('dor', 'escala').opcoes), 'sem EVA');
  assert.equal(ids[ids.indexOf('hemodinamica') + 1], 'abdome', 'abdome logo após a hemodinâmica');
  assert.ok(!campo('gi', 'abdome'), 'abdome saiu do gastrintestinal');
  const ctx = contextoEvolucao({}, '2026-10-16');
  assert.ok(visivel(campo('respiratorio', 'mvDiminuidosLocal'), { ausculta: ['mv_diminuidos'] }, ctx));
  assert.ok(!visivel(campo('respiratorio', 'mvAbolidosLocal'), { ausculta: ['mv_diminuidos'] }, ctx));
  assert.ok(!visivel(campo('hemodinamica', 'edemaGrau'), { edemaLocais: ['sem'] }, ctx));
  assert.ok(visivel(campo('gi', 'bristol'), { evacuou: 'sim' }, ctx) && !visivel(campo('gi', 'bristol'), { evacuou: 'nao' }, ctx));
  assert.ok(visivel(campo('renal', 'hdUf'), { terapiaRenal: 'hemodialise' }, ctx) && !visivel(campo('renal', 'hdUf'), { terapiaRenal: 'continua' }, ctx));
  assert.equal(campo('gi', 'estomias').tipo, 'lista');
  assert.equal(campo('pele', 'inspecao').tipo, 'marcar');
  assert.equal(subs.find((x) => x.id === 'pele').titulo, 'Pele, lesões e LPP');
  assert.deepEqual(subs.filter((x) => x.herdavel).map((x) => x.id), ['cuidado', 'pele', 'dispositivos', 'antimicrobianos']);
});

test('infusões por finalidade, nomes em caixa alta; registros antigos são convertidos', () => {
  assert.equal(textoInfusoes([{ grupo: 'hv', medicamento: 'SORO FISIOLÓGICO 0,9%', vazao: '80' }, { grupo: 'dva', medicamento: 'NORADRENALINA', vazao: '15' }, { grupo: 'sedo', medicamento: 'FENTANIL', vazao: '' }]),
    'hidratação venosa: SORO FISIOLÓGICO 0,9% a 80 mL/h; DVA: NORADRENALINA a 15 mL/h; sedoanalgesia: FENTANIL (vazão não informada)');
  assert.deepEqual(normalizarInfusoes([{ medicamento: 'midazolam', vazao: '8' }, { medicamento: 'tiopental', vazao: '5' }]),
    [{ grupo: 'sedo', medicamento: 'MIDAZOLAM', vazao: '8', livre: false }, { grupo: 'outras', medicamento: 'TIOPENTAL', vazao: '5', livre: true }]);
  for (const n of ['NITROGLICERINA', 'NITROPRUSSIATO', 'DEXMEDETOMIDINA', 'CETAMINA']) assert.ok(MEDICAMENTOS_FIXOS.includes(n), `${n} pelo princípio ativo`);
  assert.ok(!MEDICAMENTOS_FIXOS.some((n) => /TRIDIL|NIPRIDE|PRECEDEX|KETAMINA/.test(n)), 'sem nomes comerciais');
});

test('dispositivos: alertas, texto e passagem para o dia seguinte', () => {
  const avp = { tipo: 'avp', local: 'CEFÁLICA', lado: 'D', calibre: '20G', insercao: '2026-10-12', curativoTipo: 'filme', curativoData: '2026-10-12' };
  assert.ok(alertasDispositivo(avp, '2026-10-16').some((a) => a.texto.includes('96 h')));
  const cvc = { tipo: 'cvc', local: 'SUBCLÁVIA', lado: 'E', lumens: '2', insercao: '2026-10-01', curativoTipo: 'filme', curativoData: '2026-10-08', sitio: ['hiperemia'] };
  const al = alertasDispositivo(cvc, '2026-10-16').map((a) => a.texto).join(' | ');
  assert.match(al, /troca vencida/);
  assert.match(al, /sítio: hiperemia/);
  assert.match(textoDispositivo(cvc, '2026-10-16'), /^CVC, subclávia, lado esquerdo, 2 lúmens, inserção 01\/10\/2026 \(D15\), curativo filme transparente aplicado em 08\/10\/2026, sítio: hiperemia/);
  const tot = { tipo: 'tot', numero: '7,5', fixacao: '22', insercao: '2026-10-14' };
  assert.match(textoDispositivo(tot, '2026-10-16'), /TOT, número 7,5, fixação 22 cm/);
  const dia = dispositivosParaNovoDia([cvc, { ...tot, retirada: '2026-10-16' }, { tipo: 'cvd', necessario: 'sim' }]);
  assert.equal(dia.length, 2, 'retirados não passam');
  assert.deepEqual(dia[0].sitio, [], 'avaliação do sítio recomeça');
  assert.equal(dia[1].necessario, '', 'necessidade é reavaliada todo dia');
});

test('evolução nova herda limitação/objetivo, pele, dispositivos ativos, antimicrobianos, PE e última evacuação', () => {
  const anterior = evolucaoCompleta();
  anterior.dados.antimicrobianos = { itens: [{ nome: 'meropeném', inicio: '2026-10-14', previsto: '7' }] };
  anterior.dados.pele.lesoes = [{ tipo: 'lpp', local: 'sacral', estagio: '2' }];
  anterior.dados.sae = { status: 'concluido', diagnosticos: [{ codigo: '1', titulo: 'x', situacao: 'ativo', noc: [], nic: [] }] };
  const d = dadosIniciais(anterior);
  assert.deepEqual(d.cuidado, anterior.dados.cuidado);
  assert.equal(d.pele.lesoes[0].local, 'sacral');
  assert.deepEqual(d.dispositivos.itens.map((i) => i.tipo), ['cvc', 'avp'], 'só os ativos');
  assert.equal(d.dispositivos.itens[0].necessario, '');
  assert.equal(d.antimicrobianos.itens[0].nome, 'meropeném');
  assert.equal(d.sae.diagnosticos[0].confirmado, false);
  assert.equal(d.pendencias.itens.length, 1);
  assert.deepEqual(d.herdado.subblocos, ['cuidado', 'pele', 'dispositivos', 'antimicrobianos']);
  assert.equal(d.herdado.ultimaEvacuacao, '2026-10-16', 'evacuou na anterior: a data é a dela');
  assert.ok(!d.sinais && !d.neuro && !d.infusoes, 'o resto começa vazio');
  // Sem evacuar: a data vem passando de evolução em evolução.
  const seguinte = { data: '2026-10-17', dados: { ...d, gi: { evacuou: 'nao' } } };
  assert.equal(dadosIniciais(seguinte).herdado.ultimaEvacuacao, '2026-10-16');
  const ctx = contextoEvolucao({ herdado: { ultimaEvacuacao: '2026-10-14' }, gi: { evacuou: 'nao' } }, '2026-10-17');
  assert.match(resumoSubbloco('gi', { herdado: { ultimaEvacuacao: '2026-10-14' }, gi: { evacuou: 'nao' } }, '2026-10-17'), /última evacuação registrada: 14\/10\/2026 \(há 3 dia\(s\)\)/);
  assert.equal(ctx.ultimaEvacuacao, '2026-10-14');
});

test('neurológico: RASS só sob sedação, Glasgow nos demais; delirium também sem sedação', () => {
  const neuro = BLOCOS.flatMap((b) => b.subblocos).find((x) => x.id === 'neuro');
  const campo = (n) => neuro.campos.find((c) => c.nome === n);
  const ctx = contextoEvolucao({}, '2026-10-16');
  assert.ok(visivel(campo('rass'), { consciencia: 'sedado' }, ctx));
  assert.ok(!visivel(campo('gOcular'), { consciencia: 'sedado' }, ctx));
  assert.ok(visivel(campo('gOcular'), { consciencia: 'alerta' }, ctx));
  assert.ok(!visivel(campo('rass'), { consciencia: 'alerta' }, ctx));
  assert.ok(!neuro.campos.some((c) => ['pupilaD', 'pupilaE', 'suporte'].includes(c.nome)));
  assert.equal(camDe({ consciencia: 'alerta', camAgudo: 'sim', camDesatencao: 'sim', camDesorganizado: 'sim' }).resultado, 'positivo');
  assert.equal(camDe({ consciencia: 'sonolento', camAgudo: 'sim', camDesatencao: 'sim' }).resultado, 'positivo', 'sonolento = nível alterado');
  assert.equal(camDe({ consciencia: 'comatoso' }).resultado, 'nao_aplicavel');
  assert.equal(camDe({ consciencia: 'sedado', rass: '-4' }).resultado, 'nao_aplicavel');
});

test('sem bloco 1; limitação de suporte e objetivo de cuidado na avaliação', () => {
  assert.ok(!BLOCOS.some((b) => b.id === 'b1'));
  const ids = BLOCOS.flatMap((b) => b.subblocos.map((x) => x.id));
  assert.equal(ids[0], 'cuidado');
  assert.ok(!ids.includes('oncologico'));
});

test('situação no painel', () => {
  assert.equal(situacaoEvolucao(null), 'sem_evolucao');
  assert.equal(situacaoEvolucao({ status: 'rascunho', versao: 1 }), 'rascunho');
  assert.equal(situacaoEvolucao({ status: 'finalizada', versao: 1 }), 'finalizada');
  assert.equal(situacaoEvolucao({ status: 'finalizada', versao: 1, transcritoPEP: { versao: 1 } }), 'transcrita');
  assert.equal(situacaoEvolucao({ status: 'finalizada', versao: 2, transcritoPEP: { versao: 1 } }), 'alterada_apos_copia');
  assert.equal(situacaoEvolucao({ status: 'rascunho', versao: 2, transcritoPEP: { versao: 1 } }), 'alterada_apos_copia');
});

test('pendências abertas passam ao turno seguinte', () => {
  assert.deepEqual(pendenciasAbertas(evolucaoCompleta()).map((p) => p.descricao), ['Coletar hemocultura']);
});

test('texto para o PEP: SBAR em caixa alta, frases curtas e só siglas do manual da Liga', () => {
  const ev = evolucaoCompleta();
  ev.dados.intercorrencias = { itens: [{ hora: '10:30', descricao: 'Dessaturação a 85%', conduta: 'Aspiração', comunicado: 'Plantonista' }] };
  ev.dados.antimicrobianos = { itens: [{ nome: 'Meropeném', inicio: '2026-10-15', previsto: '7' }], culturas: [{ material: 'Hemocultura', coleta: '2026-10-15' }] };
  ev.dados.sae = {
    status: 'concluido',
    diagnosticos: [{
      codigo: '90001', titulo: 'Risco de infecção (exemplo)', categoria: 'Potencial para deteriorar', situacao: 'ativo', confirmado: true,
      evidencias: { ri: [{ id: 'RI1', texto: 'cateter venoso central' }] },
      noc: [{ codigo: '9101', titulo: 'Controle de infecção', indicadores: [{ codigo: '910101', texto: 'febre', niveis: ['Grave', 'Substancial', 'Moderado', 'Leve', 'Nenhum'], meta: '5', pontuacao: '4', anterior: '3' }] }],
      nic: [{ codigo: '9201', titulo: 'Cuidados com dispositivos', atividades: [{ id: 'A1', texto: 'avaliar necessidade do cateter', status: 'realizado', freq: '24/24H' }, { id: 'A2', texto: 'trocar curativo', status: 'nao_realizado', justificativa: 'sem material' }] }],
      decisao: 'manter',
    }, { codigo: '90004', titulo: 'Dor aguda', situacao: 'resolvido' }],
  };
  const t = textoParaPEP(ev, internacao, { unidadeNome: 'UTI 1' });
  assert.equal(t, t.toLocaleUpperCase('pt-BR'), 'tudo em caixa alta');
  const linhas = t.split('\n');
  assert.equal(linhas[0], 'EVOLUÇÃO DE ENFERMAGEM - UTI 1 - LEITO 01 - D3 DE UTI - TURNO DA MANHÃ');
  const pos = ['S - SITUAÇÃO:', 'B - BREVE HISTÓRICO:', 'A - AVALIAÇÃO:', 'R - RECOMENDAÇÕES:'].map((x) => t.indexOf(x));
  assert.ok(pos.every((x, k) => x > 0 && (k === 0 || x > pos[k - 1])), 'S, B, A e R nessa ordem');
  // Sem identificação, sem pendências e sem assinatura (o PEP já registra).
  assert.doesNotMatch(t, /ANA EXEMPLO|DEMO-1|1958|NASCIMENTO|PENDÊNCIA|COLETAR HEMOCULTURA|COREN|ENFERMEIRO\(A\)/);
  // S: estado atual, intercorrências e a narrativa do enfermeiro.
  assert.match(t, /S - SITUAÇÃO: ESTADO GERAL GRAVE, SOB SEDAÇÃO, EM VMI POR TOT, EM USO DE NORADRENALINA, EM HEMODIÁLISE\./);
  assert.match(t, /INTERCORRÊNCIAS: ÀS 10:30, DESSATURAÇÃO A 85%\. CONDUTA: ASPIRAÇÃO\. COMUNICADO: PLANTONISTA\./);
  assert.match(t, /\nPACIENTE GRAVE, EM DESMAME DE SEDAÇÃO\.\n/);
  // B
  assert.match(t, /DIAGNÓSTICO MÉDICO: CHOQUE SÉPTICO\. ADMISSÃO NA UTI EM 13\/10\/2026\. ALERGIA: DIPIRONA\. PRECAUÇÃO: CONTATO \(VIGILÂNCIA\)\. SEM LIMITAÇÃO DE SUPORTE, OBJETIVO DE CUIDADO CURATIVO\. ANTIMICROBIANOS: MEROPENÉM D1\/7\. CULTURAS: HEMOCULTURA DE 15\/10\/2026: SEM RESULTADO\./);
  // A: frases diretas, sem "rótulo: valor"
  assert.match(t, /SINAIS VITAIS \(08:00\): PRESSÃO ARTERIAL 96X58 MMHG \(PAM 71 MMHG\), FC 112 BPM, FREQUÊNCIA RESPIRATÓRIA 24 IRPM, TEMPERATURA 37,8 °C, SPO2 94%, HGT 180 MG\/DL\./);
  assert.match(t, /NEUROLÓGICO: SOB SEDAÇÃO, RASS -4 \(SEDAÇÃO PROFUNDA\), META RASS -3\. PUPILAS ISOCÓRICAS, FOTORREAGENTES\./);
  assert.doesNotMatch(t, /GLASGOW/, 'sedado: Glasgow não é registrado');
  assert.match(t, /DOR: DOR INACEITÁVEL \(BPS 6\), CONDUTA FARMACOLÓGICA\./);
  assert.match(t, /RESPIRATÓRIO: EM VMI POR TOT, PCV, PEEP 8 CMH2O, FIO2 40%\. MV DIMINUÍDOS EM BASE DIREITA E BASE ESQUERDA, RONCOS\./);
  assert.match(t, /CARDIOVASCULAR: RITMO SINUSAL, BNF EM 2T\. EDEMA EM MMII \+2\/4\./);
  assert.match(t, /ABDOME: GLOBOSO, FLÁCIDO, RHA PRESENTES, SEM ASCITE\./);
  assert.match(t, /INFUSÕES CONTÍNUAS: DVA: NORADRENALINA A 15 ML\/H; SEDOANALGESIA: PROPOFOL A 12 ML\/H\./);
  assert.match(t, /RENAL: DIURESE POR CVD, 600 ML EM 6 H, DÉBITO 1,43 ML\/KG\/H\. HEMODIÁLISE, UF 1500 ML, DURAÇÃO 4 H, SEM HEPARINA\./);
  assert.match(t, /GASTRINTESTINAL E NUTRIÇÃO: EVACUOU, BRISTOL 6, COLORAÇÃO HABITUAL\. COLOSTOMIA, ESTOMA VERMELHO VIVO, ÚMIDO; ILEOSTOMIA, 300 ML\./);
  assert.match(t, /DISPOSITIVOS: 1\) CVC, JUGULAR INTERNA, LADO DIREITO, 3 LÚMENS/);
  assert.match(t, /SNE, NÚMERO 12, INSERÇÃO 14\/10\/2026 \(D2\), RETIRADO EM 16\/10\/2026/);
  assert.match(t, /DIAGNÓSTICOS DE ENFERMAGEM:\n1\. RISCO DE INFECÇÃO \(EXEMPLO\), EVIDENCIADO POR FATORES DE RISCO: CATETER VENOSO CENTRAL\. RESULTADO ESPERADO - CONTROLE DE INFECÇÃO: FEBRE 4 \(META 5\)\.\n2\. DOR AGUDA: RESOLVIDO\./);
  // R: intervenções com aprazamento, situação e avaliação do dia; alertas do sistema.
  assert.match(t, /R - RECOMENDAÇÕES:\n1\. CUIDADOS COM DISPOSITIVOS: AVALIAR NECESSIDADE DO CATETER \(24\/24H\) - REALIZADO; TROCAR CURATIVO - NÃO REALIZADO \(SEM MATERIAL\)\. MANTER O PLANO\./);
  assert.match(t, /2\. AVP, ANTEBRAÇO, LADO ESQUERDO: AVP COM 5 DIAS \(96 H OU MAIS\)/);
  assert.doesNotMatch(t, /[│┃|<>]/, 'sem caracteres de tabela');
  // HTML: títulos em negrito, conteúdo escapado.
  const html = htmlParaPEP(ev, internacao, { unidadeNome: 'UTI 1' });
  assert.match(html, /^<p><b>EVOLUÇÃO DE ENFERMAGEM/);
  assert.match(html, /<p><b>S - SITUAÇÃO:<\/b> ESTADO GERAL GRAVE/);
  assert.match(html, /<p><b>RESPIRATÓRIO:<\/b> EM VMI POR TOT/);
  ev.dados.narrativa.texto = '<script>x</script>';
  assert.match(htmlParaPEP(ev, internacao, { unidadeNome: 'UTI 1' }), /&lt;SCRIPT&gt;/);
  // Siglas (no texto antes da caixa alta): só as do manual da Liga.
  const { titulo, secoes } = estruturaPEP(evolucaoCompleta(), internacao, { unidadeNome: 'UTI 1' });
  const misto = [titulo, ...secoes.flatMap((x) => [x.rotulo, x.texto, ...x.itens.flatMap((i) => [i.titulo, i.texto])])].filter(Boolean).join('\n');
  const manual = JSON.parse(fs.readFileSync(new URL('./siglas_liga_resumo.json', import.meta.url)));
  const ignorar = new Set(['UTI', 'LEITO', 'DEMO-1', 'S', 'B', 'A', 'R', 'SITUAÇÃO', 'BREVE', 'HISTÓRICO', 'AVALIAÇÃO', 'RECOMENDAÇÕES', 'EVOLUÇÃO', 'ENFERMAGEM', 'DE', 'TURNO', 'DA', 'MANHÃ',
    ...Object.values({ a: 'SINAIS VITAIS NEUROLÓGICO DOR RESPIRATÓRIO CARDIOVASCULAR ABDOME INFUSÕES CONTÍNUAS RENAL GASTRINTESTINAL E NUTRIÇÃO PELE LESÕES DISPOSITIVOS CONTENÇÃO MECÂNICA DIAGNÓSTICOS INTERCORRÊNCIAS' }).join(' ').split(' '),
    ...MEDICAMENTOS_FIXOS.flatMap((m) => m.split(/[\s,%]+/))]);
  const palavras = misto.split(/[\s.,;:()/]+/).filter((w) => /^[A-Z][A-Z0-9]{1,}$|^SpO2$|^FiO2$/.test(w));
  const naoPermitidas = [...new Set(palavras)].filter((w) => !/^D\d+$/.test(w) && !ignorar.has(w) && !manual.permitidas.includes(w));
  assert.deepEqual(naoPermitidas, [], `siglas fora do manual ou ambíguas: ${naoPermitidas}`);
});
