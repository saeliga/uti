// Fotos das lesões: limites e cálculos puros (testáveis no Node).
// A foto é reduzida no próprio aparelho antes de ir ao banco: cabe com folga no
// limite de 1 MB por registro do Firestore e não pesa no plano gratuito.

export const FOTO = {
  ladoMaior: 1280, // px da foto guardada
  ladoMiniatura: 240, // px da miniatura da galeria
  qualidade: [0.78, 0.7, 0.6, 0.5], // tenta da melhor para a menor até caber
  maxImagem: 700000, // caracteres (base64) da foto guardada (~520 KB)
  maxMiniatura: 60000,
  maxLegenda: 200,
};

/** Tamanho final mantendo a proporção, sem aumentar foto pequena. */
export function dimensoes(largura, altura, ladoMaior) {
  const maior = Math.max(largura, altura);
  if (!maior || maior <= ladoMaior) return { largura: Math.round(largura), altura: Math.round(altura) };
  const f = ladoMaior / maior;
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}

/** Fotos visíveis da galeria, da mais recente para a mais antiga (excluídas saem). */
export function galeria(fotos = []) {
  return fotos.filter((f) => !f.excluida).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (b.ordem || 0) - (a.ordem || 0));
}

/** Identificador estável de um item de lista (lesão) para ligar as fotos. */
export const novoIdLesao = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
