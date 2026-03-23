/**
 * PanelCut Pro — Moteur de découpe v2
 * Compare deux stratégies sans coupe croisée :
 * - bandes en long puis coupes transversales
 * - bandes en large puis coupes transversales
 * La V1 reste intacte dans src/engine.js et sert de moteur de base.
 */

import { optimise as optimiseLegacy } from './engine';

function bandKey(axis, panelId, depth, origin) {
  return `${axis}:${panelId}:${depth}:${origin}`;
}

function enrichHorizontal(result) {
  return {
    ...result,
    version: 'v2-bands-horizontal',
    panels: result.panels.map(panel => ({
      ...panel,
      strategy: 'horizontal',
      placed: panel.placed.map(piece => ({
        ...piece,
        panelId: panel.panelId,
        orientation: 'horizontal',
        bandAxis: 'horizontal',
        bandX: piece.x || 0,
        bandXCm: ((piece.x || 0) / 10).toFixed(1),
        bandKey: bandKey('H', panel.panelId, piece.depth || 0, piece.bandY || 0),
      })),
      cuts: panel.cuts.map(cut => {
        const origin = cut.type === 'bande' ? (cut.bandY || 0) : (cut.bandY || 0);
        return {
          ...cut,
          orientation: 'horizontal',
          bandAxis: 'horizontal',
          bandX: cut.type === 'piece' ? (cut.x || 0) : 0,
          bandXCm: (((cut.type === 'piece' ? cut.x : 0) || 0) / 10).toFixed(1),
          bandKey: bandKey('H', panel.panelId, cut.depth || 0, origin),
        };
      }),
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

  const rotated = rotatePlacedPiece(cut, panelId);
  return {
    ...cut,
    ...rotated,
    type: 'piece',
  };
}

function enrichVertical(result) {
  return {
    ...result,
    version: 'v2-bands-vertical',
    panels: result.panels.map(panel => ({
      ...panel,
      strategy: 'vertical',
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

function getMetrics(result) {
  const usedArea = result.panels.reduce((sum, panel) => sum + panel.usedArea, 0);
  const placedPieces = result.panels.reduce((sum, panel) => sum + panel.placed.length, 0);
  const totalPanels = result.panels.length;
  const utilization = Number(result.summary?.utilizationPct || 0);

  return { usedArea, placedPieces, totalPanels, utilization };
}

function pickBestResult(horizontal, vertical) {
  const a = getMetrics(horizontal);
  const b = getMetrics(vertical);

  if (a.placedPieces !== b.placedPieces) {
    return a.placedPieces > b.placedPieces ? horizontal : vertical;
  }

  if (a.totalPanels !== b.totalPanels) {
    return a.totalPanels < b.totalPanels ? horizontal : vertical;
  }

  if (a.usedArea !== b.usedArea) {
    return a.usedArea > b.usedArea ? horizontal : vertical;
  }

  if (a.utilization !== b.utilization) {
    return a.utilization > b.utilization ? horizontal : vertical;
  }

  return horizontal;
}

export function optimise(pieces, panel, opts = {}) {
  const horizontal = enrichHorizontal(optimiseLegacy(pieces, panel, opts));
  const rotatedInput = rotateInputs(pieces, panel);
  const vertical = enrichVertical(optimiseLegacy(rotatedInput.pieces, rotatedInput.panel, opts));
  const best = pickBestResult(horizontal, vertical);

  return {
    ...best,
    version: 'v2-bands-bidirectional',
    comparedStrategies: {
      horizontal: {
        totalPanels: horizontal.summary.totalPanels,
        utilizationPct: horizontal.summary.utilizationPct,
      },
      vertical: {
        totalPanels: vertical.summary.totalPanels,
        utilizationPct: vertical.summary.utilizationPct,
      },
      selected: best.panels[0]?.strategy || 'horizontal',
    },
  };
}
