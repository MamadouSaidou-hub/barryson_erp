/** Deduces a short, stable code from a human name — used everywhere the cahier des charges says
 * a code must be "déduit du nom" rather than typed by the user (articles, fournisseurs). */
export function slugCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

/** Appends -2, -3, ... until `exists` reports the candidate is free. */
export async function uniqueCode(base: string, exists: (code: string) => Promise<boolean>): Promise<string> {
  let candidate = base || 'ITEM'
  let suffix = 1
  while (await exists(candidate)) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}
