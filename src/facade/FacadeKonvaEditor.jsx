import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Text, Group, Circle } from 'react-konva';
import { WOOD_STROKE, DIM_COLOR } from './konvaTheme';
import FacadeKonvaItems from './FacadeKonvaItems';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Visual margins (in SVG reference pixels) matching FacadeCanvas */
const MARGIN = { l: 65, r: 52, t: 55, b: 65 };

const DOUBLE_COLOR = '#d97706';

// Module number badge geometry
const BADGE_RADIUS      = 20;
const BADGE_STROKE_W    = 2;
const BADGE_FONT_SIZE   = 17;
const BADGE_MIN_OFFSET  = 30;   // minimum top offset inside module
const BADGE_MIDDLE_FRAC = 0.45; // fraction of module height for the preferred center
const BADGE_MAX_FRAC    = 0.70; // maximum fraction to keep badge away from bottom

// Double-separator label geometry
const DOUBLE_LABEL_OFFSET = 10;
const DOUBLE_LABEL_WIDTH  = 20;

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

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
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      intH:      innerH - 2 * thPx,
      innerH,
    };
    xCur += wPx + (i < facadeModules.length - 1 ? (joints[i] ? 2 * thPx : thPx) : 0);
    return r;
  });
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
export default function FacadeKonvaEditor({
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
  onFacadePointerDown,
  onItemPointerDown,
  onItemErase,
  onModuleClick,
  onModuleErase,
  activeTool      = 'select',
}) {
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

  // ── 3. TOOL FLAGS ─────────────────────────────────────────────────────────
  const isErase = activeTool === 'erase';
  const isPlace = activeTool === 'shelf' || activeTool === 'rod';
  const isAdd   = activeTool === 'drawer' || activeTool === 'door' || activeTool === 'sliding';

  // ── 4. ANNOTATION Y (scaled margins) ─────────────────────────────────────
  const annotBaseY = mT + drawH;   // bottom of drawing area
  const dimLineH   = 26 * scaleRatio;
  const dimTickH   = 6  * scaleRatio;
  const rightDimX  = mL + drawW + 24 * scaleRatio;

  // ── 5. EVENT HANDLERS ─────────────────────────────────────────────────────

  /**
   * Shelf / rod placement hit.
   * Converts the Konva pointer position to a synthetic event compatible with
   * useSketchGestures.handleFacadePointerDown (which calls getSVGCoords).
   * We embed the already-computed yRatio in e._konvaYRatio so that a
   * Konva-aware gesture handler can use it directly without SVG maths.
   */
  const handleModulePlace = useCallback((konvaEvt, modIdx, intTop, intH) => {
    if (!onFacadePointerDown) return;
    konvaEvt.cancelBubble = true;
    const stage = konvaEvt.target.getStage();
    const pos   = stage?.getPointerPosition();
    if (!pos) return;
    const yRatio = Math.max(0.02, Math.min(0.98, (pos.y - intTop) / intH));
    // Synthetic event: includes screen coords + pre-computed yRatio
    const container = stage.container();
    const cr        = container?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const synth = {
      stopPropagation: () => {},
      clientX:         cr.left + pos.x,
      clientY:         cr.top  + pos.y,
      _konvaYRatio:    yRatio,
    };
    onFacadePointerDown(synth, modIdx);
  }, [onFacadePointerDown]);

  /**
   * Item drag start (shelf / rod).
   * FacadeKonvaItems already handles drag internally via Konva's built-in
   * draggable, so onItemPointerDown is called here as a notification only.
   */
  const handleItemPointerDown = useCallback((konvaEvt, itemId) => {
    if (!onItemPointerDown) return;
    konvaEvt.cancelBubble = true;
    const stage = konvaEvt.target.getStage?.();
    const pos   = stage?.getPointerPosition();
    const container = stage?.container();
    const cr        = container?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const synth = {
      stopPropagation: () => {},
      clientX: pos ? cr.left + pos.x : 0,
      clientY: pos ? cr.top  + pos.y : 0,
    };
    onItemPointerDown(synth, itemId);
  }, [onItemPointerDown]);

  // ── 6. RENDER ─────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <Stage ref={stageRef} width={stageW} height={stageH}>
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
          {mRects.map(({ x, w, m, i, intTop, intH: iH, intBottom }) => {
            const numY   = intTop + Math.min(Math.max(BADGE_MIN_OFFSET, iH * BADGE_MIDDLE_FRAC), iH * BADGE_MAX_FRAC);
            const annotY = annotBaseY + 10 * scaleRatio;

            // Rect descriptor for FacadeKonvaItems
            const moduleRect = {
              modIdx: i,
              x, y: intTop, w, h: iH,
              intX: x, intY: intTop, intW: w, intH: iH,
              widthCm: m.width,
            };

            return (
              <Group key={`mod-${i}`}>
                {/* Module interior background */}
                <Rect
                  x={x} y={intTop} width={w} height={iH}
                  fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth={0.7}
                  listening={false}
                />

                {/* Interior elements: drawers, doors, shelves, rods */}
                <FacadeKonvaItems
                  moduleRect={moduleRect}
                  facadeItems={facadeItems}
                  module={m}
                  moduleDetail={cabinetModules[i] || null}
                  isEraseTool={isErase}
                  onItemMove={() => {
                    // Item drag is handled internally by FacadeKonvaItems via Konva's
                    // built-in draggable. The parent state is updated through
                    // onItemRemove / onRemoveElement; there is no yRatio callback here
                    // because FacadeKonvaItems commits the new yRatio itself.
                  }}
                  onItemRemove={(itemId) => onItemErase?.(itemId)}
                  onRemoveElement={(modIdx, type) => onModuleErase?.(modIdx, type)}
                />

                {/* Module number badge */}
                <Circle
                  x={x + w / 2} y={numY}
                  radius={BADGE_RADIUS}
                  fill="transparent" stroke={DIM_COLOR} strokeWidth={BADGE_STROKE_W}
                  listening={false}
                />
                <Text
                  x={x + w / 2 - BADGE_RADIUS} y={numY - BADGE_RADIUS / 2}
                  width={BADGE_RADIUS * 2} height={BADGE_RADIUS}
                  text={String(i + 1)}
                  align="center" verticalAlign="middle"
                  fill={DIM_COLOR} fontStyle="bold" fontSize={BADGE_FONT_SIZE * scaleRatio}
                  listening={false}
                />

                {/* Width annotation below module */}
                <Line
                  points={[x, annotY, x + w, annotY]}
                  stroke="#b45309" strokeWidth={1} listening={false}
                />
                <Line
                  points={[x, annotY - dimTickH / 2, x, annotY + dimTickH / 2]}
                  stroke="#b45309" strokeWidth={1} listening={false}
                />
                <Line
                  points={[x + w, annotY - dimTickH / 2, x + w, annotY + dimTickH / 2]}
                  stroke="#b45309" strokeWidth={1} listening={false}
                />
                <Text
                  x={x} y={annotY + 6 * scaleRatio}
                  width={w}
                  text={`${m.width.toFixed(2)} cm`}
                  align="center"
                  fill="#b45309" fontStyle="bold" fontSize={11 * scaleRatio}
                  listening={false}
                />

                {/* ── Interaction hit zone ── */}
                {isPlace && (
                  <Rect
                    x={x} y={intTop} width={w} height={iH}
                    fill="transparent"
                    style={{ cursor: 'cell' }}
                    onMouseDown={(e) => handleModulePlace(e, i, intTop, iH)}
                    onTouchStart={(e) => handleModulePlace(e, i, intTop, iH)}
                  />
                )}
                {isAdd && (
                  <Rect
                    x={x} y={intTop} width={w} height={iH}
                    fill="transparent"
                    style={{ cursor: 'cell' }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onModuleClick?.(i, activeTool);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      onModuleClick?.(i, activeTool);
                    }}
                  />
                )}
              </Group>
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

        </Layer>
      </Stage>
    </div>
  );
}
