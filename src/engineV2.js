/**
 * PanelCut Pro — Moteur de découpe v2
 * Découpe stricte en bandes pleine largeur (long puis large)
 * La V1 reste intacte dans src/engine.js
 */

const DEFAULT_KERF = 3;
const cm = v => Math.round(v * 10);

function expandPieces(pieces) {
  let id = 1;
  const all = [];

  for (const p of pieces) {
    for (let i = 0; i < (p.qty || 1); i++) {
      all.push({
        id: id++,
        name: p.name,
        length: cm(p.length),
        height: cm(p.height),
      });
    }
  }

  return all;
}

function getOrientations(piece, panelW, panelH) {
  const orientations = [];

  if (piece.length <= panelW && piece.height <= panelH) {
    orientations.push({ ...piece, l: piece.length, h: piece.height, rotated: false });
  }

  if (
    piece.height <= panelW &&
    piece.length <= panelH &&
    (piece.height !== piece.length || orientations.length === 0)
  ) {
    orientations.push({ ...piece, l: piece.height, h: piece.length, rotated: true });
  }

  return orientations;
}

function getCandidateBandHeights(pieces, panelW, availableH) {
  const heights = new Set();

  for (const piece of pieces) {
    for (const o of getOrientations(piece, panelW, availableH)) {
      if (o.h <= availableH) heights.add(o.h);
    }
  }

  return [...heights].sort((a, b) => b - a);
}

function selectBandPieces(pieces, panelW, availableH, kerf, tol) {
  const widthCap = Math.max(panelW - kerf, 0);
  if (!pieces.length || availableH <= 0 || widthCap <= 0) return null;

  const candidateHeights = getCandidateBandHeights(pieces, panelW, availableH);
  let best = null;

  for (const bandH of candidateHeights) {
    const choicesByPiece = pieces
      .map(piece => {
        const choices = getOrientations(piece, panelW, availableH)
          .filter(o => o.h <= bandH && bandH - o.h <= tol && o.l <= widthCap)
          .map(o => ({
            id: piece.id,
            name: piece.name,
            l: o.l,
            h: o.h,
            rotated: o.rotated,
            value: o.l * o.h,
            slack: (bandH - o.h) * o.l,
          }));

        return choices.length ? { pieceId: piece.id, choices } : null;
      })
      .filter(Boolean);

    if (!choicesByPiece.length) continue;

    const dp = new Int32Array(widthCap + 1);
    const prevCap = new Int32Array(widthCap + 1);
    const prevTake = new Int32Array(widthCap + 1);
    const prevState = new Int32Array(widthCap + 1);

    prevCap.fill(-1);
    prevTake.fill(-1);
    prevState.fill(-1);

    for (let i = 0; i < choicesByPiece.length; i++) {
      const next = dp.slice();
      const nextCap = prevCap.slice();
      const nextTake = prevTake.slice();
      const nextState = prevState.slice();

      for (let cap = 0; cap <= widthCap; cap++) {
        if (cap > 0 && dp[cap] === 0 && prevCap[cap] === -1) continue;

        for (let ci = 0; ci < choicesByPiece[i].choices.length; ci++) {
          const choice = choicesByPiece[i].choices[ci];
          const weight = choice.l + kerf;
          if (cap + weight > widthCap) continue;

          const nextValue = dp[cap] + choice.value;
          if (nextValue > next[cap + weight]) {
            next[cap + weight] = nextValue;
            nextCap[cap + weight] = cap;
            nextTake[cap + weight] = i;
            nextState[cap + weight] = ci;
          }
        }
      }

      dp.set(next);
      prevCap.set(nextCap);
      prevTake.set(nextTake);
      prevState.set(nextState);
    }

    let bestCap = 0;
    for (let cap = 1; cap <= widthCap; cap++) {
      if (dp[cap] > dp[bestCap]) bestCap = cap;
    }

    if (dp[bestCap] === 0) continue;

    const selected = [];
    let cap = bestCap;

    while (cap > 0 && prevTake[cap] >= 0) {
      const pieceIdx = prevTake[cap];
      const choiceIdx = prevState[cap];
      selected.push(choicesByPiece[pieceIdx].choices[choiceIdx]);
      cap = prevCap[cap];
    }

    selected.reverse();

    const usedArea = selected.reduce((sum, choice) => sum + choice.value, 0);
    const usedWidth = selected.reduce((sum, choice) => sum + choice.l, 0);
    const slackArea = selected.reduce((sum, choice) => sum + choice.slack, 0);
    const bandArea = panelW * bandH;
    const wasteArea = bandArea - usedArea;
    const utilization = bandArea ? usedArea / bandArea : 0;
    const tallestPlaced = selected.reduce((max, choice) => Math.max(max, choice.h), 0);

    const candidate = {
      bandH,
      selected,
      usedArea,
      usedWidth,
      slackArea,
      wasteArea,
      utilization,
      tallestPlaced,
      score: utilization * 100000 + usedArea - slackArea * 0.25 + tallestPlaced * 10,
    };

    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function cutPanelInBands(rect, pieces, kerf, tol, panelId) {
  const { W, H } = rect;
  const placed = [];
  const cuts = [];
  let remaining = [...pieces];
  let usedH = 0;
  let bandIndex = 0;

  while (remaining.length > 0) {
    const availableH = H - usedH;
    if (availableH <= 0) break;

    const band = selectBandPieces(remaining, W, availableH, kerf, tol);
    if (!band || !band.selected.length) break;

    bandIndex += 1;
    const bandY = usedH;
    const cutPos = bandY + band.bandH;

    cuts.push({
      type: 'bande',
      cutNum: bandIndex,
      pos: cutPos,
      posCm: (cutPos / 10).toFixed(1),
      bandH: band.bandH,
      bandHCm: (band.bandH / 10).toFixed(1),
      bandY,
      bandYCm: (bandY / 10).toFixed(1),
      panelId,
      depth: 0,
      fullWidth: true,
    });

    let x = 0;
    const placedIds = new Set();

    for (const choice of band.selected) {
      const piecePlacement = {
        id: choice.id,
        name: choice.name,
        l: choice.l,
        lCm: (choice.l / 10).toFixed(1),
        h: choice.h,
        hCm: (choice.h / 10).toFixed(1),
        bandH: band.bandH,
        bandHCm: (band.bandH / 10).toFixed(1),
        bandY,
        bandYCm: (bandY / 10).toFixed(1),
        x,
        xCm: (x / 10).toFixed(1),
        rotated: choice.rotated,
        redeligne: choice.h < band.bandH
          ? { fromCm: (band.bandH / 10).toFixed(1), toCm: (choice.h / 10).toFixed(1) }
          : null,
        panelId,
        depth: 0,
      };

      placed.push(piecePlacement);
      cuts.push({ type: 'piece', ...piecePlacement });
      placedIds.add(choice.id);
      x += choice.l + kerf;
    }

    remaining = remaining.filter(piece => !placedIds.has(piece.id));
    usedH += band.bandH + kerf;
  }

  return { placed, cuts, remaining };
}

export function optimise(pieces, panel, opts = {}) {
  const kerf = opts.kerf ?? DEFAULT_KERF;
  const tol = opts.tolerance ?? cm(1);
  const W = cm(panel.w);
  const H = cm(panel.h);
  const panelArea = W * H;

  const allPieces = expandPieces(pieces);
  let remaining = [...allPieces];
  let panelId = 1;
  let totalPlacedArea = 0;
  let totalWaste = 0;
  const panels = [];

  while (remaining.length > 0) {
    const result = cutPanelInBands({ W, H }, remaining, kerf, tol, panelId);
    if (!result.placed.length) break;

    const usedArea = result.placed.reduce((sum, piece) => sum + piece.l * piece.h, 0);
    const wasteArea = panelArea - usedArea;

    totalPlacedArea += usedArea;
    totalWaste += wasteArea;

    panels.push({
      panelId,
      placed: result.placed,
      cuts: result.cuts,
      usedArea,
      wasteArea,
      utilizationPct: ((usedArea / panelArea) * 100).toFixed(1),
      wastePct: ((wasteArea / panelArea) * 100).toFixed(1),
    });

    const placedIds = new Set(result.placed.map(piece => piece.id));
    remaining = remaining.filter(piece => !placedIds.has(piece.id));
    panelId += 1;
  }

  const totalArea = panels.length * panelArea;

  return {
    version: 'v2-bands',
    panels,
    unplaced: remaining,
    summary: {
      totalPanels: panels.length,
      totalPieces: allPieces.length,
      placedPieces: allPieces.length - remaining.length,
      unplacedPieces: remaining.length,
      utilizationPct: totalArea ? ((totalPlacedArea / totalArea) * 100).toFixed(1) : '0',
      wastePct: totalArea ? ((totalWaste / totalArea) * 100).toFixed(1) : '0',
    },
  };
}
