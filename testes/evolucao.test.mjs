// Testes das escalas, cálculos, turnos e regras da evolução.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { glasgow, camIcu, bps, evn } from '../js/regras/escalas.js';
import { pam, checarSinal, diureseReal, debitoUrinario, doseInfusao } from '../js/regras/calculos.js';
import { diaAssistencial, diaAnterior, turnoDe, idEvolucao } from '../js/regras/turnos.js';
import { validarFinalizacao, pendenciasAutomaticas, situacaoEvolucao, textoParaPEP, pendenciasAbertas } from '../js/regras/evolucao.js';
import { BLOCOS } from '../js/regras/evolucao-esquema.js';

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

test('dose de infusão', () => {
  // noradrenalina 4 mg em 250 mL a 15 mL/h, 70 kg → 0,057 mcg/kg/min
  assert.equal(doseInfusao({ quantidade: 4, unidadeQtd: 'mg', volume: 250, vazao: 15, peso: 70, unidadeDose: 'mcg/kg/min' }), 0.057);
  // fentanil 2500 mcg em 50 mL a 2 mL/h → 100 mcg/h
  assert.equal(doseInfusao({ quantidade: 2500, unidadeQtd: 'mcg', volume: 50, vazao: 2, unidadeDose: 'mcg/h' }), 100);
  // midazolam 150 mg em 150 mL a 5 mL/h → 5 mg/h
  assert.equal(doseInfusao({ quantidade: 150, unidadeQtd: 'mg', volume: 150, vazao: 5, unidadeDose: 'mg/h' }), 5);
  // insulina 100 UI em 100 mL a 3 mL/h → 3 UI/h
  assert.equal(doseInfusao({ quantidade: 100, unidadeQtd: 'UI', volume: 100, vazao: 3, unidadeDose: 'UI/h' }), 3);
  assert.equal(doseInfusao({ quantidade: 4, unidadeQtd: 'mg', volume: 250, vazao: 15, unidadeDose: 'mcg/kg/min' }), null, 'sem peso');
  assert.equal(doseInfusao({ quantidade: 100, unidadeQtd: 'UI', volume: 100, vazao: 3, unidadeDose: 'mg/h' }), null, 'unidades incompatíveis');
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
      contexto: { peso: '70' },
      sinais: { horario: '08:00', estadoGeral: 'grave', t: '37,8', fc: '112', fr: '24', pas: '96', pad: '58', spo2: '94', hgt: '180', tendencia: 'estavel' },
      neuro: { consciencia: 'sedado', gOcular: '1', gVerbal: 'T', gMotora: '4', rass: '-4', metaRass: '-3', pupilaD: '3', pupilaE: '3', fotoD: 'presente', fotoE: 'presente' },
      dor: { escala: 'bps', bpsFacial: '2', bpsMembros: '2', bpsVentilacao: '2', conduta: ['farmacologica'] },
      respiratorio: { suporte: 'vmi_tot', modo: 'PCV', peep: '8', fio2: '40', cuff: '25' },
      hemodinamica: { ritmo: 'sinusal', infusoes: [{ finalidade: 'vasopressor', medicamento: 'noradrenalina', quantidade: '4', unidadeQtd: 'mg', volume: '250', vazao: '15', unidadeDose: 'mcg/kg/min' }] },
      renal: { modo: 'cvd', volume: '600', horas: '6' },
      pele: { inspecao: 'Pele íntegra' },
      dispositivos: { itens: [{ tipo: 'cvc', local: 'Jugular direita', insercao: '2026-10-13', necessario: 'sim' }, { tipo: 'avp', local: 'Antebraço' }] },
      prevencao: { lpp: { 'Mudança de decúbito a cada 2 h': { estado: 'nao_realizado' } } },
      pendencias: { itens: [{ descricao: 'Coletar hemocultura', situacao: 'aberta' }, { descricao: 'Trocar curativo', situacao: 'resolvida' }] },
      narrativa: { texto: 'Paciente grave, em desmame de sedação.' },
    },
    confirmados: {},
  };
}

test('validação para finalizar: obrigatórios, justificativa e pendências automáticas', () => {
  const ev = evolucaoCompleta();
  const r = validarFinalizacao(ev);
  assert.deepEqual(r.erros, ['Prevenção de LPP: "Mudança de decúbito a cada 2 h" não realizado sem justificativa'].map((e) => e.replace('Prevenção de LPP', 'Prevenção de LPP')));
  ev.dados.prevencao.lpp['Mudança de decúbito a cada 2 h'].justificativa = 'Instabilidade hemodinâmica';
  const r2 = validarFinalizacao(ev);
  assert.deepEqual(r2.erros, []);
  assert.ok(r2.avisos.some((a) => a.includes('Dor sem reavaliação')));
  assert.ok(r2.avisos.some((a) => a.includes('Acesso venoso periférico')), 'dispositivo sem avaliação de necessidade');
  delete ev.dados.sinais.fc;
  ev.dados.sinais.t = '3';
  const r3 = validarFinalizacao(ev);
  assert.ok(r3.erros.some((e) => e.includes('FC')));
  assert.ok(r3.avisos.some((a) => a.includes('Temperatura = 3')), 'valor improvável vira aviso, não bloqueio');
  const v = { data: '2026-10-16', dados: {}, confirmados: { neuro: { hora: '08:10' } } };
  assert.ok(!validarFinalizacao(v).erros.some((e) => e.startsWith('Neurológico')), 'confirmado sem alteração dispensa os campos');
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

test('texto para o PEP: seções, cálculos e só siglas do manual da Liga', () => {
  const ev = evolucaoCompleta();
  ev.dados.prevencao.lpp['Mudança de decúbito a cada 2 h'].justificativa = 'Instabilidade';
  const t = textoParaPEP(ev, internacao, { unidadeNome: 'UTI 1', autor: { nome: 'ENF. TESTE', coren: '123-RN' } });
  assert.match(t, /pressão arterial: 96x58 mmHg/);
  assert.match(t, /PAM: 71 mmHg/);
  assert.match(t, /SINAIS VITAIS \(08:00\)/);
  assert.match(t, /noradrenalina \(vasopressor\) 4 mg em 250 mL a 15 mL\/h, dose 0,057 mcg\/kg\/min/);
  assert.match(t, /Glasgow: 5T/);
  assert.match(t, /SpO2: 94 %/);
  assert.match(t, /pupilas: isocóricas, direita 3 mm/);
  assert.match(t, /0,057 mcg\/kg\/min/);
  assert.match(t, /DIA 16\/10\/2026 \(TURNO DA MANHÃ\)/);
  assert.match(t, /Alergias: Dipirona/);
  assert.match(t, /PENDÊNCIAS IDENTIFICADAS PELO SISTEMA/);
  assert.doesNotMatch(t, /[│┃|<>]/, 'sem caracteres de tabela');
  // Siglas: toda palavra toda em maiúsculas (exceto nome do paciente, cabeçalhos de seção e unidade)
  const manual = JSON.parse(fs.readFileSync(new URL('./siglas_liga_resumo.json', import.meta.url)));
  const ignorar = new Set([...internacao.paciente.nome.split(' '), 'ENF', 'TESTE', 'UTI', 'LEITO', 'DEMO-1', 'RN']);
  const titulos = new Set(BLOCOS.flatMap((b) => b.subblocos.map((s) => s.titulo.toUpperCase())).join(' ').split(/[\s(),]+/));
  const palavras = t.split(/[\s.,;:()]+/).filter((w) => /^[A-Z][A-Z0-9]{1,}$|^SpO2$|^FiO2$/.test(w));
  const fora = [...new Set(palavras)].filter((w) => !/^D\d+$/.test(w) && !ignorar.has(w) && !titulos.has(w) && !['EVOLUÇÃO', 'ENFERMAGEM', 'MANHÃ', 'DE', 'DIA', 'TURNO', 'DA', 'PENDÊNCIAS', 'IDENTIFICADAS', 'PELO', 'SISTEMA'].includes(w));
  const naoPermitidas = fora.filter((w) => !manual.permitidas.includes(w));
  assert.deepEqual(naoPermitidas, [], `siglas fora do manual ou ambíguas: ${naoPermitidas}`);
});
