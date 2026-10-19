// =============================================================================
// Configuração do sistema — ÚNICO arquivo que muda entre instalações.
// Os valores do Firebase NÃO são segredos (o Firebase os exige no navegador);
// a proteção real está nas regras do Firestore e no Apps Script.
// A chave da Groq NUNCA entra aqui: fica nas Propriedades do script.
// =============================================================================

export const VERSAO = '0.11.1';

// Copie do console do Firebase: Configurações do projeto → Seus apps → Web.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBhmd6yQcmYGumqLXLpHgAOpIASgmnEQs4',
  authDomain: 'uti-liga-sae.firebaseapp.com',
  projectId: 'uti-liga-sae',
  appId: '1:711645001575:web:7c59b87d72e7fd646da1c2',
};

// Administrador inicial: no primeiro acesso, esta conta Google já entra como
// administradora (sem passar pela aprovação). As regras do Firestore conferem
// o mesmo e-mail. Os demais usuários são aprovados por ela em Administração.
export const ADMIN_INICIAL = 'tercio.neto@liga.org.br';
// Só contas Google do domínio institucional entram (as regras do Firestore e o Apps Script conferem o mesmo).
export const DOMINIO_INSTITUCIONAL = 'liga.org.br';

// URL da implantação do Apps Script (termina em /exec).
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxYIiydVGCjTim8u1hZfAalhFGWN0pGWwlRruzeSh_xE9s4mWlR9vSVTQul3FsCRKjE/exec';

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
