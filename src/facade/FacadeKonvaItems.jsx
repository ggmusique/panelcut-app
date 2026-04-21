/**
 * FacadeKonvaItems.jsx — Éléments intérieurs d'un module (tablettes, tringles, tiroirs, portes)
 *
 * CORRECTIONS v2 :
 * - Toutes les coordonnées sont absolues et cohérentes (pas de mélange relatif/absolu)
 * - ShelfItem et RodItem : Group à x=0,y=0, Rect/Line avec coordonnées absolues
 * - dragBoundFunc corrigé pour fonctionner avec zoom/pan du Stage
 * - onItemMove réellement appelé et branché sur le state parent
 * - Tiroirs : hauteurs px calculées depuis les vraies hauteurs cm via cmToPx
 */
import React, { useState, useCallback, useRef } from 'react';
import { Group, Rect, Line, Circle, Ellipse, Text } from 'react-konva';
import {
  WOOD_STROKE,
  SHELF_FILL,
  SHELF_STROKE,
  ROD_STROKE,
  DRAWER_FILL,
  DRAWER_STROKE,
  HANDLE_FILL,
  HANDLE_STROKE,
  DOOR_STROKE,
} from './konvaTheme';

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Shared delete cross button ────────────────────────────────────────────────

const DELETE_CROSS_SIZE = 14;
const DELETE_CROSS_COLOR = '#E24B4A';

/**
 * Red circular cross button rendered in Konva.
 * x, y = top-left corner of the button (absolute or relative to parent Group).
 */
function DeleteCross({ x, y, onClick }) {
  return (
    <Group
      onClick={onClick}
      onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'pointer'; }}
      onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
    >
      <Rect x={x} y={y} width={DELETE_CROSS_SIZE} height={DELETE_CROSS_SIZE} cornerRadius={7} fill={DELETE_CROSS_COLOR} />
      <Text x={x} y={y} width={DELETE_CROSS_SIZE} height={DELETE_CROSS_SIZE} text="×" align="center" verticalAlign="middle" fill="white" fontSize={11} fontStyle="bold" listening={false} />
    </Group>
  );
}


function ShelfItem({ item, intLeft, intTop, intBottom, iW, iH, cabInteriorCm, isEraseTool, interactionMode, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const groupRef = useRef(null);

  // Coordonnée Y en espace contenu (content-space)
  const ey = intTop + clamp(toNum(item.yRatio, 0.5), 0, 1) * iH;

  // dragBoundFunc reçoit ET doit retourner des coordonnées ABSOLUES (pixels canvas).
  // Le Group est positionné à content-x = intLeft → on verrouille x à intLeft.
  const dragBoundFunc = useCallback((pos) => {
    const stage  = groupRef.current?.getStage?.();
    const scaleX = stage?.scaleX?.() ?? 1;
    const scaleY = stage?.scaleY?.() ?? 1;
    const stX    = stage?.x?.()     ?? 0;
    const stY    = stage?.y?.()     ?? 0;
    return {
      x: intLeft * scaleX + stX,  // verrouille content-x = intLeft
      y: clamp(pos.y, intTop * scaleY + stY, intBottom * scaleY + stY),
    };
  }, [intLeft, intTop, intBottom]);

  const handleDragMove = useCallback(() => {
    const posY   = groupRef.current?.y() ?? 0;
    const yRatio = clamp((posY - intTop) / Math.max(1, iH), 0, 1);
    const yCm    = Math.round((1 - yRatio) * toNum(cabInteriorCm));
    setDragInfo({ yCm });
  }, [intTop, iH, cabInteriorCm]);

  const handleDragEnd = useCallback((e) => {
    const newY      = e.target.y();
    const newYRatio = clamp((newY - intTop) / Math.max(1, iH), 0, 1);
    // Remet la position Konva à la valeur snappée (avant que React ne re-rende)
    e.target.x(intLeft);
    e.target.y(intTop + newYRatio * iH);
    onItemMove?.(item.id, newYRatio);
    setDragInfo(null);
  }, [intLeft, intTop, iH, item.id, onItemMove]);

  return (
    <Group
      ref={groupRef}
      x={intLeft}
      y={ey}
      draggable={interactionMode === 'move' && !isEraseTool}
      dragBoundFunc={dragBoundFunc}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Planche — coordonnées relatives au Group (x=0 = bord gauche du Group, positionné à intLeft) */}
      <Rect x={0} y={-3.5} width={iW} height={7}
        fill={SHELF_FILL} stroke={SHELF_STROKE} strokeWidth={1} />
      {/* Chevilles */}
      <Circle x={9}       y={0} radius={2.5} fill={SHELF_STROKE} />
      <Circle x={iW - 9}  y={0} radius={2.5} fill={SHELF_STROKE} />
      {/* Zone de hit plus large pour faciliter le drag */}
      <Rect x={0} y={-10} width={iW} height={20}
        fill="transparent"
        onClick={(e) => { if (isEraseTool) { e.cancelBubble = true; onItemRemove?.(item.id); } }}
        onTap={(e) => { if (isEraseTool) { e.cancelBubble = true; onItemRemove?.(item.id); } }}
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = isEraseTool ? 'crosshair' : 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Poignées de drag aux extrémités (ew-resize) */}
      {!isEraseTool && (
        <>
          <Circle x={0} y={0} radius={5} fill="#3b82f6" opacity={0.7}
            onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ew-resize'; }}
            onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
          />
          <Circle x={iW} y={0} radius={5} fill="#3b82f6" opacity={0.7}
            onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ew-resize'; }}
            onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
          />
        </>
      )}
      {/* Highlight hover (mode normal) */}
      {!isEraseTool && hovered && (
        <Rect x={0} y={-5} width={iW} height={10}
          fill="rgba(59,130,246,0.15)" listening={false} />
      )}
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={0} y={-10} width={iW} height={20}
          fill="rgba(226,75,74,0.2)" listening={false} />
      )}
      {/* Delete cross (hover, non-erase mode) */}
      {hovered && !isEraseTool && (
        <DeleteCross x={iW - 16} y={-8} onClick={(e) => { e.cancelBubble = true; onItemRemove?.(item.id); }} />
      )}
      {/* Badge cote live pendant le drag */}
      {!isEraseTool && dragInfo !== null && (
        <Group listening={false}>
          <Line
            points={[0, 0, iW, 0]}
            stroke="#378ADD" strokeWidth={0.8} dash={[4, 3]}
          />
          <Rect
            x={iW + 6} y={-10}
            width={58} height={20}
            fill="#0C447C" cornerRadius={4}
          />
          <Text
            x={iW + 6} y={-4}
            width={58}
            text={`${dragInfo.yCm} cm`}
            align="center"
            fill="#E6F1FB" fontSize={11} fontStyle="bold"
          />
        </Group>
      )}
    </Group>
  );
}

// ── Rod (tringle draggable) ───────────────────────────────────────────────────

function RodItem({ item, intLeft, intTop, intBottom, iW, iH, cabInteriorCm, isEraseTool, interactionMode, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const groupRef = useRef(null);

  const ey = intTop + clamp(toNum(item.yRatio, 0.32), 0, 1) * iH;

  // Même correction que ShelfItem : Group à content-x = intLeft, enfants en relatif.
  const dragBoundFunc = useCallback((pos) => {
    const stage  = groupRef.current?.getStage?.();
    const scaleX = stage?.scaleX?.() ?? 1;
    const scaleY = stage?.scaleY?.() ?? 1;
    const stX    = stage?.x?.()     ?? 0;
    const stY    = stage?.y?.()     ?? 0;
    return {
      x: intLeft * scaleX + stX,  // verrouille content-x = intLeft
      y: clamp(pos.y, intTop * scaleY + stY, intBottom * scaleY + stY),
    };
  }, [intLeft, intTop, intBottom]);

  const handleDragMove = useCallback(() => {
    const posY   = groupRef.current?.y() ?? 0;
    const yRatio = clamp((posY - intTop) / Math.max(1, iH), 0, 1);
    const yCm    = Math.round((1 - yRatio) * toNum(cabInteriorCm));
    setDragInfo({ yCm });
  }, [intTop, iH, cabInteriorCm]);

  const handleDragEnd = useCallback((e) => {
    const newY      = e.target.y();
    const newYRatio = clamp((newY - intTop) / Math.max(1, iH), 0, 1);
    e.target.x(intLeft);
    e.target.y(intTop + newYRatio * iH);
    onItemMove?.(item.id, newYRatio);
    setDragInfo(null);
  }, [intLeft, intTop, iH, item.id, onItemMove]);

  return (
    <Group
      ref={groupRef}
      x={intLeft}
      y={ey}
      draggable={interactionMode === 'move' && !isEraseTool}
      dragBoundFunc={dragBoundFunc}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Support gauche */}
      <Rect x={8} y={-10} width={7} height={18} fill="#6b7280" cornerRadius={2}
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Support droit */}
      <Rect x={iW - 15} y={-10} width={7} height={18} fill="#6b7280" cornerRadius={2}
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Barre principale */}
      <Line points={[16, 0, iW - 15, 0]}
        stroke={ROD_STROKE} strokeWidth={6} lineCap="round"
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Reflet */}
      <Line points={[16, -2, iW - 15, -2]}
        stroke="#d1d5db" strokeWidth={2} lineCap="round" opacity={0.7} />
      {/* Zone de hit */}
      <Rect x={8} y={-14} width={iW - 20} height={28}
        fill="transparent"
        onClick={(e) => { if (isEraseTool) { e.cancelBubble = true; onItemRemove?.(item.id); } }}
        onTap={(e) => { if (isEraseTool) { e.cancelBubble = true; onItemRemove?.(item.id); } }}
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = isEraseTool ? 'crosshair' : 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Highlight hover (mode normal) */}
      {!isEraseTool && hovered && (
        <Rect x={0} y={-5} width={iW} height={10}
          fill="rgba(59,130,246,0.15)" listening={false} />
      )}
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={8} y={-14} width={iW - 20} height={28}
          fill="rgba(226,75,74,0.2)" cornerRadius={4} listening={false} />
      )}
      {/* Delete cross (hover, non-erase mode) */}
      {hovered && !isEraseTool && (
        <DeleteCross x={iW - 16} y={-8} onClick={(e) => { e.cancelBubble = true; onItemRemove?.(item.id); }} />
      )}
      {/* Badge cote live pendant le drag */}
      {!isEraseTool && dragInfo !== null && (
        <Group listening={false}>
          <Line
            points={[0, 0, iW, 0]}
            stroke="#378ADD" strokeWidth={0.8} dash={[4, 3]}
          />
          <Rect
            x={iW + 6} y={-10}
            width={58} height={20}
            fill="#0C447C" cornerRadius={4}
          />
          <Text
            x={iW + 6} y={-4}
            width={58}
            text={`${dragInfo.yCm} cm`}
            align="center"
            fill="#E6F1FB" fontSize={11} fontStyle="bold"
          />
        </Group>
      )}
    </Group>
  );
}

// ── DrawerSeparator (séparation draggable entre deux tiroirs) ─────────────────

function DrawerSeparatorItem({
  modIdx, drawerIdx,
  separatorY,    // position Y courante du séparateur (= top du tiroir inférieur)
  fixedBottomI,  // bas fixe du tiroir inférieur (ne change pas pendant ce drag)
  fixedTopI1,    // haut fixe du tiroir supérieur (ne change pas pendant ce drag)
  cmToPx,        // facteur d'échelle px/cm
  intLeft, iW,
  isEraseTool,
  interactionMode,
  onDrawerResize,
}) {
  const groupRef = useRef(null);
  const [tooltipText, setTooltipText] = useState(null);

  const minHpx       = Math.max(20, cmToPx > 0 ? 8 * cmToPx : 20);
  const minBoundaryY = fixedTopI1  + minHpx;
  const maxBoundaryY = fixedBottomI - minHpx;

  const dragBoundFunc = useCallback((pos) => {
    const stage  = groupRef.current?.getStage?.();
    const scaleX = stage?.scaleX?.() ?? 1;
    const scaleY = stage?.scaleY?.() ?? 1;
    const stX    = stage?.x?.() ?? 0;
    const stY    = stage?.y?.() ?? 0;
    return {
      x: 0 * scaleX + stX,
      y: clamp(pos.y, minBoundaryY * scaleY + stY, maxBoundaryY * scaleY + stY),
    };
  }, [minBoundaryY, maxBoundaryY]);

  const handleDragMove = useCallback((e) => {
    const newY = e.target.y();
    if (cmToPx > 0) {
      const upperH = Math.round((newY - fixedTopI1)  / cmToPx);
      const lowerH = Math.round((fixedBottomI - newY) / cmToPx);
      setTooltipText(`↑ ${upperH} cm | ↓ ${lowerH} cm`);
    }
  }, [fixedTopI1, fixedBottomI, cmToPx]);

  const handleDragEnd = useCallback((e) => {
    const newY = clamp(e.target.y(), minBoundaryY, maxBoundaryY);
    e.target.y(newY);
    setTooltipText(null);
    if (cmToPx > 0) {
      const newH_lower = Math.max(8, Math.round(((fixedBottomI - newY) / cmToPx) * 10) / 10);
      const newH_upper = Math.max(8, Math.round(((newY - fixedTopI1)  / cmToPx) * 10) / 10);
      onDrawerResize?.(modIdx, drawerIdx, newH_lower, newH_upper);
    }
  }, [minBoundaryY, maxBoundaryY, fixedBottomI, fixedTopI1, cmToPx, modIdx, drawerIdx, onDrawerResize]);

  // Ne pas rendre si pas de callback ou si les contraintes sont impossibles
  if (!onDrawerResize || maxBoundaryY <= minBoundaryY) return null;

  return (
    <Group
      ref={groupRef}
      x={0}
      y={separatorY}
      draggable={interactionMode === 'move' && !isEraseTool}
      dragBoundFunc={dragBoundFunc}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Ligne visuelle de séparation */}
      <Line
        points={[intLeft, 0, intLeft + iW, 0]}
        stroke="#8b6914" strokeWidth={1.5} dash={[4, 3]}
        listening={false}
      />
      {/* Zone de hit (12 px de haut, transparent) */}
      <Rect
        x={intLeft} y={-6}
        width={iW} height={12}
        fill="transparent"
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c && !isEraseTool) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Badge cote live pendant le drag */}
      {tooltipText !== null && (
        <Group listening={false}>
          <Rect
            x={intLeft + iW / 2 - 65} y={-18}
            width={130} height={20}
            fill="#0C447C" cornerRadius={4}
          />
          <Text
            x={intLeft + iW / 2 - 65} y={-12}
            width={130}
            text={tooltipText}
            align="center"
            fill="#E6F1FB" fontSize={11} fontStyle="bold"
          />
        </Group>
      )}
    </Group>
  );
}

// ── Drawer (tiroir) ───────────────────────────────────────────────────────────

function DrawerItem({ top, height: dh, intLeft, iW, modIdx, drawerIdx, isEraseTool, onRemoveElement }) {
  const [hovered, setHovered] = useState(false);
  const safeH = Math.max(12, dh);

  return (
    <Group
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'drawer', drawerIdx); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'drawer', drawerIdx); }}
    >
      {/* Façade tiroir */}
      <Rect x={intLeft + 2} y={top + 2} width={iW - 4} height={safeH - 4}
        fill={DRAWER_FILL} stroke={DRAWER_STROKE} strokeWidth={1} cornerRadius={1} />
      {/* Ligne de séparation haute */}
      <Line points={[intLeft + 4, top + 2, intLeft + iW - 4, top + 2]}
        stroke={DRAWER_STROKE} strokeWidth={0.5} opacity={0.5} />
      {/* Poignée barre */}
      <Rect
        x={intLeft + iW / 2 - 18} y={top + safeH / 2 - 3.5}
        width={36} height={7}
        fill={HANDLE_FILL} stroke={HANDLE_STROKE} strokeWidth={0.8} cornerRadius={3.5}
      />
      {/* Bouton central */}
      <Ellipse
        x={intLeft + iW / 2} y={top + safeH / 2}
        radiusX={4} radiusY={2.8} fill="#5a5a5a"
      />
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={intLeft + 2} y={top + 2} width={iW - 4} height={safeH - 4}
          fill="red" opacity={0.22} cornerRadius={1} listening={false} />
      )}
      {/* Delete cross (hover, non-erase mode) */}
      {hovered && !isEraseTool && (
        <DeleteCross x={intLeft + iW - 16} y={top - 8} onClick={(e) => { e.cancelBubble = true; onRemoveElement?.(modIdx, 'drawer', drawerIdx); }} />
      )}
    </Group>
  );
}

// ── Door (porte battante) ─────────────────────────────────────────────────────

function DoorItem({ doorIdx, nbDoors, intLeft, intTop, iW, iH, modIdx, isEraseTool, onRemoveElement }) {
  const [hovered, setHovered] = useState(false);
  const dw  = nbDoors === 2 ? iW / 2 : iW;
  const dx  = nbDoors === 2 && doorIdx === 1 ? intLeft + iW / 2 : intLeft;
  const pad = Math.max(10, dw * 0.09);
  // Poignée côté ouverture
  const hx  = doorIdx === 0 ? dx + dw - 16 : dx + 12;

  return (
    <Group
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'door'); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'door'); }}
    >
      {/* Panneau porte */}
      <Rect x={dx + 2} y={intTop + 2} width={dw - 4} height={iH - 4}
        fill="rgba(232,220,200,0.85)" stroke={DOOR_STROKE} strokeWidth={1.5} cornerRadius={1} />
      {/* Cadre intérieur */}
      <Rect x={dx + pad} y={intTop + pad} width={dw - 2 * pad} height={iH - 2 * pad}
        fill="transparent" stroke={DOOR_STROKE} strokeWidth={0.8} opacity={0.5} />
      {/* Poignée */}
      <Rect x={hx - 4} y={intTop + iH / 2 - 12} width={8} height={24}
        fill={HANDLE_FILL} stroke={HANDLE_STROKE} strokeWidth={0.8} cornerRadius={4} />
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={dx + 2} y={intTop + 2} width={dw - 4} height={iH - 4}
          fill="red" opacity={0.18} cornerRadius={1} listening={false} />
      )}
      {/* Delete cross (hover, non-erase mode) */}
      {hovered && !isEraseTool && (
        <DeleteCross x={dx + dw - 16} y={intTop - 8} onClick={(e) => { e.cancelBubble = true; onRemoveElement?.(modIdx, 'door'); }} />
      )}
    </Group>
  );
}

// ── Sliding doors (portes coulissantes) ───────────────────────────────────────

function SlidingDoorsItem({ intLeft, intTop, iW, iH, modIdx, isEraseTool, onRemoveElement }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Group
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'sliding'); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'sliding'); }}
    >
      {/* Rail haut */}
      <Rect x={intLeft} y={intTop}     width={iW} height={3} fill="#60a5fa" />
      {/* Rail bas */}
      <Rect x={intLeft} y={intTop + iH - 3} width={iW} height={3} fill="#60a5fa" />
      {/* Panneau 1 (devant) */}
      <Rect x={intLeft + 5}       y={intTop + 6} width={iW * 0.55} height={iH - 12}
        fill="rgba(147,197,253,0.20)" stroke="#60a5fa" strokeWidth={1} />
      {/* Panneau 2 (derrière) */}
      <Rect x={intLeft + iW * 0.40} y={intTop + 6} width={iW * 0.55} height={iH - 12}
        fill="rgba(147,197,253,0.28)" stroke="#3b82f6" strokeWidth={1} />
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={intLeft} y={intTop} width={iW} height={iH}
          fill="red" opacity={0.18} listening={false} />
      )}
      {/* Delete cross (hover, non-erase mode) */}
      {hovered && !isEraseTool && (
        <DeleteCross x={intLeft + iW - 16} y={intTop - 8} onClick={(e) => { e.cancelBubble = true; onRemoveElement?.(modIdx, 'sliding'); }} />
      )}
    </Group>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * Rend tous les éléments intérieurs d'un module cabinet.
 *
 * Props:
 *   moduleRect      — { modIdx, intX, intY, intW, intH }
 *   facadeItems     — items du store (shelves, rods) filtrés pour ce module
 *   module          — module façade brut { drawers, doors, slidingDoors }
 *   moduleDetail    — module normalisé (depuis cabinetModules[i]), peut être null
 *   isEraseTool     — boolean
 *   onItemMove      — (itemId, newYRatio) => void  ← DOIT être branché sur setFacadeItems
 *   onItemRemove    — (itemId) => void
 *   onRemoveElement — (modIdx, type) => void
 *   onDrawerResize  — (modIdx, drawerIdx, newH_lower, newH_upper) => void
 */
export default function FacadeKonvaItems({
  moduleRect,
  facadeItems = [],
  module,
  moduleDetail,
  isEraseTool = false,
  interactionMode = 'navigation',
  onItemMove,
  onItemRemove,
  onRemoveElement,
  onDrawerResize,
}) {
  if (!moduleRect) return null;

  const { modIdx = 0, intX, intY, intW, intH, cabInteriorCm = 0 } = moduleRect;
  const intLeft   = toNum(intX);
  const intTop    = toNum(intY);
  const iW        = toNum(intW);
  const iH        = toNum(intH);
  const intBottom = intTop + iH;

  // Source de vérité : moduleDetail si disponible, sinon module brut
  const mod       = moduleDetail || module || {};
  const nbDoors   = toNum(mod.doors,        toNum(module?.doors,        0));
  const nbSliding = toNum(mod.slidingDoors, toNum(module?.slidingDoors, 0));

  // ── Calcul des tiroirs ──────────────────────────────────────────────────────
  // Priorité 1 : drawerItems avec hauteurs cm réelles
  // Priorité 2 : nb drawers distribués équitablement
  const rawDrawerItems = Array.isArray(mod.drawerItems) && mod.drawerItems.length > 0
    ? mod.drawerItems
    : Array.isArray(module?.drawerItems) && module.drawerItems.length > 0
      ? module.drawerItems
      : null;

  const drawerCount = rawDrawerItems
    ? rawDrawerItems.length
    : toNum(mod.drawers, toNum(module?.drawers, 0));

  // cmToPx : convertit une hauteur cm en pixels en utilisant la hauteur intérieure réelle
  // du meuble (cabInteriorCm transmis depuis FacadeKonvaEditor via moduleRect).
  // Sans cette valeur, chaque tiroir aurait une hauteur proportionnelle à la somme des
  // hauteurs des tiroirs (et non à la hauteur totale du module), ce qui les ferait remplir
  // tout l'espace disponible.
  const cabIntH  = toNum(cabInteriorCm);
  const cmToPx   = cabIntH > 0 ? iH / cabIntH : null;

  const drawerRects = (() => {
    if (drawerCount === 0) return [];

    if (rawDrawerItems) {
      let cursor = intBottom;
      return [...rawDrawerItems]
        .sort((a, b) => toNum(a.y) - toNum(b.y))
        .map((d) => {
          const hCm = toNum(d.h ?? d.height, 18);
          // Utilise l'échelle cm→px réelle si disponible, sinon proportion sur la hauteur totale
          const totalCm = rawDrawerItems.reduce((s, x) => s + toNum(x.h ?? x.height, 18), 0) || 1;
          const hPx = cmToPx != null
            ? Math.max(14, hCm * cmToPx)
            : Math.max(14, (hCm / totalCm) * iH);
          const top = cursor - hPx;
          cursor    = top;
          return { hCm, hPx, top };
        });
    }

    // Distribués équitablement depuis le bas (fallback sans drawerItems)
    const evenH = iH / drawerCount;
    return Array.from({ length: drawerCount }, (_, di) => ({
      hCm: 0,
      hPx: evenH,
      top: intBottom - evenH * (di + 1),
    }));
  })();

  // ── Tablettes et tringles depuis facadeItems ────────────────────────────────
  // facadeItems est déjà filtré pour ce module par FacadeKonvaEditor.
  const moduleItems = facadeItems;

  return (
    <Group>
      {/* Tiroirs */}
      {drawerRects.map(({ top, hPx }, di) => (
        <DrawerItem
          key={`drawer-${modIdx}-${di}`}
          drawerIdx={di}
          top={top}
          height={hPx}
          intLeft={intLeft}
          iW={iW}
          modIdx={modIdx}
          isEraseTool={isEraseTool}
          onRemoveElement={onRemoveElement}
        />
      ))}

      {/* Portes battantes */}
      {nbSliding === 0 && Array.from({ length: Math.min(nbDoors, 2) }, (_, di) => (
        <DoorItem
          key={`door-${modIdx}-${di}`}
          doorIdx={di}
          nbDoors={Math.min(nbDoors, 2)}
          intLeft={intLeft}
          intTop={intTop}
          iW={iW}
          iH={iH}
          modIdx={modIdx}
          isEraseTool={isEraseTool}
          onRemoveElement={onRemoveElement}
        />
      ))}

      {/* Portes coulissantes */}
      {nbSliding > 0 && (
        <SlidingDoorsItem
          intLeft={intLeft}
          intTop={intTop}
          iW={iW}
          iH={iH}
          modIdx={modIdx}
          isEraseTool={isEraseTool}
          onRemoveElement={onRemoveElement}
        />
      )}

      {/* Tablettes (draggables) */}
      {moduleItems
        .filter((it) => it.type === 'shelf')
        .map((item) => (
          <ShelfItem
            key={item.id}
            item={item}
            intLeft={intLeft}
            intTop={intTop}
            intBottom={intBottom}
            iW={iW}
            iH={iH}
            cabInteriorCm={cabInteriorCm}
            isEraseTool={isEraseTool}
            interactionMode={interactionMode}
            onItemMove={onItemMove}
            onItemRemove={onItemRemove}
          />
        ))}

      {/* Séparateurs draggables entre tiroirs consécutifs */}
      {rawDrawerItems && drawerRects.length >= 2 && cmToPx > 0 &&
        drawerRects.map(({ top: topI, hPx: _hPxI }, di) => {
          if (di === 0) return null; // pas de séparateur sous le premier tiroir (bas)
          const prev         = drawerRects[di - 1]; // tiroir juste en dessous (di-1)
          const separatorY   = prev.top;             // = haut du tiroir di-1 = bas du tiroir di
          const fixedBottomI = prev.top + prev.hPx;  // bas fixe du tiroir di-1
          const fixedTopI1   = topI;                 // haut fixe du tiroir di
          return (
            <DrawerSeparatorItem
              key={`drw-sep-${modIdx}-${di}`}
              modIdx={modIdx}
              drawerIdx={di - 1}
              separatorY={separatorY}
              fixedBottomI={fixedBottomI}
              fixedTopI1={fixedTopI1}
              cmToPx={cmToPx}
              intLeft={intLeft}
              iW={iW}
              isEraseTool={isEraseTool}
              interactionMode={interactionMode}
              onDrawerResize={onDrawerResize}
            />
          );
        })
      }

      {/* Tringles (draggables) */}
      {moduleItems
        .filter((it) => it.type === 'rod')
        .map((item) => (
          <RodItem
            key={item.id}
            item={item}
            intLeft={intLeft}
            intTop={intTop}
            intBottom={intBottom}
            iW={iW}
            iH={iH}
            cabInteriorCm={cabInteriorCm}
            isEraseTool={isEraseTool}
            interactionMode={interactionMode}
            onItemMove={onItemMove}
            onItemRemove={onItemRemove}
          />
        ))}
    </Group>
  );
}
