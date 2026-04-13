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

export function normalizeFromInitialResult(initialResult, draft) {
  const cab = initialResult?.cabinet || {};
  const draftState = draft?.state || {};

  const width = toNum(draftState?.cabinetDims?.width, toNum(cab.width, 240));
  const height = toNum(draftState?.cabinetDims?.height, toNum(cab.height, 220));
  const depth = toNum(draftState?.cabinetDims?.depth, toNum(cab.depth, 60));
  const thickness = toNum(draftState?.cabinetDims?.thickness, toNum(cab.thickness ?? cab.panel_thickness, 1.8));

  const sourceModules = Array.isArray(draftState.facadeModules) && draftState.facadeModules.length
    ? draftState.facadeModules
    : (Array.isArray(cab.modules) && cab.modules.length
      ? cab.modules.map((m, i) => ({ id: String(i + 1), width: toNum(m.width, 50), type: 'standard' }))
      : Array.from({ length: Math.max(1, toNum(cab.nb_dividers, 3) + 1) }, (_, i) => ({ id: String(i + 1), width: 50, type: 'standard' })));

  const totalWidth = sourceModules.reduce((acc, m) => acc + Math.max(1, toNum(m.width, 1)), 0);
  let cursor = 0;
  const facadeModules = sourceModules.map((m, idx) => {
    const normalizedWidth = Math.max(1, toNum(m.width, totalWidth / sourceModules.length));
    const x = (cursor / totalWidth) * 100;
    cursor += normalizedWidth;
    return {
      id: String(m.id ?? idx + 1),
      x,
      width: normalizedWidth,
      type: 'standard',
    };
  });

  const moduleDetails = Array.isArray(draftState.moduleDetails) && draftState.moduleDetails.length
    ? draftState.moduleDetails.map((d) => ({
        moduleId: String(d.moduleId),
        shelves: Array.isArray(d.shelves) ? d.shelves : [],
        drawers: Array.isArray(d.drawers) ? d.drawers : [],
        rods: Array.isArray(d.rods) ? d.rods : [],
        doors: Array.isArray(d.doors) ? d.doors : [],
        slidingDoors: Array.isArray(d.slidingDoors) ? d.slidingDoors : [],
      }))
    : facadeModules.map((m, idx) => {
        const src = Array.isArray(cab.modules) ? cab.modules[idx] : null;
        const shelves = Array.isArray(src?.shelves) ? src.shelves.map((s) => ({ id: uid(), y: toNum(s?.y, 50) })) : [];
        const drawers = Array.isArray(src?.drawerItems)
          ? src.drawerItems.map((d) => ({ id: uid(), y: toNum(d?.y, 25), height: toNum(d?.height ?? d?.h, 18) }))
          : [];
        const rods = Array.isArray(src?.rods) ? src.rods.map((r) => ({ id: uid(), y: toNum(r?.y, 60) })) : [];
        const doors = Array.from({ length: Math.max(0, toNum(src?.doors, 0)) }, () => ({ id: uid(), kind: 'single' }));
        const slidingDoors = Array.from({ length: Math.max(0, toNum(src?.slidingDoors, 0)) }, () => ({ id: uid(), kind: 'single' }));
        return { moduleId: m.id, shelves, drawers, rods, doors, slidingDoors };
      });

  const facadeItems = Array.isArray(draftState.facadeItems)
    ? draftState.facadeItems
    : [];

  return {
    cabinetDims: { width, height, depth, thickness },
    facadeModules,
    facadeItems,
    moduleDetails,
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
    const shelves = Array.isArray(detail.shelves) ? detail.shelves.map((s) => ({ y: toNum(s.y, 50) })) : [];
    const shelfPositions = shelves.map((s) => s.y);
    const drawerItems = Array.isArray(detail.drawers)
      ? detail.drawers.map((d) => ({ y: toNum(d.y, 30), height: toNum(d.height, 18) }))
      : [];
    return {
      id: idx + 1,
      width: toNum(m.width, 1),
      shelves,
      shelfPositions,
      drawers: drawerItems.length,
      drawerItems,
      rods: Array.isArray(detail.rods) ? detail.rods.map((r) => ({ y: toNum(r.y, 60) })) : [],
      doors: Array.isArray(detail.doors) ? detail.doors.length : 0,
      slidingDoors: Array.isArray(detail.slidingDoors) ? detail.slidingDoors.length : 0,
    };
  });

  return {
    width: toNum(dims.width, 0),
    height: toNum(dims.height, 0),
    depth: toNum(dims.depth, 60),
    thickness: toNum(dims.thickness, 1.8),
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
