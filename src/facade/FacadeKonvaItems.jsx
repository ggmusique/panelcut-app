import React, { useState } from 'react';
import { Group, Rect, Line, Circle, Ellipse } from 'react-konva';
import {
  WOOD_STROKE,
  SHELF_FILL,
  ROD_STROKE,
  DRAWER_FILL,
  DRAWER_STROKE,
  HANDLE_FILL,
  HANDLE_STROKE,
  DOOR_STROKE,
} from './konvaTheme';

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ── Shelf item (draggable, erasable) ─────────────────────────────────────────

function ShelfItem({ item, intLeft, intTop, intBottom, iW, iH, isEraseTool, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const ey = intTop + toNum(item.yRatio, 0.5) * iH;

  return (
    <Group
      x={0}
      y={ey}
      draggable={!isEraseTool}
      dragBoundFunc={(pos) => ({
        x: 0,
        y: Math.max(intTop, Math.min(intBottom, pos.y)),
      })}
      onDragEnd={(e) => {
        const newY      = e.target.y();
        const newYRatio = Math.max(0, Math.min(1, (newY - intTop) / iH));
        onItemMove?.(item.id, newYRatio);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isEraseTool) onItemRemove?.(item.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shelf plank */}
      <Rect
        x={intLeft} y={-3}
        width={iW} height={7}
        fill={SHELF_FILL} stroke={WOOD_STROKE} strokeWidth={1}
      />
      {/* Left pin */}
      <Circle x={intLeft + 9}      y={0} radius={2.5} fill={WOOD_STROKE} />
      {/* Right pin */}
      <Circle x={intLeft + iW - 9} y={0} radius={2.5} fill={WOOD_STROKE} />
      {/* Erase hover overlay */}
      {isEraseTool && hovered && (
        <Rect
          x={intLeft} y={-8}
          width={iW} height={16}
          fill="red" opacity={0.25}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Rod item (draggable, erasable) ────────────────────────────────────────────

function RodItem({ item, intLeft, intTop, intBottom, iW, iH, isEraseTool, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const ey = intTop + toNum(item.yRatio, 0.5) * iH;

  return (
    <Group
      x={0}
      y={ey}
      draggable={!isEraseTool}
      dragBoundFunc={(pos) => ({
        x: 0,
        y: Math.max(intTop, Math.min(intBottom, pos.y)),
      })}
      onDragEnd={(e) => {
        const newY      = e.target.y();
        const newYRatio = Math.max(0, Math.min(1, (newY - intTop) / iH));
        onItemMove?.(item.id, newYRatio);
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isEraseTool) onItemRemove?.(item.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left bracket */}
      <Rect
        x={intLeft + 8} y={-10}
        width={7} height={18}
        fill="#6b7280" cornerRadius={2}
      />
      {/* Right bracket */}
      <Rect
        x={intLeft + iW - 15} y={-10}
        width={7} height={18}
        fill="#6b7280" cornerRadius={2}
      />
      {/* Rod body */}
      <Line
        points={[intLeft + 16, 0, intLeft + iW - 15, 0]}
        stroke={ROD_STROKE} strokeWidth={6} lineCap="round"
      />
      {/* Highlight */}
      <Line
        points={[intLeft + 16, -2, intLeft + iW - 15, -2]}
        stroke="#d1d5db" strokeWidth={2} lineCap="round" opacity={0.7}
      />
      {/* Erase hover overlay */}
      {isEraseTool && hovered && (
        <Rect
          x={intLeft + 8} y={-12}
          width={iW - 20} height={24}
          fill="red" opacity={0.22} cornerRadius={4}
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Renders interior elements (shelves, rods, drawers, doors) for one cabinet module.
 *
 * Props:
 *   moduleRect      — { modIdx, x, y, w, h, intX, intY, intW, intH, widthCm }
 *   facadeItems     — array of { id, type, modIdx, yRatio } (shelves & rods)
 *   module          — raw facade module { drawers, doors, slidingDoors, … }
 *   moduleDetail    — normalized module (from normalizeCabinetModules), may be null
 *   isEraseTool     — boolean
 *   onItemSelect    — (itemId) => void
 *   onItemMove      — (itemId, newYRatio) => void
 *   onItemRemove    — (itemId) => void   — for shelf / rod items
 *   onRemoveElement — (modIdx, type) => void — for 'drawer' | 'door' | 'sliding'
 */
export default function FacadeKonvaItems({
  moduleRect,
  facadeItems = [],
  module,
  moduleDetail,
  isEraseTool = false,
  onItemSelect,
  onItemMove,
  onItemRemove,
  onRemoveElement,
}) {
  if (!moduleRect) return null;

  const { modIdx = 0, intX, intY, intW, intH, w, h, x, y } = moduleRect;
  const intLeft   = toNum(intX, toNum(x, 0));
  const intTop    = toNum(intY, toNum(y, 0));
  const iW        = toNum(intW, toNum(w, 0));
  const iH        = toNum(intH, toNum(h, 0));
  const intBottom = intTop + iH;

  const mod       = moduleDetail || module || {};
  const nbDoors   = toNum(mod.doors,        toNum(module?.doors,        0));
  const nbSliding = toNum(mod.slidingDoors, toNum(module?.slidingDoors, 0));

  // ── Shelves & rods ───────────────────────────────────────────────────────────

  const moduleItems = facadeItems.filter(
    (item) => item.modIdx === modIdx
  );

  const itemElems = moduleItems.map((item) => {
    if (item.type === 'shelf') {
      return (
        <ShelfItem
          key={item.id}
          item={item}
          intLeft={intLeft}
          intTop={intTop}
          intBottom={intBottom}
          iW={iW}
          iH={iH}
          isEraseTool={isEraseTool}
          onItemMove={onItemMove}
          onItemRemove={onItemRemove}
        />
      );
    }
    if (item.type === 'rod') {
      return (
        <RodItem
          key={item.id}
          item={item}
          intLeft={intLeft}
          intTop={intTop}
          intBottom={intBottom}
          iW={iW}
          iH={iH}
          isEraseTool={isEraseTool}
          onItemMove={onItemMove}
          onItemRemove={onItemRemove}
        />
      );
    }
    return null;
  });

  // ── Drawers ──────────────────────────────────────────────────────────────────

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

  const drawerElems = drawerRects.map(({ top, height: dh }, di) => (
    <Group
      key={`drawer-${modIdx}-${di}`}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isEraseTool) onRemoveElement?.(modIdx, 'drawer');
      }}
    >
      {/* Façade panel */}
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
      <Ellipse
        x={intLeft + iW / 2} y={top + dh / 2}
        radiusX={3.5} radiusY={2.5}
        fill="#6b7280"
      />
      {/* Erase overlay */}
      {isEraseTool && (
        <Rect
          x={intLeft + 2} y={top + 2}
          width={iW - 4} height={Math.max(4, dh - 4)}
          fill="red" opacity={0.18} cornerRadius={1}
          listening={false}
        />
      )}
    </Group>
  ));

  // ── Hinged doors ─────────────────────────────────────────────────────────────

  const nd = Math.min(nbDoors, 2);
  const doorElems = nd > 0 && nbSliding === 0
    ? Array.from({ length: nd }, (_, di) => {
        const dw  = nd === 2 ? iW / 2 : iW;
        const dx  = nd === 2 && di === 1 ? intLeft + iW / 2 : intLeft;
        const pad = Math.max(8, dw * 0.08);
        const hx  = di === 0 ? dx + dw - 14 : dx + 10;
        return (
          <Group
            key={`door-${modIdx}-${di}`}
            onClick={(e) => {
              e.cancelBubble = true;
              if (isEraseTool) onRemoveElement?.(modIdx, 'door');
            }}
          >
            {/* Door panel */}
            <Rect
              x={dx + 2} y={intTop + 2}
              width={dw - 4} height={iH - 4}
              fill="url(#doorGradient)" stroke={DOOR_STROKE} strokeWidth={1.5} cornerRadius={1}
            />
            {/* Inner frame */}
            <Rect
              x={dx + pad} y={intTop + pad}
              width={dw - 2 * pad} height={iH - 2 * pad}
              fill="none" stroke={DOOR_STROKE} strokeWidth={0.8} opacity={0.5}
            />
            {/* Handle */}
            <Rect
              x={hx - 4} y={intTop + iH / 2 - 10}
              width={8} height={20}
              fill="#a0a0a0" stroke="#666" strokeWidth={0.8} cornerRadius={3}
            />
            {/* Erase overlay */}
            {isEraseTool && (
              <Rect
                x={dx + 2} y={intTop + 2}
                width={dw - 4} height={iH - 4}
                fill="red" opacity={0.15} cornerRadius={1}
                listening={false}
              />
            )}
          </Group>
        );
      })
    : [];

  // ── Sliding doors ─────────────────────────────────────────────────────────────

  const slidingElem = nbSliding > 0 ? (
    <Group
      key={`sliding-${modIdx}`}
      onClick={(e) => {
        e.cancelBubble = true;
        if (isEraseTool) onRemoveElement?.(modIdx, 'sliding');
      }}
    >
      {/* Top rail */}
      <Rect
        x={intLeft} y={intTop}
        width={iW} height={2}
        fill="#60a5fa"
      />
      {/* Bottom rail */}
      <Rect
        x={intLeft} y={intBottom - 2}
        width={iW} height={2}
        fill="#60a5fa"
      />
      {/* Panel 1 */}
      <Rect
        x={intLeft + 6} y={intTop + 4}
        width={iW * 0.56} height={iH - 8}
        fill="rgba(147,197,253,0.15)" stroke="#60a5fa" strokeWidth={1}
      />
      {/* Panel 2 */}
      <Rect
        x={intLeft + iW * 0.38} y={intTop + 4}
        width={iW * 0.56} height={iH - 8}
        fill="rgba(147,197,253,0.22)" stroke="#3b82f6" strokeWidth={1}
      />
      {/* Erase overlay */}
      {isEraseTool && (
        <Rect
          x={intLeft} y={intTop}
          width={iW} height={iH}
          fill="red" opacity={0.15}
          listening={false}
        />
      )}
    </Group>
  ) : null;

  return (
    <Group>
      {drawerElems}
      {doorElems}
      {slidingElem}
      {itemElems}
    </Group>
  );
}
