// Estado compartilhado da sessão (apenas em memória).
export const estado = {
  perfil: null, // { uid, nome, coren, perfil, unidades, ativo }
  unidades: [], // [{ id, nome, ordem, leitos }]
  meta: null, // { doCache, pendente } do último retorno do banco
  atualizarConexao: null,
};

export const podeEditar = () => ['enfermeiro', 'admin'].includes(estado.perfil?.perfil);
