// Listas fixas usadas em formulários. Textos por extenso, conforme o Manual de
// Siglas da Liga (siglas só quando constam no manual e não são ambíguas).

export const PERFIS = {
  pendente: 'Aguardando aprovação',
  enfermeiro: 'Enfermeiro(a)',
  leitura: 'Somente consulta',
  admin: 'Administrador(a)',
};

export const TIPOS_INTERNACAO = {
  clinico: 'Clínico',
  cirurgico: 'Cirúrgico',
};

export const ISOLAMENTOS = {
  padrao: 'Precaução padrão (sem isolamento)',
  contato: 'Contato',
  goticulas: 'Gotículas',
  aerossois: 'Aerossóis',
  contato_goticulas: 'Contato + gotículas',
  contato_aerossois: 'Contato + aerossóis',
  protetor: 'Protetor (paciente imunossuprimido)',
};

export const ALERGIA_SITUACAO = {
  nega: 'Nega alergias',
  desconhecida: 'Não sabe informar / sem informação',
  possui: 'Possui alergia',
};

export const DESFECHOS = {
  alta: 'Alta da UTI (para outro setor)',
  transferencia_externa: 'Transferência para outra instituição',
  obito: 'Óbito',
};

export const MOTIVOS_BLOQUEIO = [
  'Manutenção / equipamento',
  'Higienização terminal',
  'Falta de equipe',
  'Isolamento de área',
  'Outro',
];
