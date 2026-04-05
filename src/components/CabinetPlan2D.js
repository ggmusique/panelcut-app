/**
 * CabinetPlan2D.js — Plan industriel style bureau d'études
 * Version : V87
 * 3 vues orthogonales : Face (F) / Côté droit (G) / Dessus (H)
 * Lignes de rappel projetées entre vues, hachures de coupe, cotations chaînées.
 */
import { useRef, useEffect, useState } from 'react';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:         '#05080f',
  paper:      '#0a1020',
  grid:       'rgba(59,130,246,0.06)',
  outline:    '#94a3b8',
  hidden:     '#1e3a5f',
  dim:        '#f59e0b',
  dimText:    '#fbbf24',
  section:    '#38bdf8',
  ref:        'rgba(99,162,251,0.20)',
  titleLine:  '#f97316',
  role: {
    side:         { fill: '#0f172a', stroke: '#475569', strokeW: 1.8 },
    top:          { fill: '#0f172a', stroke: '#7dd3fc', strokeW: 1.6 },
    bottom:       { fill: '#0f172a', stroke: '#7dd3fc', strokeW: 1.6 },
    shelf:        { fill: '#0b1929', stroke: '#38bdf8', strokeW: 1.2 },
    divider:      { fill: '#0b1929', stroke: '#93c5fd', strokeW: 1.2 },
    back:         { fill: '#060e1c', stroke: '#1e3a5f', strokeW: 0.8 },
    door:         { fill: 'rgba(249,115,22,0.08)', stroke: '#f97316', strokeW: 1.2 },
    drawer_front: { fill: 'rgba(168,85,247,0.10)', stroke: '#a855f7', strokeW: 1.2 },
    rod:          { fill: 'rgba(52,211,153,0.20)',  stroke: '#34d399', strokeW: 1.5 },
    default:      { fill: '#0f172a', stroke: '#64748b', strokeW: 1.2 },
  },
};

function rc(role) { return C.role[role] || C.role.default; }

/**
 * Génère les panneaux depuis les modules détaillés (serveur).
 */
function buildPanelsFromModules(cab) {
  const modules = cab.modules;
  if (!Array.isArray(modules) || modules.length === 0) return null;
  const detailed = modules.filter(m => typeof m === 'object' && m !== null && (m.width ?? m.w ?? 0) > 0);
  if (detailed.length === 0) return null;

  const T      = cab.thickness || 3.0;
  const H      = cab.height;
  const PL     = cab.plinth || 0;
  const panels = [];
  const innerH = H - PL - 2 * T;

  panels.push({ name: 'Côté G', role: 'side', x: 0, y: PL, w: T, h: H - PL });

  let curX = T;
  detailed.forEach((m, i) => {
    const mW = m.width;
    const mX = (m.x_start != null && m.x_start > 0) ? m.x_start : curX;

    const rawShelves     = m.shelfPositions ?? m.shelves;
    const shelfPositions = Array.isArray(rawShelves)
      ? rawShelves.filter(s => s && typeof s.y === 'number')
      : null;
    const shelvesCount   = shelfPositions
      ? shelfPositions.length
      : Math.max(0, parseInt(rawShelves ?? 0, 10));

    const rawDrawers      = m.drawerPositions ?? m.drawers;
    const drawerPositions = Array.isArray(rawDrawers)
      ? rawDrawers.filter(d => d && typeof d.y === 'number')
      : null;
    const drawersCount    = drawerPositions
      ? drawerPositions.length
      : Math.max(0, parseInt(rawDrawers ?? 0, 10));

    const rawRod = m.rodPosition ?? m.rod;
    const rodPos = (rawRod && typeof rawRod === 'object' && typeof rawRod.y === 'number')
      ? rawRod : null;
    const hasRod = Boolean(rodPos || rawRod === true || m.tringle || m.hanging || m.penderie);

    panels.push({ name: `Fond bas ${i+1}`, role: 'bottom', x: mX, y: PL, w: mW, h: T });

    if (shelfPositions && shelfPositions.length > 0) {
      shelfPositions.forEach((s, si) => {
        panels.push({
          name: `Tablette ${i+1}-${si+1}`, role: 'shelf',
          x: mX, y: PL + s.y, w: mW, h: T,
        });
      });
    } else if (shelvesCount > 0) {
      const gap = innerH / (shelvesCount + 1);
      for (let s = 0; s < shelvesCount; s++) {
        panels.push({
          name: `Tablette ${i+1}-${s+1}`, role: 'shelf',
          x: mX, y: PL + T + gap * (s + 1), w: mW, h: T,
        });
      }
    }

    if (drawerPositions && drawerPositions.length > 0) {
      drawerPositions.forEach((d, di) => {
        panels.push({
          name: `Tiroir ${i+1}-${di+1}`, role: 'drawer_front',
          x: mX, y: PL + d.y, w: mW, h: Math.max(d.height ?? 20, T),
        });
      });
    } else if (drawersCount > 0) {
      const drawerZoneH = innerH * 0.45;
      const dH          = drawerZoneH / drawersCount;
      const zoneTop     = PL + T + (innerH - drawerZoneH);
      for (let d = 0; d < drawersCount; d++) {
        panels.push({
          name: `Tiroir ${i+1}-${d+1}`, role: 'drawer_front',
          x: mX, y: zoneTop + dH * d, w: mW, h: dH,
        });
      }
    }

    if (hasRod) {
      const rodY = rodPos ? PL + rodPos.y : PL + T + innerH * 0.6;
      panels.push({
        name: `Tringle ${i+1}`, role: 'rod',
        x: mX, y: rodY, w: mW, h: Math.max(1.0, T * 0.4),
      });
    }

    if ((m.doors ?? 0) > 0) {
      for (let d = 0; d < m.doors; d++) {
        const doorW = mW / m.doors;
        panels.push({
          name: `Porte ${i+1}-${d+1}`, role: 'door',
          x: mX + doorW * d, y: PL, w: doorW, h: H - PL,
        });
      }
    }

    panels.push({
      name: i === detailed.length - 1 ? 'Côté D' : `Sep. ${i+1}`,
      role: 'side',
      x: mX + mW, y: PL, w: T, h: H - PL,
    });

    curX = mX + mW + T;
  });

  panels.push({ name: 'Dessus', role: 'top', x: 0, y: H - T, w: cab.width, h: T });
  panels.push({ name: 'Fond arr.', role: 'back', x: T, y: PL, w: cab.width - 2*T, h: H - PL });

  return panels;
}

function buildPanelsFromDimensions(cab) {
  const { width: W, height: H, depth: D, thickness: t } = cab;
  const panels = [];
  panels.push({ name: 'Côté G', role: 'side',    x: 0,       y: 0, w: t, h: H });
  panels.push({ name: 'Côté D', role: 'side',    x: W - t,   y: 0, w: t, h: H });
  panels.push({ name: 'Dessus', role: 'top',     x: 0,       y: H - t, w: W, h: t });
  panels.push({ name: 'Fond bas', role: 'bottom', x: 0,      y: 0,     w: W, h: t });
  panels.push({ name: 'Fond arr.', role: 'back', x: 0,       y: 0,     w: W, h: H });

  const interiorH = H - 2 * t;
  const shelfSpacing = interiorH > 80 ? 30 : interiorH > 50 ? interiorH / 2 : 0;
  if (shelfSpacing > 0) {
    let y = t + shelfSpacing;
    while (y < H - 2 * t) {
      panels.push({ name: 'Tablette', role: 'shelf', x: t, y, w: W - 2 * t, h: t });
      y += shelfSpacing;
    }
  }
  return panels;
}

// ─── Defs SVG ─────────────────────────────────────────────────────────────────
function SvgDefs() {
  return (
    <defs>
      <pattern id="d2-grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M10 0H0V10" fill="none" stroke={C.grid} strokeWidth="0.4" />
      </pattern>
      <pattern id="d2-grid5" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="url(#d2-grid)" />
        <path d="M50 0H0V50" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="0.6" />
      </pattern>
      <pattern id="d2-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke={C.section} strokeWidth="0.8" opacity="0.5" />
      </pattern>
      {[['aR','5','3','auto'],['aL','1','3','auto-start-reverse'],['aU','3','1','270'],['aD','3','5','90']].map(([id,rx,ry,orient]) => (
        <marker key={id} id={id} viewBox="0 0 6 6" refX={rx} refY={ry}
          markerWidth="5" markerHeight="5" orient={orient}>
          <path d="M0 0L6 3L0 6Z" fill={C.dim} />
        </marker>
      ))}
      <filter id="d2-glow">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function DH({ x1, x2, y, val, unit = 'cm', color = C.dim }) {
  const m = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke={color} strokeWidth="0.8" />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke={color} strokeWidth="0.8" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.7"
        markerStart="url(#aL)" markerEnd="url(#aR)" />
      <text x={m} y={y - 7} textAnchor="middle" fontSize="7.5" fill={C.dimText}
        fontFamily="monospace" fontWeight="600">{val}{unit}</text>
    </g>
  );
}

function DV({ x, y1, y2, val, unit = 'cm', color = C.dim, side = 1 }) {
  const m = (y1 + y2) / 2;
  const tx = x + side * 14;
  return (
    <g>
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} stroke={color} strokeWidth="0.8" />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} stroke={color} strokeWidth="0.8" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="0.7"
        markerStart="url(#aU)" markerEnd="url(#aD)" />
      <text x={tx} y={m + 3} textAnchor="middle" fontSize="7.5" fill={C.dimText}
        fontFamily="monospace" fontWeight="600"
        transform={`rotate(-90 ${tx} ${m + 3})`}>{val}{unit}</text>
    </g>
  );
}

function RefLine({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ref} strokeWidth="0.5" strokeDasharray="4,3" />;
}

function AxisLine({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" strokeDasharray="8,3,2,3" />;
}

// ─── VUES (FACE, CÔTÉ, DESSUS) ──────────────────────────────────────────────
function ViewFace({ cab, sc, ox, oy }) {
  const W  = cab.width * sc;
  const H  = cab.height * sc;
  const t  = cab.thickness * sc;
  const pl = cab.plinth * sc;
  const panels = cab.panels;

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={W} height={H} fill={C.paper} stroke="none" />
      <rect x={0} y={0} width={W} height={H} fill="url(#d2-grid5)" />
      {panels.filter(p => p.role !== 'back').map((p, i) => {
        const c  = rc(p.role);
        const isVertical = p.role === 'side' || p.role === 'divider';
        const isRod      = p.role === 'rod';
        const px = p.x * sc;
        const py = (cab.height - p.y - p.h) * sc;
        const pw = isVertical ? t : p.w * sc;
        const ph = Math.max(isRod ? 1.5 : p.h * sc, 0.5);
        if (pw < 0.5) return null;
        if (isRod) {
          const cy = py + ph / 2;
          return (
            <g key={i}>
              <line x1={px + t * 0.5} y1={cy} x2={px + pw - t * 0.5} y2={cy}
                stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round" />
              <line x1={px + t * 0.5} y1={py} x2={px + t * 0.5} y2={py + ph + 2} stroke={c.stroke} strokeWidth="1" />
              <line x1={px + pw - t * 0.5} y1={py} x2={px + pw - t * 0.5} y2={py + ph + 2} stroke={c.stroke} strokeWidth="1" />
            </g>
          );
        }
        return (
          <g key={i}>
            {isVertical && <rect x={px} y={py} width={Math.max(pw,1)} height={Math.max(ph,1)} fill="url(#d2-hatch)" opacity="0.4" />}
            <rect x={px} y={py} width={Math.max(pw,1)} height={Math.max(ph,1)}
              fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
          </g>
        );
      })}
      {pl > 0.5 && <DV x={-22} y1={H - pl} y2={H} val={cab.plinth} side={-1} />}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={C.outline} strokeWidth="1.5" />
      <DH x1={0} x2={W} y={-18} val={cab.width} />
      <DV x={W + 18} y1={0} y2={H} val={cab.height} />
      <AxisLine x1={W/2} y1={-8} x2={W/2} y2={H+8} />
      <text x={W/2} y={H + 30} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.titleLine} fontFamily="sans-serif">VUE DE FACE — F</text>
    </g>
  );
}

function ViewSide({ cab, sc, ox, oy }) {
  const D  = cab.depth * sc;
  const H  = cab.height * sc;
  const t  = cab.thickness * sc;
  const shelves = cab.panels.filter(p => ['shelf','bottom','top'].includes(p.role));
  const backs   = cab.panels.filter(p => p.role === 'back');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={D} height={H} fill={C.paper} />
      <rect x={0} y={0} width={D} height={H} fill="url(#d2-grid5)" />
      {backs.map((b, i) => (
        <rect key={i} x={D - t} y={0} width={t} height={H} fill="url(#d2-hatch)" opacity="0.5" stroke={rc('back').stroke} />
      ))}
      {[0, D - t].map((x, i) => (
        <rect key={i} x={x} y={0} width={t} height={H} fill={rc('side').fill} stroke={rc('side').stroke} strokeWidth={rc('side').strokeW} />
      ))}
      {shelves.map((s, i) => (
        <rect key={i} x={t} y={(cab.height - s.y - s.h) * sc} width={D - 2*t} height={Math.max(s.h * sc, t)} fill={rc(s.role).fill} stroke={rc(s.role).stroke} />
      ))}
      <rect x={0} y={0} width={D} height={H} fill="none" stroke={C.outline} strokeWidth="1.5" />
      <DH x1={0} x2={D} y={-18} val={cab.depth} />
      <text x={D/2} y={H + 30} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.titleLine} fontFamily="sans-serif">VUE DE CÔTÉ — G</text>
    </g>
  );
}

function ViewTop({ cab, sc, ox, oy }) {
  const W = cab.width  * sc;
  const D = cab.depth  * sc;
  const t = cab.thickness * sc;
  const dividers = cab.panels.filter(p => p.role === 'divider');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={W} height={D} fill={C.paper} />
      <rect x={0} y={0} width={W} height={D} fill="url(#d2-grid5)" />
      <rect x={t} y={D - t} width={W - 2*t} height={t} fill={rc('back').fill} stroke={rc('back').stroke} />
      {[0, W - t].map((x, i) => (
        <rect key={i} x={x} y={0} width={t} height={D} fill={rc('side').fill} stroke={rc('side').stroke} />
      ))}
      <rect x={0} y={0} width={W} height={t} fill={rc('top').fill} stroke={rc('top').stroke} strokeWidth="1.4" />
      {dividers.map((p, i) => (
        <rect key={i} x={p.x * sc} y={t} width={t} height={D - 2*t} fill={rc('divider').fill} stroke={rc('divider').stroke} />
      ))}
      <rect x={0} y={0} width={W} height={D} fill="none" stroke={C.outline} strokeWidth="1.5" />
      <DH x1={0} x2={W} y={-18} val={cab.width} />
      <text x={W/2} y={D + 30} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.titleLine} fontFamily="sans-serif">VUE DE DESSUS — H</text>
    </g>
  );
}

function Cartouche({ x, y, w, h, name, scale, width, height, depth, thickness, nbPanels }) {
  const cols = [
    { label: 'PROJET',     val: (name || 'MEUBLE').toUpperCase().slice(0, 20) },
    { label: 'DIMENSIONS', val: `L${width} × H${height} × P${depth} cm` },
    { label: 'ÉP. PANNEAU',val: `${thickness} cm` },
    { label: 'NB PANNEAUX',val: `${nbPanels} pcs` },
    { label: 'ÉCHELLE',    val: `~1:${Math.round(1 / scale)}` },
    { label: 'DATE',       val: new Date().toLocaleDateString('fr-FR') },
  ];
  const colW = (w - 2) / cols.length;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#030710" stroke="#1e3a5f" strokeWidth="1" />
      <text x={x + w/2} y={y + 11} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.titleLine}>PanelCut Pro — PLAN INDUSTRIEL</text>
      {cols.map((col, i) => (
        <g key={i} transform={`translate(${x + 1 + i * colW}, ${y + 16})`}>
          <rect width={colW} height={h - 16} fill="none" stroke="#1e3a5f" strokeWidth="0.5" />
          <text x={colW/2} y={11} textAnchor="middle" fontSize="6.5" fill="#475569" fontWeight="700">{col.label}</text>
          <text x={colW/2} y={22} textAnchor="middle" fontSize="8" fill="#94a3b8">{col.val}</text>
        </g>
      ))}
    </g>
  );
}

export default function CabinetPlan2D({ cabinet, name = 'Meuble' }) {
  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <p className="text-3xl mb-3">📐</p>
        <p>Dimensions du meuble non disponibles.</p>
      </div>
    );
  }

  const cabBase = {
    ...cabinet,
    depth:     cabinet.depth     || 60,
    thickness: cabinet.thickness || 3.0,
    plinth:    cabinet.plinth    || 0,
  };

  const generatedPanels = (cabinet.panels && cabinet.panels.length > 0)
    ? cabinet.panels
    : buildPanelsFromModules(cabBase) ?? buildPanelsFromDimensions({
        width:     cabinet.width,
        height:    cabinet.height,
        depth:     cabBase.depth,
        thickness: cabBase.thickness,
      });

  const cab = { ...cabBase, panels: generatedPanels };

  const GAP = 28;
  const PAD = 52;
  const CART = 52;
  const MAXW = 840;

  const totalW_cm = cab.width + cab.depth;
  const sc = Math.min(4, Math.max(0.8, (MAXW - 2 * PAD - GAP) / totalW_cm));

  const FW = cab.width  * sc;
  const FH = cab.height * sc;
  const SD = cab.depth  * sc;
  const TH = cab.depth  * sc;

  const svgW = FW + GAP + SD + 2 * PAD + 30;
  const svgH = FH + GAP + TH + 2 * PAD + CART + 50;

  const FOX = PAD + 20;       const FOY = PAD + 24;
  const SOX = FOX + FW + GAP; const SOY = FOY;
  const TOX = FOX;            const TOY = FOY + FH + GAP;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-700 to-orange-600 rounded-xl opacity-10 blur-lg" />
      <svg viewBox={`0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}`} className="relative w-full h-auto rounded-xl border border-white/10 shadow-2xl" style={{ background: C.bg }}>
        <SvgDefs />
        <rect x={0} y={0} width={svgW} height={svgH} fill={C.bg} />
        <text x={svgW/2} y={16} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.titleLine} letterSpacing="2">PLAN TECHNIQUE · {name.toUpperCase()}</text>
        
        <RefLine x1={FOX + FW} y1={FOY} x2={SOX} y2={SOY} />
        <RefLine x1={FOX + FW} y1={FOY + FH} x2={SOX} y2={SOY + FH} />
        <RefLine x1={FOX} y1={FOY + FH} x2={TOX} y2={TOY} />
        <RefLine x1={FOX + FW} y1={FOY + FH} x2={TOX + FW} y2={TOY} />

        <ViewFace cab={cab} sc={sc} ox={FOX} oy={FOY} />
        <ViewSide cab={cab} sc={sc} ox={SOX} oy={SOY} />
        <ViewTop  cab={cab} sc={sc} ox={TOX} oy={TOY} />
        <Cartouche x={4} y={svgH - CART - 6} w={svgW - 8} h={CART} name={name} scale={sc} width={cab.width} height={cab.height} depth={cab.depth} thickness={cab.thickness} nbPanels={cab.panels.length} />
      </svg>
    </div>
  );
}