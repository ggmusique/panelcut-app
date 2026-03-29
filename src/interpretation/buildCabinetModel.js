const DEFAULT_PANEL_THICKNESS_CM = 1.8;
const BACK_PANEL_THICKNESS_CM = 0.3;

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function buildCabinetModel(normalizedScan, options = {}) {
  const panelThickness = toNumber(options.panelThickness, DEFAULT_PANEL_THICKNESS_CM);
  const backThickness = toNumber(options.backThickness, BACK_PANEL_THICKNESS_CM);

  const width = Math.max(0, toNumber(normalizedScan?.width, 0));
  const height = Math.max(0, toNumber(normalizedScan?.height, 0));
  const depth = Math.max(0, toNumber(normalizedScan?.depth, 0));
  const plinth = Math.max(0, toNumber(normalizedScan?.plinth, 0));

  const modules = Array.isArray(normalizedScan?.modules)
    ? normalizedScan.modules.filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const computedModules = modules.length > 0
    ? modules
    : width > 0
      ? [Math.max(0, width - panelThickness * 2)]
      : [];

  const separatorsCount = Math.max(0, computedModules.length - 1);
  const usefulHeight = Math.max(0, height - plinth - panelThickness * 2);
  const usefulDepth = Math.max(0, depth - backThickness);

  return {
    dimensions: {
      width,
      height,
      depth,
      plinth,
    },
    material: {
      panelThickness,
      backThickness,
    },
    structure: {
      modules: computedModules,
      separatorsCount,
      usefulHeight,
      usefulDepth,
    },
  };
}

export default buildCabinetModel;
