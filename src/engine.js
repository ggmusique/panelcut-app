/**
 * PanelCut Pro — Moteur de découpe v3.0
 * Algorithme guillotine récursif
 */

const DEFAULT_KERF = 3;
const cm = v => Math.round(v * 10);

function knapsack1D(lengths, available, kerf) {
  if (!lengths.length || available <= 0) return [];
  const cap = Math.min(available, 100000);
  const dp   = new Int32Array(cap + 1);
  const prev = new Array(cap + 1).fill(-1);
  const pidx = new Array(cap + 1).fill(-1);

  for (let i = 0; i < lengths.length; i++) {
    const w = lengths[i] + kerf;
    if (w > cap) continue;
    for (let j = cap; j >= w; j--) {
      const v = dp[j - w] + lengths[i];
      if (v > dp[j]) { dp[j] = v; prev[j] = j - w; pidx[j] = i; }
    }
  }

  let best = 0;
  for (let j = 1; j <= cap; j++) if (dp[j] > dp[best]) best = j;

  const sel = [];
  for (let j = best; j > 0 && pidx[j] >= 0;) {
    sel.push(pidx[j]);
    j = prev[j];
  }
  return sel;
}

function groupByH(pieces, tol) {
  const s = [...pieces].sort((a, b) => b.h - a.h);
  const gs = [];
  for (const p of s) {
    const g = gs.find(g => Math.abs(g.bandH - p.h) <= tol);
    if (g) { g.pieces.push(p); g.bandH = Math.max(g.bandH, p.h); }
    else gs.push({ bandH: p.h, pieces: [p] });
  }
  return gs;
}

function cut(rect, pieces, kerf, tol, depth, panelId) {
  if (!pieces.length || depth > 30) return { placed: [], cuts: [], remaining: pieces };
  const { W, H } = rect;

  const allPlaced = [];
  const allCuts   = [];
  let remaining   = [...pieces];
  let usedH       = 0;

  const fit = () => remaining.filter(p => p.h <= H - usedH);

  while (fit().length > 0) {
    const fitting = fit();
    const groups  = groupByH(fitting, tol);

    let bestGroup = null, bestSel = [], bestUtil = -1;
    for (const g of groups) {
      if (g.bandH > H - usedH) continue;
      const sel = knapsack1D(g.pieces.map(p => p.l), W - kerf, kerf);
      if (!sel.length) continue;
      const used = sel.reduce((s, i) => s + g.pieces[i].l, 0);
      if (used > bestUtil) { bestUtil = used; bestGroup = g; bestSel = sel; }
    }

    if (!bestGroup) break;

    const bandH  = bestGroup.bandH;
    const cutPos = usedH + bandH;
    const cutNum = allCuts.filter(c => c.type === 'bande').length + 1;
    const bKey   = `H:${panelId}:${depth}:${usedH}`;

    // Coupe horizontale traversante (toute la largeur du panneau)
    allCuts.push({
      type: 'bande',
      cutNum,
      pos: cutPos,
      posCm: (bandH / 10).toFixed(1), // cote relative = hauteur de la bande (depuis le bord de la chute)
      bandH,
      bandHCm: (bandH / 10).toFixed(1),
      bandY: usedH,
      bandYCm: (usedH / 10).toFixed(1),
      orientation: 'horizontal',
      panelId,
      depth,
      bandKey: bKey,
    });

    const placedIds = new Set();
    let posInBand = 0;
    let prevVPos = 0; // position de la derniere coupe verticale (pour cote relative)

    for (let si = 0; si < bestSel.length; si++) {
      const idx = bestSel[si];
      const p   = bestGroup.pieces[idx];
      const xStart = posInBand;

      if (si > 0) {
        // Cote relative = position actuelle - position de la coupe V precedente - kerf
        const relPos = xStart - prevVPos - kerf;
        allCuts.push({
          type: 'bande',
          cutNum: allCuts.filter(c => c.type === 'bande').length + 1,
          pos: xStart,
          posCm: (relPos / 10).toFixed(1), // cote depuis la derniere coupe (largeur piece precedente)
          bandY: usedH,
          bandYCm: (usedH / 10).toFixed(1),
          bandH,
          bandHCm: (bandH / 10).toFixed(1),
          orientation: 'vertical',
          panelId,
          depth,
          bandKey: bKey,
        });
      }

      allCuts.push({
        type: 'piece',
        id: p.id,
        name: p.name,
        l: p.l, lCm: (p.l / 10).toFixed(1),
        h: p.h, hCm: (p.h / 10).toFixed(1),
        bandH, bandHCm: (bandH / 10).toFixed(1),
        bandY: usedH, bandYCm: (usedH / 10).toFixed(1),
        x: xStart,
        xCm: (xStart / 10).toFixed(1),
        redeligne: p.h < bandH
          ? { fromCm: (bandH / 10).toFixed(1), toCm: (p.h / 10).toFixed(1) }
          : null,
        rotated: p.rotated || false,
        panelId,
        depth,
        bandKey: bKey,
      });

      allPlaced.push({ ...p, bandY: usedH, x: xStart });
      placedIds.add(p.id);

      // Coupe V apres la derniere piece si elle ne va pas jusqu au bord droit
      const isLast = si === bestSel.length - 1;
      const afterEdge = xStart + p.l;
      if (isLast && afterEdge + kerf < W) {
        // Il y a une chute a droite — on ajoute quand meme la coupe pour indiquer la largeur
        const relPos = afterEdge - (prevVPos > 0 ? prevVPos + kerf : 0);
        allCuts.push({
          type: 'bande',
          cutNum: allCuts.filter(c => c.type === 'bande').length + 1,
          pos: afterEdge + kerf,
          posCm: (p.l / 10).toFixed(1), // largeur de la derniere piece
          bandY: usedH,
          bandYCm: (usedH / 10).toFixed(1),
          bandH,
          bandHCm: (bandH / 10).toFixed(1),
          orientation: 'vertical',
          panelId,
          depth,
          bandKey: bKey,
          isLastInBand: true,
        });
      }

      if (posInBand > 0) prevVPos = posInBand; // mise a jour pour la prochaine cote relative
      posInBand += p.l + kerf;
    }

    // Récursion dans la chute longitudinale de la bande
    const bandWasteL = W - kerf - bestUtil - (bestSel.length - 1) * kerf;
    if (bandWasteL >= cm(5)) {
      const subP = remaining.filter(p => !placedIds.has(p.id) && p.h <= bandH);
      if (subP.length > 0) {
        const offsetX = W - bandWasteL;
        const sub = cut({ W: bandWasteL, H: bandH }, subP, kerf, tol, depth + 1, panelId);
        for (const p of sub.placed) {
          placedIds.add(p.id);
          allPlaced.push({ ...p, bandY: usedH, x: p.x + offsetX });
        }
        allCuts.push(...sub.cuts.map(c => ({
          ...c,
          bandY: usedH,
          x: (c.x || 0) + offsetX,
          pos: c.orientation === 'vertical' ? (c.pos || 0) + offsetX : c.pos,
        })));
        remaining = remaining.filter(p => !placedIds.has(p.id));
      }
    }

    remaining = remaining.filter(p => !placedIds.has(p.id));
    usedH += bandH + kerf;
    if (!remaining.length) break;
  }

  // Récursion sur la chute principale
  const wasteH = H - usedH;
  if (remaining.length > 0 && wasteH >= cm(5)) {
    const sub = cut({ W, H: wasteH }, remaining, kerf, tol, depth + 1, panelId);
    allPlaced.push(...sub.placed.map(p => ({ ...p, bandY: p.bandY + usedH })));
    allCuts.push(...sub.cuts.map(c => ({ ...c, bandY: (c.bandY || 0) + usedH, pos: (c.pos || 0) + usedH })));
    remaining = sub.remaining;
  }

  return { placed: allPlaced, cuts: allCuts, remaining };
}

function preparePieces(rawPieces, panelW, panelH, tol) {
  return rawPieces.map(p => {
    const normal  = p.height <= panelH && p.length <= panelW;
    const rotated = p.length  <= panelH && p.height <= panelW;
    if (!normal && !rotated) return null;
    if (normal && rotated)
      return p.height <= p.length
        ? { ...p, l: p.length, h: p.height, rotated: false }
        : { ...p, l: p.height, h: p.length,  rotated: true  };
    if (normal)  return { ...p, l: p.length, h: p.height, rotated: false };
    if (rotated) return { ...p, l: p.height, h: p.length,  rotated: true  };
  }).filter(Boolean);
}

export function optimise(pieces, panel, opts = {}) {
  const kerf = opts.kerf      ?? DEFAULT_KERF;
  const tol  = opts.tolerance ?? cm(1);

  let all = [], id = 1;
  for (const p of pieces)
    for (let i = 0; i < (p.qty || 1); i++)
      all.push({ id: id++, name: p.name, length: cm(p.length), height: cm(p.height) });

  const W = cm(panel.w), H = cm(panel.h);
  const panelArea = W * H;

  const panels  = [];
  let remaining = [...all];
  let panelId   = 1;
  let totalWaste = 0;

  while (remaining.length > 0) {
    const prep   = preparePieces(remaining, W, H, tol);
    const result = cut({ W, H }, prep, kerf, tol, 0, panelId);

    if (!result.placed.length) break;

    const usedArea  = result.placed.reduce((s, p) => s + p.l * p.h, 0);
    const wasteArea = panelArea - usedArea;
    totalWaste += wasteArea;

    panels.push({
      panelId,
      placed:         result.placed,
      cuts:           result.cuts,
      usedArea, wasteArea,
      utilizationPct: ((usedArea / panelArea) * 100).toFixed(1),
      wastePct:       ((wasteArea / panelArea) * 100).toFixed(1),
    });

    const placedIds = new Set(result.placed.map(p => p.id));
    remaining = remaining.filter(p => !placedIds.has(p.id));
    panelId++;
  }

  const totalArea = panels.length * panelArea;
  const totalUsed = all.reduce((s, p) => s + p.length * p.height, 0);

  return {
    panels,
    summary: {
      totalPanels:      panels.length,
      totalPieces:      all.length,
      utilizationPct:   totalArea ? ((totalUsed / totalArea) * 100).toFixed(1) : '0',
      wastePct:         totalArea ? ((totalWaste / totalArea) * 100).toFixed(1) : '0',
    }
  };
}