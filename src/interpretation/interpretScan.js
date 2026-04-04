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
  if (value > 500) return value / 10;   // mm → cm
  if (value < 5)   return value * 100;  // m  → cm
  return value;                          // déjà en cm
};

/**
 * Lit les modules détaillés depuis cabinet.modules[]
 * Chaque module a : { x, width, shelves, drawers, doors, rod }
 * Retourne un tableau de bodies { width, shelves, drawers, doors, rod }
 * ou null si absent/vide.
 */
const readBodiesFromModules = (scanResult) => {
  const src = scanResult?.cabinet || scanResult?.furniture || scanResult || {};

  // Priorité 1 : modules détaillés (format serveur)
  const rawModules = src?.modules || scanResult?.modules || [];
  if (Array.isArray(rawModules) && rawModules.length > 0) {
    const detailed = rawModules.filter(m => typeof m === 'object' && m !== null);
    if (detailed.length > 0) {
      return detailed.map(m => ({
        width:   toCm(toNumber(m?.width ?? m?.w ?? m?.largeur, 0)),
        shelves: Math.max(0, parseInt(m?.shelves  ?? m?.nb_shelves  ?? 0, 10)),
        drawers: Math.max(0, parseInt(m?.drawers  ?? m?.nb_drawers  ?? 0, 10)),
        doors:   Math.max(0, parseInt(m?.doors    ?? m?.nb_doors    ?? 0, 10)),
        rod:     pickFirstBool([m?.rod, m?.tringle, m?.hanging, m?.penderie], false),
      }));
    }
  }

  // Priorité 2 : bodies explicites
  const rawBodies = src?.bodies || scanResult?.bodies || [];
  if (Array.isArray(rawBodies) && rawBodies.length > 0) {
    return rawBodies.map(b => ({
      width:   toCm(toNumber(b?.width ?? b?.w ?? 0, 0)),
      shelves: Math.max(0, parseInt(b?.shelves ?? b?.nb_shelves ?? 0, 10)),
      drawers: Math.max(0, parseInt(b?.drawers ?? b?.nb_drawers ?? 0, 10)),
      doors:   Math.max(0, parseInt(b?.doors   ?? b?.nb_doors   ?? 0, 10)),
      rod:     pickFirstBool([b?.rod, b?.tringle, b?.hanging], false),
    }));
  }

  return null; // pas de données détaillées
};

/**
 * Lit uniquement les largeurs (pour rétrocompatibilité buildCabinetModel)
 */
const readModuleWidths = (scanResult) => {
  const src = scanResult?.cabinet || scanResult?.furniture || scanResult || {};
  const rawModules = src?.modules || scanResult?.modules || [];
  if (!Array.isArray(rawModules)) return [];
  return rawModules
    .map(entry => {
      if (typeof entry === 'number') return toCm(entry);
      if (typeof entry === 'object' && entry !== null) {
        const w = toNumber(entry?.width ?? entry?.w ?? entry?.largeur, NaN);
        return Number.isFinite(w) ? toCm(w) : NaN;
      }
      return NaN;
    })
    .filter(v => Number.isFinite(v) && v > 0);
};

export function interpretScan(scanResult) {
  const src = scanResult?.cabinet || scanResult?.furniture || scanResult?.data || scanResult || {};

  const rawWidth  = pickFirstNumber([src?.width,  src?.w,  src?.largeur,    scanResult?.width,  scanResult?.w],  0);
  const rawHeight = pickFirstNumber([src?.height, src?.h,  src?.hauteur,    scanResult?.height, scanResult?.h],  0);
  const rawDepth  = pickFirstNumber([src?.depth,  src?.d,  src?.profondeur, scanResult?.depth,  scanResult?.d],  0);
  const rawPlinth = pickFirstNumber([src?.plinth, src?.socle, src?.toeKick, scanResult?.plinth, scanResult?.socle], 0);

  const nbShelves = Math.max(0, parseInt(
    src?.shelves ?? src?.nb_shelves ?? src?.tablettes ??
    scanResult?.shelves ?? scanResult?.nb_shelves ?? 2,
    10
  ));

  const nbDrawers = Math.max(0, parseInt(
    src?.drawers ?? src?.nb_drawers ?? src?.tiroirs ??
    scanResult?.drawers ?? scanResult?.nb_drawers ?? 0,
    10
  ));

  const hasRod = pickFirstBool([
    src?.rod, src?.tringle, src?.hanging, src?.penderie,
    scanResult?.rod, scanResult?.tringle, scanResult?.hanging,
  ], false);

  const bodies = readBodiesFromModules(scanResult);

  return {
    width:     toCm(rawWidth),
    height:    toCm(rawHeight),
    depth:     toCm(rawDepth),
    plinth:    toCm(rawPlinth),
    modules:   readModuleWidths(scanResult),
    nbShelves,
    nbDrawers,
    hasRod,
    bodies,
  };
}

export default interpretScan;
