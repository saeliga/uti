// Validações puras dos formulários de internação. Devolvem um objeto
// { campo: 'mensagem' }; objeto vazio = válido. Sem dependência do navegador.

import { dataValida, antes, idade, hojeISO, agoraLocalISO } from './datas.js';
import { ISOLAMENTOS, ALERGIA_SITUACAO, TIPOS_INTERNACAO, DESFECHOS } from './opcoes.js';

const TOLERANCIA_MIN = 15; // aceita horário até 15 min no futuro (relógio do aparelho)

function noFuturo(iso, agora) {
  const lim = new Date(agora.getTime() + TOLERANCIA_MIN * 60000);
  return antes(agoraLocalISO(lim), iso);
}

export function normalizarTexto(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** Identificador do documento do paciente a partir do registro (prontuário). */
export function idPaciente(registro) {
  const r = normalizarTexto(registro).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return r ? `reg_${r}` : '';
}

export function validarPaciente(p, agora = new Date()) {
  const e = {};
  const nome = normalizarTexto(p.nome);
  if (!nome) e.nome = 'Informe o nome completo.';
  else if (nome.split(' ').length < 2) e.nome = 'Informe nome e sobrenome (nome completo).';

  if (!p.dataNascimento) e.dataNascimento = 'Informe a data de nascimento (2º identificador).';
  else if (!dataValida(p.dataNascimento)) e.dataNascimento = 'Data inválida.';
  else if (antes(hojeISO(agora), p.dataNascimento)) e.dataNascimento = 'A data de nascimento está no futuro.';
  else if (idade(p.dataNascimento, hojeISO(agora)) > 120) e.dataNascimento = 'Confira o ano de nascimento.';

  const reg = normalizarTexto(p.registro);
  if (!reg) e.registro = 'Informe o registro (prontuário).';
  else if (!idPaciente(reg)) e.registro = 'O registro precisa ter letras ou números.';
  else if (reg.length > 30) e.registro = 'Registro longo demais.';
  return e;
}

export function validarInternacao(i, agora = new Date()) {
  const e = {};
  if (!i.admissaoUti) e.admissaoUti = 'Informe data e hora da admissão na UTI.';
  else if (!dataValida(i.admissaoUti) || i.admissaoUti.length !== 16) e.admissaoUti = 'Data/hora inválida.';
  else if (noFuturo(i.admissaoUti, agora)) e.admissaoUti = 'A admissão está no futuro.';

  if (i.admissaoHospital) {
    if (!dataValida(i.admissaoHospital)) e.admissaoHospital = 'Data inválida.';
    else if (i.admissaoUti && dataValida(i.admissaoUti) && antes(i.admissaoUti.slice(0, 10), i.admissaoHospital))
      e.admissaoHospital = 'A internação hospitalar não pode ser depois da admissão na UTI.';
  }

  if (!normalizarTexto(i.diagnosticoMedico)) e.diagnosticoMedico = 'Informe o diagnóstico médico / motivo da internação.';
  if (i.tipo && !(i.tipo in TIPOS_INTERNACAO)) e.tipo = 'Tipo inválido.';

  const al = i.alergias || {};
  if (!(al.situacao in ALERGIA_SITUACAO)) e.alergias = 'Informe a situação de alergias.';
  else if (al.situacao === 'possui' && !normalizarTexto(al.descricao)) e.alergias = 'Descreva a(s) alergia(s).';

  const iso = i.isolamento || {};
  if (!(iso.tipo in ISOLAMENTOS)) e.isolamento = 'Informe o tipo de precaução/isolamento.';
  else if (iso.tipo !== 'padrao' && !normalizarTexto(iso.motivo)) e.isolamento = 'Informe o motivo do isolamento.';
  return e;
}

export function validarDesfecho(d, internacao, agora = new Date()) {
  const e = {};
  if (!(d.tipo in DESFECHOS)) e.tipo = 'Escolha o desfecho.';
  if (!d.dataHora || !dataValida(d.dataHora) || d.dataHora.length !== 16) e.dataHora = 'Informe data e hora.';
  else if (noFuturo(d.dataHora, agora)) e.dataHora = 'O horário está no futuro.';
  else if (internacao?.admissaoUti && antes(d.dataHora, internacao.admissaoUti))
    e.dataHora = 'O horário é anterior à admissão na UTI.';
  if ((d.tipo === 'alta' || d.tipo === 'transferencia_externa') && !normalizarTexto(d.destino))
    e.destino = d.tipo === 'alta' ? 'Informe o setor de destino.' : 'Informe a instituição de destino.';
  return e;
}

/** Dados mínimos copiados para o leito, para o painel não precisar ler cada internação. */
export function resumoParaLeito(internacao) {
  return {
    nome: internacao.paciente.nome,
    dataNascimento: internacao.paciente.dataNascimento,
    registro: internacao.paciente.registro,
    admissaoUti: internacao.admissaoUti,
    diagnosticoMedico: internacao.diagnosticoMedico,
    alergias: internacao.alergias,
    isolamento: internacao.isolamento,
  };
}

/** Monta o objeto de internação a partir dos dados do formulário (normalizados). */
export function montarInternacao(form) {
  return {
    paciente: {
      nome: normalizarTexto(form.nome).toUpperCase(),
      dataNascimento: form.dataNascimento,
      registro: normalizarTexto(form.registro),
      convenio: normalizarTexto(form.convenio),
    },
    tipo: form.tipo || '',
    admissaoUti: form.admissaoUti,
    admissaoHospital: form.admissaoHospital || '',
    diagnosticoMedico: normalizarTexto(form.diagnosticoMedico),
    comorbidades: normalizarTexto(form.comorbidades),
    especialidade: normalizarTexto(form.especialidade),
    alergias: {
      situacao: form.alergiaSituacao,
      descricao: form.alergiaSituacao === 'possui' ? normalizarTexto(form.alergiaDescricao) : '',
    },
    isolamento: {
      tipo: form.isolamentoTipo,
      motivo: form.isolamentoTipo === 'padrao' ? '' : normalizarTexto(form.isolamentoMotivo),
    },
    pulseira: form.pulseira === true,
  };
}
