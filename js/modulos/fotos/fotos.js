// Fotos das lesões: galeria em linha do tempo, foto tirada pela câmera dentro da
// página (não passa pela galeria do aparelho), reduzida antes de enviar e sem os
// dados escondidos do arquivo (local, aparelho), porque a imagem é redesenhada.

import { backend } from '../../dados/backend.js';
import { estado, podeEditar } from '../../nucleo/estado.js';
import { h, aviso, abrirJanela } from '../../nucleo/ui.js';
import { formatarData } from '../../regras/datas.js';
import { FOTO, dimensoes, galeria, novoIdLesao } from '../../regras/fotos.js';

export { novoIdLesao };

const ORIENTACAO = 'Enquadre só a lesão, com boa luz. Evite rosto, tatuagens, pulseira e documentos. Tirada pelo botão da câmera, a foto fica só no sistema. Se enviar uma foto já salva no aparelho, apague-a do aparelho depois de enviar.';

/** Redesenha a imagem no tamanho pedido e devolve JPEG em base64 que caiba no limite. */
async function reduzir(arquivo, ladoMaior, limite) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const { largura, altura } = dimensoes(bmp.width, bmp.height, ladoMaior);
  const canvas = Object.assign(document.createElement('canvas'), { width: largura, height: altura });
  canvas.getContext('2d').drawImage(bmp, 0, 0, largura, altura);
  bmp.close?.();
  for (const q of FOTO.qualidade) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= limite) return { url, largura, altura };
  }
  throw new Error('A foto ficou grande demais mesmo reduzida. Tente outra, com menos detalhes ao fundo.');
}

/** Botão "Fotos" de uma lesão (dentro do item da lista). */
export function barraFotos({ item, garantirId, contexto, ro, titulo }) {
  const botao = h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno btn-fotos' }, '📷 Fotos da lesão');
  botao.addEventListener('click', () => abrirGaleria({ item, garantirId, contexto, ro, titulo: titulo() }));
  return botao;
}

async function abrirGaleria({ item, garantirId, contexto, ro, titulo }) {
  const ctx = contexto();
  const internacao = ctx.internacao;
  if (!internacao) return aviso('Abra a evolução do paciente para ver as fotos.', 'atencao');
  const podeIncluir = !ro && podeEditar() && internacao.status === 'ativa';
  const lista = h('div', { class: 'fotos-galeria', 'aria-live': 'polite' }, h('p', { class: 'ajuda' }, 'Carregando fotos…'));
  const selecionadas = new Set();
  const comparar = h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', disabled: true }, 'Comparar 2 fotos lado a lado');
  let fotos = [];

  async function carregar() {
    if (!item().id) { fotos = []; return desenhar(); }
    try {
      fotos = galeria(await backend.listarFotosLesao(internacao.id, item().id));
    } catch (e) {
      lista.replaceChildren(h('p', { class: 'campo-erro' }, e.message));
      return;
    }
    desenhar();
  }
  function desenhar() {
    selecionadas.forEach((id) => { if (!fotos.some((f) => f.id === id)) selecionadas.delete(id); });
    comparar.disabled = selecionadas.size !== 2;
    if (!fotos.length) return lista.replaceChildren(h('p', { class: 'ajuda' }, 'Nenhuma foto desta lesão ainda.'));
    lista.replaceChildren(...fotos.map((f) => {
      const marcar = h('input', { type: 'checkbox', 'aria-label': `Selecionar a foto de ${formatarData(f.data)} para comparar`, checked: selecionadas.has(f.id) });
      marcar.addEventListener('change', () => {
        if (marcar.checked) selecionadas.add(f.id); else selecionadas.delete(f.id);
        if (selecionadas.size > 2) { selecionadas.delete(f.id); marcar.checked = false; aviso('Escolha só 2 fotos para comparar.', 'atencao'); }
        comparar.disabled = selecionadas.size !== 2;
      });
      return h('figure', { class: 'foto-card' },
        h('button', { type: 'button', class: 'foto-mini', 'aria-label': `Abrir a foto de ${formatarData(f.data)}`, onclick: () => verFoto(f) },
          h('img', { src: f.miniatura, alt: `Lesão em ${formatarData(f.data)}` })),
        h('figcaption', {}, h('label', { class: 'foto-marcar' }, marcar, h('strong', {}, formatarData(f.data))),
          f.legenda ? h('span', {}, f.legenda) : null,
          h('small', {}, f.autorNome || '')));
    }));
  }

  async function imagemDe(f) {
    const url = await backend.lerImagemFoto(f.id);
    backend.registrarEvento?.('foto_aberta', { fotoId: f.id, unidade: ctx.unidade?.id || internacao.unidade });
    return url;
  }

  async function verFoto(f) {
    const img = h('img', { class: 'foto-grande', alt: `Lesão em ${formatarData(f.data)}` });
    const corpo = h('div', { class: 'foto-ver' }, h('p', { class: 'ajuda' }, 'Carregando…'));
    const j = abrirJanela({
      titulo: `${titulo} · ${formatarData(f.data)}`,
      conteudo: corpo,
      acoes: [
        podeEditar() && internacao.status === 'ativa' && { texto: 'Excluir (foto errada)', classe: 'btn-perigo', aoClicar: () => excluir(f) },
        { texto: 'Fechar', classe: 'btn-primario' },
      ].filter(Boolean),
    });
    try {
      img.src = (await imagemDe(f)) || f.miniatura;
      corpo.replaceChildren(img, f.legenda ? h('p', {}, f.legenda) : '', h('p', { class: 'ajuda' }, `Registrada por ${f.autorNome || '—'}.`));
    } catch (e) {
      corpo.replaceChildren(h('p', { class: 'campo-erro' }, e.message));
    }
    return j;
  }

  async function excluir(f) {
    const motivo = h('input', { type: 'text', maxlength: 200, placeholder: 'Ex.: foto de outro paciente, foto tremida' });
    return new Promise((resolve) => {
      abrirJanela({
        titulo: 'Excluir foto',
        prioritaria: true,
        aoFechar: () => resolve(false),
        conteudo: h('div', { class: 'formulario' },
          h('p', {}, 'A foto sai da galeria, mas o registro da exclusão fica guardado (com o seu nome e o motivo).'),
          h('label', { class: 'campo-rotulo' }, 'Motivo *'), motivo),
        acoes: [
          { texto: 'Cancelar', classe: 'btn-secundario', aoClicar: () => { resolve(false); } },
          { texto: 'Excluir', classe: 'btn-perigo', aoClicar: async () => {
            if (!motivo.value.trim()) { aviso('Informe o motivo.', 'atencao'); return false; }
            try {
              await backend.excluirFotoLesao(f.id, motivo.value.trim());
              aviso('Foto excluída da galeria.', 'ok');
              await carregar();
              resolve(true);
            } catch (e) {
              aviso(e.message, 'erro');
              return false;
            }
          } },
        ],
      });
    });
  }

  comparar.addEventListener('click', async () => {
    const [a, b] = fotos.filter((f) => selecionadas.has(f.id)).sort((x, y) => String(x.data).localeCompare(String(y.data)));
    const lado = (f) => h('figure', { class: 'foto-lado' }, h('p', { class: 'ajuda' }, 'Carregando…'), h('figcaption', {}, h('strong', {}, formatarData(f.data)), f.legenda ? ` · ${f.legenda}` : ''));
    const la = lado(a);
    const lb = lado(b);
    abrirJanela({ titulo: `${titulo} · comparação`, conteudo: h('div', { class: 'fotos-comparar' }, la, lb), acoes: [{ texto: 'Fechar', classe: 'btn-primario' }] });
    for (const [el, f] of [[la, a], [lb, b]]) {
      try {
        el.firstChild.replaceWith(h('img', { class: 'foto-grande', src: (await imagemDe(f)) || f.miniatura, alt: `Lesão em ${formatarData(f.data)}` }));
      } catch (e) {
        el.firstChild.replaceWith(h('p', { class: 'campo-erro' }, e.message));
      }
    }
  });

  // Nova foto: câmera traseira no tablet/celular; no computador, escolher arquivo.
  const entrada = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  // Foto tirada antes (em outro momento): escolher da galeria ou de uma pasta, sem abrir a câmera.
  const arquivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const hojeDia = ctx.dataTurno;
  const minDia = String(internacao.admissaoUti || '').slice(0, 10) || undefined;
  const dataFoto = h('input', { type: 'date', value: hojeDia, max: hojeDia, min: minDia, 'aria-label': 'Data em que a foto foi tirada' });
  const legenda = h('input', { type: 'text', maxlength: FOTO.maxLegenda, placeholder: 'Legenda (opcional). Ex.: após desbridamento' });
  const previa = h('div', { class: 'foto-previa' });
  let pronta = null;
  const salvar = h('button', { type: 'button', class: 'btn btn-primario btn-pequeno', hidden: true }, 'Salvar foto');
  const aoEscolher = async (campo, daGaleria) => {
    const arq = campo.files?.[0];
    campo.value = '';
    if (!arq) return;
    // Foto da galeria: sugere a data do arquivo (dentro da internação); câmera: hoje.
    if (daGaleria && arq.lastModified) {
      const d = new Date(arq.lastModified);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dataFoto.value = iso > hojeDia ? hojeDia : minDia && iso < minDia ? minDia : iso;
    } else dataFoto.value = hojeDia;
    previa.replaceChildren(h('p', { class: 'ajuda' }, 'Preparando a foto…'));
    try {
      const grande = await reduzir(arq, FOTO.ladoMaior, FOTO.maxImagem);
      const mini = await reduzir(arq, FOTO.ladoMiniatura, FOTO.maxMiniatura);
      pronta = { imagem: grande.url, miniatura: mini.url, largura: grande.largura, altura: grande.altura };
      previa.replaceChildren(h('img', { src: mini.url, alt: 'Prévia da foto' }), h('span', { class: 'ajuda' }, `${Math.round((grande.url.length * 0.75) / 1024)} KB`));
      salvar.hidden = false;
    } catch (e) {
      pronta = null;
      salvar.hidden = true;
      previa.replaceChildren(h('p', { class: 'campo-erro' }, e.message));
    }
  };
  entrada.addEventListener('change', () => aoEscolher(entrada, false));
  arquivo.addEventListener('change', () => aoEscolher(arquivo, true));
  salvar.addEventListener('click', async () => {
    if (!pronta) return;
    if (!dataFoto.value || dataFoto.value > hojeDia || (minDia && dataFoto.value < minDia)) return aviso('Data da foto inválida: use uma data entre a admissão na UTI e o dia da evolução.', 'atencao');
    salvar.disabled = true;
    try {
      const lesaoId = garantirId();
      await backend.salvarFotoLesao({
        unidade: ctx.unidade?.id || internacao.unidade, internacaoId: internacao.id, lesaoId, data: dataFoto.value || hojeDia,
        legenda: legenda.value.trim(), autorNome: estado.perfil ? `${estado.perfil.nome}${estado.perfil.coren ? ` (Coren ${estado.perfil.coren})` : ''}` : '',
        ...pronta,
      });
      aviso(navigator.onLine ? 'Foto salva.' : 'Foto salva neste aparelho; sobe quando o Wi-Fi voltar.', 'ok');
      pronta = null;
      legenda.value = '';
      previa.replaceChildren();
      salvar.hidden = true;
      await carregar();
    } catch (e) {
      aviso(e.message, 'erro', 8000);
    } finally {
      salvar.disabled = false;
    }
  });

  abrirJanela({
    titulo: `Fotos · ${titulo}`,
    conteudo: h('div', { class: 'fotos formulario' },
      podeIncluir && h('div', { class: 'fotos-nova' },
        h('p', { class: 'caixa caixa-atencao' }, ORIENTACAO),
        entrada, arquivo,
        h('div', { class: 'linha-acoes' },
          h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: () => entrada.click() }, '📷 Tirar foto'),
          h('button', { type: 'button', class: 'btn btn-secundario btn-pequeno', onclick: () => arquivo.click() }, '🖼 Enviar foto já tirada'),
          salvar),
        previa,
        h('label', { class: 'foto-data' }, h('span', { class: 'campo-rotulo' }, 'Data da foto'), dataFoto),
        legenda),
      h('div', { class: 'linha-acoes' }, h('strong', {}, 'Linha do tempo'), comparar),
      lista),
    acoes: [{ texto: 'Fechar', classe: 'btn-primario' }],
  });
  carregar();
}
