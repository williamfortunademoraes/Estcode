export function getProductErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'SUPABASE_NOT_CONFIGURED') return 'Configure o Supabase para usar o catálogo.';
    if (error.message.includes('23505')) return 'Já existe um produto com este SKU ou código de barras.';
    if (error.message.includes('duplicate')) return 'Já existe um produto com este identificador.';
    if (error.message === 'PRODUCT_IMAGE_TYPE_NOT_ALLOWED') return 'Use uma imagem JPG, PNG ou WebP.';
    if (error.message === 'PRODUCT_IMAGE_TOO_LARGE') return 'A imagem deve ter no máximo 8 MB.';
    if (error.message === 'PRODUCT_IMAGE_READ_FAILED') return 'Não foi possível ler a imagem selecionada.';
  }
  return 'Não foi possível salvar o produto. Verifique os dados e tente novamente.';
}
