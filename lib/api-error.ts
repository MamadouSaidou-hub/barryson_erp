export function toApiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('violates foreign key constraint')) return 'Référence invalide (élément lié introuvable).'
  if (message.includes('duplicate key value violates unique constraint')) return 'Cette valeur existe déjà (référence en doublon).'
  return message || 'Erreur inconnue.'
}
