/**
 * FacadeKonvaEditor.jsx — Éditeur façade Konva complet
 *
 * CORRECTIONS v2 :
 * - onItemMove correctement branché → setFacadeItems dans SketchEditor
 * - FacadeKonvaAnnotations intégré dans le Stage (cotes + notes)
 * - FacadeKonvaModule.jsx n'est plus utilisé (fichier orphelin)
 * - Snap indicator (ligne bleue) quand resize en cours
 * - exportDataUrl retourne un PNG haute résolution (pixelRatio 3)
 */
import React, {
  useRef, useState, useEffect, useMemo,
  useCallback, useImperativeHandle,
} from 'react';
import { Stage, Layer, Rect, Line, Text, Group, Circle } from 'react-konva';
import { WOOD_STROKE, DIM_COLOR } from './konvaTheme';
import FacadeKonvaItems from './FacadeKonvaItems';
import FacadeKonvaAnnotations from './FacadeKonvaAnnotations';

// ── Constantes ────────────────────────────────────────────────────────────────

const MARGIN = { l: 65, r: 52, t: 55, b: 65 };
const DOUBLE_COLOR          = '#d97706';
const BADGE_RADIUS          = 20;
const BADGE_STROKE_W        = 2;
const BADGE_FONT_SIZE       = 17;
const PINCH_GESTURE_DELAY   = 50;

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Gestes ────────────────────────────────────────────────────────────────────

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// ── Géométrie ─────────────────────────────────────────────────────────────────

function computeKonvaMRects({ facadeModules, joints, thPx, drawW, mL, mT, innerH }) {
  if (!facadeModules.length) return [];
  const totalSepPx = joints.reduce((acc, j) => acc + (j ? 2 * thPx : thPx), 0) + 2 * thPx;
  const avail      = drawW - totalSepPx;
  const totalModW  = facadeModules.reduce((a, m) => a + toNum(m.width, 0), 0);
  const scale      = avail / Math.max(1, totalModW);
  let xCur = mL + thPx;
  return facadeModules.map((m, i) => {
    const wPx = toNum(m.width, 0) * scale;
    const r = {
      x: xCur, w: wPx, m, i,
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      intH:      innerH - 2 * thPx,
      innerH,
      // Format attendu par FacadeKonvaItems
      modIdx: i,
      intX: xCur,
      intY: mT + thPx,
      intW: wPx,
    };
    xCur += wPx + (i < facadeModules.length - 1 ? (joints[i] ? 2 * thPx : thPx) : 0);
    return r;
  });
}

// ── Gradients bois ────────────────────────────────────────────────────────────

const woodGradH = (w) => ({
  fillLinearGradientStartPoint: { x: 0, y: 0 },
  fillLinearGradientEndPoint:   { x: w, y: 0 },
  fillLinearGradientColorStops: [0, '#dcc89a', 0.45, '#f5ede0', 1, '#dcc89a'],
});

const woodGradV = (h) => ({
  fillLinearGradientStartPoint: { x: 0, y: 0 },
  fillLinearGradientEndPoint:   { x: 0, y: h },
  fillLinearGradientColorStops: [0, '#c4a87a', 1, '#e8d5b0'],
});

const sepGradH = (w) => ({
  fillLinearGradientStartPoint: { x: 0, y: 0 },
  fillLinearGradientEndPoint:   { x: w, y: 0 },
  fillLinearGradientColorStops: [0, '#dcc89a', 0.48, '#e8d5b0', 0.52, '#c9b068', 1, '#dcc89a'],
});

// ── Composant principal ───────────────────────────────────────────────────────

const FacadeKonvaEditor = React.forwardRef(function FacadeKonvaEditor({
  svgW           = 1140,
  svgH           = 700,
  cabW,
  cabH,
  plinth,
  thick,
  facadeModules  = [],
  facadeItems    = [],
  joints         = [],
  cabinetModules = [],
  globalSliding,
  // Callbacks depuis SketchEditor
  onFacadePointerDown,   // (synthEvt, modIdx) — placement tablette/tringle
  onItemPointerDown,     // (synthEvt, itemId) — notification drag start (optionnel)
  onItemMove,            // (itemId, newYRatio) — mise à jour yRatio ← CRUCIAL
  onItemErase,           // (itemId)
  onModuleClick,         // (modIdx, tool)
  onModuleErase,         // (modIdx, type)
  // Annotations
  elements       = [],
  onElementAdd,
  onElementUpdate,
  onElementRemove,
  activeTool     = 'select',
}, ref) {

  const containerRef = useRef(null);
  const stageRef     = useRef(null);

  // ── Export PNG haute résolution pour PDF et Claude ────────────────────────
  useImperativeHandle(ref, () => ({
    exportDataUrl: () =>
      stageRef.current?.toDataURL({ mimeType: 'image/png', pixelRatio: 3 }) ?? null,
  }), []);

  // ── Taille responsive ────────────────────────────────────────────────────
  const [stageSize, setStageSize] = useState({ w: svgW, h: svgH });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width } = entries[0].contentRect;
      if (width < 10) return;
      const ratio = svgH / svgW;
      setStageSize({ w: width, h: Math.round(width * ratio) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [svgW, svgH]);

  // ── Zoom / Pan ───────────────────────────────────────────────────────────
  const [scale,    setScale]    = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastDist   = useRef(null);
  const isPinching = useRef(false);
  const panStart   = useRef(null);

  // Molette (non-passive pour pouvoir appeler preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const stage    = stageRef.current;
      if (!stage) return;
      const oldScale = stage.scaleX();
      const pointer  = stage.getPointerPosition();
      if (!pointer) return;
      const factor   = e.deltaY > 0 ? 1 / 1.06 : 1.06;
      const newScale = clamp(oldScale * factor, 0.4, 5);
      const mpt = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      setScale(newScale);
      setPosition({ x: pointer.x - mpt.x * newScale, y: pointer.y - mpt.y * newScale });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const { w: stageW, h: stageH } = stageSize;
  const scaleRatio = stageW / Math.max(1, svgW);

  // ── Géométrie ────────────────────────────────────────────────────────────
  const drawW = (svgW - MARGIN.l - MARGIN.r) * scaleRatio;
  const drawH = (svgH - MARGIN.t - MARGIN.b) * scaleRatio;
  const mL    = MARGIN.l * scaleRatio;
  const mT    = MARGIN.t * scaleRatio;
  const thPx  = toNum(thick, 1.8) * (drawW / Math.max(1, toNum(cabW)));
  const plPx  = toNum(plinth)      * (drawH / Math.max(1, toNum(cabH)));
  const innerH = drawH - plPx;

  const mRects = useMemo(() =>
    computeKonvaMRects({ facadeModules, joints, thPx, drawW, mL, mT, innerH }),
    [facadeModules, joints, thPx, drawW, mL, mT, innerH],
  );

  // ── Flags outils ────────────────────────────────────────────────────────
  const isErase  = activeTool === 'erase';
  const isPlace  = activeTool === 'shelf' || activeTool === 'rod';
  const isAdd    = activeTool === 'drawer' || activeTool === 'door' || activeTool === 'sliding';
  const isNavMode = activeTool === 'select';

  // ── Annotations (dim/note) — on les gère dans le Stage Konva ────────────
  const isDim  = activeTool === 'dim';
  const isNote = activeTool === 'note';

  // ── Touch handlers ───────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length === 1 && isNavMode) {
      const stage = stageRef.current;
      panStart.current = {
        cx: touches[0].clientX, cy: touches[0].clientY,
        sx: stage.x(), sy: stage.y(),
      };
    }
  }, [isNavMode]);

  const handleTouchMove = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      isPinching.current = true;
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      const newDist = getDistance(p1, p2);
      if (!lastDist.current) { lastDist.current = newDist; return; }
      const stage    = stageRef.current;
      const oldScale = stage.scaleX();
      const newScale = clamp(oldScale * (newDist / lastDist.current), 0.4, 5);
      const pointer  = stage.getPointerPosition();
      if (pointer) {
        const mpt = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        setScale(newScale);
        setPosition({ x: pointer.x - mpt.x * newScale, y: pointer.y - mpt.y * newScale });
      }
      lastDist.current = newDist;
    } else if (touches.length === 1 && isNavMode && panStart.current && !isPinching.current) {
      const dx = touches[0].clientX - panStart.current.cx;
      const dy = touches[0].clientY - panStart.current.cy;
      setPosition({ x: panStart.current.sx + dx, y: panStart.current.sy + dy });
    }
  }, [isNavMode]);

  const handleTouchEnd = useCallback(() => {
    lastDist.current = null;
    panStart.current = null;
    setTimeout(() => { isPinching.current = false; }, PINCH_GESTURE_DELAY);
  }, []);

  // ── Placement tablette / tringle dans un module ──────────────────────────
  const handleModulePlace = useCallback((konvaEvt, modIdx, intTop, iH) => {
    if (!onFacadePointerDown) return;
    konvaEvt.cancelBubble = true;
    const stage = konvaEvt.target.getStage();
    const pos   = stage?.getPointerPosition();
    if (!pos) return;
    const yRatio = clamp((pos.y - intTop) / Math.max(1, iH), 0.02, 0.98);
    const cr     = stage.container()?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    onFacadePointerDown(
      { stopPropagation: () => {}, clientX: cr.left + pos.x, clientY: cr.top + pos.y, _konvaYRatio: yRatio },
      modIdx,
    );
  }, [onFacadePointerDown]);

  // ── Annotations ──────────────────────────────────────────────────────────
  const annotBaseY = mT + drawH;
  const dimTickH   = 6 * scaleRatio;
  const rightDimX  = mL + drawW + 24 * scaleRatio;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%', touchAction: 'none' }}>
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Layer>

          {/* ── Fond bois extérieur ── */}
          <Rect x={mL} y={mT} width={drawW} height={drawH}
            {...woodGradH(drawW)} stroke={WOOD_STROKE} strokeWidth={2.5} listening={false} />

          {/* Fond intérieur */}
          <Rect x={mL + thPx} y={mT + thPx}
            width={drawW - 2 * thPx} height={innerH - thPx}
            fill="#ede4d3" listening={false} />

          {/* ── Plinthe ── */}
          {plPx > 2 && (
            <Group listening={false}>
              <Rect x={mL} y={mT + innerH} width={drawW} height={plPx}
                fill="#c8b07c" stroke={WOOD_STROKE} strokeWidth={1.5} />
              <Line points={[mL, mT + innerH, mL + drawW, mT + innerH]}
                stroke={WOOD_STROKE} strokeWidth={2} />
            </Group>
          )}

          {/* ── Panneaux latéraux ── */}
          <Rect x={mL} y={mT} width={thPx} height={innerH}
            {...woodGradH(thPx)} stroke={WOOD_STROKE} strokeWidth={1.5} listening={false} />
          <Rect x={mL + drawW - thPx} y={mT} width={thPx} height={innerH}
            {...woodGradH(thPx)} stroke={WOOD_STROKE} strokeWidth={1.5} listening={false} />

          {/* ── Panneau dessus ── */}
          <Rect x={mL} y={mT} width={drawW} height={thPx}
            {...woodGradV(thPx)} stroke={WOOD_STROKE} strokeWidth={1.5} listening={false} />

          {/* ── Panneau dessous ── */}
          <Rect x={mL} y={mT + innerH - thPx} width={drawW} height={thPx}
            {...woodGradV(thPx)} stroke={WOOD_STROKE} strokeWidth={1.5} listening={false} />

          {/* ── Séparateurs ── */}
          {mRects.map(({ x, w, i }) => {
            if (i >= facadeModules.length - 1) return null;
            const sepX     = x + w;
            const isDouble = joints[i];
            if (isDouble) {
              return (
                <Group key={`sep-${i}`} listening={false}>
                  <Rect x={sepX}        y={mT} width={thPx} height={innerH}
                    {...sepGradH(thPx)} stroke={WOOD_STROKE} strokeWidth={1} />
                  <Rect x={sepX + thPx} y={mT} width={thPx} height={innerH}
                    {...sepGradH(thPx)} stroke={WOOD_STROKE} strokeWidth={1} />
                  <Line points={[sepX + thPx, mT + 2, sepX + thPx, mT + innerH - 2]}
                    stroke={DOUBLE_COLOR} strokeWidth={1.5} dash={[4, 3]} opacity={0.9} />
                </Group>
              );
            }
            return (
              <Rect key={`sep-${i}`} x={sepX} y={mT} width={thPx} height={innerH}
                {...woodGradH(thPx)} stroke={WOOD_STROKE} strokeWidth={1} listening={false} />
            );
          })}

          {/* ── Modules ── */}
          {mRects.map((mr) => {
            const { x, w, m, i, intTop, intH: iH, intBottom } = mr;
            const annotY = annotBaseY + 10 * scaleRatio;

            return (
              <Group key={`mod-${i}`}>
                {/* Fond intérieur du module */}
                <Rect x={x} y={intTop} width={w} height={iH}
                  fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth={0.7} listening={false} />

                {/* Éléments intérieurs (tiroirs, portes, tablettes, tringles) */}
                <FacadeKonvaItems
                  moduleRect={mr}
                  facadeItems={facadeItems}
                  module={m}
                  moduleDetail={cabinetModules[i] || null}
                  isEraseTool={isErase}
                  onItemMove={onItemMove}          // ← correctement branché
                  onItemRemove={onItemErase}
                  onRemoveElement={onModuleErase}
                />

                {/* Badge numéro */}
                <Circle x={x + w / 2} y={intTop + iH * 0.45}
                  radius={BADGE_RADIUS} fill="transparent"
                  stroke={DIM_COLOR} strokeWidth={BADGE_STROKE_W} listening={false} />
                <Text
                  x={x + w / 2 - BADGE_RADIUS} y={intTop + iH * 0.45 - BADGE_RADIUS / 2}
                  width={BADGE_RADIUS * 2} height={BADGE_RADIUS}
                  text={String(i + 1)} align="center" verticalAlign="middle"
                  fill={DIM_COLOR} fontStyle="bold"
                  fontSize={BADGE_FONT_SIZE * scaleRatio} listening={false} />

                {/* Cote largeur en bas */}
                <Line points={[x, annotY, x + w, annotY]}
                  stroke="#b45309" strokeWidth={1} listening={false} />
                <Line points={[x, annotY - dimTickH, x, annotY + dimTickH]}
                  stroke="#b45309" strokeWidth={1} listening={false} />
                <Line points={[x + w, annotY - dimTickH, x + w, annotY + dimTickH]}
                  stroke="#b45309" strokeWidth={1} listening={false} />
                <Text x={x} y={annotY + 5 * scaleRatio} width={w}
                  text={`${toNum(m.width).toFixed(1)} cm`} align="center"
                  fill="#b45309" fontStyle="bold" fontSize={11 * scaleRatio} listening={false} />

                {/* Zone de hit — placement tablette / tringle */}
                {isPlace && (
                  <Rect x={x} y={intTop} width={w} height={iH} fill="transparent"
                    onMouseDown={(e) => handleModulePlace(e, i, intTop, iH)}
                    onTouchStart={(e) => handleModulePlace(e, i, intTop, iH)}
                    style={{ cursor: 'crosshair' }}
                  />
                )}

                {/* Zone de hit — ajout tiroir / porte */}
                {isAdd && (
                  <Rect x={x} y={intTop} width={w} height={iH} fill="transparent"
                    onClick={(e) => { e.cancelBubble = true; onModuleClick?.(i, activeTool); }}
                    onTap={(e)   => { e.cancelBubble = true; onModuleClick?.(i, activeTool); }}
                    style={{ cursor: 'cell' }}
                  />
                )}
              </Group>
            );
          })}

          {/* ── Cote largeur totale ── */}
          <Line points={[mL, mT - 24 * scaleRatio, mL + drawW, mT - 24 * scaleRatio]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Line points={[mL, mT - 30 * scaleRatio, mL, mT - 18 * scaleRatio]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Line points={[mL + drawW, mT - 30 * scaleRatio, mL + drawW, mT - 18 * scaleRatio]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Text x={mL} y={mT - 34 * scaleRatio} width={drawW}
            text={`${toNum(cabW)} cm`} align="center"
            fill={DIM_COLOR} fontSize={13 * scaleRatio} fontStyle="bold" listening={false} />

          {/* ── Cote hauteur droite ── */}
          <Line points={[rightDimX, mT, rightDimX, mT + drawH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Line points={[rightDimX - 6 * scaleRatio, mT, rightDimX + 6 * scaleRatio, mT]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Line points={[rightDimX - 6 * scaleRatio, mT + drawH, rightDimX + 6 * scaleRatio, mT + drawH]}
            stroke={DIM_COLOR} strokeWidth={1.5} listening={false} />
          <Text
            x={rightDimX + 4 * scaleRatio} y={mT + drawH / 2}
            text={`${toNum(cabH)} cm`}
            rotation={90} offsetY={-(13 * scaleRatio) / 2}
            fill={DIM_COLOR} fontSize={13 * scaleRatio} fontStyle="bold" listening={false} />

          {/* ── Portes coulissantes globales ── */}
          {globalSliding?.enabled && (
            <Group listening={false}>
              <Line points={[mL + 4, mT + 10, mL + drawW - 4, mT + 10]}
                stroke="#38bdf8" strokeWidth={2} />
              <Line points={[mL + 4, mT + innerH - 10, mL + drawW - 4, mT + innerH - 10]}
                stroke="#38bdf8" strokeWidth={2} />
              <Text x={mL} y={mT + 16} width={drawW}
                text={`${globalSliding.count} vantaux coulissants · H ${globalSliding.heightCm} cm`}
                align="center" fill="#0ea5e9" fontSize={11 * scaleRatio} fontStyle="bold" />
            </Group>
          )}

          {/* ── Annotations (cotes + notes) ── */}
          <FacadeKonvaAnnotations
            elements={elements}
            stageWidth={stageW / scale}
            stageHeight={stageH / scale}
            activeTool={activeTool}
            onElementAdd={onElementAdd}
            onElementUpdate={onElementUpdate}
            onElementRemove={onElementRemove}
            stageRef={stageRef}
          />

        </Layer>
      </Stage>
    </div>
  );
});

export default FacadeKonvaEditor;
