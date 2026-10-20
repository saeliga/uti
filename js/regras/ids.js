// Identificadores curtos e únicos para itens da evolução (lesões, dispositivos, infusões).
// Usa o gerador criptográfico do navegador (crypto.getRandomValues), e não Math.random:
// não há segredo envolvido, mas assim nenhum identificador é previsível.
export function idAleatorio(prefixo = '', tamanho = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  const sufixo = Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  return `${prefixo}${Date.now().toString(36)}${sufixo}`;
}
