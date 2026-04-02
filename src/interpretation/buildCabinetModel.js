const DEFAULT_PANEL_THICKNESS_CM = 1.8;
const BACK_PANEL_THICKNESS_CM    = 0.3;

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function buildCabinetModel(normalizedScan, options = {}) {
  const T  = toNumber(options.panelThickness, DEFAULT_PANEL_THICKNESS_CM);
  const BT = toNumber(options.backThickness,  BACK_PANEL_THICKNESS_CM);

  const width  = Math.max(0, toNumber(normalizedScan?.width,  0));
  const height = Math.max(0, toNumber(normalizedScan?.height, 0));
  const depth  = Math.max(0, toNumber(normalizedScan?.depth,  0));
  const plinth = Math.max(0, toNumber(normalizedScan?.plinth, 0));

  // Corps (modules latéraux)
  const rawModules = Array.isArray(normalizedScan?.modules)
    ? normalizedScan.modules.filter(v => Number.isFinite(v) && v > 0)
    : [];

  const computedModules = rawModules.length > 0
    ? rawModules
    : width > 0 ? [Math.max(0, width - T * 2)] : [];

  const separatorsCount = Math.max(0, computedModules.length - 1);
  const usefulHeight    = Math.max(0, height - plinth - T * 2);
  const usefulDepth     = Math.max(0, depth - BT);

  // Aménagements intérieurs — depuis interpretScan
  const nbShelves = Math.max(0, parseInt(normalizedScan?.nbShelves ?? 2, 10));
  const nbDrawers = Math.max(0, parseInt(normalizedScan?.nbDrawers ?? 0, 10));
  const hasRod    = Boolean(normalizedScan?.hasRod ?? false);

  // Corps détaillés (optionnel — si le serveur les retourne body-par-body)
  const bodies = Array.isArray(normalizedScan?.bodies) && normalizedScan.bodies.length > 0
    ? normalizedScan.bodies
    : computedModules.map(mw => ({ width: mw, shelves: nbShelves, drawers: nbDrawers, rod: hasRod }));

  return {
    dimensions: { width, height, depth, plinth },
    material:   { panelThickness: T, backThickness: BT },
    structure: {
      modules:         computedModules,
      separatorsCount,
      usefulHeight,
      usefulDepth,
      nbShelves,
      nbDrawers,
      hasRod,
      bodies,          // [{ width, shelves, drawers, rod }, ...]
    },
  };
}

export default buildCabinetModel;
