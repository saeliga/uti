// Internação: admissão, correção de dados, troca de leito e saída da UTI.
// A internação pertence ao paciente; o leito é só a localização atual.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, abrirJanela, campo, lerFormulario, mostrarErros, aviso, carregando, confirmar } from '../../nucleo/ui.js';
import { validarPaciente, validarInternacao, validarDesfecho, montarInternacao } from '../../regras/validacao.js';
import { agoraLocalISO, contagemDia, formatarData, formatarDataHora, hojeISO, idade } from '../../regras/datas.js';
import { ISOLAMENTOS, ALERGIA_SITUACAO, TIPOS_INTERNACAO, DESFECHOS } from '../../regras/opcoes.js';

const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || id;
const secao = (titulo, ...filhos) => h('fieldset', { class: 'secao' }, h('legend', {}, titulo), ...filhos);

/** Formulário de admissão (sem `internacao`) ou de correção (com `internacao`). */
export function formularioInternacao({ leito, unidade, internacao }) {
  const ed = !!internacao;
  const i = internacao || {};
  const p = i.paciente || {};
  const form = h('form', { class: 'formulario', novalidate: true },
    secao('Identificação do paciente (dois identificadores)',
      h('div', { class: 'linha' },
        campo({ nome: 'registro', rotulo: 'Registro (prontuário)', valor: p.registro, obrigatorio: true,
          ajuda: ed ? 'O registro não pode ser alterado aqui.' : 'Se o paciente já esteve na UTI, os dados são preenchidos.',
          attrs: { readonly: ed, inputmode: 'text', autocomplete: 'off' } }),
        campo({ nome: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'date', valor: p.dataNascimento, obrigatorio: true })),
      campo({ nome: 'nome', rotulo: 'Nome completo', valor: p.nome, obrigatorio: true, attrs: { autocomplete: 'off' } }),
      h('div', { class: 'linha' },
        campo({ nome: 'convenio', rotulo: 'Convênio', valor: p.convenio }),
        campo({ nome: 'pulseira', rotulo: 'Pulseira de identificação conferida', tipo: 'checkbox', valor: i.pulseira }))),
    secao('Internação',
      h('div', { class: 'linha' },
        campo({ nome: 'admissaoUti', rotulo: 'Admissão na UTI', tipo: 'datetime-local', valor: i.admissaoUti || agoraLocalISO(), obrigatorio: true }),
        campo({ nome: 'admissaoHospital', rotulo: 'Internação hospitalar', tipo: 'date', valor: i.admissaoHospital })),
      h('div', { class: 'linha' },
        campo({ nome: 'tipo', rotulo: 'Tipo', tipo: 'radio', opcoes: TIPOS_INTERNACAO, valor: i.tipo }),
        campo({ nome: 'especialidade', rotulo: 'Equipe médica responsável', valor: i.especialidade, ajuda: 'Ex.: Oncologia clínica, Cirurgia oncológica' })),
      campo({ nome: 'diagnosticoMedico', rotulo: 'Diagnóstico médico / motivo da internação', tipo: 'textarea', valor: i.diagnosticoMedico, obrigatorio: true,
        ajuda: 'Os diagnósticos de enfermagem ficam no Processo de Enfermagem, separados deste campo.' }),
      campo({ nome: 'comorbidades', rotulo: 'Comorbidades', tipo: 'textarea', valor: i.comorbidades })),
    secao('Segurança',
      campo({ nome: 'alergiaSituacao', rotulo: 'Alergias', tipo: 'radio', opcoes: ALERGIA_SITUACAO, valor: i.alergias?.situacao, obrigatorio: true }),
      campo({ nome: 'alergiaDescricao', rotulo: 'Quais alergias?', valor: i.alergias?.descricao }),
      h('div', { class: 'linha' },
        campo({ nome: 'isolamentoTipo', rotulo: 'Precaução / isolamento', tipo: 'select', opcoes: ISOLAMENTOS, valor: i.isolamento?.tipo || 'padrao', obrigatorio: true }),
        campo({ nome: 'isolamentoMotivo', rotulo: 'Motivo do isolamento', valor: i.isolamento?.motivo }))));

  // Campos condicionais: só aparecem quando se aplicam.
  const sincronizar = () => {
    const d = lerFormulario(form);
    form.querySelector('[data-campo=alergiaDescricao]').hidden = d.alergiaSituacao !== 'possui';
    form.querySelector('[data-campo=isolamentoMotivo]').hidden = !d.isolamentoTipo || d.isolamentoTipo === 'padrao';
  };
  form.addEventListener('change', sincronizar);
  sincronizar();

  // Readmissão: busca o paciente pelo registro e oferece os dados já cadastrados.
  if (!ed) {
    const reg = form.elements.registro;
    reg.addEventListener('change', async () => {
      const achado = await backend.buscarPaciente(reg.value).catch(() => null);
      if (!achado) return;
      const msg = `Registro já cadastrado: ${achado.nome}, nascido(a) em ${formatarData(achado.dataNascimento)}. Usar estes dados?`;
      if (await confirmar(msg, { titulo: 'Paciente já cadastrado', sim: 'Usar dados' })) {
        form.elements.nome.value = achado.nome;
        form.elements.dataNascimento.value = achado.dataNascimento;
        form.elements.convenio.value = achado.convenio || '';
      }
    });
  }

  abrirJanela({
    titulo: ed ? `Corrigir dados — leito ${leito.numero}` : `Admitir no leito ${leito.numero} · ${unidade.nome}`,
    conteudo: form,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      {
        texto: ed ? 'Salvar correção' : 'Admitir',
        classe: 'btn-primario',
        aoClicar: async () => {
          const d = lerFormulario(form);
          if (ed) d.registro = p.registro;
          const dados = montarInternacao(d);
          const erros = {
            ...validarPaciente({ ...dados.paciente }),
            ...validarInternacao(dados),
          };
          // Os erros de alergia/isolamento aparecem no campo que precisa de ajuste.
          if (erros.alergias) erros[dados.alergias.situacao === 'possui' ? 'alergiaDescricao' : 'alergiaSituacao'] = erros.alergias;
          if (erros.isolamento) erros[dados.isolamento.tipo && dados.isolamento.tipo !== 'padrao' ? 'isolamentoMotivo' : 'isolamentoTipo'] = erros.isolamento;
          if (!mostrarErros(form, erros)) return false;
          try {
            if (ed) {
              await backend.atualizarInternacao(internacao.id, dados, internacao.versao);
              aviso('Dados corrigidos.', 'ok');
            } else {
              await backend.admitir(leito.id, dados);
              aviso(`${dados.paciente.nome} admitido(a) no leito ${leito.numero}.`, 'ok');
            }
          } catch (e) {
            aviso(e.message, 'erro', 8000);
            return false;
          }
        },
      },
    ],
  });
}

const linhaInfo = (rotulo, valor) => valor ? h('div', { class: 'info' }, h('dt', {}, rotulo), h('dd', {}, valor)) : null;

/** Janela lateral com os dados da internação do leito e as ações possíveis. */
export async function detalheInternacao({ leito, unidade }) {
  const corpo = h('div', {});
  carregando(corpo);
  const { fechar } = abrirJanela({ titulo: `Leito ${leito.numero} · ${unidade.nome}`, conteudo: corpo, lateral: true });
  let i;
  try {
    i = await backend.lerInternacao(leito.internacaoId);
  } catch (e) {
    corpo.textContent = e.message;
    return;
  }
  if (!i) {
    corpo.textContent = 'Internação não encontrada.';
    return;
  }
  const hoje = hojeISO();
  const al = i.alergias;
  corpo.replaceChildren(
    h('div', { class: 'detalhe-ident' },
      h('div', { class: 'detalhe-nome' }, i.paciente.nome),
      h('div', {}, `${idade(i.paciente.dataNascimento, hoje)} anos · nascimento ${formatarData(i.paciente.dataNascimento)} · Reg. ${i.paciente.registro}`)),
    al?.situacao === 'possui'
      ? h('div', { class: 'faixa-alergia' }, '⚠ ALERGIA: ', al.descricao)
      : h('div', { class: 'faixa-neutra' }, ALERGIA_SITUACAO[al?.situacao] || 'Alergias não informadas'),
    i.isolamento?.tipo !== 'padrao' && h('div', { class: 'faixa-isolamento' }, `Isolamento: ${ISOLAMENTOS[i.isolamento.tipo]} — ${i.isolamento.motivo}`),
    h('dl', { class: 'detalhe-lista' },
      linhaInfo('Admissão na UTI', `${formatarDataHora(i.admissaoUti)} (UTI ${contagemDia(i.admissaoUti, hoje)})`),
      linhaInfo('Internação hospitalar', i.admissaoHospital && `${formatarData(i.admissaoHospital)} (hospital ${contagemDia(i.admissaoHospital, hoje)})`),
      linhaInfo('Tipo', TIPOS_INTERNACAO[i.tipo]),
      linhaInfo('Equipe médica', i.especialidade),
      linhaInfo('Diagnóstico médico', i.diagnosticoMedico),
      linhaInfo('Comorbidades', i.comorbidades),
      linhaInfo('Convênio', i.paciente.convenio),
      linhaInfo('Pulseira de identificação', i.pulseira ? 'Conferida' : 'Não conferida'),
      i.historicoLeitos.length > 1 && linhaInfo('Leitos nesta internação',
        i.historicoLeitos.map((x) => `${nomeUnidade(x.unidade)} · leito ${x.leitoId.split('_')[1]} desde ${formatarDataHora(x.de)}`).join(' → '))),
    h('a', { class: 'btn btn-primario btn-largo', href: `#/evolucao/${i.id}`, onclick: () => fechar() }, 'Evolução do turno'),
    h('div', { class: 'detalhe-proximos' },
      h('p', {}, 'Processo de Enfermagem, prescrição de enfermagem, BH e checklists entram nas próximas entregas.')),
    podeEditar() && h('div', { class: 'detalhe-acoes' },
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => { fechar(); formularioInternacao({ leito, unidade, internacao: i }); } }, 'Corrigir dados'),
      h('button', { class: 'btn btn-secundario', type: 'button', onclick: () => { fechar(); trocarLeito(i); } }, 'Trocar de leito'),
      h('button', { class: 'btn btn-perigo', type: 'button', onclick: () => { fechar(); registrarSaida(i, leito); } }, 'Registrar saída da UTI')));
}

async function trocarLeito(i) {
  const opcoes = {};
  for (const u of estado.unidades.filter((x) => estado.perfil.perfil === 'admin' || estado.perfil.unidades.includes(x.id))) {
    const livres = await new Promise((resolve) => {
      const parar = backend.observarLeitos(u.id, (ls) => {
        setTimeout(() => parar(), 0);
        resolve(ls.filter((l) => !l.internacaoId && !l.bloqueado));
      });
    });
    for (const l of livres.sort((a, b) => a.numero.localeCompare(b.numero, 'pt', { numeric: true }))) opcoes[l.id] = `${u.nome} — leito ${l.numero}`;
  }
  if (!Object.keys(opcoes).length) return aviso('Não há leito livre e desbloqueado nas suas unidades.', 'atencao');
  const form = h('form', { class: 'formulario' },
    h('p', {}, `${i.paciente.nome} — sai do leito ${i.leitoId.split('_')[1]}.`),
    campo({ nome: 'destino', rotulo: 'Leito de destino', tipo: 'select', opcoes, obrigatorio: true }),
    campo({ nome: 'dataHora', rotulo: 'Data e hora da troca', tipo: 'datetime-local', valor: agoraLocalISO(), obrigatorio: true }));
  abrirJanela({
    titulo: 'Trocar de leito',
    conteudo: form,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      {
        texto: 'Confirmar troca', classe: 'btn-primario',
        aoClicar: async () => {
          const d = lerFormulario(form);
          const erros = {};
          if (!d.destino) erros.destino = 'Escolha o leito.';
          if (!d.dataHora) erros.dataHora = 'Informe data e hora.';
          if (!mostrarErros(form, erros)) return false;
          try {
            await backend.transferirLeito(i.id, d.destino, d.dataHora);
            aviso('Troca de leito registrada.', 'ok');
          } catch (e) {
            aviso(e.message, 'erro', 8000);
            return false;
          }
        },
      },
    ],
  });
}

function registrarSaida(i, leito) {
  const form = h('form', { class: 'formulario' },
    h('p', {}, `${i.paciente.nome} — leito ${leito.numero}. Depois de registrada, a internação fica encerrada e não pode ser alterada.`),
    campo({ nome: 'tipo', rotulo: 'Desfecho', tipo: 'radio', opcoes: DESFECHOS, obrigatorio: true }),
    campo({ nome: 'dataHora', rotulo: 'Data e hora', tipo: 'datetime-local', valor: agoraLocalISO(), obrigatorio: true }),
    campo({ nome: 'destino', rotulo: 'Destino (setor ou instituição)' }));
  const sinc = () => {
    const t = lerFormulario(form).tipo;
    form.querySelector('[data-campo=destino]').hidden = !t || t === 'obito';
  };
  form.addEventListener('change', sinc);
  sinc();
  abrirJanela({
    titulo: 'Registrar saída da UTI',
    conteudo: form,
    acoes: [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      {
        texto: 'Registrar saída', classe: 'btn-perigo',
        aoClicar: async () => {
          const d = lerFormulario(form);
          const desfecho = { tipo: d.tipo, dataHora: d.dataHora, destino: d.tipo === 'obito' ? '' : d.destino.trim() };
          if (!mostrarErros(form, validarDesfecho(desfecho, i))) return false;
          try {
            await backend.encerrarInternacao(i.id, desfecho);
            aviso(`Saída registrada. Leito ${leito.numero} livre.`, 'ok');
          } catch (e) {
            aviso(e.message, 'erro', 8000);
            return false;
          }
        },
      },
    ],
  });
}
