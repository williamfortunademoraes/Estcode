export function getProductErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'SUPABASE_NOT_CONFIGURED') return 'Configure o Supabase para usar o catálogo.';
    if (error.message.includes('23505')) return 'Já existe um produto com este SKU ou código de barras.';
    if (error.message.includes('duplicate')) return 'Já existe um produto com este identificador.';
  }
  return 'Não foi possível salvar o produto. Verifique os dados e tente novamente.';
}
