/**
 * Normalise les modules d'un cabinet depuis n'importe quel format API.
 * Source de vérité unique pour tous les composants de visualisation.
 *
 * @param {object} cabinet - Objet cabinet brut (peut avoir modules[], nb_dividers, etc.)
 * @param {object} [options]
 * @param {number} [options.cabinetHeight] - Hauteur totale en cm (surcharge cabinet.height)
 * @param {number} [options.plinth] - Hauteur plinthe en cm (surcharge cabinet.plinth)
 * @returns {Array} modules normalisés avec :
 *   { id, width, shelves, shelfPositions, drawers, drawerItems,
 *     doors, slidingDoors, rod, rodYs, hasBack, drawerParts }
 *
 * Priorité : modules[] objets détaillés > modules[] numériques > fallback nb_dividers
 * Chaque module retourné a TOUJOURS tous les champs (pas de undefined).
 * Les positions y sont en cm depuis le bas intérieur.
 */

function _toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function _getCount(value, fallback = 0) {
  if (Array.isArray(value)) return value.length;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/**
 * Extrait les positions y (en cm) depuis un tableau mixte de nombres/objets.
 * Filtre les valeurs non-finies.
 */
function _normalizeYList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === 'number') return v;
      if (v && typeof v === 'object') return _toNum(v.y, NaN);
      return NaN;
    })
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/** Détecte la présence d'une tringle depuis tous les formats possibles */
function _hasRodFlag(m) {
  if (Array.isArray(m?.rods) && m.rods.length > 0) return true;
  return Boolean(
    m?.rod ??
    m?.rods ??
    m?.tringle ??
    m?.hanging ??
    m?.penderie
  );
}

function _defaultDrawerParts() {
  return { front: true, back: true, left: true, right: true, bottom: true };
}

export function normalizeCabinetModules(cabinet, options = {}) {
  const raw = Array.isArray(cabinet?.modules) ? cabinet.modules : [];

  // ── Chemin 1 : modules[] avec objets détaillés ─────────────────────────────
  const detailed = raw.filter((m) => typeof m === 'object' && m !== null);
  if (detailed.length > 0) {
    return detailed
      .map((m, i) => {
        const width = Math.max(0, _toNum(m.width ?? m.w ?? m.largeur, 0));

        // Tablettes
        const rawShelves = m.shelves ?? m.nb_shelves ?? 0;
        const shelfPositions = _normalizeYList(rawShelves);
        const shelves =
          shelfPositions.length > 0
            ? shelfPositions.length
            : _getCount(rawShelves, _getCount(m.nb_shelves, 0));

        // Tiroirs
        const rawDrawerItems = Array.isArray(m.drawerItems)
          ? m.drawerItems
          : Array.isArray(m.drawers) && m.drawers.every((d) => typeof d === 'object' && d !== null)
          ? m.drawers
          : [];
        const drawerItems = rawDrawerItems
          .filter((d) => typeof d === 'object' && d !== null)
          .map((d) => ({
            y: _toNum(d.y, null),
            h: _toNum(d.height ?? d.h ?? 20, 20),
          }))
          .filter((d) => d.y !== null && d.y >= 0);
        const drawers =
          drawerItems.length > 0
            ? drawerItems.length
            : _getCount(m.drawers ?? m.nb_drawers, 0);

        // Tringles
        const rodSource = Array.isArray(m.rods) ? m.rods : Array.isArray(m.rod) ? m.rod : [];
        const rodYs = _normalizeYList(rodSource);
        const rod = rodYs.length > 0 || _hasRodFlag(m);

        return {
          id: m.id ?? i + 1,
          width,
          shelves,
          shelfPositions,
          drawers,
          drawerItems,
          doors: Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10) || 0),
          slidingDoors: Math.max(0, parseInt(m.slidingDoors ?? m.nb_sliding_doors ?? 0, 10) || 0),
          rod,
          rodYs,
          hasBack: m?.hasBack !== false,
          drawerParts: {
            front: m?.drawerParts?.front !== false,
            back: m?.drawerParts?.back !== false,
            left: m?.drawerParts?.left !== false,
            right: m?.drawerParts?.right !== false,
            bottom: m?.drawerParts?.bottom !== false,
          },
        };
      })
      .filter((m) => m.width > 0);
  }

  // ── Chemin 2 : modules[] avec nombres simples (largeurs uniquement) ─────────
  const numeric = raw.filter((v) => typeof v === 'number' && v > 0);
  if (numeric.length > 0) {
    const shelves = _getCount(cabinet?.nb_shelves, 0);
    const drawers = _getCount(cabinet?.nb_drawers, 0);
    return numeric.map((mw, i) => ({
      id: i + 1,
      width: mw,
      shelves,
      shelfPositions: [],
      drawers,
      drawerItems: [],
      doors: 0,
      slidingDoors: 0,
      rod: false,
      rodYs: [],
      hasBack: true,
      drawerParts: _defaultDrawerParts(),
    }));
  }

  // ── Chemin 3 : fallback heuristique via nb_dividers ────────────────────────
  const W = Math.max(0, _toNum(cabinet?.width, 0));
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 4, 10) + 1);
  const mw = W > 0 ? W / nb : 0;
  const totalDrawers = _getCount(cabinet?.nb_drawers, 0);
  const drawersPerOuter = nb >= 2 ? Math.floor(totalDrawers / 2) : totalDrawers;
  const hasRod = Boolean(cabinet?.rod ?? cabinet?.tringle ?? false);
  const innerCount = Math.max(1, nb - 2);
  const shelvesFallback = Math.max(
    0,
    Math.round(_getCount(cabinet?.nb_shelves, 0) / innerCount)
  );

  return Array.from({ length: nb }, (_, i) => {
    const isOuter = i === 0 || i === nb - 1;
    return {
      id: i + 1,
      width: mw,
      shelves: isOuter ? 0 : shelvesFallback,
      shelfPositions: [],
      drawers: isOuter ? drawersPerOuter : 0,
      drawerItems: [],
      doors: 0,
      slidingDoors: 0,
      rod: !isOuter && hasRod,
      rodYs: [],
      hasBack: true,
      drawerParts: _defaultDrawerParts(),
    };
  });
}
