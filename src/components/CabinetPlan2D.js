/**
 * CabinetPlan2D.js — Plan industriel style bureau d'études
 * 3 vues orthogonales : Face (VF) / Côté droit (VD) / Dessus (VH)
 * Lignes de rappel projetées entre vues, hachures de coupe, cotations chaînées.
 * Toutes les dimensions en cm.
 */
import { useRef, useEffect, useState } from 'react';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:        '#05080f',
  paper:     '#0a1020',
  grid:      'rgba(59,130,246,0.06)',
  outline:   '#94a3b8',   // trait fort (contour pièce visible)
  hidden:    '#1e3a5f',   // trait caché (tirets)
  dim:       '#f59e0b',   // cotation
  dimText:   '#fbbf24',
  section:   '#38bdf8',   // hachure / contour section
  ref:       'rgba(99,162,251,0.20)', // ligne de rappel
  titleLine: '#f97316',
  role: {
    side:         { fill: '#0f172a', stroke: '#475569', strokeW: 1.8 },
    top:          { fill: '#0f172a', stroke: '#7dd3fc', strokeW: 1.6 },
    bottom:       { fill: '#0f172a', stroke: '#7dd3fc', strokeW: 1.6 },
    shelf:        { fill: '#0b1929', stroke: '#38bdf8', strokeW: 1.2 },
    divider:      { fill: '#0b1929', stroke: '#93c5fd', strokeW: 1.2 },
    back:         { fill: '#060e1c', stroke: '#1e3a5f', strokeW: 0.8 },
    door:         { fill: 'rgba(249,115,22,0.08)', stroke: '#f97316', strokeW: 1.2 },
    drawer_front: { fill: 'rgba(168,85,247,0.10)', stroke: '#a855f7', strokeW: 1.2 },
    default:      { fill: '#0f172a', stroke: '#64748b', strokeW: 1.2 },
  },
};

function rc(role) { return C.role[role] || C.role.default; }

// ─── Defs SVG ─────────────────────────────────────────────────────────────────
function SvgDefs() {
  return (
    <defs>
      {/* Grille millimétrique */}
      <pattern id="d2-grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M10 0H0V10" fill="none" stroke={C.grid} strokeWidth="0.4" />
      </pattern>
      <pattern id="d2-grid5" width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="url(#d2-grid)" />
        <path d="M50 0H0V50" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="0.6" />
      </pattern>
      {/* Hachures de coupe (45°) */}
      <pattern id="d2-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke={C.section} strokeWidth="0.8" opacity="0.5" />
      </pattern>
      {/* Flèches cotation */}
      {[['aR','5','3','auto'],['aL','1','3','auto-start-reverse'],['aU','3','1','270'],['aD','3','5','90']].map(([id,rx,ry,orient]) => (
        <marker key={id} id={id} viewBox="0 0 6 6" refX={rx} refY={ry}
          markerWidth="5" markerHeight="5" orient={orient}>
          <path d="M0 0L6 3L0 6Z" fill={C.dim} />
        </marker>
      ))}
      {/* Filtre glow pour titres */}
      <filter id="d2-glow">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

// ─── Cotation horizontale ─────────────────────────────────────────────────────
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
// ─── Cotation verticale ───────────────────────────────────────────────────────
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

// ─── Ligne de rappel ─────────────────────────────────────────────────────────
function RefLine({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ref} strokeWidth="0.5" strokeDasharray="4,3" />;
}

// ─── Trait d'axe ─────────────────────────────────────────────────────────────
function AxisLine({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" strokeDasharray="8,3,2,3" />;
}

// ─── VUE DE FACE ─────────────────────────────────────────────────────────────
function ViewFace({ cab, sc, ox, oy }) {
  const W = cab.width * sc;
  const H = cab.height * sc;
  const t = cab.thickness * sc;
  const pl = cab.plinth * sc;
  const panels = cab.panels;

  return (
    <g transform={`translate(${ox},${oy})`}>
      {/* Fond */}
      <rect x={0} y={0} width={W} height={H} fill={C.paper} stroke="none" />
      <rect x={0} y={0} width={W} height={H} fill="url(#d2-grid5)" />

      {/* Panneaux visibles de face */}
      {panels.filter(p => p.role !== 'back').map((p, i) => {
        const c  = rc(p.role);
        const isVertical = p.role === 'side' || p.role === 'divider';
        const px = p.x * sc;
        const py = (cab.height - p.y - p.h) * sc;
        const pw = isVertical ? t : p.w * sc;
        const ph = p.h * sc;
        return (
          <g key={i}>
            {/* Hachure de coupe sur panneaux verticaux (coupés horizontalement) */}
            {isVertical && <rect x={px} y={py} width={Math.max(pw,1)} height={Math.max(ph,1)} fill="url(#d2-hatch)" opacity="0.4" />}
            <rect x={px} y={py} width={Math.max(pw,1)} height={Math.max(ph,1)}
              fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
            {/* Nom centré si assez grand */}
            {pw > 18 && ph > 12 && (
              <text x={px + pw/2} y={py + ph/2 + 3} textAnchor="middle"
                fontSize="6" fill="rgba(203,213,225,0.6)" fontFamily="monospace">
                {(p.name || '').slice(0,8)}
              </text>
            )}
          </g>
        );
      })}

      {/* Plinthe */}
      {pl > 0.5 && (
        <g>
          <rect x={t} y={H - pl} width={W - 2*t} height={pl}
            fill="rgba(100,116,139,0.10)" stroke="#475569" strokeWidth="0.7" strokeDasharray="4,2" />
          <DV x={-22} y1={H - pl} y2={H} val={cab.plinth} side={-1} />
        </g>
      )}

      {/* Trait de contour fort */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={C.outline} strokeWidth="1.5" />

      {/* Cotations chaînées */}
      <DH x1={0} x2={W} y={-18} val={cab.width} />
      <DV x={W + 18} y1={0} y2={H} val={cab.height} />

      {/* Axe de symétrie vertical */}
      <AxisLine x1={W/2} y1={-8} x2={W/2} y2={H+8} />

      {/* Label */}
      <text x={W/2} y={H + 28} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={C.titleLine} fontFamily="sans-serif" letterSpacing="0.5" filter="url(#d2-glow)">
        VUE DE FACE  —  F
      </text>
    </g>
  );
}

// ─── VUE DE CÔTÉ ─────────────────────────────────────────────────────────────
function ViewSide({ cab, sc, ox, oy }) {
  const D = cab.depth * sc;
  const H = cab.height * sc;
  const t = cab.thickness * sc;
  const pl = cab.plinth * sc;
  const shelves = cab.panels.filter(p =>['shelf','bottom','top'].includes(p.role));
  const backs   = cab.panels.filter(p => p.role === 'back');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={D} height={H} fill={C.paper} />
      <rect x={0} y={0} width={D} height={H} fill="url(#d2-grid5)" />

      {/* Fond arrière */}
      {backs.length > 0
        ? backs.map((b, i) => (
            <g key={i}>
              <rect x={D - t} y={0} width={t} height={H}
                fill={rc('back').fill} stroke={rc('back').stroke} strokeWidth="0.8" />
              <rect x={D - t} y={0} width={t} height={H} fill="url(#d2-hatch)" opacity="0.5" />
            </g>
          ))
        : <rect x={D - t} y={0} width={t} height={H}
            fill={rc('back').fill} stroke="#1e3a5f" strokeWidth="0.6" strokeDasharray="3,2" />
      }

      {/* Montants côtés (coupés = hachures) */}
      {[0, D - t].map((x, i) => (
        <g key={i}>
          <rect x={x} y={0} width={t} height={H} fill="url(#d2-hatch)" opacity="0.3" />
          <rect x={x} y={0} width={t} height={H}
            fill={rc('side').fill} stroke={rc('side').stroke} strokeWidth={rc('side').strokeW} />
        </g>
      ))}

      {/* Tablettes / fond-bas / dessus */}
      {shelves.map((s, i) => {
        const sy = (cab.height - s.y - s.h) * sc;
        const sh = Math.max(s.h * sc, t);
        const c  = rc(s.role);
        return (
          <g key={i}>
            <rect x={t} y={sy} width={D - 2*t} height={sh}
              fill="url(#d2-hatch)" opacity="0.4" />
            <rect x={t} y={sy} width={D - 2*t} height={sh}
              fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
          </g>
        );
      })}

      {/* Plinthe (coupe) */}
      {pl > 0.5 && (
        <rect x={0} y={H - pl} width={D - t} height={pl}
          fill="rgba(100,116,139,0.10)" stroke="#475569" strokeWidth="0.6" strokeDasharray="3,2" />
      )}

      <rect x={0} y={0} width={D} height={H} fill="none" stroke={C.outline} strokeWidth="1.5" />

      <DH x1={0} x2={D} y={-18} val={cab.depth} />
      <DV x={D + 18} y1={0} y2={H} val={cab.height} />
      {pl > 0.5 && <DH x1={0} x2={t} y={H + 16} val={`ép.${cab.thickness}`} color="#7dd3fc" />}

      <text x={D/2} y={H + 28} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={C.titleLine} fontFamily="sans-serif" letterSpacing="0.5" filter="url(#d2-glow)">
        VUE DE CÔTÉ  —  G
      </text>
    </g>
  );
}

// ─── VUE DE DESSUS ────────────────────────────────────────────────────────────
function ViewTop({ cab, sc, ox, oy }) {
  const W = cab.width  * sc;
  const D = cab.depth  * sc;
  const t = cab.thickness * sc;
  const dividers = cab.panels.filter(p => p.role === 'divider');
  const doors    = cab.panels.filter(p => p.role === 'door');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={W} height={D} fill={C.paper} />
      <rect x={0} y={0} width={W} height={D} fill="url(#d2-grid5)" />

      {/* Fond arrière vu de dessus (hachures) */}
      <rect x={t} y={D - t} width={W - 2*t} height={t}
        fill="url(#d2-hatch)" opacity="0.4" />
      <rect x={t} y={D - t} width={W - 2*t} height={t}
        fill={rc('back').fill} stroke={rc('back').stroke} strokeWidth="0.8" />

      {/* Côtés (coupés = hachures) */}
      {[0, W - t].map((x, i) => (
        <g key={i}>
          <rect x={x} y={0} width={t} height={D} fill="url(#d2-hatch)" opacity="0.35" />
          <rect x={x} y={0} width={t} height={D}
            fill={rc('side').fill} stroke={rc('side').stroke} strokeWidth={rc('side').strokeW} />
        </g>
      ))}
      {/* Dessus (section) */}
      <rect x={0} y={0} width={W} height={t}
        fill="url(#d2-hatch)" opacity="0.4" />
      <rect x={0} y={0} width={W} height={t}
        fill={rc('top').fill} stroke={rc('top').stroke} strokeWidth="1.4" />

      {/* Séparations internes */}
      {dividers.map((p, i) => (
        <g key={i}>
          <rect x={p.x * sc} y={t} width={t} height={D - 2*t}
            fill="url(#d2-hatch)" opacity="0.3" />
          <rect x={p.x * sc} y={t} width={t} height={D - 2*t}
            fill={rc('divider').fill} stroke={rc('divider').stroke} strokeWidth="1" />
        </g>
      ))}

      {/* Tracé d'ouverture portes (arc quart de cercle) */}
      {doors.map((p, i) => {
        const dx  = p.x * sc;
        const dw  = p.w * sc;
        // ouverture à gauche par défaut
        return (
          <g key={i} opacity="0.5">
            <path d={`M${dx},${t} A${dw},${dw} 0 0,1 ${dx + dw},${t}`}
              fill="none" stroke="#f97316" strokeWidth="0.7" strokeDasharray="4,3" />
            <line x1={dx} y1={t} x2={dx + dw} y2={t} stroke="#f97316" strokeWidth="0.6" />
          </g>
        );
      })}

      <rect x={0} y={0} width={W} height={D} fill="none" stroke={C.outline} strokeWidth="1.5" />

      <DH x1={0} x2={W} y={-18} val={cab.width} />
      <DV x={W + 18} y1={0} y2={D} val={cab.depth} />

      <text x={W/2} y={D + 28} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={C.titleLine} fontFamily="sans-serif" letterSpacing="0.5" filter="url(#d2-glow)">
        VUE DE DESSUS  —  H
      </text>
    </g>
  );
}

// ─── Cartouche industriel ─────────────────────────────────────────────────────
function Cartouche({ x, y, w, h, name, scale, width, height, depth, thickness, nbPanels }) {
  const cols = [
    { label: 'PROJET', val: (name || 'MEUBLE').toUpperCase() },
    { label: 'DIMENSIONS', val: `L${width} × H${height} × P${depth} cm` },
    { label: 'ÉP. PANNEAU', val: `${thickness} cm` },
    { label: 'PANNEAUX', val: `${nbPanels} pcs` },
    { label: 'ÉCHELLE', val: `~1:${Math.round(1 / scale)}` },
    { label: 'DATE', val: new Date().toLocaleDateString('fr-FR') },
  ];
  const colW = (w - 2) / cols.length;
  return (
    <g>
      {/* Fond */}
      <rect x={x} y={y} width={w} height={h} fill="#030710" stroke="#1e3a5f" strokeWidth="1" />
      {/* Header */}
      <rect x={x} y={y} width={w} height={16} fill="#0a1628" />
      <text x={x + w/2} y={y + 11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={C.titleLine} fontFamily="sans-serif" letterSpacing="1.5"
        filter="url(#d2-glow)">PanelCut Pro  —  PLAN INDUSTRIEL</text>
      {/* Colonnes */}
      {cols.map((col, i) => {
        const cx = x + 1 + i * colW;
        return (
          <g key={i}>
            <rect x={cx} y={y + 16} width={colW} height={h - 16} fill="none" stroke="#1e3a5f" strokeWidth="0.5" />
            <text x={cx + colW/2} y={y + 27} textAnchor="middle" fontSize="6.5"
              fill="#475569" fontFamily="monospace" fontWeight="700" letterSpacing="0.5">
              {col.label}
            </text>
            <text x={cx + colW/2} y={y + 38} textAnchor="middle" fontSize="8"
              fill="#94a3b8" fontFamily="monospace">{col.val}</text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function CabinetPlan2D({ cabinet, name = 'Meuble' }) {
  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <p className="text-3xl mb-3">📐</p>
        <p>Dimensions du meuble non disponibles.</p>
      </div>
    );
  }

  const cab = {
    ...cabinet,
    depth:     cabinet.depth     || 60,
    thickness: cabinet.thickness || 1.8,
    plinth:    cabinet.plinth    || 0,
    panels:    cabinet.panels    || [],
  };

  // Échelle : faire tenir dans 820px (face + côté côte à côte)
  const GAP  = 28;
  const PAD  = 44;   // marge cotations
  const CART = 52;   // hauteur cartouche
  const MAXW = 820;

  const totalW_cm = cab.width + cab.depth;
  const sc = Math.min(4, Math.max(1, (MAXW - 2 * PAD - GAP) / totalW_cm));

  const FW = cab.width  * sc;
  const FH = cab.height * sc;
  const SD = cab.depth  * sc;  // side width
  const TH = cab.depth  * sc;  // top height

  const svgW = FW + GAP + SD + 2 * PAD + 30;
  const svgH = FH + GAP + TH + 2 * PAD + CART + 40;

  // Origines
  const FOX = PAD + 20;          const FOY = PAD + 20;
  const SOX = FOX + FW + GAP;    const SOY = FOY;
  const TOX = FOX;               const TOY = FOY + FH + GAP;
  const cartY = svgH - CART - 4;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-700 to-orange-600 rounded-xl opacity-10 blur-lg" />
      <svg
        viewBox={`0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}`}
        className="relative w-full h-auto rounded-xl border border-white/10 shadow-2xl"
        style={{ display: 'block', background: C.bg }}
      >
        <SvgDefs />
        <rect x={0} y={0} width={svgW} height={svgH} fill={C.bg} />

        {/* Titre */}
        <text x={svgW/2} y={16} textAnchor="middle" fontSize="11" fontWeight="700"
          fill={C.titleLine} fontFamily="sans-serif" letterSpacing="2" filter="url(#d2-glow)">
          PLAN TECHNIQUE  ·  {(name||'MEUBLE').toUpperCase()}
        </text>

        {/* Lignes de rappel projetées (projection 1ère dièdre) */}
        {/* Face → Côté : horizontales */}
        <RefLine x1={FOX + FW} y1={FOY} x2={SOX} y2={SOY} />
        <RefLine x1={FOX + FW} y1={FOY + FH} x2={SOX} y2={SOY + FH} />
        {/* Face → Dessus : verticales */}
        <RefLine x1={FOX} y1={FOY + FH} x2={TOX} y2={TOY} />
        <RefLine x1={FOX + FW} y1={FOY + FH} x2={TOX + FW} y2={TOY} />

        <ViewFace cab={cab} sc={sc} ox={FOX} oy={FOY} />
        <ViewSide cab={cab} sc={sc} ox={SOX} oy={SOY} />
        <ViewTop  cab={cab} sc={sc} ox={TOX} oy={TOY} />

        <Cartouche
          x={4} y={cartY} w={svgW - 8} h={CART}
          name={name} scale={sc}
          width={cab.width} height={cab.height} depth={cab.depth}
          thickness={cab.thickness} nbPanels={cab.panels.length}
        />
      </svg>
    </div>
  );
}
