import React, { useRef, useState, useEffect, useMemo, useCallback, useImperativeHandle } from 'react';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';
import { Hand, MousePointer2 } from 'lucide-react';
import { WOOD_STROKE, DIM_COLOR } from './konvaTheme';
import FacadeKonvaModule from './FacadeKonvaModule';
import FacadeKonvaAnnotations from './FacadeKonvaAnnotations';
import { useFacadeKonva } from './useFacadeKonva';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Visual margins (in SVG reference pixels) matching FacadeCanvas */
const MARGIN = { l: 65, r: 52, t: 55, b: 65 };

const DOUBLE_COLOR = '#d97706';

// Double-separator label geometry
const DOUBLE_LABEL_OFFSET = 10;
const DOUBLE_LABEL_WIDTH  = 20;

// Delay (ms) before resetting isPinching after the last touch ends,
// preventing a residual single-finger move from firing right after a pinch.
const PINCH_GESTURE_DELAY_MS = 50;

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// ── Gesture helpers ───────────────────────────────────────────────────────────

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function getCenter(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// ── Geometry ──────────────────────────────────────────────────────────────────

/**
 * Computes per-module drawing rects for the Konva stage.
 * Matches the logic of computeMRects in FacadeCanvas so the layouts are equivalent.
 */
function computeKonvaMRects({ facadeModules, joints, thPx, drawW, mL, mT, innerH }) {
  if (!facadeModules.length) return [];
  const totalSepPx = joints.reduce((acc, j) => acc + (j ? 2 * thPx : thPx), 0) + 2 * thPx;
  const avail      = drawW - totalSepPx;
  const totalModW  = facadeModules.reduce((a, m) => a + m.width, 0);
  const scale      = avail / Math.max(1, totalModW);
  let xCur = mL + thPx;
  return facadeModules.map((m, i) => {
    const wPx = m.width * scale;
    const r = {
      x: xCur, w: wPx, m, i,
      modIdx: i,
      y: mT + thPx,
      intX: xCur,
      intY: mT + thPx,
      intW: wPx,
      intH: innerH - 2 * thPx,
      widthCm: m.width,
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      innerH,
    };
    xCur += wPx + (i < facadeModules.length - 1 ? (joints[i] ? 2 * thPx : thPx) : 0);
    return r;
  });
}

// ── Grid + Ruler component ────────────────────────────────────────────────────

/**
 * GridLayer — grille fine + règles cm (rendu sur un Layer séparé, non-interactif).
 * Positionné après le Layer principal pour que la grille soit visible par-dessus
 * le fond intérieur du meuble.
 */
function GridLayer({ mL, mT, drawW, drawH, cabW, cabH, scaleRatio }) {
  const RULER_H  = 20; // hauteur règle horizontale (pixels canvas)
  const RULER_W  = 20; // largeur règle verticale  (pixels canvas)
  const fontSize = Math.max(6, 8 * scaleRatio);

  const cmToPxH = drawW / Math.max(1, cabW);
  const cmToPxV = drawH / Math.max(1, cabH);

  const maxI = Math.ceil(cabW / 10) + 2;
  const maxJ = Math.ceil(cabH / 10) + 2;

  const vLines  = []; // lignes verticales de la grille
  const hLines  = []; // lignes horizontales de la grille
  const hTicks  = []; // graduations + labels règle horizontale
  const vTicks  = []; // graduations + labels règle verticale

  // Lignes verticales + graduations règle du haut
  for (let i = 0; i <= maxI; i++) {
    const x = mL + i * 10 * cmToPxH;
    if (x > mL + drawW + 0.5) break;
    const is50 = i % 5 === 0;
    vLines.push(
      <Line key={`vg${i}`}
        points={[x, mT, x, mT + drawH]}
        stroke={is50 ? 'rgba(180,180,160,0.3)' : 'rgba(180,180,160,0.15)'}
        strokeWidth={is50 ? 0.8 : 0.5}
        listening={false}
      />
    );
    hTicks.push(
      <Line key={`hrt${i}`}
        points={[x, mT - (is50 ? 8 : 4), x, mT]}
        stroke="#aaa" strokeWidth={0.8}
        listening={false}
      />
    );
    if (is50) {
      hTicks.push(
        <Text key={`hrl${i}`}
          x={x - 12} y={mT - RULER_H + 2}
          width={24} text={`${i * 10}`}
          align="center" fontSize={fontSize} fill="#888"
          listening={false}
        />
      );
    }
  }

  // Lignes horizontales + graduations règle de gauche
  for (let j = 0; j <= maxJ; j++) {
    const y = mT + j * 10 * cmToPxV;
    if (y > mT + drawH + 0.5) break;
    const is50 = j % 5 === 0;
    hLines.push(
      <Line key={`hg${j}`}
        points={[mL, y, mL + drawW, y]}
        stroke={is50 ? 'rgba(180,180,160,0.3)' : 'rgba(180,180,160,0.15)'}
        strokeWidth={is50 ? 0.8 : 0.5}
        listening={false}
      />
    );
    vTicks.push(
      <Line key={`vrt${j}`}
        points={[mL - (is50 ? 8 : 4), y, mL, y]}
        stroke="#aaa" strokeWidth={0.8}
        listening={false}
      />
    );
    if (is50) {
      vTicks.push(
        <Text key={`vrl${j}`}
          x={mL - RULER_W + 2} y={y - fontSize / 2}
          width={RULER_W - 6} text={`${j * 10}`}
          align="right" fontSize={fontSize} fill="#888"
          listening={false}
        />
      );
    }
  }

  return (
    <Layer listening={false}>
      {/* Fonds des règles */}
      <Rect x={mL}          y={mT - RULER_H} width={drawW}   height={RULER_H}
        fill="rgba(240,238,233,0.9)" listening={false} />
      <Rect x={mL - RULER_W} y={mT}           width={RULER_W} height={drawH}
        fill="rgba(240,238,233,0.9)" listening={false} />
      {/* Coin supérieur-gauche */}
      <Rect x={mL - RULER_W} y={mT - RULER_H} width={RULER_W} height={RULER_H}
        fill="rgba(240,238,233,0.9)" listening={false} />
      {/* Lignes de grille */}
      {vLines}
      {hLines}
      {/* Graduations et labels */}
      {hTicks}
      {vTicks}
    </Layer>
  );
}

// ── Wood gradient helpers ─────────────────────────────────────────────────────

/** Horizontal wood gradient (left-to-right) filling a rect of width `w`. */
const woodGradH = (w) => ({
  fillLinearGradientStartPoint:      { x: 0, y: 0 },
  fillLinearGradientEndPoint:        { x: w, y: 0 },
  fillLinearGradientColorStops:      [0, '#dcc89a', 0.45, '#f5ede0', 1, '#dcc89a'],
});

/** Vertical wood gradient (top-to-bottom) filling a rect of height `h`. */
const woodGradV = (h) => ({
  fillLinearGradientStartPoint:      { x: 0, y: 0 },
  fillLinearGradientEndPoint:        { x: 0, y: h },
  fillLinearGradientColorStops:      [0, '#c4a87a', 1, '#e8d5b0'],
});

/** Double-panel separator gradient (horizontal). */
const sepGradH = (w) => ({
  fillLinearGradientStartPoint:      { x: 0, y: 0 },
  fillLinearGradientEndPoint:        { x: w, y: 0 },
  fillLinearGradientColorStops:      [0, '#dcc89a', 0.48, '#e8d5b0', 0.52, '#c9b068', 1, '#dcc89a'],
});

// ── Main component ────────────────────────────────────────────────────────────

/**
 * FacadeKonvaEditor
 *
 * Drop-in Konva replacement for FacadeRealisteSVG / FacadeCanvas.
 * Shares the same props interface so it can replace the SVG-based renderer
 * in SketchEditor without touching the parent's state logic.
 *
 * Props:
 *   svgW, svgH           — reference viewport size (same as the SVG viewBox)
 *   cabW, cabH           — cabinet outer dimensions in cm
 *   plinth               — plinth height in cm
 *   thick                — panel thickness in cm
 *   facadeModules        — array of { width, drawers, doors, slidingDoors, … }
 *   facadeItems          — array of { id, type, modIdx, yRatio }
 *   joints               — boolean[] — true = double joint between module i and i+1
 *   cabinetModules       — normalized modules from normalizeCabinetModules (may be [])
 *   globalSliding        — { enabled, count, heightCm } | null
 *   onFacadePointerDown  — (e, modIdx) => void — shelf / rod placement
 *   onItemPointerDown    — (e, itemId) => void — item drag start
 *   onItemErase          — (itemId) => void
 *   onModuleClick        — (modIdx, tool) => void
 *   onModuleErase        — (modIdx, type) => void
 *   activeTool           — 'select'|'shelf'|'rod'|'drawer'|'door'|'sliding'|'erase'|…
 */
const FacadeKonvaEditor = React.forwardRef(function FacadeKonvaEditor({
  svgW         = 1140,
  svgH         = 700,
  cabW,
  cabH,
  plinth,
  thick,
  facadeModules   = [],
  facadeItems     = [],
  joints          = [],
  cabinetModules  = [],
  globalSliding,
  elements        = [],
  onFacadePointerDown,
  onItemPointerDown,
  onItemMove,
  onItemErase,
  onModuleClick,
  onModuleErase,
  onElementAdd,
  onElementUpdate,
  onElementRemove,
  onDrawerResize,
  onModuleSelect,
  onSelectionChange,
  activeTool      = 'select',
  showGrid        = true,
  onChange,
  onModuleChange,
  onItemChange,
  onHistoryChange,
}, ref) {
  // ── 1. RESPONSIVE RESIZE ───────────────────────────────────────────────────
  const containerRef = useRef(null);
  const stageRef     = useRef(null);

  const [stageSize, setStageSize] = useState({ w: svgW, h: svgH });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width } = entries[0].contentRect;
      const ratio = svgH / svgW;
      setStageSize({ w: width, h: Math.round(width * ratio) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [svgW, svgH]);

  // ── 1b. INTERACTION MODE (move | navigation) ──────────────────────────────
  // "navigation" → pan + zoom, drag des éléments désactivé
  // "move"       → drag des éléments activé, pan désactivé
  const [interactionMode, setInteractionMode] = useState('navigation');

  // ── 1c. VIEWPORT STATE (zoom / pan) ────────────────────────────────────────
  const [scale,    setScale]    = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastCenter    = useRef(null);
  const lastDist      = useRef(null);
  const isPinching    = useRef(false);
  const touchStartPos = useRef(null);
  // Pan souris (PC)
  const mousePanRef   = useRef({ active: false, startX: 0, startY: 0, stageX: 0, stageY: 0 });

  // ── 1c. RESIZE LIVE WIDTH ──────────────────────────────────────────────────
  const [resizeWidthCm, setResizeWidthCm] = useState(null);

  // ── 1d. RUBBER BAND SELECTION ─────────────────────────────────────────────
  // Stored in Stage content coordinates (matching mRects).
  const [rubberBand, setRubberBand] = useState(null); // { x0, y0, x1, y1 } | null
  const isRubberBanding = useRef(false);

  // ── TOOL FLAGS (declared early — used in useEffect/useCallback dep arrays below) ──
  const isErase   = activeTool === 'erase';
  const isPlace   = activeTool === 'shelf' || activeTool === 'rod';
  const isAdd     = activeTool === 'drawer' || activeTool === 'door' || activeTool === 'sliding';
  const isNavMode = interactionMode === 'navigation';

  // Non-passive wheel listener so we can call preventDefault()
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const scaleBy = 1.06;
      const stage   = stageRef.current;
      if (!stage) return;
      const oldScale = stage.scaleX();
      const pointer  = stage.getPointerPosition();
      if (!pointer) return;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newScale  = Math.max(0.5, Math.min(4, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      setScale(newScale);
      setPosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan souris (bouton gauche sur fond, uniquement en mode Select)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e) => {
      if (!mousePanRef.current.active) return;
      const dx = e.clientX - mousePanRef.current.startX;
      const dy = e.clientY - mousePanRef.current.startY;
      setPosition({
        x: mousePanRef.current.stageX + dx,
        y: mousePanRef.current.stageY + dy,
      });
    };

    const stopPan = () => {
      if (mousePanRef.current.active) {
        mousePanRef.current.active = false;
        el.style.cursor = isNavMode ? 'grab' : 'default';
      }
    };

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup',   stopPan);
    el.addEventListener('mouseleave', stopPan);
    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup',   stopPan);
      el.removeEventListener('mouseleave', stopPan);
    };
  }, [isNavMode, setPosition]);

  // Curseur selon le mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mousePanRef.current.active) return;
    if (isNavMode) el.style.cursor = 'grab';
    else if (isErase) el.style.cursor = 'crosshair';
    else el.style.cursor = 'default';
  }, [isNavMode, isErase]);

  const { w: stageW, h: stageH } = stageSize;

  // Scale factor between the Konva canvas and the SVG reference size
  const scaleRatio = stageW / Math.max(1, svgW);

  // ── 2. LAYOUT GEOMETRY ────────────────────────────────────────────────────
  const drawW = (svgW - MARGIN.l - MARGIN.r) * scaleRatio;
  const drawH = (svgH - MARGIN.t - MARGIN.b) * scaleRatio;
  const mL    = MARGIN.l * scaleRatio;
  const mT    = MARGIN.t * scaleRatio;

  const thPx   = toNum(thick, 1.8) * (drawW / Math.max(1, toNum(cabW)));
  const plPx   = toNum(plinth)      * (drawH / Math.max(1, toNum(cabH)));
  const innerH = drawH - plPx;

  const mRects = useMemo(() =>
    computeKonvaMRects({ facadeModules, joints, thPx, drawW, mL, mT, innerH }),
    [facadeModules, joints, thPx, drawW, mL, mT, innerH],
  );

  // ── 2b. HISTORY / SNAP (useFacadeKonva) ──────────────────────────────────
  // stageWidth = drawW so the hook's internal geometry aligns with the drawing
  // area; snapX from the hook is relative to the drawing area's left edge (0),
  // so we add mL to render it in Stage coordinates.

  // Compose a single onChange that notifies all callers (onChange, onModuleChange, onItemChange).
  const composedOnChange = useCallback((newModules, newItems) => {
    onChange?.(newModules, newItems);
    onModuleChange?.(newModules);
    onItemChange?.(newItems);
  }, [onChange, onModuleChange, onItemChange]);

  const {
    undo,
    redo,
    canUndo,
    canRedo,
    snapActive,
    snapX: hookSnapX,
    selectedIds,
    selectModule,
    selectModules,
    clearSelection,
    resizeModule,
    setResizingModuleId,
  } = useFacadeKonva({
    cabinetDims: { width: toNum(cabW), height: toNum(cabH), plinth: toNum(plinth) },
    facadeModules,
    facadeItems,
    joints,
    thickness:   toNum(thick, 1.8),
    stageWidth:  drawW,
    stageHeight: drawH,
    onChange: composedOnChange,
  });

  // Snap line position in Stage coordinate space
  const snapLineX = hookSnapX != null ? hookSnapX + mL : null;

  // ── Imperative handle (undo/redo must be defined first) ───────────────────
  useImperativeHandle(ref, () => ({
    // Returns a PNG data URL (high-res, pixelRatio 3) of the current Konva stage content.
    exportDataUrl: () => stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 3 }) ?? null,
    undo,
    redo,
    zoomIn:  () => setScale(s => Math.min(4, s * 1.2)),
    zoomOut: () => setScale(s => Math.max(0.5, s / 1.2)),
  }), [undo, redo]);

  // ── Notify parent when undo/redo availability changes ─────────────────────
  useEffect(() => {
    onHistoryChange?.({ canUndo, canRedo });
  }, [canUndo, canRedo, onHistoryChange]);

  // ── Notify parent when selection changes ─────────────────────────────────
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // ── 3. ANNOTATION Y (scaled margins) ─────────────────────────────────────
  const dimLineH   = 26 * scaleRatio;
  const dimTickH   = 6  * scaleRatio;
  const rightDimX  = mL + drawW + 24 * scaleRatio;

  // ── 5. EVENT HANDLERS ─────────────────────────────────────────────────────

  // ── Pan souris — démarrage (Konva onMouseDown) ────────────────────────────
  // Utilise le système de détection de Konva plutôt que stage.getIntersection()
  // avec des coordonnées converties manuellement (source d'erreur avec zoom/pan).
  // La détection Konva gère correctement les Rects transparents (listening=true).
  const handleStagePanStart = useCallback((e) => {
    if (e.evt.button !== 0) return;

    if (isNavMode) {
      // Navigation mode → pan
      let node = e.target;
      while (node && node.getType?.() !== 'Stage') {
        if (node.draggable?.()) return;
        node = node.parent;
      }
      const stage = stageRef.current;
      if (!stage) return;
      mousePanRef.current = {
        active: true,
        startX: e.evt.clientX,
        startY: e.evt.clientY,
        stageX: stage.x(),
        stageY: stage.y(),
      };
      stage.container().style.cursor = 'grabbing';
      return;
    }

    // Move mode → rubber band on background only (not on module/item)
    let node = e.target;
    while (node && node.getType?.() !== 'Stage') {
      if (node.draggable?.()) return;
      if (node.name?.() === 'module-hitbox') return;
      node = node.parent;
    }
    // Only start rubber band when clicking empty background
    const stage = stageRef.current;
    if (!stage) return;
    const pt = stage.getPointerPosition();
    if (!pt) return;
    const cx = (pt.x - stage.x()) / stage.scaleX();
    const cy = (pt.y - stage.y()) / stage.scaleY();
    isRubberBanding.current = true;
    setRubberBand({ x0: cx, y0: cy, x1: cx, y1: cy });
  }, [isNavMode]);

  // ── Touch gesture handlers ────────────────────────────────────────────────

  const handleStageTouchStart = useCallback((e) => {
    if (e.evt.touches.length === 1 && isNavMode) {
      const stage = stageRef.current;
      touchStartPos.current = {
        clientX: e.evt.touches[0].clientX,
        clientY: e.evt.touches[0].clientY,
        stageX:  stage.x(),
        stageY:  stage.y(),
      };
    }
  }, [isNavMode]);

  const handleStageTouchMove = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      // Pinch-to-zoom
      e.evt.preventDefault();
      isPinching.current = true;
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      const newDist   = getDistance(p1, p2);
      const newCenter = getCenter(p1, p2);
      if (!lastDist.current) {
        lastDist.current   = newDist;
        lastCenter.current = newCenter;
        return;
      }
      const scaleBy  = newDist / lastDist.current;
      const stage    = stageRef.current;
      const oldScale = stage.scaleX();
      const newScale = Math.max(0.5, Math.min(4, oldScale * scaleBy));
      const pointer  = stage.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      setScale(newScale);
      setPosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      lastDist.current   = newDist;
      lastCenter.current = newCenter;
    } else if (touches.length === 1 && isNavMode && !isPinching.current) {
      // Single-finger pan
      if (!touchStartPos.current) return;
      const dx = touches[0].clientX - touchStartPos.current.clientX;
      const dy = touches[0].clientY - touchStartPos.current.clientY;
      setPosition({
        x: touchStartPos.current.stageX + dx,
        y: touchStartPos.current.stageY + dy,
      });
    }
  }, [isNavMode]);

  const handleStageTouchEnd = useCallback(() => {
    lastDist.current      = null;
    lastCenter.current    = null;
    touchStartPos.current = null;
    setTimeout(() => { isPinching.current = false; }, PINCH_GESTURE_DELAY_MS);
  }, []);

  // ── Rubber band — mouse move ───────────────────────────────────────────────
  const handleStageMouseMove = useCallback((e) => {
    if (!isRubberBanding.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pt = stage.getPointerPosition();
    if (!pt) return;
    const cx = (pt.x - stage.x()) / stage.scaleX();
    const cy = (pt.y - stage.y()) / stage.scaleY();
    setRubberBand(prev => prev ? { ...prev, x1: cx, y1: cy } : prev);
  }, []);

  // ── Rubber band — mouse up → select matching modules ──────────────────────
  const handleStageMouseUp = useCallback(() => {
    if (!isRubberBanding.current) return;
    isRubberBanding.current = false;
    setRubberBand(prev => {
      if (!prev) return null;
      const { x0, y0, x1, y1 } = prev;
      const rxMin = Math.min(x0, x1);
      const rxMax = Math.max(x0, x1);
      const ryMin = Math.min(y0, y1);
      const ryMax = Math.max(y0, y1);
      // Only select if band has meaningful area
      if (rxMax - rxMin > 4 && ryMax - ryMin > 4) {
        const matched = mRects
          .filter(r => {
            const cx = r.intX + r.intW / 2;
            const cy = r.intY + r.intH / 2;
            return cx >= rxMin && cx <= rxMax && cy >= ryMin && cy <= ryMax;
          })
          .map(r => r.modIdx);
        if (matched.length > 0) selectModules(matched);
      }
      return null;
    });
  }, [mRects, selectModules]);

  /**
   * Module resize drag: called by FacadeKonvaModule's onResizeStart.
   * Sets up mousemove / mouseup listeners on window to track the drag and
   * call resizeModule with the updated width in cm.
   */
  const handleResizeStart = useCallback((modIdx, moduleWPx, widthCm, konvaEvt) => {
    konvaEvt.cancelBubble = true;
    setResizingModuleId(modIdx);
    setResizeWidthCm(widthCm);
    const startClientX = konvaEvt.evt?.clientX ?? 0;
    const pxPerCm = moduleWPx / Math.max(1, widthCm);

    const handleMouseMove = (e) => {
      const dx = e.clientX - startClientX;
      const currentZoom = stageRef.current?.scaleX() ?? 1;
      const newWidthCm = Math.max(10, widthCm + (dx / currentZoom) / pxPerCm);
      setResizeWidthCm(Math.round(newWidthCm * 10) / 10);
      resizeModule(modIdx, newWidthCm);
    };

    const handleMouseUp = () => {
      setResizingModuleId(null);
      setResizeWidthCm(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [resizeModule, setResizingModuleId]);

  /**
   * Computes the screen (client) coordinates of the center of a module,
   * accounting for the stage's current scale and pan position.
   */
  const computeModuleScreenCenter = useCallback((moduleRect) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const container    = stage.container();
    const containerRect = container.getBoundingClientRect();
    const stageScale   = stage.scaleX();
    const modCx = moduleRect.intX + moduleRect.intW / 2;
    const modCy = moduleRect.intY + moduleRect.intH / 2;
    return {
      x: containerRect.left + stage.x() + modCx * stageScale,
      y: containerRect.top  + stage.y() + modCy * stageScale,
    };
  }, []);

  /**
   * Called by FacadeKonvaModule's onAddElement.
   * payload = { type, yRatio } for shelf/rod, or a tool string for drawer/door/sliding.
   */
  const handleModuleAddElement = useCallback((modIdx, payload) => {
    if (payload && typeof payload === 'object') {
      // shelf / rod: FacadeKonvaModule already computed yRatio from the pointer
      if (!onFacadePointerDown) return;
      const stage = stageRef.current;
      const container = stage?.container();
      const cr = container?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const pos = stage?.getPointerPosition();
      onFacadePointerDown({
        stopPropagation: () => {},
        clientX:      pos ? cr.left + pos.x : cr.left,
        clientY:      pos ? cr.top  + pos.y : cr.top,
        _konvaYRatio: payload.yRatio,
      }, modIdx);
    } else {
      // drawer / door / sliding: no position needed
      onModuleClick?.(modIdx, typeof payload === 'string' ? payload : activeTool);
    }
  }, [onFacadePointerDown, onModuleClick, activeTool]);

  /**
   * Called by FacadeKonvaModule's onRemoveElement.
   * type = 'item' for shelf/rod (with id), or 'drawer'/'door'/'sliding' for fixtures.
   */
  const handleModuleRemoveElement = useCallback((modIdx, type, id) => {
    if (type === 'item') {
      onItemErase?.(id);
    } else {
      onModuleErase?.(modIdx, type, id);
    }
  }, [onItemErase, onModuleErase]);

  // ── 6. RENDER ─────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>

      {/* ── Mode buttons (top-left overlay on the Konva Stage) ── */}
      <div style={{
        position: 'absolute',
        top: 6,
        left: 6,
        zIndex: 10,
        display: 'flex',
        gap: 4,
        pointerEvents: 'auto',
      }}>

        {/* ── Mode buttons ── */}

        <button
          onClick={() => setInteractionMode('navigation')}
          title="Mode Navigation — pan et zoom de la vue"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            fontSize: 13,
            borderRadius: 4,
            border: `1.5px solid ${interactionMode === 'navigation' ? '#3b82f6' : '#d1d5db'}`,
            background: interactionMode === 'navigation' ? '#eff6ff' : '#fff',
            color: interactionMode === 'navigation' ? '#1d4ed8' : '#374151',
            cursor: 'pointer',
            fontWeight: interactionMode === 'navigation' ? 600 : 400,
            lineHeight: 1.4,
          }}
        >
          <MousePointer2 size={14} />
          Navigation
        </button>

        <button
          onClick={() => setInteractionMode('move')}
          title="Mode Déplacer — glisser les étagères, tringles et modules"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            fontSize: 13,
            borderRadius: 4,
            border: `1.5px solid ${interactionMode === 'move' ? '#10b981' : '#d1d5db'}`,
            background: interactionMode === 'move' ? '#ecfdf5' : '#fff',
            color: interactionMode === 'move' ? '#065f46' : '#374151',
            cursor: 'pointer',
            fontWeight: interactionMode === 'move' ? 600 : 400,
            lineHeight: 1.4,
          }}
        >
          <Hand size={14} />
          Déplacer
        </button>
      </div>
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onMouseDown={handleStagePanStart}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onClick={(e) => {
          if (e.target === e.target.getStage()) {
            clearSelection();
            onModuleSelect?.(null, 0, 0);
          }
        }}
      >
        <Layer>

          {/* ── 2. FOND BOIS — outer cabinet rectangle ── */}
          <Rect
            x={mL} y={mT}
            width={drawW} height={drawH}
            {...woodGradH(drawW)}
            stroke={WOOD_STROKE} strokeWidth={2.5}
            listening={false}
          />

          {/* Interior background (inside the four panels) */}
          <Rect
            x={mL + thPx}     y={mT + thPx}
            width={drawW - 2 * thPx} height={innerH - thPx}
            fill="#ede4d3"
            listening={false}
          />

          {/* ── PLINTH ── */}
          {plPx > 2 && (
            <Group listening={false}>
              <Rect
                x={mL}     y={mT + innerH}
                width={drawW} height={plPx}
                fill="#c8b07c" stroke={WOOD_STROKE} strokeWidth={1.5}
              />
              <Line
                points={[mL, mT + innerH, mL + drawW, mT + innerH]}
                stroke={WOOD_STROKE} strokeWidth={2}
              />
            </Group>
          )}

          {/* ── SIDE PANELS ── */}
          <Rect
            x={mL} y={mT} width={thPx} height={innerH}
            {...woodGradH(thPx)}
            stroke={WOOD_STROKE} strokeWidth={1.5}
            listening={false}
          />
          <Rect
            x={mL + drawW - thPx} y={mT} width={thPx} height={innerH}
            {...woodGradH(thPx)}
            stroke={WOOD_STROKE} strokeWidth={1.5}
            listening={false}
          />

          {/* ── TOP PANEL ── */}
          <Rect
            x={mL} y={mT} width={drawW} height={thPx}
            {...woodGradV(thPx)}
            stroke={WOOD_STROKE} strokeWidth={1.5}
            listening={false}
          />

          {/* ── BOTTOM PANEL ── */}
          <Rect
            x={mL} y={mT + innerH - thPx} width={drawW} height={thPx}
            {...woodGradV(thPx)}
            stroke={WOOD_STROKE} strokeWidth={1.5}
            listening={false}
          />

          {/* ── SEPARATORS / JOINTS ── */}
          {mRects.map(({ x, w, i }) => {
            if (i >= facadeModules.length - 1) return null;
            const isDouble = joints[i];
            const sepX     = x + w;
            if (isDouble) {
              return (
                <Group key={`sep-${i}`} listening={false}>
                  <Rect
                    x={sepX}        y={mT} width={thPx} height={innerH}
                    {...sepGradH(thPx)}
                    stroke={WOOD_STROKE} strokeWidth={1}
                  />
                  <Rect
                    x={sepX + thPx} y={mT} width={thPx} height={innerH}
                    {...sepGradH(thPx)}
                    stroke={WOOD_STROKE} strokeWidth={1}
                  />
                  <Line
                    points={[sepX + thPx, mT + 2, sepX + thPx, mT + innerH - 2]}
                    stroke={DOUBLE_COLOR} strokeWidth={1.5} dash={[4, 3]} opacity={0.9}
                  />
                  <Text
                    x={sepX + thPx - DOUBLE_LABEL_OFFSET} y={mT + innerH + 28 * scaleRatio}
                    width={DOUBLE_LABEL_WIDTH} text="⬛⬛"
                    align="center" fill={DOUBLE_COLOR} fontSize={9 * scaleRatio} fontStyle="bold"
                  />
                </Group>
              );
            }
            return (
              <Rect
                key={`sep-${i}`}
                x={sepX} y={mT} width={thPx} height={innerH}
                {...woodGradH(thPx)}
                stroke={WOOD_STROKE} strokeWidth={1}
                listening={false}
              />
            );
          })}

          {/* ── MODULES ── */}
          {mRects.map((moduleRect) => {
            const { i, m } = moduleRect;
            const cabInteriorCm = toNum(cabH) - toNum(plinth);
            const moduleItems   = facadeItems.filter((it) => Number(it.modIdx) === i);
            const isSelected    = selectedIds.has(i);
            const hasSelection  = selectedIds.size > 0;
            return (
              <FacadeKonvaModule
                key={`mod-${i}`}
                moduleRect={{ ...moduleRect, cabInteriorCm }}
                module={m}
                moduleDetail={cabinetModules[i] || null}
                facadeItems={moduleItems}
                isSelected={isSelected}
                hasSelection={hasSelection}
                activeTool={activeTool}
                interactionMode={interactionMode}
                onSelect={(konvaEvt) => {
                  const addToSelection = konvaEvt?.evt?.shiftKey ?? false;
                  selectModule(i, addToSelection);
                  if (activeTool === 'select' && !addToSelection) {
                    const { x, y } = computeModuleScreenCenter(moduleRect);
                    onModuleSelect?.(i, x, y);
                  }
                }}
                onResizeStart={(e) => handleResizeStart(i, moduleRect.w, m.width, e)}
                onAddElement={(payload) => handleModuleAddElement(i, payload)}
                onRemoveElement={(type, id) => handleModuleRemoveElement(i, type, id)}
                onItemMove={onItemMove}
                onDrawerResize={onDrawerResize}
              />
            );
          })}

          {/* ── GLOBAL DIMENSION ANNOTATIONS ── */}

          {/* Width arrow */}
          <Line
            points={[mL, mT - dimLineH, mL + drawW, mT - dimLineH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Line
            points={[mL,        mT - dimLineH - dimTickH, mL,        mT - dimLineH + dimTickH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Line
            points={[mL + drawW, mT - dimLineH - dimTickH, mL + drawW, mT - dimLineH + dimTickH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Text
            x={mL} y={mT - dimLineH - 10 * scaleRatio}
            width={drawW}
            text={`${toNum(cabW)} cm`}
            align="center"
            fill={DIM_COLOR} fontSize={13 * scaleRatio} fontStyle="bold"
            listening={false}
          />

          {/* Height arrow */}
          <Line
            points={[rightDimX, mT, rightDimX, mT + drawH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Line
            points={[rightDimX - 6 * scaleRatio, mT,        rightDimX + 6 * scaleRatio, mT]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Line
            points={[rightDimX - 6 * scaleRatio, mT + drawH, rightDimX + 6 * scaleRatio, mT + drawH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false}
          />
          <Text
            x={rightDimX + 4 * scaleRatio}
            y={mT + drawH / 2}
            text={`${toNum(cabH)} cm`}
            rotation={90}
            offsetX={0}
            offsetY={-(13 * scaleRatio) / 2}
            fill={DIM_COLOR} fontSize={13 * scaleRatio} fontStyle="bold"
            listening={false}
          />

          {/* ── GLOBAL SLIDING DOORS indicator ── */}
          {globalSliding?.enabled && (
            <Group listening={false}>
              <Line
                points={[mL + 4, mT + 10, mL + drawW - 4, mT + 10]}
                stroke="#38bdf8" strokeWidth={2}
              />
              <Line
                points={[mL + 4, mT + innerH - 10, mL + drawW - 4, mT + innerH - 10]}
                stroke="#38bdf8" strokeWidth={2}
              />
              <Text
                x={mL} y={mT + 16}
                width={drawW}
                text={`${globalSliding.count} vantaux coulissants · H ${globalSliding.heightCm} cm`}
                align="center"
                fill="#0ea5e9" fontSize={11 * scaleRatio} fontStyle="bold"
              />
            </Group>
          )}

          {/* ── ANNOTATIONS (cotes et notes) ── */}
          <FacadeKonvaAnnotations
            elements={elements}
            stageWidth={stageW}
            stageHeight={stageH}
            activeTool={activeTool}
            onElementAdd={onElementAdd}
            onElementUpdate={onElementUpdate}
            onElementRemove={onElementRemove}
            stageRef={stageRef}
          />

          {/* ── SNAP LINE — amber vertical guide + badge shown during module resize ── */}
          {snapActive && snapLineX != null && (() => {
            const snapCm    = Math.round(hookSnapX / scaleRatio / (drawW / Math.max(1, toNum(cabW))));
            const badgeText = `${snapCm} cm`;
            const badgeFS   = 11 * scaleRatio;
            const badgePadY = 3  * scaleRatio;
            const badgeW    = 44 * scaleRatio;
            const badgeH    = badgeFS + 2 * badgePadY;
            const badgeX    = snapLineX - badgeW / 2;
            const badgeY    = mT - 20 * scaleRatio - badgeH;
            return (
              <>
                <Line
                  points={[snapLineX, mT, snapLineX, mT + drawH]}
                  stroke="#EF9F27"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                  listening={false}
                />
                <Rect
                  x={badgeX} y={badgeY}
                  width={badgeW} height={badgeH}
                  fill="#fef3c7"
                  stroke="#EF9F27" strokeWidth={1}
                  cornerRadius={3 * scaleRatio}
                  listening={false}
                />
                <Text
                  x={badgeX} y={badgeY + badgePadY}
                  width={badgeW}
                  text={badgeText}
                  align="center"
                  fill="#92400e"
                  fontSize={badgeFS}
                  fontStyle="bold"
                  listening={false}
                />
              </>
            );
          })()}

          {/* ── SNAP HORIZONTAL GUIDES — tablette-alignment guides during resize ── */}
          {snapActive && facadeItems
            .filter(it => it.type === 'shelf' || it.type === 'rod')
            .map(it => {
              const yGuide = mT + thPx + toNum(it.yRatio, 0.5) * (innerH - 2 * thPx);
              return (
                <Line
                  key={`snapH-${it.id}`}
                  points={[mL, yGuide, mL + drawW, yGuide]}
                  stroke="#EF9F27"
                  strokeWidth={1}
                  dash={[4, 3]}
                  opacity={0.6}
                  listening={false}
                />
              );
            })
          }

          {/* ── LIVE WIDTH BADGE — shown during module resize when not snapped ── */}
          {!snapActive && resizeWidthCm !== null && (() => {
            const badgeText = `${resizeWidthCm} cm`;
            const badgeFS   = 11 * scaleRatio;
            const badgePadY = 3  * scaleRatio;
            const badgeW    = 54 * scaleRatio;
            const badgeH    = badgeFS + 2 * badgePadY;
            const badgeX    = mL + drawW / 2 - badgeW / 2;
            const badgeY    = mT - 20 * scaleRatio - badgeH;
            return (
              <>
                <Rect
                  x={badgeX} y={badgeY}
                  width={badgeW} height={badgeH}
                  fill="#fef3c7"
                  stroke="#EF9F27" strokeWidth={1}
                  cornerRadius={3 * scaleRatio}
                  listening={false}
                />
                <Text
                  x={badgeX} y={badgeY + badgePadY}
                  width={badgeW}
                  text={badgeText}
                  align="center"
                  fill="#92400e"
                  fontSize={badgeFS}
                  fontStyle="bold"
                  listening={false}
                />
              </>
            );
          })()}

          {/* ── RUBBER BAND SELECTION RECT ── */}
          {rubberBand && (() => {
            const { x0, y0, x1, y1 } = rubberBand;
            const rx = Math.min(x0, x1);
            const ry = Math.min(y0, y1);
            const rw = Math.abs(x1 - x0);
            const rh = Math.abs(y1 - y0);
            return (
              <Rect
                x={rx} y={ry}
                width={rw} height={rh}
                fill="rgba(59, 130, 246, 0.12)"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[4, 3]}
                listening={false}
              />
            );
          })()}

        </Layer>

        {/* ── GRID + RULER LAYER (au-dessus du fond, non-interactif) ── */}
        {showGrid && (
          <GridLayer
            mL={mL} mT={mT}
            drawW={drawW} drawH={drawH}
            cabW={toNum(cabW)} cabH={toNum(cabH)}
            scaleRatio={scaleRatio}
          />
        )}
      </Stage>
    </div>
  );
});

export default FacadeKonvaEditor;
