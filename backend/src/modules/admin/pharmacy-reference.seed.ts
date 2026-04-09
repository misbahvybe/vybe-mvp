/**
 * Curated reference list for seeding draft products when the pharmacy has no export.
 * Replace or extend with your own CSV bulk upload; do not rely on scraping third-party sites.
 */
export interface PharmacyReferenceRow {
  name: string;
  /** Maps to a ProductCategory name created under the store if missing. */
  categoryName: string;
  description?: string;
}

export const PHARMACY_REFERENCE_SEED: PharmacyReferenceRow[] = [
  { name: 'Paracetamol 500mg Tablets', categoryName: 'Tablets', description: 'Analgesic / antipyretic' },
  { name: 'Ibuprofen 400mg Tablets', categoryName: 'Tablets', description: 'NSAID' },
  { name: 'Aspirin 75mg Tablets (EC)', categoryName: 'Tablets', description: 'Antiplatelet (use as directed)' },
  { name: 'Amoxicillin 500mg Capsules', categoryName: 'Capsules', description: 'Antibiotic — prescription only' },
  { name: 'Azithromycin 500mg Tablets', categoryName: 'Tablets', description: 'Antibiotic — prescription only' },
  { name: 'Cetirizine 10mg Tablets', categoryName: 'Tablets', description: 'Antihistamine' },
  { name: 'Loratadine 10mg Tablets', categoryName: 'Tablets', description: 'Antihistamine' },
  { name: 'Omeprazole 20mg Capsules', categoryName: 'Capsules', description: 'PPI' },
  { name: 'Pantoprazole 40mg Tablets', categoryName: 'Tablets', description: 'PPI' },
  { name: 'Metformin 500mg Tablets', categoryName: 'Tablets', description: 'Antidiabetic' },
  { name: 'Glimepiride 2mg Tablets', categoryName: 'Tablets', description: 'Antidiabetic' },
  { name: 'Amlodipine 5mg Tablets', categoryName: 'Tablets', description: 'Calcium channel blocker' },
  { name: 'Atenolol 50mg Tablets', categoryName: 'Tablets', description: 'Beta blocker' },
  { name: 'Losartan 50mg Tablets', categoryName: 'Tablets', description: 'ARB' },
  { name: 'Atorvastatin 20mg Tablets', categoryName: 'Tablets', description: 'Statin' },
  { name: 'Salbutamol Inhaler (MDI)', categoryName: 'Inhalers', description: 'Bronchodilator' },
  { name: 'Montelukast 10mg Tablets', categoryName: 'Tablets', description: 'Leukotriene antagonist' },
  { name: 'Vitamin D3 2000 IU Capsules', categoryName: 'Vitamins', description: 'Supplement' },
  { name: 'Multivitamin Tablets', categoryName: 'Vitamins', description: 'Supplement' },
  { name: 'ORS Sachets', categoryName: 'Hydration', description: 'Oral rehydration' },
  { name: 'Diclofenac Sodium 50mg Tablets', categoryName: 'Tablets', description: 'NSAID' },
  { name: 'Tramadol 50mg Capsules', categoryName: 'Capsules', description: 'Analgesic — controlled' },
  { name: 'Calcium + Vitamin D3 Tablets', categoryName: 'Vitamins', description: 'Supplement' },
  { name: 'Iron + Folic Acid Tablets', categoryName: 'Vitamins', description: 'Supplement' },
  { name: 'ORS Liquid (ready-to-drink)', categoryName: 'Hydration', description: 'Oral rehydration' },
  { name: 'Cough Syrup (expectorant)', categoryName: 'Syrups', description: 'Symptomatic relief' },
  { name: 'Antacid Liquid', categoryName: 'Syrups', description: 'GI symptomatic relief' },
  { name: 'Insulin Glargine Injection (prefilled pen)', categoryName: 'Injections', description: 'Antidiabetic — cold chain' },
  { name: 'Ceftriaxone 1g Injection', categoryName: 'Injections', description: 'Antibiotic — prescription / facility use' },
  { name: 'Hydrocortisone Cream 1%', categoryName: 'Topical', description: 'Topical steroid' },
  { name: 'Fusidic Acid Ointment 2%', categoryName: 'Topical', description: 'Antibiotic topical' },
  { name: 'Chlorhexidine Mouthwash', categoryName: 'Oral care', description: 'Antiseptic' },
  { name: 'Eye Drops (Lubricating)', categoryName: 'Eye care', description: 'OTC lubricant' },
  { name: 'Nasal Saline Spray', categoryName: 'Nasal', description: 'Nasal hygiene' },
  { name: 'Zinc Tablets', categoryName: 'Vitamins', description: 'Supplement' },
  { name: 'Electrolyte Powder Sachets', categoryName: 'Hydration', description: 'Rehydration' },
];
