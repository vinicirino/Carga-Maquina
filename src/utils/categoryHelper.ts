import { SectorGroup } from '../types';

export function getWorkCenterCategory(wc: { name: string; category?: string }): SectorGroup {
  if (wc.category && wc.category.trim()) {
    return wc.category.trim().toUpperCase();
  }
  return 'OUTROS';
}

// Optional helper for initial data seeding
export function initialCategorySeed(name: string): string {
  const nameUpper = name.toUpperCase();
  if (
    nameUpper.includes('CORTE') ||
    nameUpper.includes('PLASMA') ||
    nameUpper.includes('SERRA') ||
    nameUpper.includes('CHANFRAMENTO') ||
    nameUpper.includes('OXICORTE') ||
    nameUpper.includes('OXIPIRA')
  ) {
    return 'CORTE';
  }
  if (nameUpper.includes('CALDEIRARIA') || nameUpper.includes('CONFORMACAO') || nameUpper.includes('REBARBAMENTO')) {
    return 'CALDEIRARIA';
  }
  if (nameUpper.includes('SOLDAGEM') || nameUpper.includes('SOLDA')) {
    return 'SOLDA';
  }
  if (
    nameUpper.includes('USINAGEM') ||
    nameUpper.includes('TORNO') ||
    nameUpper.includes('FRESADORA') ||
    nameUpper.includes('MANDRILHADORA') ||
    nameUpper.includes('FURADEIRA') ||
    nameUpper.includes('RETIFICA') ||
    nameUpper.includes('ROSQUEAMENTO')
  ) {
    return 'USINAGEM';
  }
  if (nameUpper.includes('MONTAGEM')) {
    return 'MONTAGENS';
  }
  if (nameUpper.includes('PINTURA') || nameUpper.includes('JATEAMENTO') || nameUpper.includes('LIXAMENTO') || nameUpper.includes('METALIZACAO')) {
    return 'ACABAMENTOS';
  }
  return 'OUTROS';
}
