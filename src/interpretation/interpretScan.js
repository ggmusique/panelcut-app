const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pickFirstNumber = (sources, fallback = 0) => {
  for (const value of sources) {
    const n = toNumber(value, Number.NaN);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const readModules = (scanResult) => {
  const rawModules = scanResult?.modules
    || scanResult?.cabinet?.modules
    || scanResult?.furniture?.modules
    || scanResult?.data?.modules
    || [];

  if (!Array.isArray(rawModules)) return [];

  return rawModules
    .map((entry) => {
      if (typeof entry === 'number' || typeof entry === 'string') {
        return toNumber(entry, Number.NaN);
      }
      return pickFirstNumber([
        entry?.width,
        entry?.w,
        entry?.largeur,
        entry?.moduleWidth,
      ], Number.NaN);
    })
    .filter((value) => Number.isFinite(value) && value > 0);
};

export function interpretScan(scanResult) {
  const width = pickFirstNumber([
    scanResult?.width,
    scanResult?.w,
    scanResult?.largeur,
    scanResult?.cabinet?.width,
    scanResult?.furniture?.width,
    scanResult?.data?.width,
  ], 0);

  const height = pickFirstNumber([
    scanResult?.height,
    scanResult?.h,
    scanResult?.hauteur,
    scanResult?.cabinet?.height,
    scanResult?.furniture?.height,
    scanResult?.data?.height,
  ], 0);

  const depth = pickFirstNumber([
    scanResult?.depth,
    scanResult?.d,
    scanResult?.profondeur,
    scanResult?.cabinet?.depth,
    scanResult?.furniture?.depth,
    scanResult?.data?.depth,
  ], 0);

  const plinth = pickFirstNumber([
    scanResult?.plinth,
    scanResult?.socle,
    scanResult?.toeKick,
    scanResult?.cabinet?.plinth,
    scanResult?.furniture?.plinth,
    scanResult?.data?.plinth,
  ], 0);

  const modules = readModules(scanResult);

  return {
    width,
    height,
    depth,
    plinth,
    modules,
  };
}

export default interpretScan;
