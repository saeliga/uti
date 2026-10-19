/**
 * Ponte com a Groq. A chave fica em GROQ_API_KEY (Propriedades do script).
 * Os prompts da SAE entram na Fase 3; aqui fica a chamada base com modelo
 * principal e de reserva, prazo e tratamento de falhas.
 * Confira na conta da Groq se os nomes dos modelos continuam disponíveis.
 */

var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
var GROQ_MODELO_PADRAO = 'qwen/qwen3.8-27b'; // mesmo do piloto do Hospesc
var GROQ_RESERVA_PADRAO = 'openai/gpt-oss-20b';

// Ajustes por modelo exato (como no piloto): esforço de raciocínio e se o
// raciocínio volta na resposta. Modelo fora desta lista vai sem esses campos.
var GROQ_CONFIG_MODELO = {
  'qwen/qwen3.8-27b': { esforco: 'none', semRaciocinio: false },
  'openai/gpt-oss-20b': { esforco: 'medium', semRaciocinio: true }
};

/**
 * mensagens: [{ role: 'system'|'user', content }]. Devolve { texto, modelo, ms }.
 * Tenta o modelo principal; em limite (429) ou falha do servidor (5xx), tenta o de reserva.
 */
function chamarGroq_(mensagens, opcoes) {
  opcoes = opcoes || {};
  var chave = prop_('GROQ_API_KEY', true);
  var modelos = [prop_('GROQ_MODELO') || GROQ_MODELO_PADRAO, prop_('GROQ_MODELO_RESERVA') || GROQ_RESERVA_PADRAO];
  // Coleta da pesquisa (versão congelada): GROQ_SEM_RESERVA = sim usa só o modelo
  // principal, para que todas as sugestões avaliadas venham do mesmo modelo.
  if (String(prop_('GROQ_SEM_RESERVA') || '').toLowerCase() === 'sim') modelos = [modelos[0]];
  var ultimo = 'ia_indisponivel';
  for (var i = 0; i < modelos.length; i++) {
    var inicio = Date.now();
    var corpo = {
      model: modelos[i],
      messages: mensagens,
      temperature: opcoes.temperatura == null ? 0.2 : opcoes.temperatura,
      max_completion_tokens: opcoes.maxTokens || 2048
    };
    if (opcoes.json) corpo.response_format = { type: 'json_object' };
    var cfg = GROQ_CONFIG_MODELO[modelos[i]];
    if (cfg) {
      corpo.reasoning_effort = opcoes.esforco || cfg.esforco;
      if (cfg.semRaciocinio) corpo.include_reasoning = false;
    }
    var r;
    try {
      r = UrlFetchApp.fetch(GROQ_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + chave },
        payload: JSON.stringify(corpo),
        muteHttpExceptions: true
      });
    } catch (e) {
      ultimo = 'ia_sem_conexao';
      continue;
    }
    var status = r.getResponseCode();
    if (status === 200) {
      var j = JSON.parse(r.getContentText());
      var texto = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      return { texto: texto, modelo: modelos[i], ms: Date.now() - inicio };
    }
    if (status === 401 || status === 403) throw erro_('ia_chave_invalida');
    ultimo = status === 429 ? 'ia_limite' : 'ia_indisponivel';
    // 404/400 (modelo inexistente ou corpo recusado) e 429/5xx: tenta o próximo modelo.
  }
  throw erro_(ultimo);
}

/** Teste do administrador: confirma chave e modelo, sem dados de pacientes. */
function iaTeste_() {
  var r = chamarGroq_([{ role: 'user', content: 'Responda apenas com a palavra OK.' }], { maxTokens: 20, temperatura: 0 });
  return { modelo: r.modelo, ms: r.ms, resposta: r.texto.slice(0, 20) };
}
