/**
 * cabinetCalculator.js
 * Pure logic for computing all wood pieces from a cabinetState.
 */

const uid = () => Math.random().toString(36).slice(2, 9);

const EDGE_THICKNESS_CM = {
  none: 0,
  pvc_04: 0.04,
  pvc_2: 0.2,
  abs_2: 0.2,
  veneer: 0.06,
  postform: 0.2,
};

const HARDWARE_SLIDES = {
  side:       [25, 30, 35, 40, 45, 50],
  undermount: [27, 30, 35, 40, 45, 50],
};

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

function edgePresetForRole(role) {
  // 0/1/2/4-sided presets by role.
  // We model front-visible sides by default for cabinet pieces.
  if (role === 'shelf') return { top: false, bottom: false, left: false, right: true }; // 1 side (front)
  if (role === 'door' || role === 'drawer_face') return { top: true, bottom: true, left: true, right: true }; // 4 sides
  if (role === 'top' || role === 'bottom') return { top: false, bottom: false, left: false, right: true }; // 1 side (front)
  return { top: false, bottom: false, left: false, right: false }; // 0 side by default
}

function countEdges(edges) {
  return Object.values(edges || {}).filter(Boolean).length;
}

function applyEdgeCompensation(length, height, edges, edgeType) {
  const edgeTh = EDGE_THICKNESS_CM[edgeType] ?? 0;
  const leftComp = edges?.left ? edgeTh : 0;
  const rightComp = edges?.right ? edgeTh : 0;
  const topComp = edges?.top ? edgeTh : 0;
  const bottomComp = edges?.bottom ? edgeTh : 0;
  return {
    finalLength: Math.max(0, length),
    finalHeight: Math.max(0, height),
    rawLength: Math.max(0, length - leftComp - rightComp),
    rawHeight: Math.max(0, height - topComp - bottomComp),
  };
}

function pickSlideNominalLength(slideType, usefulDepth) {
  const options = HARDWARE_SLIDES[slideType] || [];
  const eligible = options.filter(v => v <= usefulDepth);
  return eligible.length ? eligible[eligible.length - 1] : 0;
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
    assemblyMode = 'MONTANTS_PLEINE_HAUTEUR', // or TRAVERSES_SUR_MONTANTS
    edgeType = 'none',
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
    const montantH = assemblyMode === 'TRAVERSES_SUR_MONTANTS'
      ? Math.max(0, interiorH - 2 * thickness)
      : Math.max(0, interiorH);

    // ── Vertical stiles ────────────────────────────────────────────────────
    // Left exterior stile
    const montantGEdges = edgePresetForRole('side');
    const montantGComp = applyEdgeCompensation(isBiais ? Math.max(hl, hr) : montantH, depth, montantGEdges, edgeType);
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Montant G`,
      moduleId: mod.id,
      role: 'side',
      length: montantGComp.rawLength,
      height: montantGComp.rawHeight,
      finalLength: montantGComp.finalLength,
      finalHeight: montantGComp.finalHeight,
      qty: 1,
      isRod: false,
      isBiais,
      angle: angleDeg,
      edges: montantGEdges,
      edgeType,
      edgeCount: countEdges(montantGEdges),
      notes: isBiais ? `Montant trapézoïdal: ${hl}/${hr} cm` : '',
    });

    // Right exterior stile (only for last module or if not shared)
    if (modIdx === modules.length - 1) {
      const montantDEdges = edgePresetForRole('side');
      const montantDComp = applyEdgeCompensation(isBiais ? Math.max(hl, hr) : montantH, depth, montantDEdges, edgeType);
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Montant D`,
        moduleId: mod.id,
        role: 'side',
        length: montantDComp.rawLength,
        height: montantDComp.rawHeight,
        finalLength: montantDComp.finalLength,
        finalHeight: montantDComp.finalHeight,
        qty: 1,
        isRod: false,
        isBiais,
        angle: angleDeg,
        edges: montantDEdges,
        edgeType,
        edgeCount: countEdges(montantDEdges),
        notes: isBiais ? `Montant trapézoïdal: ${hl}/${hr} cm` : '',
      });
    }

    // ── Traverse haute ─────────────────────────────────────────────────────
    const topRailLength = isBiais ? biaisLength(netW, hl, hr) : netW;
    const topEdges = edgePresetForRole('top');
    const topComp = applyEdgeCompensation(topRailLength, depth, topEdges, edgeType);
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Traverse haute`,
      moduleId: mod.id,
      role: 'top',
      length: topComp.rawLength,
      height: topComp.rawHeight,
      finalLength: topComp.finalLength,
      finalHeight: topComp.finalHeight,
      qty: 1,
      isRod: false,
      isBiais,
      angle: angleDeg,
      edges: topEdges,
      edgeType,
      edgeCount: countEdges(topEdges),
      notes: isBiais
        ? `Couper à ${angleDeg.toFixed(1)}° — longueur réelle ${topRailLength.toFixed(1)} cm`
        : '',
    });

    // ── Traverse basse ─────────────────────────────────────────────────────
    const botEdges = edgePresetForRole('bottom');
    const botComp = applyEdgeCompensation(netW, depth, botEdges, edgeType);
    pieces.push({
      id: uid(),
      name: `Module ${modNum} — Traverse basse`,
      moduleId: mod.id,
      role: 'bottom',
      length: botComp.rawLength,
      height: botComp.rawHeight,
      finalLength: botComp.finalLength,
      finalHeight: botComp.finalHeight,
      qty: 1,
      isRod: false,
      isBiais: false,
      angle: 0,
      edges: botEdges,
      edgeType,
      edgeCount: countEdges(botEdges),
      notes: '',
    });

    // ── Fond ───────────────────────────────────────────────────────────────
    if (mod.hasFond) {
      const fondEdges = edgePresetForRole('back');
      const fondComp = applyEdgeCompensation(netW, interiorH, fondEdges, edgeType);
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Fond`,
        moduleId: mod.id,
        role: 'back',
        length: fondComp.rawLength,
        height: fondComp.rawHeight,
        finalLength: fondComp.finalLength,
        finalHeight: fondComp.finalHeight,
        qty: 1,
        isRod: false,
        isBiais: false,
        angle: 0,
        edges: fondEdges,
        edgeType,
        edgeCount: countEdges(fondEdges),
        notes: '',
      });
    }

    const content = mod.content || {};

    // ── Étagères ───────────────────────────────────────────────────────────
    (content.shelves || []).forEach((shelf, si) => {
      const shelfEdges = edgePresetForRole('shelf');
      const shelfComp = applyEdgeCompensation(netW, depth, shelfEdges, edgeType);
      pieces.push({
        id: uid(),
        name: `Module ${modNum} — Étagère #${si + 1}`,
        moduleId: mod.id,
        role: 'shelf',
        length: shelfComp.rawLength,
        height: shelfComp.rawHeight,
        finalLength: shelfComp.finalLength,
        finalHeight: shelfComp.finalHeight,
        qty: 1,
        isRod: false,
        isBiais: false,
        angle: 0,
        edges: shelfEdges,
        edgeType,
        edgeCount: countEdges(shelfEdges),
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
      const slideType = drawer.slideType || 'side';
      const slideClearance = drawer.slideClearance ?? (slideType === 'undermount' ? 0.2 : slideType === 'none' ? 0 : 1.3);
      const backClearance = drawer.backClearance ?? (slideType === 'none' ? 0 : 2);
      const innerNetW = netW - 2 * thickness - 2 * slideClearance;
      const caisseH = drawerH - thickness;
      const usefulDepth = Math.max(0, depth - thickness - backClearance);
      const flancL = usefulDepth;
      const slideNominal = pickSlideNominalLength(slideType, usefulDepth);

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
        const drawerEdges = edgePresetForRole(def.role);
        const comp = applyEdgeCompensation(def.length, def.height, drawerEdges, edgeType);
        pieces.push({
          id: uid(),
          name: def.name,
          moduleId: mod.id,
          role: def.role,
          length: comp.rawLength,
          height: comp.rawHeight,
          finalLength: comp.finalLength,
          finalHeight: comp.finalHeight,
          qty: 1,
          isRod: false,
          isBiais: false,
          angle: 0,
          edges: drawerEdges,
          edgeType,
          edgeCount: countEdges(drawerEdges),
          notes: `Tiroir h=${drawerH} cm, pos=${drawer.yFromBottom ?? 0} cm · coulisse=${slideType} jeu=${slideClearance} recul=${backClearance} cm · coulisse nominale ${slideNominal || 'N/A'} cm`,
        });
      });
    });

    // ── Portes ─────────────────────────────────────────────────────────────
    (content.doors || []).forEach((door, doi) => {
      if (door.type === 'swing') {
        const count = door.count ?? 1;
        const doorW = count === 2 ? netW / 2 : netW;
        for (let v = 0; v < count; v++) {
          const doorEdges = edgePresetForRole('door');
          const doorComp = applyEdgeCompensation(doorW, interiorH, doorEdges, edgeType);
          pieces.push({
            id: uid(),
            name: `Module ${modNum} — Porte #${doi + 1} vantail ${v + 1}`,
            moduleId: mod.id,
            role: 'door',
            length: doorComp.rawLength,
            height: doorComp.rawHeight,
            finalLength: doorComp.finalLength,
            finalHeight: doorComp.finalHeight,
            qty: 1,
            isRod: false,
            isBiais: false,
            angle: 0,
            edges: doorEdges,
            edgeType,
            edgeCount: countEdges(doorEdges),
            notes: 'Porte battante',
          });
        }
      } else if (door.type === 'sliding') {
        // 2 pièces qui se chevauchent
        for (let v = 0; v < 2; v++) {
          const doorEdges = edgePresetForRole('door');
          const doorComp = applyEdgeCompensation(netW * 0.6, interiorH, doorEdges, edgeType);
          pieces.push({
            id: uid(),
            name: `Module ${modNum} — Porte coulissante #${doi + 1} vantail ${v + 1}`,
            moduleId: mod.id,
            role: 'door',
            length: doorComp.rawLength,
            height: doorComp.rawHeight,
            finalLength: doorComp.finalLength,
            finalHeight: doorComp.finalHeight,
            qty: 1,
            isRod: false,
            isBiais: false,
            angle: 0,
            edges: doorEdges,
            edgeType,
            edgeCount: countEdges(doorEdges),
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
    finalLength: p.finalLength ?? p.length,
    finalHeight: p.finalHeight ?? p.height,
    qty: p.qty,
    ...(p.isRod ? { isRod: true, type: 'rod' } : {}),
    edges: p.edges,
    edgeType: p.edgeType,
    edgeCount: p.edgeCount,
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

export function validateCabinetFabrication(cabinetState, computedPieces = null) {
  const issues = [];
  const pieces = computedPieces || computeAllPieces(cabinetState);
  const modules = cabinetState?.modules || [];
  const panelW = Number(cabinetState?.panelW) || 244;
  const panelH = Number(cabinetState?.panelH) || 122;
  const thickness = Number(cabinetState?.thickness) || 1.8;
  const panelThickness = Number(cabinetState?.panelThickness ?? thickness);

  if (Math.abs(thickness - panelThickness) > 0.01) {
    issues.push({
      level: 'error',
      code: 'THICKNESS_MISMATCH',
      message: `Épaisseur incohérente: meuble ${thickness} cm vs panneau ${panelThickness} cm`,
    });
  }

  modules.forEach((m, i) => {
    if ((m.width || 0) <= 0) {
      issues.push({ level: 'error', code: 'MODULE_WIDTH', message: `Module ${i + 1}: largeur <= 0` });
    }
    if ((m.width || 0) > 90) {
      issues.push({ level: 'warning', code: 'MODULE_WIDE', message: `Module ${i + 1}: largeur > 90 cm, vérifier renfort/flèche` });
    }
  });

  pieces.forEach((p) => {
    if (p.isRod) return;
    if ((p.length || 0) <= 0 || (p.height || 0) <= 0) {
      issues.push({ level: 'error', code: 'PIECE_NEGATIVE', message: `${p.name}: cote invalide` });
      return;
    }
    const fitsDirect = p.length <= panelW && p.height <= panelH;
    const fitsRotated = p.height <= panelW && p.length <= panelH;
    if (!fitsDirect && !fitsRotated) {
      issues.push({ level: 'error', code: 'PIECE_TOO_BIG', message: `${p.name}: ne rentre pas dans panneau ${panelW}×${panelH} cm` });
    }
  });

  modules.forEach((m, i) => {
    const drawers = m?.content?.drawers || [];
    drawers.forEach((d, di) => {
      const slideType = d.slideType || 'side';
      if (slideType === 'none') return;
      const backClearance = d.backClearance ?? 2;
      const usefulDepth = Math.max(0, (cabinetState?.depth || 58) - thickness - backClearance);
      const nominal = pickSlideNominalLength(slideType, usefulDepth);
      if (!nominal) {
        issues.push({
          level: 'error',
          code: 'DRAWER_SLIDE_DEPTH',
          message: `Module ${i + 1} tiroir ${di + 1}: profondeur utile (${usefulDepth.toFixed(1)} cm) insuffisante pour une coulisse ${slideType}`,
        });
      }
    });
  });

  return issues;
}

/**
 * Normalize a scan result (from Claude Vision) into a cabinetState.
 */
export function normalizeResultToCabinetState(result) {
  const cab = result?.cabinet || {};
  const rawModules = Array.isArray(cab.modules) ? cab.modules : [];

  const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  const totalWidth  = toNum(cab.width, 240);
  const heightLeft  = toNum(cab.height, 220);
  const heightRight = toNum(cab.height, 220);
  const depth       = toNum(cab.depth, 58);
  const plinth      = toNum(cab.plinth, 10);
  const thickness   = toNum(cab.thickness ?? cab.panel_thickness, 1.8);
  const edgeType    = cab.edgeType ?? cab.edge_type ?? 'none';
  const assemblyMode = cab.assemblyMode ?? 'MONTANTS_PLEINE_HAUTEUR';

  const nb = rawModules.length > 0 ? rawModules.length : Math.max(1, toNum(cab.nb_dividers, 3) + 1);
  const defaultModW = totalWidth / Math.max(1, nb);

  const modules = rawModules.length > 0
    ? rawModules.map((m) => {
        const shelves = Array.isArray(m.shelves)
          ? m.shelves.map((s, si) => ({
              id: uid(),
              yFromBottom: typeof s === 'object' && s !== null ? toNum(s.y ?? s.yFromBottom, (si + 1) * 30) : toNum(s, (si + 1) * 30),
            }))
          : Array.from({ length: toNum(m.nb_shelves ?? 0, 0) }, (_, si) => ({
              id: uid(),
              yFromBottom: (si + 1) * 30,
            }));

        const nbDrawers = toNum(m.drawers ?? m.nb_drawers, 0);
        const drawerItems = Array.isArray(m.drawerItems) && m.drawerItems.length > 0
          ? m.drawerItems
          : Array.from({ length: nbDrawers }, (_, di) => ({ height: 18, y: di * 18 }));
        const drawers = drawerItems.map((d, di) => ({
          id: uid(),
          height: toNum(d.height ?? d.h, 18),
          yFromBottom: toNum(d.y ?? d.yFromBottom, di * 18),
          slideType: 'side',
          slideClearance: 1.3,
          backClearance: 2,
          pieces: { face: true, avanCaisse: true, arriereCaisse: true, flancGauche: true, flancDroit: true, fond: true },
        }));

        const rodsSrc = Array.isArray(m.rods) && m.rods.length > 0
          ? m.rods
          : (m.rod || m.tringle || m.hanging) ? [{}] : [];
        const rods = rodsSrc.map((r, ri) => ({
          id: uid(),
          yFromBottom: typeof r === 'object' && r !== null ? toNum(r.y ?? r.yFromBottom, 160) : 160,
          diameter: typeof r === 'object' && r !== null ? toNum(r.diameter, 2.5) : 2.5,
        }));

        const nbDoors = toNum(m.doors ?? m.nb_doors, 0);
        const nbSliding = toNum(m.slidingDoors ?? m.nb_sliding_doors, 0);
        const doors = nbSliding > 0
          ? [{ id: uid(), type: 'sliding', count: 2 }]
          : nbDoors > 0
            ? [{ id: uid(), type: 'swing', count: Math.min(2, nbDoors) }]
            : [];

        return {
          id: m.id ? String(m.id) : uid(),
          width: toNum(m.width ?? m.w ?? m.largeur, defaultModW),
          heightLeft,
          heightRight,
          hasFond: m.hasBack !== false && m.hasFond !== false,
          content: { shelves, drawers, rods, doors },
        };
      })
    : Array.from({ length: nb }, (_, i) => ({
        id: uid(),
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
    panelThickness: thickness,
    edgeType,
    assemblyMode,
    modules,
  };
}
