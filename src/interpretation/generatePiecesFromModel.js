/**
 * generatePiecesFromModel
 * Toutes les dimensions du model sont en CM.
 * Les pièces générées sont en MM (× 10) car l'optimiseur et PiecesList travaillent en mm.
 */

const roundMm = (value) => Math.round(value * 10);

const pushPiece = (target, name, lengthCm, heightCm, qty = 1) => {
  const safeLength = roundMm(Math.max(0, lengthCm));
  const safeHeight = roundMm(Math.max(0, heightCm));
  const safeQty    = Math.max(1, Math.round(qty));
  if (safeLength <= 0 || safeHeight <= 0 || safeQty <= 0) return;
  target.push({ name, length: safeLength, height: safeHeight, qty: safeQty });
};

export function generatePiecesFromModel(model) {
  const width          = model?.dimensions?.width          || 0;  // cm
  const height         = model?.dimensions?.height         || 0;  // cm
  const depth          = model?.dimensions?.depth          || 0;  // cm
  const plinth         = model?.dimensions?.plinth         || 0;  // cm
  const panelThickness = model?.material?.panelThickness   || 1.8; // cm
  const backThickness  = model?.material?.backThickness    || 0.3; // cm
  const modules        = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];
  const usefulDepth    = model?.structure?.usefulDepth     || Math.max(0, depth - backThickness);

  const pieces = [];

  // Joues (côtés)
  pushPiece(pieces, 'Côté',       depth,                        Math.max(0, height - plinth),                          2);
  // Tablettes haut / bas
  pushPiece(pieces, 'Dessus',     width - panelThickness * 2,   usefulDepth,                                           1);
  pushPiece(pieces, 'Dessous',    width - panelThickness * 2,   usefulDepth,                                           1);
  // Séparations verticales
  if (modules.length > 1) {
    pushPiece(pieces, 'Séparation', usefulDepth, Math.max(0, height - plinth - panelThickness * 2), modules.length - 1);
  }
  // Tablettes horizontales par module
  modules.forEach((mod, idx) => {
    const mw = typeof mod === 'number' ? mod : (mod?.width || 0);
    pushPiece(pieces, `Tablette M${idx + 1}`, Math.max(0, mw), usefulDepth, 1);
  });
  // Fond
  pushPiece(pieces, 'Fond',       width - panelThickness * 2,   Math.max(0, height - plinth),                          1);
  // Plinthe
  if (plinth > 0) pushPiece(pieces, 'Plinthe', width, plinth, 1);

  // Déduplication (additionne les qty identiques)
  const byKey = new Map();
  for (const p of pieces) {
    const key = `${p.name}|${p.length}|${p.height}`;
    if (!byKey.has(key)) { byKey.set(key, { ...p }); }
    else                  { byKey.get(key).qty += p.qty; }
  }

  return [...byKey.values()];
}

export default generatePiecesFromModel;
