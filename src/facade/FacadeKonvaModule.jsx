import React, { useCallback } from 'react';
import { Group, Rect, Line, Circle, Text } from 'react-konva';
import {
  WOOD_STROKE,
  SELECTION_COLOR,
  DIM_COLOR,
} from './konvaTheme';
import FacadeKonvaItems from './FacadeKonvaItems';

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Renders ONE cabinet module in Konva with all interactions.
 *
 * Props:
 *   moduleRect    — { modIdx, x, y, w, h, intX, intY, intW, intH, widthCm }
 *   module        — facade module { width, drawers, doors, slidingDoors, … }
 *   moduleDetail  — normalized module from normalizeCabinetModules (may be null)
 *   facadeItems   — items (shelves, rods) for this module, each { id, type, yRatio }
 *   isSelected    — boolean
 *   activeTool    — 'select' | 'shelf' | 'rod' | 'erase' | 'drawer' | 'door' | 'sliding'
 *   onSelect      — () => void
 *   onResizeStart — (konvaEvt) => void — called on mousedown on the right resize handle
 *   onAddElement  — (payload) => void  — payload is { type, yRatio? } or just type string
 *   onRemoveElement — (type, id?) => void
 *   onItemMove    — (itemId, newYRatio) => void
 *   onDrawerResize — (modIdx, drawerIdx, newH_lower, newH_upper) => void
 */
export default function FacadeKonvaModule({
  moduleRect,
  module,
  moduleDetail,
  facadeItems = [],
  isSelected = false,
  activeTool = 'select',
  interactionMode = 'navigation',
  onSelect,
  onResizeStart,
  onAddElement,
  onRemoveElement,
  onItemMove,
  onDrawerResize,
}) {
  if (!moduleRect) return null;

  const { modIdx = 0, w, h, intX, intY, intW, intH, widthCm } = moduleRect;

  // Interior bounds
  const intLeft   = toNum(intX, toNum(moduleRect.x, 0));
  const intTop    = toNum(intY, toNum(moduleRect.y, 0));
  const intBottom = intTop + toNum(intH, toNum(h, 0));
  const iW        = toNum(intW, toNum(w, 0));
  const iH        = toNum(intH, toNum(h, 0));

  const isErase = activeTool === 'erase';
  const isPlace = activeTool === 'shelf' || activeTool === 'rod';
  const isAdd   = activeTool === 'drawer' || activeTool === 'door' || activeTool === 'sliding';

  // Merge module data: prefer moduleDetail for rich data, fall back to module
  const mod = moduleDetail || module || {};

  // ── Module number ─────────────────────────────────────────────────────────────
  // Position the number badge in the upper half, leaving room for drawers at bottom.
  // Keep drawerRects computation for badge positioning only.
  const rawDrawerItems = Array.isArray(mod.drawerItems) && mod.drawerItems.length > 0
    ? mod.drawerItems
    : null;
  const drawerCount = rawDrawerItems
    ? rawDrawerItems.length
    : toNum(mod.drawers, toNum(module?.drawers, 0));

  const drawerRects = (() => {
    if (drawerCount === 0) return [];
    if (rawDrawerItems) {
      const totalH = rawDrawerItems.reduce((s, d) => s + toNum(d.h ?? d.height, 18), 0) || 1;
      let cursor = intBottom;
      return [...rawDrawerItems]
        .sort((a, b) => toNum(a.y) - toNum(b.y))
        .map((d) => {
          const hCm = toNum(d.h ?? d.height, 18);
          const hPx = Math.max(10, (hCm / totalH) * iH);
          const top = cursor - hPx;
          cursor    = top;
          return { top, height: hPx };
        });
    }
    const evenH = iH / drawerCount;
    return Array.from({ length: drawerCount }, (_, di) => ({
      top:    intBottom - evenH * (di + 1),
      height: evenH,
    }));
  })();

  const drawerZonePx = drawerRects.length > 0
    ? intBottom - (drawerRects[drawerRects.length - 1]?.top ?? intBottom)
    : 0;
  const freeH = iH - drawerZonePx;
  const numCy = intTop + Math.min(Math.max(30, freeH * 0.45), freeH * 0.7);

  // ── Dimension annotation below module ─────────────────────────────────────────
  const annotY     = intTop + iH + 14;
  const widthLabel = `${toNum(widthCm, 0).toFixed(2)} cm`;

  // ── Resize handle (right edge) ────────────────────────────────────────────────
  const RESIZE_HANDLE_W = 8;

  const handleGroupClick = useCallback((e) => {
    e.cancelBubble = true;
    if (isErase || isPlace) return;
    if (isAdd) {
      onAddElement?.(activeTool);
      return;
    }
    onSelect?.();
  }, [isErase, isPlace, isAdd, activeTool, onSelect, onAddElement]);

  return (
    <Group>
      {/* ── Interior background ── */}
      <Rect
        x={intLeft} y={intTop}
        width={iW} height={iH}
        fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth={0.7}
      />

      {/* ── Selection highlight ── */}
      {isSelected && (
        <Rect
          x={intLeft - 2} y={intTop - 2}
          width={iW + 4} height={iH + 4}
          fill="transparent"
          stroke={SELECTION_COLOR} strokeWidth={2.5}
          dash={[6, 3]}
          listening={false}
        />
      )}

      {/* ── Zone de clic générale rendue AVANT les items pour que les items draggables soient au-dessus en z-order ── */}
      {!isPlace && !isAdd && (
        <Rect
          x={intLeft} y={intTop}
          width={iW} height={iH}
          fill="transparent"
          listening={!isErase}
          onClick={handleGroupClick}
        />
      )}

      {/* ── Interior elements (drawers, doors, shelves, rods, drawer separators) ── */}
      <FacadeKonvaItems
        moduleRect={moduleRect}
        facadeItems={facadeItems}
        module={module}
        moduleDetail={moduleDetail}
        isEraseTool={isErase}
        interactionMode={interactionMode}
        onItemMove={onItemMove}
        onItemRemove={(itemId) => onRemoveElement?.('item', itemId)}
        onRemoveElement={(_mIdx, type, idx) => onRemoveElement?.(type, idx)}
        onDrawerResize={onDrawerResize}
      />

      {/* ── Module number badge ── */}
      <Circle
        x={intLeft + iW / 2} y={numCy}
        radius={20}
        fill="transparent" stroke={DIM_COLOR} strokeWidth={2}
        listening={false}
      />
      <Text
        x={intLeft + iW / 2 - 20} y={numCy - 9}
        width={40} height={18}
        text={String(modIdx + 1)}
        align="center" verticalAlign="middle"
        fill={DIM_COLOR} fontStyle="bold" fontSize={17}
        listening={false}
      />

      {/* ── Width annotation ── */}
      <Line
        points={[intLeft, annotY, intLeft + iW, annotY]}
        stroke="#b45309" strokeWidth={1}
        listening={false}
      />
      <Line
        points={[intLeft, annotY - 4, intLeft, annotY + 4]}
        stroke="#b45309" strokeWidth={1}
        listening={false}
      />
      <Line
        points={[intLeft + iW, annotY - 4, intLeft + iW, annotY + 4]}
        stroke="#b45309" strokeWidth={1}
        listening={false}
      />
      <Text
        x={intLeft} y={annotY + 6}
        width={iW}
        text={widthLabel}
        align="center"
        fill="#b45309" fontStyle="bold" fontSize={11}
        listening={false}
      />

      {/* ── Zone de clic pour placement tablette / tringle (au-dessus — capture la position du clic) ── */}
      {/* En mode 'move', cette zone est désactivée pour ne pas bloquer le drag des items draggables. */}
      {isPlace && interactionMode !== 'move' && (
        <Rect
          x={intLeft} y={intTop}
          width={iW} height={iH}
          fill="transparent"
          onClick={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            const pos   = stage?.getPointerPosition();
            if (!pos) return;
            const yRatio = Math.max(0, Math.min(1, (pos.y - intTop) / iH));
            onAddElement?.({ type: activeTool, yRatio });
          }}
        />
      )}

      {/* ── Zone de clic pour outils d'ajout (au-dessus — pas de position nécessaire) ── */}
      {/* En mode 'move', cette zone est désactivée pour ne pas bloquer le drag des séparateurs de tiroirs. */}
      {isAdd && interactionMode !== 'move' && (
        <Rect
          x={intLeft} y={intTop}
          width={iW} height={iH}
          fill="transparent"
          onClick={handleGroupClick}
        />
      )}

      {/* ── Resize handle (right edge) ── */}
      {onResizeStart && (
        <Rect
          x={intLeft + iW - RESIZE_HANDLE_W / 2}
          y={intTop}
          width={RESIZE_HANDLE_W}
          height={iH}
          fill={SELECTION_COLOR}
          opacity={isSelected ? 0.35 : 0}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'ew-resize';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
          onMouseDown={(e) => {
            e.cancelBubble = true;
            onResizeStart(e);
          }}
        />
      )}
    </Group>
  );
}
