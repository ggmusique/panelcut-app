/**
 * PanelCut Pro — Moteur de découpe v2
 * Compare plusieurs stratégies sans coupe croisée :
 * - bandes en long puis coupes transversales
 * - bandes en large puis coupes transversales
 * avec tolérance stricte ou relâchée pour minimiser la chute.
 * La V1 reste intacte dans src/engine.js et sert de moteur de base.
 */

import { optimise as optimiseLegacy } from './engine';

function bandKey(axis, panelId, depth, origin) {
  return `${axis}:${panelId}:${depth}:${origin}`;
}

function enrichHorizontal(result, toleranceMode) {
  return {
    ...result,
    version: 'v2-bands-horizontal',
    panels: result.panels.map(panel => ({
      ...panel,
      strategy: 'horizontal',
      toleranceMode,
      placed: panel.placed.map(piece => ({
        ...piece,
        panelId: panel.panelId,
        orientation: 'horizontal',
        bandAxis: 'horizontal',
        bandX: piece.x || 0,
        bandXCm: ((piece.x || 0) / 10).toFixed(1),
        bandKey: bandKey('H', panel.panelId, piece.depth || 0, piece.bandY || 0),
      })),
      cuts: panel.cuts.map(cut => ({
        ...cut,
        orientation: cut.orientation || 'horizontal',
        bandAxis: 'horizontal',
        bandX: cut.type === 'piece' ? (cut.x || 0) : 0,
        bandXCm: (((cut.type === 'piece' ? cut.x : 0) || 0) / 10).toFixed(1),
        bandKey: bandKey('H', panel.panelId, cut.depth || 0, cut.bandY || 0),
      })),
    })),
  };
}

function rotatePlacedPiece(piece, panelId) {
  const x = piece.bandY || 0;
  const y = piece.x || 0;
  const l = piece.h;
  const h = piece.l;
  const depth = piece.depth || 0;

  return {
    ...piece,
    panelId,
    x,
    xCm: (x / 10).toFixed(1),
    bandY: y,
    bandYCm: (y / 10).toFixed(1),
    bandX: x,
    bandXCm: (x / 10).toFixed(1),
    l,
    lCm: (l / 10).toFixed(1),
    h,
    hCm: (h / 10).toFixed(1),
    orientation: 'vertical',
    bandAxis: 'vertical',
    bandKey: bandKey('V', panelId, depth, x),
  };
}

function rotateCut(cut, panelId) {
  const depth = cut.depth || 0;

  if (cut.type === 'bande') {
    const bandX = cut.bandY || 0;
    return {
      ...cut,
      panelId,
      orientation: 'vertical',
      bandAxis: 'vertical',
      bandX,
      bandXCm: (bandX / 10).toFixed(1),
      bandY: 0,
      bandYCm: '0.0',
      bandKey: bandKey('V', panelId, depth, bandX),
    };
  }

  return {
    ...cut,
    ...rotatePlacedPiece(cut, panelId),
    type: 'piece',
  };
}

function enrichVertical(result, toleranceMode) {
  return {
    ...result,
    version: 'v2-bands-vertical',
    panels: result.panels.map(panel => ({
      ...panel,
      strategy: 'vertical',
      toleranceMode,
      placed: panel.placed.map(piece => rotatePlacedPiece(piece, panel.panelId)),
      cuts: panel.cuts.map(cut => rotateCut(cut, panel.panelId)),
    })),
  };
}

function rotateInputs(pieces, panel) {
  return {
    pieces: pieces.map(piece => ({
      ...piece,
      length: piece.height,
      height: piece.length,
    })),
    panel: {
      ...panel,
      w: panel.h,
      h: panel.w,
    },
  };
}

function relaxedTolerance(panel) {
  return 50;
}

function getMetrics(result) {
  const usedArea = result.panels.reduce((sum, panel) => sum + panel.usedArea, 0);
  const placedPieces = result.panels.reduce((sum, panel) => sum + panel.placed.length, 0);
  const totalPanels = result.panels.length;
  const utilization = Number(result.summary?.utilizationPct || 0);
  const waste = Number(result.summary?.wastePct || 0);

  return { usedArea, placedPieces, totalPanels, utilization, waste };
}

function pickBestResult(results) {
  return results.reduce((best, current) => {
    if (!best) return current;

    const a = getMetrics(best);
    const b = getMetrics(current);

    if (a.placedPieces !== b.placedPieces) {
      return a.placedPieces > b.placedPieces ? best : current;
    }

    if (a.totalPanels !== b.totalPanels) {
      return a.totalPanels < b.totalPanels ? best : current;
    }

    if (a.usedArea !== b.usedArea) {
      return a.usedArea > b.usedArea ? best : current;
    }

    if (a.utilization !== b.utilization) {
      return a.utilization > b.utilization ? best : current;
    }

    if (a.waste !== b.waste) {
      return a.waste < b.waste ? best : current;
    }

    return best;
  }, null);
}

export function optimise(pieces, panel, opts = {}) {
  const relaxedOpts = { ...opts, tolerance: relaxedTolerance(panel) };
  const rotatedInput = rotateInputs(pieces, panel);

  const horizontalStrict = enrichHorizontal(optimiseLegacy(pieces, panel, opts), 'strict');
  const horizontalRelaxed = enrichHorizontal(optimiseLegacy(pieces, panel, relaxedOpts), 'relaxed');
  const verticalStrict = enrichVertical(optimiseLegacy(rotatedInput.pieces, rotatedInput.panel, opts), 'strict');
  const verticalRelaxed = enrichVertical(optimiseLegacy(rotatedInput.pieces, rotatedInput.panel, relaxedOpts), 'relaxed');

  const allStrategies = [horizontalStrict, horizontalRelaxed, verticalStrict, verticalRelaxed];
  const best = pickBestResult(allStrategies);

  return {
    ...best,
    version: 'v2-bands-bidirectional',
    comparedStrategies: {
      horizontalStrict: {
        totalPanels: horizontalStrict.summary.totalPanels,
        utilizationPct: horizontalStrict.summary.utilizationPct,
      },
      horizontalRelaxed: {
        totalPanels: horizontalRelaxed.summary.totalPanels,
        utilizationPct: horizontalRelaxed.summary.utilizationPct,
      },
      verticalStrict: {
        totalPanels: verticalStrict.summary.totalPanels,
        utilizationPct: verticalStrict.summary.utilizationPct,
      },
      verticalRelaxed: {
        totalPanels: verticalRelaxed.summary.totalPanels,
        utilizationPct: verticalRelaxed.summary.utilizationPct,
      },
      selected: `${best.panels[0]?.strategy || 'horizontal'}-${best.panels[0]?.toleranceMode || 'strict'}`,
    },
  };
}