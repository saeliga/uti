// Respostas simuladas do Apps Script no modo demonstração.
// NÃO contém o catálogo NANDA/NOC/NIC (protegido por direitos autorais):
// só exemplos fictícios para a interface funcionar.

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function responder(acao) {
  await espera(600);
  switch (acao) {
    case 'ping':
      return { ok: true, usuario: 'demonstracao@exemplo.org', perfil: 'admin', demo: true };
    case 'catalogo.versao':
      return { nanda: 'demonstração', noc: 'demonstração', nic: 'demonstração', ligacoes: 'demonstração' };
    case 'catalogo.nanda.buscar':
      return [{ codigo: '00000', titulo: 'Diagnóstico de exemplo (modo demonstração)', dominio: '—', classe: '—', categoria: 'Com foco no problema' }];
    case 'ia.teste':
      return { modelo: 'demonstração', ms: 600 };
    default:
      return null;
  }
}
