// Erros com código e mensagem em português, comuns aos dois modos (Firebase e demonstração).

export class ErroSistema extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || MENSAGENS[codigo] || 'Não foi possível concluir a operação.');
    this.codigo = codigo;
  }
}

export const MENSAGENS = {
  leito_ocupado: 'Este leito já está ocupado. Atualize o painel.',
  leito_bloqueado: 'Este leito está bloqueado.',
  leito_inexistente: 'Leito não encontrado.',
  internacao_encerrada: 'Esta internação já foi encerrada e não pode ser alterada.',
  internacao_inexistente: 'Internação não encontrada.',
  conflito_versao: 'Outra pessoa alterou este registro agora. Abra de novo para ver a versão atual.',
  sem_conexao: 'Sem conexão. Esta operação precisa de internet; tente de novo quando o Wi-Fi voltar.',
  sem_permissao: 'Você não tem permissão para esta ação (ou seu acesso foi desativado).',
  conta_nao_institucional: 'Use a sua conta institucional (@liga.org.br). Contas pessoais não têm acesso ao sistema.',
  leito_com_paciente: 'Não é possível remover um leito ocupado.',
  login_cancelado: 'Login cancelado.',
  popup_bloqueado: 'O navegador bloqueou a janela do Google. Permita janelas pop-up para este site e tente de novo.',
  conta_diferente: 'Essa não é a conta Google da sessão bloqueada. Para entrar com outra conta, use "Trocar de usuário".',
  dominio_nao_autorizado: 'Este endereço ainda não foi autorizado no Firebase (Authentication → Configurações → Domínios autorizados).',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
};

/** Converte erros do Firebase em ErroSistema com mensagem clara. */
export function traduzirErro(e) {
  if (e instanceof ErroSistema) return e;
  const c = e?.code || '';
  if (c === 'permission-denied') return new ErroSistema('sem_permissao');
  if (c === 'unavailable' || c === 'failed-precondition' || c === 'auth/network-request-failed')
    return new ErroSistema('sem_conexao');
  if (c === 'aborted') return new ErroSistema('conflito_versao');
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return new ErroSistema('login_cancelado');
  if (c === 'auth/popup-blocked') return new ErroSistema('popup_bloqueado');
  if (c === 'auth/user-mismatch') return new ErroSistema('conta_diferente');
  if (c === 'auth/unauthorized-domain') return new ErroSistema('dominio_nao_autorizado');
  if (c === 'auth/too-many-requests') return new ErroSistema('muitas_tentativas');
  console.warn('[erro]', c || e?.name); // sem conteúdo clínico no log
  return new ErroSistema('desconhecido');
}
