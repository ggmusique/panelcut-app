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

  // Si on a des bodies détaillés, on extrait les largeurs depuis eux
  const rawBodies = Array.isArray(normalizedScan?.bodies) && normalizedScan.bodies.length > 0
    ? normalizedScan.bodies
    : null;

  const rawModuleWidths = Array.isArray(normalizedScan?.modules)
    ? normalizedScan.modules.filter(v => Number.isFinite(v) && v > 0)
    : [];

  // Source de vérité pour les largeurs
  const computedModules = rawBodies
    ? rawBodies.map(b => Math.max(0, toNumber(b?.width, 0))).filter(w => w > 0)
    : rawModuleWidths.length > 0
      ? rawModuleWidths
      : width > 0 ? [Math.max(0, width - T * 2)] : [];

  const separatorsCount = Math.max(0, computedModules.length - 1);
  const usefulHeight    = Math.max(0, height - plinth - T * 2);
  const usefulDepth     = Math.max(0, depth - BT);

  // Valeurs globales (fallback si pas de bodies détaillés)
  const nbShelves = Math.max(0, parseInt(normalizedScan?.nbShelves ?? 2, 10));
  const nbDrawers = Math.max(0, parseInt(normalizedScan?.nbDrawers ?? 0, 10));
  const hasRod    = Boolean(normalizedScan?.hasRod ?? false);

  // Corps finaux — priorité aux bodies détaillés
  const bodies = rawBodies
    ? rawBodies.map(b => ({
        width:   Math.max(0, toNumber(b?.width,   computedModules[0] || Math.max(0, width - T * 2))),
        shelves: Math.max(0, parseInt(b?.shelves ?? nbShelves, 10)),
        drawers: Math.max(0, parseInt(b?.drawers ?? nbDrawers, 10)),
        doors:   Math.max(0, parseInt(b?.doors   ?? 0,         10)),
        rod:     Boolean(b?.rod ?? hasRod),
      }))
    : computedModules.map(mw => ({
        width:   mw,
        shelves: nbShelves,
        drawers: nbDrawers,
        doors:   0,
        rod:     hasRod,
      }));

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
      bodies,  // [{ width, shelves, drawers, rod }, ...]
    },
  };
}

export default buildCabinetModel;
