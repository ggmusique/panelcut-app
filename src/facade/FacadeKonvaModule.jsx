import React, { useCallback } from 'react';
import { Group, Rect, Line, Circle, Text } from 'react-konva';
import {
  WOOD_STROKE,
  SHELF_FILL,
  SHELF_STROKE,
  ROD_STROKE,
  DRAWER_FILL,
  DRAWER_STROKE,
  HANDLE_FILL,
  HANDLE_STROKE,
  DOOR_FILL,
  DOOR_STROKE,
  SELECTION_COLOR,
  DIM_COLOR,
} from './konvaTheme';

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
 */
export default function FacadeKonvaModule({
  moduleRect,
  module,
  moduleDetail,
  facadeItems = [],
  isSelected = false,
  activeTool = 'select',
  onSelect,
  onResizeStart,
  onAddElement,
  onRemoveElement,
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
  const nbDoors   = toNum(mod.doors,        toNum(module?.doors,        0));
  const nbSliding = toNum(mod.slidingDoors, toNum(module?.slidingDoors, 0));

  // ── Drawers (tiroirs) ───────────────────────────────────────────────────────
  //
  // When moduleDetail.drawerItems has cm positions we distribute proportionally.
  // Otherwise we fall back to evenly spaced items from the bottom.
  const rawDrawerItems = Array.isArray(mod.drawerItems) && mod.drawerItems.length > 0
    ? mod.drawerItems
    : null;
  const drawerCount = rawDrawerItems
    ? rawDrawerItems.length
    : toNum(mod.drawers, toNum(module?.drawers, 0));

  // Build pixel rects for each drawer { top, height }
  const drawerRects = (() => {
    if (drawerCount === 0) return [];
    if (rawDrawerItems) {
      // Proportional layout: each item's height relative to total cm height
      const totalH = rawDrawerItems.reduce((s, d) => s + toNum(d.h ?? d.height, 18), 0) || 1;
      let cursor = intBottom;
      // Items are stored bottom→top by y ascending; reverse to draw bottom→top
      return [...rawDrawerItems]
        .sort((a, b) => toNum(a.y) - toNum(b.y))
        .map((d) => {
          const hCm   = toNum(d.h ?? d.height, 18);
          const hPx   = Math.max(10, (hCm / totalH) * iH);
          const top   = cursor - hPx;
          cursor      = top;
          return { top, height: hPx };
        });
    }
    // Even distribution from bottom
    const evenH = iH / drawerCount;
    return Array.from({ length: drawerCount }, (_, di) => ({
      top:    intBottom - evenH * (di + 1),
      height: evenH,
    }));
  })();

  const drawerElems = drawerRects.map(({ top, height: dh }, di) => (
    <Group
      key={`drawer-${di}`}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isErase) onRemoveElement?.('drawer', null);
      }}
    >
      {/* Panel */}
      <Rect
        x={intLeft + 2} y={top + 2}
        width={iW - 4} height={Math.max(4, dh - 4)}
        fill={DRAWER_FILL} stroke={DRAWER_STROKE} strokeWidth={1} cornerRadius={1}
      />
      {/* Handle bar */}
      <Rect
        x={intLeft + iW / 2 - 14} y={top + dh / 2 - 3.5}
        width={28} height={7}
        fill={HANDLE_FILL} stroke={HANDLE_STROKE} strokeWidth={0.8} cornerRadius={3}
      />
      {/* Handle knob */}
      <Circle
        x={intLeft + iW / 2} y={top + dh / 2}
        radius={3} fill="#6b7280"
      />
      {/* Erase overlay */}
      {isErase && (
        <Rect
          x={intLeft + 2} y={top + 2}
          width={iW - 4} height={Math.max(4, dh - 4)}
          fill="red" opacity={0.18} cornerRadius={1}
        />
      )}
    </Group>
  ));

  // ── Hinged doors (portes battantes) ─────────────────────────────────────────
  const nd = Math.min(nbDoors, 2);
  const doorElems = nd > 0 && nbSliding === 0
    ? Array.from({ length: nd }, (_, di) => {
        const dw  = nd === 2 ? iW / 2 : iW;
        const dx  = nd === 2 && di === 1 ? intLeft + iW / 2 : intLeft;
        const pad = Math.max(8, dw * 0.08);
        // Handle on opening edge
        const hx  = di === 0 ? dx + dw - 14 : dx + 10;
        return (
          <Group
            key={`door-${di}`}
            onClick={(e) => {
              e.cancelBubble = true;
              if (isErase) onRemoveElement?.('door', null);
            }}
          >
            {/* Door panel */}
            <Rect
              x={dx + 2} y={intTop + 2}
              width={dw - 4} height={iH - 4}
              fill={DOOR_FILL} stroke={DOOR_STROKE} strokeWidth={1.5} cornerRadius={1}
            />
            {/* Inner frame */}
            <Rect
              x={dx + pad} y={intTop + pad}
              width={dw - 2 * pad} height={iH - 2 * pad}
              fill="transparent" stroke={DOOR_STROKE} strokeWidth={0.8} opacity={0.5}
            />
            {/* Handle */}
            <Rect
              x={hx - 4} y={intTop + iH / 2 - 10}
              width={8} height={20}
              fill={HANDLE_FILL} stroke={HANDLE_STROKE} strokeWidth={0.8} cornerRadius={3}
            />
            {/* Erase overlay */}
            {isErase && (
              <Rect
                x={dx + 2} y={intTop + 2}
                width={dw - 4} height={iH - 4}
                fill="red" opacity={0.15} cornerRadius={1}
              />
            )}
          </Group>
        );
      })
    : [];

  // ── Sliding doors (portes coulissantes) ──────────────────────────────────────
  const slidingElem = nbSliding > 0 ? (
    <Group
      key="sliding"
      onClick={(e) => {
        e.cancelBubble = true;
        if (isErase) onRemoveElement?.('sliding', null);
      }}
    >
      {/* Outer frame */}
      <Rect
        x={intLeft + 3} y={intTop + 3}
        width={iW - 6} height={iH - 6}
        fill="transparent" stroke="#60a5fa" strokeWidth={1.3} cornerRadius={1}
      />
      {/* Top rail */}
      <Line
        points={[intLeft + 6, intTop + 8, intLeft + iW - 6, intTop + 8]}
        stroke="#60a5fa" strokeWidth={1.5}
      />
      {/* Bottom rail */}
      <Line
        points={[intLeft + 6, intBottom - 8, intLeft + iW - 6, intBottom - 8]}
        stroke="#60a5fa" strokeWidth={1.5}
      />
      {/* Left panel */}
      <Rect
        x={intLeft + 6} y={intTop + 12}
        width={iW * 0.52} height={iH - 24}
        fill="rgba(147,197,253,0.15)" stroke="#60a5fa" strokeWidth={1}
      />
      {/* Right panel (overlapping) */}
      <Rect
        x={intLeft + iW * 0.42 - 6} y={intTop + 12}
        width={iW * 0.52} height={iH - 24}
        fill="rgba(147,197,253,0.22)" stroke="#3b82f6" strokeWidth={1}
      />
      {/* Erase overlay */}
      {isErase && (
        <Rect
          x={intLeft + 3} y={intTop + 3}
          width={iW - 6} height={iH - 6}
          fill="red" opacity={0.15} cornerRadius={1}
        />
      )}
    </Group>
  ) : null;

  // ── Shelves & rods from facadeItems ──────────────────────────────────────────
  const itemElems = facadeItems.map((item) => {
    const ey = intTop + toNum(item.yRatio, 0.5) * iH;

    if (item.type === 'shelf') {
      return (
        <Group
          key={item.id}
          onClick={(e) => {
            e.cancelBubble = true;
            if (isErase) onRemoveElement?.('item', item.id);
          }}
        >
          {/* Shelf plank */}
          <Rect
            x={intLeft} y={ey - 3.5}
            width={iW} height={6.5}
            fill={SHELF_FILL} stroke={SHELF_STROKE} strokeWidth={1}
          />
          {/* Shelf pins */}
          <Circle x={intLeft + 9}       y={ey} radius={2.5} fill={SHELF_STROKE} />
          <Circle x={intLeft + iW - 9}  y={ey} radius={2.5} fill={SHELF_STROKE} />
          {/* Erase overlay */}
          {isErase && (
            <Rect
              x={intLeft} y={ey - 8}
              width={iW} height={16}
              fill="red" opacity={0.2}
            />
          )}
        </Group>
      );
    }

    if (item.type === 'rod') {
      return (
        <Group
          key={item.id}
          onClick={(e) => {
            e.cancelBubble = true;
            if (isErase) onRemoveElement?.('item', item.id);
          }}
        >
          {/* Left bracket */}
          <Rect
            x={intLeft + 8} y={ey - 10}
            width={7} height={18}
            fill="#6b7280" cornerRadius={2}
          />
          {/* Right bracket */}
          <Rect
            x={intLeft + iW - 15} y={ey - 10}
            width={7} height={18}
            fill="#6b7280" cornerRadius={2}
          />
          {/* Rod body */}
          <Line
            points={[intLeft + 16, ey, intLeft + iW - 15, ey]}
            stroke={ROD_STROKE} strokeWidth={6} lineCap="round"
          />
          {/* Highlight */}
          <Line
            points={[intLeft + 16, ey - 2, intLeft + iW - 15, ey - 2]}
            stroke="#d1d5db" strokeWidth={2} lineCap="round" opacity={0.7}
          />
          {/* Erase overlay */}
          {isErase && (
            <Rect
              x={intLeft + 8} y={ey - 12}
              width={iW - 20} height={24}
              fill="red" opacity={0.18} cornerRadius={4}
            />
          )}
        </Group>
      );
    }

    return null;
  });

  // ── Module number ─────────────────────────────────────────────────────────────
  // Position the number badge in the upper half, leaving room for drawers at bottom
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

      {/* ── Drawers ── */}
      {drawerElems}

      {/* ── Hinged doors ── */}
      {doorElems}

      {/* ── Sliding doors ── */}
      {slidingElem}

      {/* ── Shelves & rods ── */}
      {itemElems}

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

      {/* ── Hit zone for shelf / rod placement (captures click position) ── */}
      {isPlace && (
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

      {/* ── Hit zone for add-element tools (no position needed) ── */}
      {isAdd && (
        <Rect
          x={intLeft} y={intTop}
          width={iW} height={iH}
          fill="transparent"
          onClick={handleGroupClick}
        />
      )}

      {/* ── General click zone (select / erase passthrough) ── */}
      {!isPlace && !isAdd && (
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
