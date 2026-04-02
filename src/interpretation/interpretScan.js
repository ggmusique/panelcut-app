/**
 * interpretScan
 * Normalise la réponse brute du serveur en un objet unifié (dimensions en CM).
 * Gère mm (>500), m (<5), cm (sinon).
 * Lit AUSSI : shelves, drawers, rod, nb_dividers, bodies
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

const pickFirstBool = (sources, fallback = false) => {
  for (const v of sources) {
    if (v === true || v === false) return v;
    if (v === 'true' || v === 1)   return true;
    if (v === 'false' || v === 0)  return false;
  }
  return fallback;
};

const toCm = (value) => {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value > 500) return value / 10;
  if (value < 5)   return value * 100;
  return value;
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
        raw = pickFirstNumber([entry?.width, entry?.w, entry?.largeur, entry?.moduleWidth], NaN);
      }
      return Number.isFinite(raw) ? toCm(raw) : NaN;
    })
    .filter((v) => Number.isFinite(v) && v > 0);
};

/** Lit les corps (bodies) si le serveur les retourne directement */
const readBodies = (scanResult) => {
  const raw =
    scanResult?.bodies ||
    scanResult?.cabinet?.bodies ||
    scanResult?.furniture?.bodies ||
    [];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map(b => ({
    width:    toCm(toNumber(b?.width  || b?.w   || b?.largeur, 0)),
    shelves:  Math.max(0, parseInt(b?.shelves  ?? b?.nb_shelves  ?? 0, 10)),
    drawers:  Math.max(0, parseInt(b?.drawers  ?? b?.nb_drawers  ?? 0, 10)),
    rod:      pickFirstBool([b?.rod, b?.tringle, b?.hanging], false),
  }));
};

export function interpretScan(scanResult) {
  const src = scanResult?.cabinet || scanResult?.furniture || scanResult?.data || scanResult || {};

  const rawWidth  = pickFirstNumber([src?.width,  src?.w,         src?.largeur,  scanResult?.width,  scanResult?.w],  0);
  const rawHeight = pickFirstNumber([src?.height, src?.h,         src?.hauteur,  scanResult?.height, scanResult?.h],  0);
  const rawDepth  = pickFirstNumber([src?.depth,  src?.d,         src?.profondeur, scanResult?.depth, scanResult?.d], 0);
  const rawPlinth = pickFirstNumber([src?.plinth, src?.socle,     src?.toeKick,  scanResult?.plinth, scanResult?.socle], 0);

  // Nombre de tablettes par corps (ou global)
  const nbShelves = Math.max(0, parseInt(
    src?.shelves ?? src?.nb_shelves ?? src?.tablettes ??
    scanResult?.shelves ?? scanResult?.nb_shelves ?? 2,
    10
  ));

  // Nombre de tiroirs par corps (ou global)
  const nbDrawers = Math.max(0, parseInt(
    src?.drawers ?? src?.nb_drawers ?? src?.tiroirs ??
    scanResult?.drawers ?? scanResult?.nb_drawers ?? 0,
    10
  ));

  // Tringle penderie
  const hasRod = pickFirstBool([
    src?.rod, src?.tringle, src?.hanging, src?.penderie,
    scanResult?.rod, scanResult?.tringle, scanResult?.hanging,
  ], false);

  // Corps individuels si détaillés
  const bodies = readBodies(scanResult);

  return {
    width:     toCm(rawWidth),
    height:    toCm(rawHeight),
    depth:     toCm(rawDepth),
    plinth:    toCm(rawPlinth),
    modules:   readModules(scanResult),
    nbShelves,
    nbDrawers,
    hasRod,
    bodies,
  };
}

export default interpretScan;
