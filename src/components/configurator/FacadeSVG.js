import React from 'react';

const WOOD_FILL    = '#f5ede0';
const WOOD_STROKE  = '#8b6914';
const DOUBLE_COLOR = '#d97706';
const DIM_COLOR    = '#dc2626';
const MARGIN       = { l: 70, r: 55, t: 60, b: 70 };

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * FacadeSVG — technical plan view of the cabinet.
 * Supports trapezoid modules (biais) and all content types.
 */
export default function FacadeSVG({ cabinet, svgRef, activeTool = 'drawer', selectedItem = null, onModuleClick, onItemClick }) {
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

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto bg-white rounded-xl border border-slate-200 shadow-xl"
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
        const cmToY = (yCm) => {
          // bl.y is bottom of interior (left side)
          return bl.y - yCm * sy;
        };

        // Shelves
        const shelves = (content.shelves || []).map((sh, si) => {
          const yPx = cmToY(sh.yFromBottom ?? 0);
          const isSelected = selectedItem?.type === 'shelf' && selectedItem?.moduleIdx === i && selectedItem?.itemIdx === si;
          return (
            <g key={`sh-${i}-${si}`}>
              <rect
                x={tl.x + 2}
                y={yPx - 3}
                width={w - 4}
                height={5}
                fill={isSelected ? '#16a34a' : '#7c6341'}
                stroke={WOOD_STROKE}
                strokeWidth="0.8"
                rx="1"
                style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}
                onClick={(e) => { e.stopPropagation(); onItemClick?.({ type: 'shelf', moduleIdx: i, itemIdx: si }); }}
              />
            </g>
          );
        });

        // Drawers
        const drawers = (content.drawers || []).map((dr, di) => {
          const h   = (dr.height ?? 18) * sy;
          const yPx = cmToY((dr.yFromBottom ?? 0) + (dr.height ?? 18));
          const isSelected = selectedItem?.type === 'drawer' && selectedItem?.moduleIdx === i && selectedItem?.itemIdx === di;
          return (
            <g
              key={`dr-${i}-${di}`}
              style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}
              onClick={(e) => { e.stopPropagation(); onItemClick?.({ type: 'drawer', moduleIdx: i, itemIdx: di }); }}
            >
              <rect x={tl.x + 2} y={yPx + 1} width={w - 4} height={h - 2} fill={isSelected ? '#fde68a' : WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1" rx="1"/>
              <rect x={tl.x + w / 2 - 14} y={yPx + h / 2 - 3.5} width="28" height="7" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" rx="3"/>
              <ellipse cx={tl.x + w / 2} cy={yPx + h / 2} rx="3.5" ry="2.5" fill="#6b7280"/>
            </g>
          );
        });

        // Rods
        const rods = (content.rods || []).map((rod, ri) => {
          const yPx = cmToY(rod.yFromBottom ?? 160);
          const isSelected = selectedItem?.type === 'rod' && selectedItem?.moduleIdx === i && selectedItem?.itemIdx === ri;
          return (
            <g
              key={`rod-${i}-${ri}`}
              style={{ cursor: activeTool === 'erase' ? 'not-allowed' : 'grab' }}
              onClick={(e) => { e.stopPropagation(); onItemClick?.({ type: 'rod', moduleIdx: i, itemIdx: ri }); }}
            >
              <line x1={tl.x + 6} y1={yPx} x2={tl.x + w - 6} y2={yPx} stroke={isSelected ? '#db2777' : '#374151'} strokeWidth="4" strokeLinecap="round"/>
              <circle cx={tl.x + 8}     cy={yPx - 4} r={4} fill="#9ca3af" stroke="#374151" strokeWidth="1.5"/>
              <circle cx={tl.x + w - 8} cy={yPx - 4} r={4} fill="#9ca3af" stroke="#374151" strokeWidth="1.5"/>
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

        return (
          <g key={`mod-${i}`}>
            <polygon
              points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
              fill="transparent"
              style={{ cursor: ['drawer', 'shelf', 'rod', 'move'].includes(activeTool) ? 'copy' : 'default' }}
              onClick={(e) => {
                e.stopPropagation();
                if (!onModuleClick) return;
                const svg = e.currentTarget.ownerSVGElement;
                if (!svg) return;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const ctm = svg.getScreenCTM();
                if (!ctm) return;
                const loc = pt.matrixTransform(ctm.inverse());
                const yFromBottom = Math.max(0, (bl.y - loc.y) / sy);
                onModuleClick(i, yFromBottom);
              }}
            />
            {shelves}
            {drawers}
            {rods}
            {doors}
            {modNumCircle}
            {modWidthDim}
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
    </svg>
  );
}
