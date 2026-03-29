const roundCm = (value) => Math.round(value * 10) / 10;

const pushPiece = (target, name, length, height, qty = 1) => {
  const safeLength = roundCm(Math.max(0, length));
  const safeHeight = roundCm(Math.max(0, height));
  const safeQty = Math.max(1, Math.round(qty));

  if (safeLength <= 0 || safeHeight <= 0 || safeQty <= 0) return;

  target.push({
    name,
    length: safeLength,
    height: safeHeight,
    qty: safeQty,
  });
};

export function generatePiecesFromModel(model) {
  const width = model?.dimensions?.width || 0;
  const height = model?.dimensions?.height || 0;
  const depth = model?.dimensions?.depth || 0;
  const plinth = model?.dimensions?.plinth || 0;

  const panelThickness = model?.material?.panelThickness || 0;
  const backThickness = model?.material?.backThickness || 0;

  const modules = Array.isArray(model?.structure?.modules) ? model.structure.modules : [];
  const usefulDepth = model?.structure?.usefulDepth || 0;

  const pieces = [];

  pushPiece(pieces, 'Côté', depth, Math.max(0, height - plinth), 2);
  pushPiece(pieces, 'Dessus', width - panelThickness * 2, usefulDepth, 1);
  pushPiece(pieces, 'Dessous', width - panelThickness * 2, usefulDepth, 1);

  if (modules.length > 1) {
    pushPiece(
      pieces,
      'Séparation',
      usefulDepth,
      Math.max(0, height - plinth - panelThickness * 2),
      modules.length - 1,
    );
  }

  modules.forEach((module, index) => {
    const moduleWidth = typeof module === 'number' ? module : (module?.width || 0);
    pushPiece(
      pieces,
      `Tablette M${index + 1}`,
      Math.max(0, moduleWidth),
      usefulDepth,
      1,
    );
  });

  pushPiece(pieces, 'Fond', width - panelThickness * 2, Math.max(0, height - plinth), 1);
  pushPiece(pieces, 'Plinthe', width, plinth, plinth > 0 ? 1 : 0);

  const deduped = [];
  const byKey = new Map();

  for (const piece of pieces) {
    const key = `${piece.name}|${piece.length}|${piece.height}`;
    if (!byKey.has(key)) {
      byKey.set(key, piece);
      deduped.push(piece);
      continue;
    }

    byKey.get(key).qty += piece.qty;
  }

  return deduped.map((piece) => ({
    ...piece,
    height: roundCm(piece.height),
    length: roundCm(piece.length),
  }));
}

export default generatePiecesFromModel;
