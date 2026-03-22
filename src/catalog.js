// Catalogue de panneaux — prix de référence Belgique (Hubo/Brico/Maxiwood)
// Mis à jour mars 2026 — modifiables dans l'app

export const PANEL_CATALOG = [
  // ── MDF Standard ──────────────────────────────────────────────────────
  { id: 'mdf-12', name: 'MDF 12mm',      material: 'MDF',      thickness: 12, w: 244, h: 122, price: 18.50 },
  { id: 'mdf-15', name: 'MDF 15mm',      material: 'MDF',      thickness: 15, w: 244, h: 122, price: 22.90 },
  { id: 'mdf-18', name: 'MDF 18mm',      material: 'MDF',      thickness: 18, w: 244, h: 122, price: 27.50 },
  { id: 'mdf-22', name: 'MDF 22mm',      material: 'MDF',      thickness: 22, w: 244, h: 122, price: 34.90 },
  // ── MDF Hydro ─────────────────────────────────────────────────────────
  { id: 'mdfh-12', name: 'MDF Hydro 12mm', material: 'MDF Hydro', thickness: 12, w: 244, h: 122, price: 26.90 },
  { id: 'mdfh-15', name: 'MDF Hydro 15mm', material: 'MDF Hydro', thickness: 15, w: 244, h: 122, price: 32.50 },
  { id: 'mdfh-18', name: 'MDF Hydro 18mm', material: 'MDF Hydro', thickness: 18, w: 244, h: 122, price: 39.80 },
  { id: 'mdfh-22', name: 'MDF Hydro 22mm', material: 'MDF Hydro', thickness: 22, w: 244, h: 122, price: 48.90 },
  // ── Aggloméré mélaminé ─────────────────────────────────────────────────
  { id: 'mel-16', name: 'Mélaminé blanc 16mm', material: 'Mélaminé', thickness: 16, w: 244, h: 122, price: 28.50 },
  { id: 'mel-18', name: 'Mélaminé blanc 18mm', material: 'Mélaminé', thickness: 18, w: 244, h: 122, price: 32.90 },
  // ── Contreplaqué ──────────────────────────────────────────────────────
  { id: 'cp-12', name: 'Contreplaqué 12mm', material: 'Contreplaqué', thickness: 12, w: 244, h: 122, price: 24.90 },
  { id: 'cp-18', name: 'Contreplaqué 18mm', material: 'Contreplaqué', thickness: 18, w: 244, h: 122, price: 38.50 },
  // ── OSB ───────────────────────────────────────────────────────────────
  { id: 'osb-18', name: 'OSB 18mm',      material: 'OSB',      thickness: 18, w: 244, h: 122, price: 19.90 },
];

export const MATERIAL_COLORS = {
  'MDF':          '#8B6914',
  'MDF Hydro':    '#2E7D32',
  'Mélaminé':     '#C8B8A2',
  'Contreplaqué': '#A0522D',
  'OSB':          '#CD853F',
  'Personnalisé': '#607D8B',
};
