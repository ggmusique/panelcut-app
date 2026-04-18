import React, { useState, useRef, useCallback } from 'react';

const WOOD_FILL    = '#f5ede0';
const WOOD_STROKE  = '#8b6914';
const DOUBLE_COLOR = '#d97706';
const DIM_COLOR    = '#dc2626';
const MARGIN       = { l: 70, r: 55, t: 60, b: 70 };

// Eraser cursor — a small red eraser icon encoded as data URI
const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'%3E%3Cpolygon points='4,22 18,22 18,10 11,2 4,10' fill='%23fca5a5' stroke='%23991b1b' stroke-width='1.5'/%3E%3Crect x='4' y='14' width='14' height='8' rx='1' fill='%23ef4444' stroke='%23991b1b' stroke-width='1.5'/%3E%3Cline x1='11' y1='14' x2='11' y2='22' stroke='%23991b1b' stroke-width='1'/%3E%3C/svg%3E") 11 22, cell`;

const CURSORS = {
  select:  'default',
  shelf:   'cell',
  rod:     'cell',
  drawer:  'cell',
  cote:    'crosshair',
  eraser:  ERASER_CURSOR,
};

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Convert a DOM mouse/touch event to SVG viewBox coordinates */
function getSVGCoords(svgEl, e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}

/**
 * FacadeSVG — technical plan view of the cabinet.
 * Supports trapezoid modules (biais) and all content types.
 * Interactive: place / move / delete elements directly on the drawing.
 *
 * Props:
 *   cabinet        — cabinet state object
 *   svgRef         — optional external ref forwarded to <svg> (for capture)
 *   activeTool     — 'select' | 'shelf' | 'rod' | 'drawer' | 'cote' | 'eraser'
 *   onAddElement   — (modIdx, type, yFromBottom) => void
 *   onDeleteElement— (modIdx, type, elemIdx) => void
 *   onMoveElement  — (modIdx, type, elemIdx, newYFromBottom) => void
 *   onAddAnnotation— ({ x1, y1, x2, y2 }) => void
 */
export default function FacadeSVG({
  cabinet,
  svgRef,
  activeTool,
  onAddElement,
  onDeleteElement,
  onMoveElement,
  onAddAnnotation,
}) {
  // ── Internal state for interactivity ──────────────────────────────────────
  const localSvgRef = useRef(null);
  // Merge external svgRef with internal one via callback ref
  const setSvgRef = useCallback((el) => {
    localSvgRef.current = el;
    if (svgRef) {
      if (typeof svgRef === 'function') svgRef(el);
      else svgRef.current = el;
    }
  }, [svgRef]);

  // drag = { modIdx, type, elemIdx, startSvgY, currentSvgY, originalYCm, blY, tlY }
  const [drag, setDrag] = useState(null);
  // hoverElem = { modIdx, type, elemIdx } — for eraser hover highlight
  const [hoverElem, setHoverElem] = useState(null);
  // coteStart = { x, y } — first click for dimension annotation
  const [coteStart, setCoteStart] = useState(null);

  if (!cabinet) return null;

  const {
    totalWidth: W  = 240,
    heightLeft: HL = 220,
    heightRight: HR = 220,
    plinth: PL     = 10,
    thickness: TH  = 1.8,
    modules        = [],
  } = cabinet;

  const SVG_W = 980;
  const SVG_H = 620;

  const drawW = SVG_W - MARGIN.l - MARGIN.r;
  const drawH = SVG_H - MARGIN.t - MARGIN.b;

  // Scale
  const sx = drawW / Math.max(1, W);
  const sy = drawH / Math.max(1, Math.max(HL, HR));

  const ox = MARGIN.l;
  const oy = MARGIN.t;

  const plPxL = PL * sy;
  const plPxR = PL * sy;
  const thPx  = TH * sy;

  // Compute module X positions (each module has its own width in net cm)
  // First we need total net cm including shared stiles.
  // totalWidth = 2*TH + (nbMod-1)*2*TH + sum(modWidths)
  // So sum(modWidths) = totalWidth - 2*TH - (nbMod-1)*2*TH
  const nbMod      = modules.length;
  const totalStiles = 2 * TH + (nbMod > 1 ? (nbMod - 1) * 2 * TH : 0);
  const netTotal    = Math.max(1, W - totalStiles);
  const sumModW     = modules.reduce((s, m) => s + (m.width || 0), 0);
  const modScale    = sumModW > 0 ? netTotal / sumModW : 1;

  // Build module rectangles
  const thPxX = TH * sx; // thickness in X pixels
  let curX = ox + thPxX; // start after left stile
  const modRects = modules.map((m, i) => {
    const netWPx = m.width * modScale * sx;
    const modHL  = toNum(m.heightLeft  ?? HL, HL);
    const modHR  = toNum(m.heightRight ?? HR, HR);
    const hlPx   = modHL * sy;
    const hrPx   = modHR * sy;
    const plHLpx = PL * sy;
    const plHRpx = PL * sy;
    const intHLpx = hlPx - plHLpx;
    const intHRpx = hrPx - plHRpx;
    const rect = {
      x: curX,
      w: netWPx,
      m,
      i,
      hlPx,
      hrPx,
      intHLpx,
      intHRpx,
      // Top-left, top-right, bottom-right, bottom-left of interior area
      tl: { x: curX,           y: oy + thPx },
      tr: { x: curX + netWPx,  y: oy + thPx },
      // Bottom accounting for plinth
      bl: { x: curX,           y: oy + hlPx - plHLpx - thPx },
      br: { x: curX + netWPx,  y: oy + hrPx - plHRpx - thPx },
    };
    curX += netWPx + 2 * thPxX; // advance past this module + double stile
    return rect;
  });

  const totalDrawH = drawH;

  // Average height for exterior box
  const avgHL = toNum(HL, 220);
  const avgHR = toNum(HR, 220);
  const boxHL = avgHL * sy;
  const boxHR = avgHR * sy;

  // ── Interaction helpers ──────────────────────────────────────────────────

  const isInteractive = !!activeTool && activeTool !== 'select';

  // Convert an interior click (SVG coords) to yFromBottom (cm)
  function yFromSVG(svgY, blY) {
    return Math.max(0, (blY - svgY) / sy);
  }

  // Clamp a yFromBottom value to the module's interior height
  function clampY(yCm, tlY, blY) {
    const maxCm = (blY - tlY) / sy;
    return Math.max(0, Math.min(yCm, maxCm));
  }

  // Click on the module interior overlay: place element
  function handleModuleClick(e, modRect) {
    const tool = activeTool;
    if (!tool || tool === 'select' || tool === 'eraser' || tool === 'cote') return;
    e.stopPropagation();
    const svgEl = localSvgRef.current;
    if (!svgEl) return;
    const pt = getSVGCoords(svgEl, e);
    const rawY = yFromSVG(pt.y, modRect.bl.y);
    const yCm  = clampY(rawY, modRect.tl.y, modRect.bl.y);
    onAddElement?.(modRect.i, tool, yCm);
  }

  // Click on the SVG background for cote tool
  function handleSVGClick(e) {
    if (activeTool !== 'cote') return;
    const svgEl = localSvgRef.current;
    if (!svgEl) return;
    const pt = getSVGCoords(svgEl, e);
    if (!coteStart) {
      setCoteStart({ x: pt.x, y: pt.y });
    } else {
      onAddAnnotation?.({ x1: coteStart.x, y1: coteStart.y, x2: pt.x, y2: pt.y });
      setCoteStart(null);
    }
  }

  // Mouse down on an interactive element (select drag OR eraser delete)
  function handleElemMouseDown(e, modIdx, type, elemIdx, yCm, blY, tlY) {
    if (activeTool === 'eraser') {
      e.stopPropagation();
      onDeleteElement?.(modIdx, type, elemIdx);
      setHoverElem(null);
      return;
    }
    if (activeTool === 'select') {
      e.stopPropagation();
      const svgEl = localSvgRef.current;
      if (!svgEl) return;
      const pt = getSVGCoords(svgEl, e);
      setDrag({ modIdx, type, elemIdx, startSvgY: pt.y, currentSvgY: pt.y, originalYCm: yCm, blY, tlY });
    }
  }

  // SVG-level mouse move — update drag preview
  function handleSVGMouseMove(e) {
    if (!drag) return;
    const svgEl = localSvgRef.current;
    if (!svgEl) return;
    const pt = getSVGCoords(svgEl, e);
    setDrag(prev => prev ? { ...prev, currentSvgY: pt.y } : null);
  }

  // SVG-level mouse up — commit drag
  function handleSVGMouseUp(e) {
    if (!drag) return;
    const svgEl = localSvgRef.current;
    if (svgEl) {
      const pt = getSVGCoords(svgEl, e);
      const deltaCm  = (drag.startSvgY - pt.y) / sy; // up = higher yFromBottom
      const newYCm   = clampY(drag.originalYCm + deltaCm, drag.tlY, drag.blY);
      onMoveElement?.(drag.modIdx, drag.type, drag.elemIdx, newYCm);
    }
    setDrag(null);
  }

  // Compute dragged position in SVG coords for preview rendering
  function getDragPreviewY(modIdx, type, elemIdx, defaultSvgY) {
    if (!drag) return defaultSvgY;
    if (drag.modIdx !== modIdx || drag.type !== type || drag.elemIdx !== elemIdx) return defaultSvgY;
    const deltaSvg = drag.currentSvgY - drag.startSvgY;
    return defaultSvgY + deltaSvg;
  }

  function isHovered(modIdx, type, elemIdx) {
    return hoverElem &&
      hoverElem.modIdx === modIdx &&
      hoverElem.type   === type   &&
      hoverElem.elemIdx === elemIdx;
  }

  const svgCursor = CURSORS[activeTool] || 'default';

  return (
    <svg
      ref={setSvgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto bg-white rounded-xl border border-slate-200 shadow-xl"
      style={{ cursor: svgCursor }}
      onMouseMove={handleSVGMouseMove}
      onMouseUp={handleSVGMouseUp}
      onMouseLeave={() => { if (drag) setDrag(null); }}
      onClick={handleSVGClick}
    >
      <defs>
        <linearGradient id="gWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#dcc89a"/>
          <stop offset="45%"  stopColor="#f5ede0"/>
          <stop offset="100%" stopColor="#dcc89a"/>
        </linearGradient>
        <linearGradient id="gRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c4a87a"/>
          <stop offset="100%" stopColor="#e8d5b0"/>
        </linearGradient>
        <linearGradient id="gDouble" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#dcc89a"/>
          <stop offset="48%"  stopColor="#e8d5b0"/>
          <stop offset="52%"  stopColor="#c9b068"/>
          <stop offset="100%" stopColor="#dcc89a"/>
        </linearGradient>
        <linearGradient id="gDoor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#e8dcc8" stopOpacity="0.75"/>
          <stop offset="50%"  stopColor="#f8f0e4" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#ddd0ba" stopOpacity="0.75"/>
        </linearGradient>
        <marker id="arrR2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L8 4L0 8Z" fill={DIM_COLOR} />
        </marker>
        <marker id="arrL2" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M8 0L0 4L8 8Z" fill={DIM_COLOR} />
        </marker>
        <marker id="arrU2" viewBox="0 0 8 8" refX="4" refY="1" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 8L4 0L8 8Z" fill={DIM_COLOR} />
        </marker>
        <marker id="arrD2" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L4 8L8 0Z" fill={DIM_COLOR} />
        </marker>
      </defs>

      {/* Title */}
      <text x={SVG_W / 2} y={24} textAnchor="middle" fontSize={13} fontWeight="700" fill="#334155">
        Vue façade — {W} × {Math.max(HL, HR)} cm {Math.abs(HL - HR) > 0.1 ? `(biais: G${HL} / D${HR})` : ''}
      </text>

      {/* Exterior body — trapezoid if biais */}
      <polygon
        points={`${ox},${oy} ${ox + drawW},${oy + (boxHR - boxHL)} ${ox + drawW},${oy + boxHR} ${ox},${oy + boxHL}`}
        fill="url(#gWood)"
        stroke={WOOD_STROKE}
        strokeWidth="2.5"
      />

      {/* Interior fill */}
      <polygon
        points={`
          ${ox + thPxX},${oy + thPx}
          ${ox + drawW - thPxX},${oy + (boxHR - boxHL) + thPx}
          ${ox + drawW - thPxX},${oy + boxHR - plPxR - thPx}
          ${ox + thPxX},${oy + boxHL - plPxL - thPx}
        `}
        fill="#ede4d3"
      />

      {/* Left exterior stile */}
      <rect x={ox} y={oy} width={thPxX} height={boxHL - plPxL} fill="url(#gWood)" stroke={WOOD_STROKE} strokeWidth="1.5"/>

      {/* Right exterior stile */}
      <rect x={ox + drawW - thPxX} y={oy + (boxHR - boxHL)} width={thPxX} height={boxHR - plPxR} fill="url(#gWood)" stroke={WOOD_STROKE} strokeWidth="1.5"/>

      {/* Top rail */}
      <polygon
        points={`${ox},${oy} ${ox + drawW},${oy + (boxHR - boxHL)} ${ox + drawW},${oy + (boxHR - boxHL) + thPx} ${ox},${oy + thPx}`}
        fill="url(#gRail)"
        stroke={WOOD_STROKE}
        strokeWidth="1.5"
      />

      {/* Bottom rail (above plinth) */}
      <polygon
        points={`
          ${ox},${oy + boxHL - plPxL - thPx}
          ${ox + drawW},${oy + boxHR - plPxR - thPx}
          ${ox + drawW},${oy + boxHR - plPxR}
          ${ox},${oy + boxHL - plPxL}
        `}
        fill="url(#gRail)"
        stroke={WOOD_STROKE}
        strokeWidth="1.5"
      />

      {/* Plinth */}
      {PL > 0 && (
        <>
          <polygon
            points={`
              ${ox},${oy + boxHL - plPxL}
              ${ox + drawW},${oy + boxHR - plPxR}
              ${ox + drawW},${oy + boxHR}
              ${ox},${oy + boxHL}
            `}
            fill="#c8b07c"
            stroke={WOOD_STROKE}
            strokeWidth="1.5"
          />
          <text x={ox + drawW / 2} y={oy + boxHL - plPxL / 2 + 4} textAnchor="middle" fontSize={9} fill="#5a3e1b">
            Plinthe {PL} cm
          </text>
        </>
      )}

      {/* Inter-module double stiles */}
      {modRects.map(({ x, w, i }) => {
        if (i >= nbMod - 1) return null;
        const stileX = x + w;
        return (
          <g key={`stile-${i}`}>
            <rect x={stileX}          y={oy} width={thPxX} height={totalDrawH - plPxL} fill="url(#gDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
            <rect x={stileX + thPxX}  y={oy} width={thPxX} height={totalDrawH - plPxL} fill="url(#gDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
            <line x1={stileX + thPxX} y1={oy + 2} x2={stileX + thPxX} y2={oy + totalDrawH - plPxL - 2}
              stroke={DOUBLE_COLOR} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9"/>
            {/* "double" indicator */}
            <text x={stileX + thPxX} y={oy + totalDrawH - plPxL + 14}
              textAnchor="middle" fill={DOUBLE_COLOR} fontSize="8" fontWeight="700">⬛⬛</text>
          </g>
        );
      })}

      {/* Module contents */}
      {modRects.map(({ x, w, i, tl, tr, bl, br, intHLpx, intHRpx }) => {
        const mod = modules[i];
        if (!mod) return null;
        const content = mod.content || {};
        const modHL = toNum(mod.heightLeft ?? HL, HL);
        const modHR = toNum(mod.heightRight ?? HR, HR);
        const intH = (modHL - PL - TH * 2) * sy; // interior height in px at left edge

        // Y from bottom (cm) → px from top of interior
        const cmToY = (yCm) => bl.y - yCm * sy;

        // Shared props for interactive (draggable/erasable) elements
        const elemProps = (type, idx, yCm) => {
          if (!activeTool || activeTool === 'cote') return {};
          const hovered = isHovered(i, type, idx);
          const isDragging = drag && drag.modIdx === i && drag.type === type && drag.elemIdx === idx;
          return {
            style: {
              cursor: activeTool === 'eraser' ? ERASER_CURSOR
                : activeTool === 'select' ? (isDragging ? 'grabbing' : 'grab')
                : 'default',
              opacity: hovered && activeTool === 'eraser' ? 0.55 : 1,
            },
            onMouseDown: (e) => handleElemMouseDown(e, i, type, idx, yCm, bl.y, tl.y),
            onMouseEnter: () => setHoverElem({ modIdx: i, type, elemIdx: idx }),
            onMouseLeave: () => setHoverElem(h => (h && h.modIdx === i && h.type === type && h.elemIdx === idx) ? null : h),
          };
        };

        // Shelves
        const shelves = (content.shelves || []).map((sh, si) => {
          const baseY  = cmToY(sh.yFromBottom ?? 0);
          const yPx    = getDragPreviewY(i, 'shelf', si, baseY);
          const ep     = elemProps('shelf', si, sh.yFromBottom ?? 0);
          return (
            <g key={`sh-${i}-${si}`} {...ep}>
              <rect x={tl.x + 2} y={yPx - 3} width={w - 4} height={5}
                fill="#7c6341" stroke={WOOD_STROKE} strokeWidth="0.8" rx="1"/>
              {/* Wider invisible hit area */}
              <rect x={tl.x} y={yPx - 7} width={w} height={13} fill="transparent"/>
            </g>
          );
        });

        // Drawers
        const drawers = (content.drawers || []).map((dr, di) => {
          const h      = (dr.height ?? 18) * sy;
          const baseY  = cmToY((dr.yFromBottom ?? 0) + (dr.height ?? 18));
          const yPx    = getDragPreviewY(i, 'drawer', di, baseY);
          const ep     = elemProps('drawer', di, dr.yFromBottom ?? 0);
          return (
            <g key={`dr-${i}-${di}`} {...ep}>
              <rect x={tl.x + 2} y={yPx + 1} width={w - 4} height={h - 2}
                fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1" rx="1"/>
              <rect x={tl.x + w / 2 - 14} y={yPx + h / 2 - 3.5} width="28" height="7"
                fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" rx="3"/>
              <ellipse cx={tl.x + w / 2} cy={yPx + h / 2} rx="3.5" ry="2.5" fill="#6b7280"/>
            </g>
          );
        });

        // Rods
        const rods = (content.rods || []).map((rod, ri) => {
          const baseY  = cmToY(rod.yFromBottom ?? 160);
          const yPx    = getDragPreviewY(i, 'rod', ri, baseY);
          const ep     = elemProps('rod', ri, rod.yFromBottom ?? 160);
          return (
            <g key={`rod-${i}-${ri}`} {...ep}>
              <line x1={tl.x + 6} y1={yPx} x2={tl.x + w - 6} y2={yPx}
                stroke="#374151" strokeWidth="4" strokeLinecap="round"/>
              <circle cx={tl.x + 8}     cy={yPx - 4} r={4} fill="#9ca3af" stroke="#374151" strokeWidth="1.5"/>
              <circle cx={tl.x + w - 8} cy={yPx - 4} r={4} fill="#9ca3af" stroke="#374151" strokeWidth="1.5"/>
              {/* Wider invisible hit area */}
              <rect x={tl.x} y={yPx - 10} width={w} height={20} fill="transparent"/>
            </g>
          );
        });

        // Doors
        const doors = (content.doors || []).map((door, doi) => {
          if (door.type === 'sliding') {
            return (
              <g key={`door-${i}-${doi}`}>
                <line x1={tl.x + 4} y1={tl.y + 8} x2={tl.x + w - 4} y2={tl.y + 8} stroke="#3b82f6" strokeWidth="1.5"/>
                <line x1={tl.x + 4} y1={bl.y - 8} x2={tl.x + w - 4} y2={bl.y - 8} stroke="#3b82f6" strokeWidth="1.5"/>
                <rect x={tl.x + 4} y={tl.y + 12} width={w * 0.56} height={intH - 20} fill="rgba(147,197,253,0.18)" stroke="#60a5fa" strokeWidth="1"/>
                <rect x={tl.x + w * 0.38} y={tl.y + 12} width={w * 0.56} height={intH - 20} fill="rgba(147,197,253,0.26)" stroke="#3b82f6" strokeWidth="1"/>
              </g>
            );
          }
          const count = door.count ?? 1;
          const doorW = count === 2 ? w / 2 : w;
          return Array.from({ length: count }, (_, v) => {
            const dx  = tl.x + v * doorW;
            const pad = Math.max(6, doorW * 0.08);
            const hx  = v === 0 ? dx + doorW - 12 : dx + 8;
            return (
              <g key={`door-${i}-${doi}-${v}`}>
                <rect x={dx + 2} y={tl.y + 2} width={doorW - 4} height={intH - 4} fill="url(#gDoor)" stroke={WOOD_STROKE} strokeWidth="1.5" rx="1"/>
                <rect x={dx + pad} y={tl.y + pad} width={doorW - 2 * pad} height={intH - 2 * pad} fill="none" stroke={WOOD_STROKE} strokeWidth="0.7" opacity="0.5"/>
                <rect x={hx - 4} y={tl.y + intH / 2 - 9} width="8" height="18" fill="#a0a0a0" stroke="#666" strokeWidth="0.8" rx="3"/>
              </g>
            );
          });
        });

        // Module number circle
        const modNumCircle = (
          <g key={`num-${i}`}>
            <circle cx={tl.x + w / 2} cy={tl.y + 14} r={11} fill={DIM_COLOR}/>
            <text x={tl.x + w / 2} y={tl.y + 19} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{i + 1}</text>
          </g>
        );

        // Width dimension below module
        const dimY = oy + Math.max(boxHL, boxHR) + 20;
        const modWidthDim = (
          <g key={`dim-${i}`}>
            <line x1={tl.x} y1={dimY} x2={tl.x + w} y2={dimY} stroke={DIM_COLOR} strokeWidth="1"
              markerEnd="url(#arrR2)" markerStart="url(#arrL2)"/>
            <text x={tl.x + w / 2} y={dimY + 12} textAnchor="middle" fill={DIM_COLOR} fontSize="10" fontWeight="600">
              {(mod.width).toFixed(1)} cm
            </text>
          </g>
        );

        // Invisible overlay for placement tools (shelf / rod / drawer)
        const placementOverlay = isInteractive && activeTool !== 'eraser' && activeTool !== 'cote' && (
          <rect
            key={`overlay-${i}`}
            x={tl.x} y={tl.y}
            width={w} height={bl.y - tl.y}
            fill="transparent"
            style={{ cursor: CURSORS[activeTool] || 'cell' }}
            onClick={(e) => handleModuleClick(e, { i, tl, bl })}
          />
        );

        return (
          <g key={`mod-${i}`}>
            {shelves}
            {drawers}
            {rods}
            {doors}
            {modNumCircle}
            {modWidthDim}
            {placementOverlay}
          </g>
        );
      })}

      {/* Global width dimension */}
      <line x1={ox} y1={oy - 20} x2={ox + drawW} y2={oy - 20}
        stroke={DIM_COLOR} strokeWidth="1.5" markerEnd="url(#arrR2)" markerStart="url(#arrL2)"/>
      <text x={ox + drawW / 2} y={oy - 24} textAnchor="middle" fill={DIM_COLOR} fontSize="12" fontWeight="700">
        {W} cm
      </text>
      <line x1={ox} y1={oy - 14} x2={ox} y2={oy} stroke={DIM_COLOR} strokeWidth="1"/>
      <line x1={ox + drawW} y1={oy - 14} x2={ox + drawW} y2={oy + (boxHR - boxHL)} stroke={DIM_COLOR} strokeWidth="1"/>

      {/* Height dimension left */}
      <line x1={ox - 20} y1={oy} x2={ox - 20} y2={oy + boxHL}
        stroke={DIM_COLOR} strokeWidth="1.5" markerStart="url(#arrU2)" markerEnd="url(#arrD2)"/>
      <text x={ox - 26} y={oy + boxHL / 2} textAnchor="middle" fill={DIM_COLOR} fontSize="11" fontWeight="600"
        transform={`rotate(-90, ${ox - 26}, ${oy + boxHL / 2})`}>
        {HL} cm
      </text>

      {/* User-drawn dimension annotations (cote tool) */}
      {(cabinet.annotations || []).map((ann, ai) => {
        const dx = ann.x2 - ann.x1;
        const dy = ann.y2 - ann.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const midX = (ann.x1 + ann.x2) / 2;
        const midY = (ann.y1 + ann.y2) / 2;
        const labelCm = (len / Math.max(sx, sy)).toFixed(1);
        return (
          <g key={`ann-${ai}`}>
            <line x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2}
              stroke="#7c3aed" strokeWidth="1.5"
              markerEnd="url(#arrR2)" markerStart="url(#arrL2)"
              strokeDasharray="6 3"/>
            <circle cx={ann.x1} cy={ann.y1} r={3} fill="#7c3aed"/>
            <circle cx={ann.x2} cy={ann.y2} r={3} fill="#7c3aed"/>
            <text x={midX} y={midY - 5} textAnchor="middle" fill="#7c3aed" fontSize="9" fontWeight="700">
              {labelCm} cm
            </text>
          </g>
        );
      })}

      {/* Cote: ghost line from first click to mouse position */}
      {coteStart && (
        <circle cx={coteStart.x} cy={coteStart.y} r={4} fill="#7c3aed" opacity="0.7"/>
      )}
    </svg>
  );
}
