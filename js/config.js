// =============================================================================
// Configuração do sistema — ÚNICO arquivo que muda entre instalações.
// Os valores do Firebase NÃO são segredos (o Firebase os exige no navegador);
// a proteção real está nas regras do Firestore e no Apps Script.
// A chave da Groq NUNCA entra aqui: fica nas Propriedades do script.
// =============================================================================

export const VERSAO = '0.1.1';

// Copie do console do Firebase: Configurações do projeto → Seus apps → Web.
export const FIREBASE_CONFIG = {
  apiKey: 'COLE_AQUI',
  authDomain: 'COLE_AQUI.firebaseapp.com',
  projectId: 'COLE_AQUI',
  appId: 'COLE_AQUI',
};

// URL da implantação do Apps Script (termina em /exec).
export const APPS_SCRIPT_URL = 'COLE_AQUI';

// Minutos sem uso até a tela bloquear (pede a senha de novo).
export const MINUTOS_BLOQUEIO = 10;

// Minutos entre verificações de nova versão publicada.
export const MINUTOS_VERIFICAR_VERSAO = 5;

// Unidades criadas automaticamente na primeira configuração pelo administrador.
export const UNIDADES_PADRAO = [
  { id: 'uti1', nome: 'UTI 1', ordem: 1, leitos: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'] },
  { id: 'uti2', nome: 'UTI 2', ordem: 2, leitos: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] },
];

// Modo demonstração: abra o endereço com ?demo=1. Usa dados fictícios em
// memória, sem Firebase. Também é ativado se a configuração não foi preenchida.
const naoConfigurado = FIREBASE_CONFIG.apiKey === 'COLE_AQUI';
export const MODO_DEMO =
  new URLSearchParams(location.search).has('demo') || naoConfigurado;
