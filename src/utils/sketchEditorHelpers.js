import { normalizeCabinetModules } from './normalizeCabinetModules';
import { uid, defaultDrawerParts } from './sketchEditorConstants';

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export function normalizeModulesFromResult(result, width = 0) {
  const cabinet = result?.cabinet || {};
  const hasRealModules = Array.isArray(cabinet.modules) && cabinet.modules.length > 0;
  if (!hasRealModules) {
    const n  = Math.max(1, parseInt(cabinet.nb_dividers ?? 4, 10) + 1);
    const mw = width > 0 ? width / n : 50;
    return Array.from({ length: n }, () => ({
      id: uid(), width: mw, drawers: 0, doors: 0, slidingDoors: 0,
    }));
  }
  return normalizeCabinetModules(cabinet).map(m => ({
    id: uid(),
    width: m.width,
    drawers: m.drawers,
    doors: m.doors,
    slidingDoors: m.slidingDoors,
  }));
}

export function normalizeItemsFromResult(result) {
  const cabinet = result?.cabinet || {};
  const modules = normalizeCabinetModules(cabinet);
  const items = [];
  modules.forEach((m, modIdx) => {
    for (let si = 0; si < m.shelves; si++) {
      items.push({ id: uid(), type: 'shelf', modIdx, yRatio: (si + 1) / (m.shelves + 1) });
    }
    if (m.rod) {
      items.push({ id: uid(), type: 'rod', modIdx, yRatio: 0.32 });
    }
  });
  return items;
}

/**
 * Construit le prompt texte envoyé à Claude lors d'un re-scan.
 */
export function buildSketchContextPrompt({
  elements,
  dimensionsFromWizard,
  cabinetDims,
  thickness,
  joints,
  totalJointsWidth,
  totalInteriorWidth,
  facadeModules,
  facadeItems,
  moduleDetails,
  generalNotes,
  globalSliding,
}) {
  const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;
  const dims  = elements.filter(e => e.type === 'dim');
  const notes = elements.filter(e => e.type === 'note');
  let ctx = '';
  if (dimensionsFromWizard && cabinetDims.width > 0)
    ctx += `DIMENSIONS IMPOSÉES :\n  width:${cabinetDims.width} cm  height:${cabinetDims.height} cm  plinth:${cabinetDims.plinth} cm\n\n`;
  ctx += `MONTANTS (ép. panneau=${thickness} cm) :\n`;
  joints.forEach((d, i) => ctx += `  M${i+1}|M${i+2}: ${d?'⬛⬛ DOUBLE':'▪️ simple'} → ${jointThickness(d,thickness).toFixed(1)} cm\n`);
  const nD = joints.filter(Boolean).length;
  ctx += `  Total joints=${totalJointsWidth.toFixed(1)} cm (${nD} double, ${joints.length-nD} simple)  Net=${totalInteriorWidth.toFixed(1)} cm\n\n`;
  ctx += 'MODULES (façade éditée par l\'utilisateur) :\n';
  facadeModules.forEach((m, i) => {
    const items    = facadeItems.filter(it => Number(it.modIdx) === i);
    const nbShelf  = items.filter(it => it.type === 'shelf').length;
    const nbRod    = items.filter(it => it.type === 'rod').length;
    const nbDrawers = typeof m.drawers === 'number' ? m.drawers : 0;
    const nbDoors   = typeof m.doors   === 'number' ? m.doors   : 0;
    const det = moduleDetails[i] || { hasBack: true, drawerParts: defaultDrawerParts() };
    const dp = { ...defaultDrawerParts(), ...(det.drawerParts || {}) };
    ctx += `  M${i+1}: L=${m.width.toFixed(2)}cm  tiroirs=${nbDrawers}  tablettes=${nbShelf}  tringles=${nbRod}  portes=${nbDoors}  coulissantes=${det.slidingDoors || 0}  fond=${det.hasBack ? 'oui' : 'non'}\n`;
    if (nbDrawers > 0) {
      const hList = Array.isArray(det.drawerHeights) ? det.drawerHeights.map(v => Math.max(5, toNum(v, 18))) : [];
      ctx += `      hauteurs_tiroirs_cm=${hList.join(',') || 'auto'}\n`;
      ctx += `      tiroir: facade=${dp.front ? 'oui' : 'non'} arriere=${dp.back ? 'oui' : 'non'} coteG=${dp.left ? 'oui' : 'non'} coteD=${dp.right ? 'oui' : 'non'} fond=${dp.bottom ? 'oui' : 'non'}\n`;
    }
  });
  if (dims.length > 0) { ctx += 'COTES :\n'; dims.forEach(d => { if(d.label) ctx += `  ${d.label} cm\n`; }); }
  if (notes.length > 0) { ctx += 'NOTES :\n'; notes.forEach((n,i) => ctx += `  ${i+1}. "${n.text}"\n`); }
  if (generalNotes.trim()) ctx += `NOTES GÉNÉRALES : ${generalNotes.trim()}\n`;
  if (globalSliding.enabled) {
    ctx += `PORTES COULISSANTES GLOBALES: oui (vantaux=${globalSliding.count}, hauteur=${globalSliding.heightCm} cm)\n`;
  }
  ctx += `\nCOTES MEUBLE: L=${cabinetDims.width} H=${cabinetDims.height} plinthe=${cabinetDims.plinth} cm\n`;
  ctx += `INSTRUCTION: Tiens compte des doubles montants pour les largeurs nettes.`;
  return ctx;
}
