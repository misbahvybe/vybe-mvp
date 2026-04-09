import { MedicineFormHint } from '@prisma/client';

/** Single-spaced lowercase key for deduplication within a store. */
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Best-effort classification from medicine name (no clinical claims). */
export function inferMedicineFormHint(name: string): MedicineFormHint {
  const n = name.toLowerCase();
  if (/\binj\b|injection|ampoule|vial|infusion/i.test(n)) return 'INJECTION';
  if (/\bsyrup\b|suspension|oral\s*sol|drops\b|elixir/i.test(n)) return 'SYRUP';
  if (/\bcapsule\b|\bcap\b(?!\s*d)/i.test(n)) return 'CAPSULE';
  if (/\btab\b|tablet|chewable/i.test(n)) return 'TABLET';
  return 'OTHER';
}
