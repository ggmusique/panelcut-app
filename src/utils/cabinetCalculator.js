/**
 * cabinetCalculator.js
 * Pure logic for computing all wood pieces from a cabinetState.
 */

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Compute net (interior) width of a module.
 * netWidth = moduleWidth  (already stored as net width in cabinetState)
 */
function moduleNetWidth(module) {
  return module.width;
}

/**
 * Compute the real (cut) length of the sloped top rail when the module is biased.
 */
function biaisLength(netWidth, heightLeft, heightRight) {
  const diff = heightLeft - heightRight;
  return Math.sqrt(netWidth * netWidth + diff * diff);
}

function biaisAngleDeg(netWidth, heightLeft, heightRight) {
  if (netWidth <= 0) return 0;
  return (Math.atan(Math.abs(heightLeft - heightRight) / netWidth) * 180) / Math.PI;
}

/**
 * Main export: compute all pieces from the cabinet state.
 * Returns a flat array of piece descriptors.
 */
export function computeAllPieces(cabinet) {
  const {
    modules = [],
    depth = 58,
    thickness = 1.8,
    heightLeft: cabinetHL = 220,
    heightRight: cabinetHR = 220,
    plinth = 10,
  } = cabinet;

  const pieces = [];

  // ── Global panels (common to whole cabinet) ─────────────────────────────
  // We do NOT compute them here; each module generates its own vertical stiles.
  // Global traverse haute/basse are per-module already.

  modules.forEach((mod, modIdx) => {
    const modNum = modIdx + 1;
    const netW = moduleNetWidth(mod);
    const hl = mod.heightLeft ?? cabinetHL;
    const hr = mod.heightRight ?? cabinetHR;
    const isBiais = Math.abs(hl - hr) > 0.1;
    const angleDeg = isBiais ? biaisAngleDeg(netW, hl, hr) : 0;
    // Interior height (left side, for vertical members)
    const interiorH = hl - plinth;

    // ── Vertical stiles ────────────────────────────────────────────────────
    // Left exterior stile
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Montant G`,
      moduleId: mod.id,
      role: 'side',
      length: isBiais ? Math.max(hl, hr) : hl,
      height: thickness,
      qty: 1,
      isRod: false,
      isBiais,
      angle: angleDeg,
      notes: isBiais ? `Montant trapézoïdal: ${hl}/${hr} cm` : '',
    });

    // Right exterior stile (only for last module or if not shared)
    if (modIdx === modules.length - 1) {
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Montant D`,
        moduleId: mod.id,
        role: 'side',
        length: isBiais ? Math.max(hl, hr) : hr,
        height: thickness,
        qty: 1,
        isRod: false,
        isBiais,
        angle: angleDeg,
        notes: isBiais ? `Montant trapézoïdal: ${hl}/${hr} cm` : '',
      });
    }

    // ── Traverse haute ─────────────────────────────────────────────────────
    const topRailLength = isBiais ? biaisLength(netW, hl, hr) : netW;
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Traverse haute`,
      moduleId: mod.id,
      role: 'top',
      length: topRailLength,
      height: thickness,
      qty: 1,
      isRod: false,
      isBiais,
      angle: angleDeg,
      notes: isBiais
        ? `Couper à ${angleDeg.toFixed(1)}° — longueur réelle ${topRailLength.toFixed(1)} cm`
        : '',
    });

    // ── Traverse basse ─────────────────────────────────────────────────────
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Traverse basse`,
      moduleId: mod.id,
      role: 'bottom',
      length: netW,
      height: thickness,
      qty: 1,
      isRod: false,
      isBiais: false,
      angle: 0,
      notes: '',
    });

    // ── Fond ───────────────────────────────────────────────────────────────
    if (mod.hasFond) {
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Fond`,
        moduleId: mod.id,
        role: 'back',
        length: netW,
        height: interiorH,
        qty: 1,
        isRod: false,
        isBiais: false,
        angle: 0,
        notes: '',
      });
    }

    const content = mod.content || {};

    // ── Étagères ───────────────────────────────────────────────────────────
    (content.shelves || []).forEach((shelf, si) => {
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Étagère #${si + 1}`,
        moduleId: mod.id,
        role: 'shelf',
        length: netW,
        height: depth,
        qty: 1,
        isRod: false,
        isBiais: false,
        angle: 0,
        notes: shelf.yFromBottom != null ? `Position: ${shelf.yFromBottom} cm depuis le bas` : '',
      });
    });

    // ── Tringles ───────────────────────────────────────────────────────────
    (content.rods || []).forEach((rod, ri) => {
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Tringle #${ri + 1}`,
        moduleId: mod.id,
        role: 'rod',
        length: netW,
        height: rod.diameter ?? 2.5,
        qty: 1,
        isRod: true,
        isBiais: false,
        angle: 0,
        notes: `Ø ${rod.diameter ?? 2.5} cm${rod.yFromBottom != null ? ` · Position: ${rod.yFromBottom} cm` : ''}`,
      });
    });

    // ── Tiroirs ────────────────────────────────────────────────────────────
    (content.drawers || []).forEach((drawer, di) => {
      const drawerH = drawer.height ?? 18;
      const p = drawer.pieces || {};
      const innerNetW = netW - 2 * thickness;
      const caisseH = drawerH - thickness;
      const flancL = depth - thickness;

      const drawerPieceDefs = [
        {
          key: 'face',
          enabled: p.face !== false,
          name: `Module ${modNum} — Face tiroir #${di + 1}`,
          role: 'drawer_face',
          length: netW,
          height: drawerH,
        },
        {
          key: 'avanCaisse',
          enabled: p.avanCaisse !== false,
          name: `Module ${modNum} — Avant caisse tiroir #${di + 1}`,
          role: 'drawer_front',
          length: innerNetW,
          height: caisseH,
        },
        {
          key: 'arriereCaisse',
          enabled: p.arriereCaisse !== false,
          name: `Module ${modNum} — Arrière caisse tiroir #${di + 1}`,
          role: 'drawer_back',
          length: innerNetW,
          height: caisseH,
        },
        {
          key: 'flancGauche',
          enabled: p.flancGauche !== false,
          name: `Module ${modNum} — Flanc G tiroir #${di + 1}`,
          role: 'drawer_side',
          length: flancL,
          height: caisseH,
        },
        {
          key: 'flancDroit',
          enabled: p.flancDroit !== false,
          name: `Module ${modNum} — Flanc D tiroir #${di + 1}`,
          role: 'drawer_side',
          length: flancL,
          height: caisseH,
        },
        {
          key: 'fond',
          enabled: p.fond !== false,
          name: `Module ${modNum} — Fond tiroir #${di + 1}`,
          role: 'drawer_bottom',
          length: innerNetW,
          height: depth - thickness,
        },
      ];

      drawerPieceDefs.forEach(def => {
        if (!def.enabled) return;
        pieces.push({
          id: uid(),
          name: def.name,
          moduleId: mod.id,
          role: def.role,
          length: Math.max(0, def.length),
          height: Math.max(0, def.height),
          qty: 1,
          isRod: false,
          isBiais: false,
          angle: 0,
          notes: `Tiroir h=${drawerH} cm, pos=${drawer.yFromBottom ?? 0} cm`,
        });
      });
    });

    // ── Portes ─────────────────────────────────────────────────────────────
    (content.doors || []).forEach((door, doi) => {
      if (door.type === 'swing') {
        const count = door.count ?? 1;
        const doorW = count === 2 ? netW / 2 : netW;
        for (let v = 0; v < count; v++) {
          pieces.push({
            id: uid(),
            name: `Module ${modNum} — Porte #${doi + 1} vantail ${v + 1}`,
            moduleId: mod.id,
            role: 'door',
            length: doorW,
            height: interiorH,
            qty: 1,
            isRod: false,
            isBiais: false,
            angle: 0,
            notes: 'Porte battante',
          });
        }
      } else if (door.type === 'sliding') {
        // 2 pièces qui se chevauchent
        for (let v = 0; v < 2; v++) {
          pieces.push({
            id: uid(),
            name: `Module ${modNum} — Porte coulissante #${doi + 1} vantail ${v + 1}`,
            moduleId: mod.id,
            role: 'door',
            length: netW * 0.6,
            height: interiorH,
            qty: 1,
            isRod: false,
            isBiais: false,
            angle: 0,
            notes: 'Porte coulissante (chevauchement 20%)',
          });
        }
      }
    });
  });

  return pieces;
}

/**
 * Convert cabinetState to the { pieces, cabinet } format used by onComplete.
 */
export function convertCabinetStateToPieces(cabinetState) {
  const pieces = computeAllPieces(cabinetState).map(p => ({
    name: p.name,
    length: p.length,
    height: p.height,
    qty: p.qty,
    ...(p.isRod ? { isRod: true, type: 'rod' } : {}),
    notes: p.notes || undefined,
  }));

  const cabinet = {
    width: cabinetState.totalWidth,
    height: cabinetState.heightLeft,
    depth: cabinetState.depth,
    plinth: cabinetState.plinth,
    thickness: cabinetState.thickness,
    modules: (cabinetState.modules || []).map((m, i) => ({
      id: m.id || i + 1,
      width: m.width,
      shelves: (m.content?.shelves || []).map(s => ({ y: s.yFromBottom ?? 0 })),
      drawers: (m.content?.drawers || []).length,
      drawerItems: (m.content?.drawers || []).map(d => ({
        y: d.yFromBottom ?? 0,
        height: d.height ?? 18,
      })),
      rods: (m.content?.rods || []).map(r => ({ y: r.yFromBottom ?? 0 })),
      doors: (m.content?.doors || []).length,
      hasBack: m.hasFond,
    })),
  };

  return { pieces, cabinet };
}

/**
 * Normalize a scan result (from Claude Vision) into a cabinetState.
 */
export function normalizeResultToCabinetState(result) {
  const cab = result?.cabinet || {};
  const rawModules = Array.isArray(cab.modules) ? cab.modules : [];

  const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const uid2  = () => Math.random().toString(36).slice(2, 9);

  const totalWidth  = toNum(cab.width, 240);
  const heightLeft  = toNum(cab.height, 220);
  const heightRight = toNum(cab.height, 220);
  const depth       = toNum(cab.depth, 58);
  const plinth      = toNum(cab.plinth, 10);
  const thickness   = toNum(cab.thickness ?? cab.panel_thickness, 1.8);

  const nb = rawModules.length > 0 ? rawModules.length : Math.max(1, toNum(cab.nb_dividers ?? 3, 3) + 1);
  const defaultModW = totalWidth / Math.max(1, nb);

  const modules = rawModules.length > 0
    ? rawModules.map((m) => {
        const shelves = Array.isArray(m.shelves)
          ? m.shelves.map((s, si) => ({
              id: uid2(),
              yFromBottom: typeof s === 'object' && s !== null ? toNum(s.y ?? s.yFromBottom, (si + 1) * 30) : toNum(s, (si + 1) * 30),
            }))
          : Array.from({ length: toNum(m.nb_shelves ?? 0, 0) }, (_, si) => ({
              id: uid2(),
              yFromBottom: (si + 1) * 30,
            }));

        const nbDrawers = toNum(m.drawers ?? m.nb_drawers, 0);
        const drawerItems = Array.isArray(m.drawerItems) && m.drawerItems.length > 0
          ? m.drawerItems
          : Array.from({ length: nbDrawers }, (_, di) => ({ height: 18, y: di * 18 }));
        const drawers = drawerItems.map((d, di) => ({
          id: uid2(),
          height: toNum(d.height ?? d.h, 18),
          yFromBottom: toNum(d.y ?? d.yFromBottom, di * 18),
          pieces: { face: true, avanCaisse: true, arriereCaisse: true, flancGauche: true, flancDroit: true, fond: true },
        }));

        const rodsSrc = Array.isArray(m.rods) && m.rods.length > 0
          ? m.rods
          : (m.rod || m.tringle || m.hanging) ? [{}] : [];
        const rods = rodsSrc.map((r, ri) => ({
          id: uid2(),
          yFromBottom: typeof r === 'object' && r !== null ? toNum(r.y ?? r.yFromBottom, 160) : 160,
          diameter: typeof r === 'object' && r !== null ? toNum(r.diameter, 2.5) : 2.5,
        }));

        const nbDoors = toNum(m.doors ?? m.nb_doors, 0);
        const nbSliding = toNum(m.slidingDoors ?? m.nb_sliding_doors, 0);
        const doors = nbSliding > 0
          ? [{ id: uid2(), type: 'sliding', count: 2 }]
          : nbDoors > 0
            ? [{ id: uid2(), type: 'swing', count: Math.min(2, nbDoors) }]
            : [];

        return {
          id: m.id ? String(m.id) : uid2(),
          width: toNum(m.width ?? m.w ?? m.largeur, defaultModW),
          heightLeft,
          heightRight,
          hasFond: m.hasBack !== false && m.hasFond !== false,
          content: { shelves, drawers, rods, doors },
        };
      })
    : Array.from({ length: nb }, (_, i) => ({
        id: uid2(),
        width: defaultModW,
        heightLeft,
        heightRight,
        hasFond: true,
        content: { shelves: [], drawers: [], rods: [], doors: [] },
      }));

  return {
    totalWidth,
    heightLeft,
    heightRight,
    depth,
    plinth,
    thickness,
    modules,
  };
}
