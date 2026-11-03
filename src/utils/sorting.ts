/**
 * Natural alphanumeric comparator and sorting utilities.
 * Handles numeric values in natural ascending order:
 * "1" < "2" < "9" < "10" < "100" < "9999"
 * "ART-1" < "ART-2" < "ART-10"
 * "CLI-01" < "CLI-02" < "CLI-10"
 * "A-Z" alphabetical and 1..N numeric.
 */

export function naturalCompare(a: string = '', b: string = ''): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Sorts products by code ascending (A-Z and 1..N),
 * with description / name as secondary tie-breaker.
 */
export function sortProductsNatural<T extends { code?: string; description?: string; name?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const codeA = (a.code || '').trim();
    const codeB = (b.code || '').trim();
    const diff = naturalCompare(codeA, codeB);
    if (diff !== 0) return diff;
    const nameA = (a.description || a.name || '').trim();
    const nameB = (b.description || b.name || '').trim();
    return naturalCompare(nameA, nameB);
  });
}

/**
 * Sorts clients by code ascending (A-Z and 1..N),
 * with company name as secondary tie-breaker.
 */
export function sortClientsNatural<T extends { code?: string; company?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const codeA = (a.code || '').trim();
    const codeB = (b.code || '').trim();
    const diff = naturalCompare(codeA, codeB);
    if (diff !== 0) return diff;
    const compA = (a.company || '').trim();
    const compB = (b.company || '').trim();
    return naturalCompare(compA, compB);
  });
}
