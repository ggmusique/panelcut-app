const uid = () => Math.random().toString(36).slice(2, 10);

export const TOOL_IDS = {
  SELECT: 'select',
  DIM: 'dimension',
  NOTE: 'note',
  ARROW: 'arrow',
  ERASE: 'erase',
  SHELF: 'shelf',
  DRAWER: 'drawer',
  ROD: 'rod',
  DOOR: 'door',
  SLIDING: 'sliding_door',
};

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const hasValue = (v) => v !== undefined && v !== null && v !== '';

function normalizeModuleWidth(m, fallback = 0) {
  return Math.max(1, toNum(m?.width ?? m?.w ?? m?.largeur, fallback));
}

function normalizeShelves(rawModule, cabinetHeightCm) {
  const rawShelves = rawModule?.shelves;
  if (Array.isArray(rawShelves) && rawShelves.length) {
    return rawShelves.map((s) => ({
      id: uid(),
      y: toNum(typeof s === 'object' ? s?.y : s, 0),
    }));
  }

  const shelfCount = Math.max(0, parseInt(rawShelves ?? rawModule?.nb_shelves ?? 0, 10) || 0);
  if (shelfCount <= 0) return [];

  return Array.from({ length: shelfCount }, (_, i) => ({
    id: uid(),
    y: ((i + 1) * cabinetHeightCm) / (shelfCount + 1),
  }));
}

function normalizeRods(rawModule) {
  const rods = [];

  if (Array.isArray(rawModule?.rods) && rawModule.rods.length) {
    rawModule.rods.forEach((r) => {
      const y = hasValue(r?.y) ? toNum(r.y, null) : null;
      rods.push({ id: uid(), y: Number.isFinite(y) ? y : null });
    });
    return rods;
  }

  const legacyRod = rawModule?.rod ?? rawModule?.tringle;
  if (legacyRod === true) {
    rods.push({ id: uid(), y: null });
    return rods;
  }

  if (legacyRod && typeof legacyRod === 'object') {
    const y = hasValue(legacyRod.y) ? toNum(legacyRod.y, null) : null;
    rods.push({ id: uid(), y: Number.isFinite(y) ? y : null });
  }

  return rods;
}

function normalizeDrawers(rawModule) {
  const drawerItems = Array.isArray(rawModule?.drawerItems) ? rawModule.drawerItems : null;
  if (drawerItems && drawerItems.length) {
    return drawerItems.map((d) => ({
      id: uid(),
      y: hasValue(d?.y) ? toNum(d.y, 0) : null,
      height: Math.max(1, toNum(d?.height ?? d?.h, 18)),
    }));
  }

  if (Array.isArray(rawModule?.drawers) && rawModule.drawers.length && typeof rawModule.drawers[0] === 'object') {
    return rawModule.drawers.map((d) => ({
      id: uid(),
      y: hasValue(d?.y) ? toNum(d.y, 0) : null,
      height: Math.max(1, toNum(d?.height ?? d?.h, 18)),
    }));
  }

  const drawerCount = Math.max(0, parseInt(rawModule?.drawers ?? rawModule?.nb_drawers ?? 0, 10) || 0);
  return Array.from({ length: drawerCount }, () => ({ id: uid(), y: null, height: 18 }));
}

function normalizeDoorArray(count) {
  return Array.from({ length: Math.max(0, count) }, () => ({ id: uid(), kind: count === 1 ? 'single' : 'double' }));
}

function buildFallbackModules(cabinet, cabinetDims) {
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 3, 10) + 1);
  const width = toNum(cabinetDims.width, 0);
  const equalWidth = nb > 0 ? Math.max(1, width / nb) : 40;

  const totalDrawers = Math.max(0, parseInt(cabinet?.nb_drawers ?? 0, 10) || 0);
  const totalShelves = Math.max(0, parseInt(cabinet?.nb_shelves ?? 0, 10) || 0);
  const rodEnabled = Boolean(cabinet?.rod ?? cabinet?.tringle ?? false);

  const facadeModules = Array.from({ length: nb }, (_, i) => ({
    id: String(i + 1),
    x: 0,
    width: equalWidth,
    type: 'standard',
  }));

  const drawersPerOuter = Math.floor(totalDrawers / 2);
  const shelvesPerInner = Math.max(0, Math.round(totalShelves / Math.max(1, nb - 2)));

  const moduleDetails = facadeModules.map((m, idx) => {
    const isOuter = idx === 0 || idx === nb - 1;
    const isInner = !isOuter;

    return {
      moduleId: m.id,
      shelves: isInner
        ? Array.from({ length: shelvesPerInner }, (_, sIdx) => ({
            id: uid(),
            y: ((sIdx + 1) * toNum(cabinetDims.height, 220)) / (shelvesPerInner + 1),
          }))
        : [],
      drawers: isOuter
        ? Array.from({ length: drawersPerOuter }, () => ({ id: uid(), y: null, height: 18 }))
        : [],
      rods: isInner && rodEnabled ? [{ id: uid(), y: null }] : [],
      doors: [],
      slidingDoors: [],
    };
  });

  return { facadeModules, moduleDetails };
}

export function normalizeFromInitialResult(initialResult, draft) {
  const cab = initialResult?.cabinet || {};
  const draftState = draft?.state || {};

  const draftDims = draftState?.cabinetDims || {};
  const cabinetDims = {
    width: hasValue(draftDims.width) ? draftDims.width : (hasValue(cab.width) ? cab.width : ''),
    height: hasValue(draftDims.height) ? draftDims.height : (hasValue(cab.height) ? cab.height : ''),
    depth: hasValue(draftDims.depth) ? draftDims.depth : (hasValue(cab.depth ?? cab.prof) ? (cab.depth ?? cab.prof) : 60),
    thickness: hasValue(draftDims.thickness) ? draftDims.thickness : (hasValue(cab.thickness ?? cab.panel_thickness) ? (cab.thickness ?? cab.panel_thickness) : 1.8),
    plinth: hasValue(draftDims.plinth) ? draftDims.plinth : (hasValue(cab.plinth ?? cab.plinthe) ? (cab.plinth ?? cab.plinthe) : 0),
  };

  const rawModules = Array.isArray(cab.modules) ? cab.modules : [];
  const useDraftModules = Array.isArray(draftState.facadeModules) && draftState.facadeModules.length > 0;
  const useDraftDetails = Array.isArray(draftState.moduleDetails) && draftState.moduleDetails.length > 0;

  let facadeModules = [];
  let moduleDetails = [];

  if (useDraftModules) {
    facadeModules = draftState.facadeModules.map((m, i) => ({
      id: String(m.id ?? i + 1),
      x: toNum(m.x, 0),
      width: Math.max(1, toNum(m.width, 1)),
      type: m.type || 'standard',
    }));
  } else if (rawModules.length > 0) {
    facadeModules = rawModules.map((m, i) => ({
      id: String(i + 1),
      x: 0,
      width: normalizeModuleWidth(m, 1),
      type: 'standard',
    }));
  } else {
    const fallback = buildFallbackModules(cab, cabinetDims);
    facadeModules = fallback.facadeModules;
    moduleDetails = fallback.moduleDetails;
  }

  const totalW = facadeModules.reduce((acc, m) => acc + Math.max(1, toNum(m.width, 1)), 0);
  let cursor = 0;
  facadeModules = facadeModules.map((m, idx) => {
    const w = Math.max(1, toNum(m.width, 1));
    const next = { ...m, id: String(idx + 1), x: (cursor / totalW) * 100, width: w };
    cursor += w;
    return next;
  });

  if (useDraftDetails) {
    const draftMap = new Map(draftState.moduleDetails.map((d) => [String(d.moduleId), d]));
    moduleDetails = facadeModules.map((m) => {
      const d = draftMap.get(String(m.id));
      if (!d) return { moduleId: m.id, shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
      return {
        moduleId: String(m.id),
        shelves: Array.isArray(d.shelves) ? d.shelves : [],
        drawers: Array.isArray(d.drawers) ? d.drawers : [],
        rods: Array.isArray(d.rods) ? d.rods : [],
        doors: Array.isArray(d.doors) ? d.doors : [],
        slidingDoors: Array.isArray(d.slidingDoors) ? d.slidingDoors : [],
      };
    });
  } else if (moduleDetails.length === 0) {
    moduleDetails = facadeModules.map((fm, idx) => {
      const m = rawModules[idx] || {};
      const shelves = normalizeShelves(m, toNum(cabinetDims.height, 220));
      const drawers = normalizeDrawers(m);
      const rods = normalizeRods(m);
      const doorsCount = Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10) || 0);
      const slidingCount = Math.max(0, parseInt(m.slidingDoors ?? m.nb_sliding_doors ?? 0, 10) || 0);

      return {
        moduleId: fm.id,
        shelves,
        drawers,
        rods,
        doors: normalizeDoorArray(doorsCount),
        slidingDoors: normalizeDoorArray(slidingCount),
      };
    });
  }

  return {
    cabinetDims,
    facadeModules,
    facadeItems: Array.isArray(draftState.facadeItems) ? draftState.facadeItems : [],
    moduleDetails,
  };
}

export function buildFacadeLayout(facadeModules, cabinetDims, svgWidth, svgHeight, padding = 60) {
  const W = Math.max(1, toNum(cabinetDims?.width, 1));
  const H = Math.max(1, toNum(cabinetDims?.height, 1));
  const PL = Math.max(0, toNum(cabinetDims?.plinth ?? 0, 0));
  const TH = Math.max(0.1, toNum(cabinetDims?.thickness ?? 1.8, 1.8));

  const ox = padding;
  const oy = padding;
  const innerW = Math.max(10, svgWidth - padding * 2);
  const innerH = Math.max(10, svgHeight - padding * 2);

  const contentH = Math.max(1, H - PL);
  const sx = innerW / W;
  const sy = innerH / H;
  const thicknessPx = TH * sx;
  const plinthPx = PL * sy;

  const cmToY = (yCmFromBottom) => oy + (contentH - toNum(yCmFromBottom, 0)) * (contentH > 0 ? (innerH - plinthPx) / contentH : 0);
  const cmToX = (xCm) => ox + toNum(xCm, 0) * sx;

  const totalModuleW = facadeModules.reduce((acc, m) => acc + Math.max(1, toNum(m.width, 1)), 0) || 1;
  let curX = ox;
  const moduleRects = facadeModules.map((m) => {
    const wPx = (Math.max(1, toNum(m.width, 1)) / totalModuleW) * innerW;
    const rect = {
      id: String(m.id),
      x: curX,
      y: oy,
      width: wPx,
      height: innerH - plinthPx,
      bottom: oy + innerH - plinthPx,
      top: oy,
    };
    curX += wPx;
    return rect;
  });

  return {
    ox,
    oy,
    innerW,
    innerH,
    thicknessPx,
    plinthPx,
    moduleRects,
    sx,
    sy,
    cmToY,
    cmToX,
  };
}

export function layoutModulesPx(facadeModules, svgWidth, left = 32, right = 32) {
  const innerW = Math.max(1, svgWidth - left - right);
  const total = facadeModules.reduce((a, m) => a + Math.max(1, toNum(m.width, 1)), 0);
  let cursor = left;
  return facadeModules.map((m) => {
    const w = (Math.max(1, toNum(m.width, 1)) / total) * innerW;
    const rect = { id: m.id, x: cursor, width: w };
    cursor += w;
    return rect;
  });
}

export function buildCabinetFromDraft(draftState) {
  const dims = draftState?.cabinetDims || {};
  const modules = Array.isArray(draftState?.facadeModules) ? draftState.facadeModules : [];
  const details = Array.isArray(draftState?.moduleDetails) ? draftState.moduleDetails : [];

  const resultModules = modules.map((m, idx) => {
    const detail = details.find((d) => String(d.moduleId) === String(m.id)) || {};
    const shelves = Array.isArray(detail.shelves) ? detail.shelves.map((s) => ({ y: hasValue(s.y) ? toNum(s.y, 0) : null })) : [];
    const shelfPositions = shelves.map((s) => s.y).filter((v) => Number.isFinite(v));
    const drawerItems = Array.isArray(detail.drawers)
      ? detail.drawers.map((d) => ({ y: hasValue(d.y) ? toNum(d.y, 0) : null, height: toNum(d.height, 18) }))
      : [];
    return {
      id: idx + 1,
      width: toNum(m.width, 1),
      shelves,
      shelfPositions,
      drawers: drawerItems.length,
      drawerItems,
      rods: Array.isArray(detail.rods) ? detail.rods.map((r) => ({ y: hasValue(r.y) ? toNum(r.y, 0) : null })) : [],
      doors: Array.isArray(detail.doors) ? detail.doors.length : 0,
      slidingDoors: Array.isArray(detail.slidingDoors) ? detail.slidingDoors.length : 0,
    };
  });

  return {
    width: hasValue(dims.width) ? toNum(dims.width, 0) : 0,
    height: hasValue(dims.height) ? toNum(dims.height, 0) : 0,
    depth: hasValue(dims.depth) ? toNum(dims.depth, 60) : 60,
    thickness: hasValue(dims.thickness) ? toNum(dims.thickness, 1.8) : 1.8,
    modules: resultModules,
  };
}

export function buildPiecesFromCabinet(cabinet) {
  const pieces = [];
  const depth = toNum(cabinet?.depth, 60);
  (cabinet?.modules || []).forEach((m, i) => {
    (m.shelves || []).forEach((_, si) => pieces.push({ name: `Tablette M${i + 1}-${si + 1}`, length: toNum(m.width, 0), height: depth, qty: 1 }));
    (m.drawerItems || []).forEach((d, di) => pieces.push({ name: `Tiroir M${i + 1}-${di + 1}`, length: toNum(m.width, 0), height: toNum(d.height, 18), qty: 1 }));
    (m.rods || []).forEach((_, ri) => pieces.push({ name: `Tringle M${i + 1}-${ri + 1}`, length: toNum(m.width, 0), height: 2, qty: 1, isRod: true }));
  });
  return pieces;
}

export function buildRefinePrompt({ initialResult, draftState, extraNotes }) {
  const cab = initialResult?.cabinet || {};
  const d = draftState || {};
  const dims = d.cabinetDims || {};
  const annotations = Array.isArray(d.facadeItems) ? d.facadeItems : [];
  const modules = Array.isArray(d.moduleDetails) ? d.moduleDetails : [];

  const moduleLines = modules.map((md) => {
    const s = md.shelves?.length || 0;
    const dr = md.drawers?.length || 0;
    const r = md.rods?.length || 0;
    const p = md.doors?.length || 0;
    const sp = md.slidingDoors?.length || 0;
    return `M${md.moduleId}: tablettes=${s}, tiroirs=${dr}, tringles=${r}, portes=${p}, coulissantes=${sp}`;
  });

  const annotationLines = annotations.map((a) => {
    if (a.type === 'dim') return `Cote: ${a.label || 'sans label'} (${toNum(a.x1, 0)},${toNum(a.y1, 0)} -> ${toNum(a.x2, 0)},${toNum(a.y2, 0)})`;
    if (a.type === 'note') return `Note: ${a.label || ''}`;
    return `Repère ${a.type}: ${a.label || ''}`;
  });

  return [
    'Résumé du scan initial:',
    `- width=${cab.width || '?'} height=${cab.height || '?'} depth=${cab.depth || '?'} modules=${Array.isArray(cab.modules) ? cab.modules.length : '?'}`,
    '',
    'Dimensions corrigées utilisateur:',
    `- width=${dims.width || '?'} height=${dims.height || '?'} depth=${dims.depth || '?'} thickness=${dims.thickness || '?'}`,
    '',
    'Contenu modules:',
    ...(moduleLines.length ? moduleLines : ['- aucun module']),
    '',
    'Annotations libres:',
    ...(annotationLines.length ? annotationLines : ['- aucune annotation']),
    '',
    `Notes supplémentaires: ${extraNotes || '(aucune)'}`,
    '',
    'INSTRUCTION: PRIORITÉ aux cotes et annotations. Retourne un JSON complet avec { pieces, cabinet }.',
  ].join('\n');
}

export function validateDraftState(draftState) {
  const critical = [];
  const warnings = [];
  const dims = draftState?.cabinetDims || {};
  const moduleCount = Array.isArray(draftState?.facadeModules) ? draftState.facadeModules.length : 0;
  if (!toNum(dims.width, 0)) critical.push('Largeur absente');
  if (!toNum(dims.height, 0)) critical.push('Hauteur absente');
  if (moduleCount === 0) critical.push('Aucun module');

  const annotations = Array.isArray(draftState?.facadeItems) ? draftState.facadeItems : [];
  if (!annotations.some((a) => a.type === 'dim')) warnings.push('Aucune cote');

  const details = Array.isArray(draftState?.moduleDetails) ? draftState.moduleDetails : [];
  const countObjects = details.reduce((acc, d) => acc + (d.shelves?.length || 0) + (d.drawers?.length || 0) + (d.rods?.length || 0) + (d.doors?.length || 0) + (d.slidingDoors?.length || 0), 0);
  if (!countObjects) warnings.push('Aucun objet métier');
  if (moduleCount > 0 && !details.length) warnings.push('Façade incomplète');

  return { critical, warnings, ok: critical.length === 0 && warnings.length === 0 };
}

export function updateModuleCount(draftState, targetCount) {
  const nextCount = Math.max(1, Math.round(toNum(targetCount, 1)));
  const modules = Array.isArray(draftState.facadeModules) ? [...draftState.facadeModules] : [];
  const details = Array.isArray(draftState.moduleDetails) ? [...draftState.moduleDetails] : [];

  while (modules.length < nextCount) {
    const id = String(modules.length + 1);
    modules.push({ id, x: 0, width: 50, type: 'standard' });
    details.push({ moduleId: id, shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] });
  }
  while (modules.length > nextCount) {
    const removed = modules.pop();
    const idx = details.findIndex((d) => String(d.moduleId) === String(removed?.id));
    if (idx >= 0) details.splice(idx, 1);
  }

  const total = modules.reduce((acc, m) => acc + Math.max(1, toNum(m.width, 1)), 0);
  let c = 0;
  const withPos = modules.map((m, i) => {
    const w = Math.max(1, toNum(m.width, total / modules.length));
    const x = (c / total) * 100;
    c += w;
    return { ...m, id: String(i + 1), x, width: w };
  });
  const withDetails = withPos.map((m) => {
    const ex = details.find((d) => String(d.moduleId) === String(m.id));
    return ex || { moduleId: m.id, shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
  });

  return {
    ...draftState,
    facadeModules: withPos,
    moduleDetails: withDetails,
  };
}

export function toPercentY(y, svgHeight, top, height) {
  return clamp(((y - top) / Math.max(1, height)) * 100, 0, 100);
}

export function fromPercentY(percent, top, height) {
  return top + (clamp(percent, 0, 100) / 100) * height;
}

export function createAnnotation(type, x1, y1, x2, y2, label = '') {
  return { id: uid(), type, x1, y1, x2, y2, label };
}

export function createModuleItem(type, y = 50) {
  if (type === 'shelf') return { id: uid(), y };
  if (type === 'drawer') return { id: uid(), y, height: 18 };
  if (type === 'rod') return { id: uid(), y };
  if (type === 'door') return { id: uid(), kind: 'single' };
  if (type === 'sliding_door') return { id: uid(), kind: 'double' };
  return { id: uid() };
}
