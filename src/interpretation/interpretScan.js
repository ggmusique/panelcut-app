/**
 * interpretScan
 * Normalise la réponse brute du serveur en un objet unifié avec toutes les dimensions en CM.
 * Gère les cas où le serveur renvoie des mm (valeurs > 500 pour largeur/hauteur/profondeur)
 * ou des m (valeurs < 5).
 */

const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pickFirstNumber = (sources, fallback = 0) => {
  for (const value of sources) {
    const n = toNumber(value, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
};

/**
 * Convertit une valeur de dimension en cm quelle que soit l'unité source.
 * Heuristique :
 *  - valeur > 500  → mm   → diviser par 10
 *  - valeur < 5    → m    → multiplier par 100
 *  - sinon         → cm   → laisser tel quel
 */
const toCm = (value) => {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value > 500)  return value / 10;   // mm → cm
  if (value < 5)    return value * 100;  // m  → cm
  return value;                          // déjà en cm
};

const readModules = (scanResult) => {
  const rawModules =
    scanResult?.modules ||
    scanResult?.cabinet?.modules ||
    scanResult?.furniture?.modules ||
    scanResult?.data?.modules ||
    [];

  if (!Array.isArray(rawModules)) return [];

  return rawModules
    .map((entry) => {
      let raw;
      if (typeof entry === 'number' || typeof entry === 'string') {
        raw = toNumber(entry, NaN);
      } else {
        raw = pickFirstNumber([
          entry?.width, entry?.w, entry?.largeur, entry?.moduleWidth,
        ], NaN);
      }
      return Number.isFinite(raw) ? toCm(raw) : NaN;
    })
    .filter((v) => Number.isFinite(v) && v > 0);
};

export function interpretScan(scanResult) {
  const rawWidth  = pickFirstNumber([
    scanResult?.width,            scanResult?.w,
    scanResult?.largeur,          scanResult?.cabinet?.width,
    scanResult?.furniture?.width, scanResult?.data?.width,
  ], 0);

  const rawHeight = pickFirstNumber([
    scanResult?.height,            scanResult?.h,
    scanResult?.hauteur,           scanResult?.cabinet?.height,
    scanResult?.furniture?.height, scanResult?.data?.height,
  ], 0);

  const rawDepth  = pickFirstNumber([
    scanResult?.depth,             scanResult?.d,
    scanResult?.profondeur,        scanResult?.cabinet?.depth,
    scanResult?.furniture?.depth,  scanResult?.data?.depth,
  ], 0);

  const rawPlinth = pickFirstNumber([
    scanResult?.plinth,            scanResult?.socle,
    scanResult?.toeKick,           scanResult?.cabinet?.plinth,
    scanResult?.furniture?.plinth, scanResult?.data?.plinth,
  ], 0);

  return {
    width:   toCm(rawWidth),
    height:  toCm(rawHeight),
    depth:   toCm(rawDepth),
    plinth:  toCm(rawPlinth),
    modules: readModules(scanResult),
  };
}

export default interpretScan;
