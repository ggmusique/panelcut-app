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
import React, { useState, useCallback } from 'react';
import { Group, Rect, Line, Circle, Ellipse } from 'react-konva';
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

// ── Shelf (tablette draggable) ────────────────────────────────────────────────

function ShelfItem({ item, intLeft, intTop, intBottom, iW, iH, isEraseTool, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef(null);

  // Coordonnée Y en espace contenu (content-space)
  const ey = intTop + clamp(toNum(item.yRatio, 0.5), 0, 1) * iH;

  // dragBoundFunc reçoit ET doit retourner des coordonnées ABSOLUES (pixels canvas),
  // c'est-à-dire après application du scaleX/Y et x/y du Stage.
  // intTop/intBottom sont en espace contenu → on les convertit en absolu.
  // Pour l'axe X, on verrouille le Group à content-x=0 :
  //   absX = 0 * scaleX + stageX = stageX.
  const dragBoundFunc = useCallback((pos) => {
    const stage  = groupRef.current?.getStage?.();
    const scaleX = stage?.scaleX?.() ?? 1;
    const scaleY = stage?.scaleY?.() ?? 1;
    const stX    = stage?.x?.()     ?? 0;
    const stY    = stage?.y?.()     ?? 0;
    return {
      x: 0 * scaleX + stX,  // maintient content-x = 0
      y: clamp(pos.y, intTop * scaleY + stY, intBottom * scaleY + stY),
    };
  }, [intTop, intBottom]);

  const handleDragEnd = useCallback((e) => {
    // e.target.y() retourne la position Y LOCALE (espace contenu) après drag
    const newY      = e.target.y();
    const newYRatio = clamp((newY - intTop) / Math.max(1, iH), 0, 1);
    // Remet la position Konva à la valeur snappée (avant que React ne re-rende)
    e.target.y(intTop + newYRatio * iH);
    onItemMove?.(item.id, newYRatio);
  }, [intTop, iH, item.id, onItemMove]);

  return (
    <Group
      ref={groupRef}
      x={0}
      y={ey}
      draggable={!isEraseTool}
      dragBoundFunc={dragBoundFunc}
      onDragEnd={handleDragEnd}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Planche — coordonnées relatives au Group (y=0 = position de la tablette) */}
      <Rect x={intLeft} y={-3.5} width={iW} height={7}
        fill={SHELF_FILL} stroke={SHELF_STROKE} strokeWidth={1} />
      {/* Chevilles */}
      <Circle x={intLeft + 9}      y={0} radius={2.5} fill={SHELF_STROKE} />
      <Circle x={intLeft + iW - 9} y={0} radius={2.5} fill={SHELF_STROKE} />
      {/* Zone de hit plus large pour faciliter le drag */}
      <Rect x={intLeft} y={-10} width={iW} height={20}
        fill="transparent"
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c && !isEraseTool) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={intLeft} y={-10} width={iW} height={20}
          fill="red" opacity={0.3} listening={false} />
      )}
    </Group>
  );
}

// ── Rod (tringle draggable) ───────────────────────────────────────────────────

function RodItem({ item, intLeft, intTop, intBottom, iW, iH, isEraseTool, onItemMove, onItemRemove }) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef(null);

  const ey = intTop + clamp(toNum(item.yRatio, 0.32), 0, 1) * iH;

  // Même correction que ShelfItem : convertir intTop/intBottom en coordonnées absolues.
  const dragBoundFunc = useCallback((pos) => {
    const stage  = groupRef.current?.getStage?.();
    const scaleX = stage?.scaleX?.() ?? 1;
    const scaleY = stage?.scaleY?.() ?? 1;
    const stX    = stage?.x?.()     ?? 0;
    const stY    = stage?.y?.()     ?? 0;
    return {
      x: 0 * scaleX + stX,
      y: clamp(pos.y, intTop * scaleY + stY, intBottom * scaleY + stY),
    };
  }, [intTop, intBottom]);

  const handleDragEnd = useCallback((e) => {
    const newY      = e.target.y();
    const newYRatio = clamp((newY - intTop) / Math.max(1, iH), 0, 1);
    e.target.y(intTop + newYRatio * iH);
    onItemMove?.(item.id, newYRatio);
  }, [intTop, iH, item.id, onItemMove]);

  return (
    <Group
      ref={groupRef}
      x={0}
      y={ey}
      draggable={!isEraseTool}
      dragBoundFunc={dragBoundFunc}
      onDragEnd={handleDragEnd}
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onItemRemove?.(item.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Support gauche */}
      <Rect x={intLeft + 8} y={-10} width={7} height={18} fill="#6b7280" cornerRadius={2} />
      {/* Support droit */}
      <Rect x={intLeft + iW - 15} y={-10} width={7} height={18} fill="#6b7280" cornerRadius={2} />
      {/* Barre principale */}
      <Line points={[intLeft + 16, 0, intLeft + iW - 15, 0]}
        stroke={ROD_STROKE} strokeWidth={6} lineCap="round" />
      {/* Reflet */}
      <Line points={[intLeft + 16, -2, intLeft + iW - 15, -2]}
        stroke="#d1d5db" strokeWidth={2} lineCap="round" opacity={0.7} />
      {/* Zone de hit */}
      <Rect x={intLeft + 8} y={-14} width={iW - 20} height={28}
        fill="transparent"
        onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c && !isEraseTool) c.style.cursor = 'ns-resize'; }}
        onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }}
      />
      {/* Overlay erase */}
      {isEraseTool && hovered && (
        <Rect x={intLeft + 8} y={-14} width={iW - 20} height={28}
          fill="red" opacity={0.25} cornerRadius={4} listening={false} />
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
      onClick={(e) => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'drawer'); }}
      onTap={(e)   => { e.cancelBubble = true; if (isEraseTool) onRemoveElement?.(modIdx, 'drawer'); }}
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
 */
export default function FacadeKonvaItems({
  moduleRect,
  facadeItems = [],
  module,
  moduleDetail,
  isEraseTool = false,
  onItemMove,
  onItemRemove,
  onRemoveElement,
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
  const moduleItems = facadeItems.filter((it) => Number(it.modIdx) === Number(modIdx));

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
            isEraseTool={isEraseTool}
            onItemMove={onItemMove}
            onItemRemove={onItemRemove}
          />
        ))}

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
            isEraseTool={isEraseTool}
            onItemMove={onItemMove}
            onItemRemove={onItemRemove}
          />
        ))}
    </Group>
  );
}
