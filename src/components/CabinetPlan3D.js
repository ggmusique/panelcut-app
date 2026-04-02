/**
 * CabinetPlan3D.js — Moteur isométrique SVG multi-corps v3
 *
 * Accepte deux formes de props :
 *   1. <CabinetPlan3D model={buildCabinetModel(scan)} />          (nouveau)
 *   2. <CabinetPlan3D cabinet={...} pieces={[...]} name="..." />  (rétro-compat)
 *
 * Rendu : SVG pur, projection isométrique JS, painter's algorithm.
 * Zéro WebGL, zéro canvas, zéro bug de zoom.
 */
import { useRef, useState } from 'react';

// ────────────────────────────────────────────────────────────────────────────────
const PAL = {
  panel:    { f: '#1a3352', t: '#2a4d78', s: '#3b82f6', sw: 0.6 },
  side:     { f: '#142840', t: '#1e3a5f', s: '#38bdf8', sw: 0.7 },
  shelf:    { f: '#0f2a42', t: '#38bdf8', s: '#38bdf8', sw: 0.5 },
  top:      { f: '#1a4060', t: '#7dd3fc', s: '#7dd3fc', sw: 0.6 },
  bottom:   { f: '#0d2035', t: '#2a4d78', s: '#38bdf8', sw: 0.5 },
  back:     { f: '#060d14', t: '#0d1f33', s: '#1e3a5f', sw: 0.4, a: 0.85 },
  door:     { f: '#f9731612', t: '#f9731640', s: '#f97316', sw: 0.9, a: 0.35 },
  drawer:   { f: '#a855f712', t: '#a855f740', s: '#a855f7', sw: 0.9, a: 0.38 },
  rod:      { f: '#94a3b8',  t: '#cbd5e1',   s: '#e2e8f0', sw: 0.5 },
  divider:  { f: '#1a3352',  t: '#4a90c4',   s: '#93c5fd', sw: 0.5 },
  handle:   { f: '#64748b',  t: '#94a3b8',   s: '#cbd5e1', sw: 0.4 },
};

// ────────────────────────────────────────────────────────────────────────────────
function iso(x, y, z, theta, phi, scale, ox, oy) {
  const rx  = x * Math.cos(theta) + z * Math.sin(theta);
  const rz  = -x * Math.sin(theta) + z * Math.cos(theta);
  const ry2 = y * Math.cos(phi) - rz * Math.sin(phi);
  const rz2 = y * Math.sin(phi) + rz * Math.cos(phi);
  return { sx: ox + rx * scale, sy: oy - ry2 * scale, depth: rz2 };
}
function svgPt(x, y, z, th, ph, sc, ox, oy) {
  const p = iso(x, y, z, th, ph, sc, ox, oy);
  return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
}
function depthOf(x, y, z, th, ph, sc, ox, oy) {
  return iso(x, y, z, th, ph, sc, ox, oy).depth;
}

// ────────────────────────────────────────────────────────────────────────────────
function buildDimFace(W, H, DEP, th, ph, sc, ox, oy) {
  const yBase = -0.02;
  const p0w   = iso(0,       yBase,       0, th, ph, sc, ox, oy);
  const p1w   = iso(W,       yBase,       0, th, ph, sc, ox, oy);
  const midW  = iso(W / 2,   yBase - 0.04,0, th, ph, sc, ox, oy);
  const xBase = -0.04;
  const p0h   = iso(xBase,   0,           0, th, ph, sc, ox, oy);
  const p1h   = iso(xBase,   H,           0, th, ph, sc, ox, oy);
  const midH  = iso(xBase - 0.04, H / 2,  0, th, ph, sc, ox, oy);
  const p0d   = iso(W,        yBase,        0,       th, ph, sc, ox, oy);
  const p1d   = iso(W,        yBase,        DEP,     th, ph, sc, ox, oy);
  const midD  = iso(W + 0.04, yBase - 0.04, DEP / 2, th, ph, sc, ox, oy);
  return { p0w, p1w, midW, p0h, p1h, midH, p0d, p1d, midD };
}

function buildGrid(W, D, th, ph, sc, ox, oy) {
  const step  = Math.max(0.1, W / 8);
  const lines = [];
  const P = (x, z) => svgPt(x - W / 2, 0, z - D / 2, th, ph, sc, ox, oy);
  for (let x = 0; x <= W; x += step) lines.push(`M${P(x, 0)} L${P(x, D)}`);
  for (let z = 0; z <= D; z += step) lines.push(`M${P(0, z)} L${P(W, z)}`);
  return lines.join(' ');
}

// ────────────────────────────────────────────────────────────────────────────────
export default function CabinetPlan3D({ model, cabinet: cabinetProp, pieces = [], name = 'Meuble' }) {
  const SVG_W = 620, SVG_H = 460;
  const OX = SVG_W * 0.48, OY = SVG_H * 0.65;

  const [theta, setTheta] = useState(0.52);
  const [phi,   setPhi]   = useState(0.32);
  const [zoom,  setZoom]  = useState(1);
  const drag = useRef({ on: false, lx: 0, ly: 0, ld: null });

  // ─── Résolution des dimensions ──────────────────────────────────────────────────────
  // Priorité : model (buildCabinetModel) > cabinet (legacy)
  let dims, T, BT, bodies, nbBodies;

  if (model?.dimensions) {
    // — Nouveau chemin : model issu de buildCabinetModel
    dims  = model.dimensions;
    T     = (model.material?.panelThickness ?? 1.8) / 100;
    BT    = (model.material?.backThickness  ?? 0.3)  / 100;
    const struct = model.structure || {};
    const rawBodies = Array.isArray(struct.bodies) && struct.bodies.length > 0
      ? struct.bodies
      : null;
    const W_m     = dims.width  / 100;
    const innerW  = W_m - 2 * T;
    const nbB     = rawBodies?.length ?? Math.max(1, struct.modules?.length ?? 1);
    bodies  = rawBodies ?? Array.from({ length: nbB }, () => ({
      width:   innerW / nbB,
      shelves: struct.nbShelves ?? 2,
      drawers: struct.nbDrawers ?? 0,
      rod:     struct.hasRod    ?? false,
    }));
    nbBodies = bodies.length;
  } else if (cabinetProp?.width) {
    // — Chemin hérité : cabinet plat
    const cab = cabinetProp;
    dims = { width: cab.width, height: cab.height, depth: cab.depth || 60, plinth: cab.plinth || 0 };
    T    = (cab.thickness || 1.8) / 100;
    BT   = 0.003;

    // Priorité : modules retournés par le serveur (liste avec width/shelves/drawers)
    const rawModules = Array.isArray(cab.modules) && cab.modules.length > 0 ? cab.modules : null;

    if (rawModules) {
      // Le serveur retourne les modules explicitement → on les utilise directement
      nbBodies = rawModules.length;
      bodies = rawModules.map(m => ({
        width:   parseFloat(m.width || m.w) || (dims.width / nbBodies), // cm
        shelves: Math.max(0, parseInt(m.shelves ?? m.nb_shelves ?? 2, 10)),
        drawers: Math.max(0, parseInt(m.drawers ?? m.nb_drawers ?? 0, 10)),
        rod:     Boolean(m.rod ?? m.tringle ?? m.hanging ?? false),
      }));
    } else {
      // Fallback : nb_dividers ou comptage dans pieces
      const nbDiv  = cab.nb_dividers ||
        (pieces || []).reduce((a, p) => a + (p.role === 'divider' ? (p.qty || 1) : 0), 0) || 0;
      nbBodies = nbDiv + 1;
      const bw_cm  = dims.width / nbBodies; // largeur approximative en cm
      const nS     = cab.nb_shelves ||
        (pieces || []).reduce((a, p) => a + (p.role === 'shelf' ? (p.qty || 1) : 0), 0) || 0;
      const nD     = cab.nb_drawers ||
        (pieces || []).reduce((a, p) => a + (['drawer_front','drawer_box'].includes(p.role) ? (p.qty || 1) : 0), 0) || 0;
      const rod    = (pieces || []).some(p =>
        p.role === 'rod' ||
        (p.notes || '').toLowerCase().includes('tringle') ||
        (p.name  || '').toLowerCase().includes('tringle')
      );
      bodies = Array.from({ length: nbBodies }, () => ({
        width:   bw_cm, // cm
        shelves: Math.max(0, Math.round(nS / nbBodies)),
        drawers: Math.max(0, Math.round(nD / nbBodies)),
        rod,
      }));
    }
  } else {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="text-5xl">📦</div>
        <p className="text-white font-bold text-lg">Vue 3D non disponible</p>
        <p className="text-sm text-slate-400 max-w-xs">
          Dimensions manquantes — relancez un scan IA ou entrez les dimensions manuellement.
        </p>
      </div>
    );
  }

  const W   = dims.width  / 100;
  const H   = dims.height / 100;
  const DEP = (dims.depth  || 60) / 100;
  const PL  = (dims.plinth || 0)  / 100;

  const maxDim  = Math.max(W, H, DEP);
  const BASE_SC = 155 / maxDim;
  const sc      = BASE_SC * zoom;
  const th      = theta;
  const ph      = phi;

  // Helper BF : génère 3 faces d'une boîte, centrée sur W/2 en X et DEP/2 en Z
  const BF = (box, pal) => {
    const { x0, y0, z0, x1, y1, z1 } = box;
    const Pf = (x, y, z) => svgPt(x - W / 2, y + PL, z - DEP / 2, th, ph, sc, OX, OY);
    const Df = (x, y, z) => depthOf(x - W / 2, y + PL, z - DEP / 2, th, ph, sc, OX, OY);
    const d  = Df((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const a  = pal.a ?? 1;
    return [
      { depth: d - 0.002, a,
        path: `M${Pf(x0,y0,z0)} L${Pf(x1,y0,z0)} L${Pf(x1,y1,z0)} L${Pf(x0,y1,z0)} Z`,
        fill: pal.f, stroke: pal.s, sw: pal.sw },
      { depth: d + 0.002, a,
        path: `M${Pf(x0,y1,z0)} L${Pf(x1,y1,z0)} L${Pf(x1,y1,z1)} L${Pf(x0,y1,z1)} Z`,
        fill: pal.t, stroke: pal.s, sw: pal.sw },
      { depth: d, a,
        path: `M${Pf(x1,y0,z0)} L${Pf(x1,y0,z1)} L${Pf(x1,y1,z1)} L${Pf(x1,y1,z0)} Z`,
        fill: pal.f, stroke: pal.s, sw: pal.sw },
    ];
  };

  // ─── Construction de la scène ────────────────────────────────────────────────────────
  let allFaces = [];

  // Socle
  if (PL > 0.005) {
    allFaces.push(...BF({ x0: 0, y0: -PL, z0: DEP * 0.05, x1: W, y1: 0, z1: DEP * 0.95 }, PAL.bottom));
  }

  // Côté gauche global
  allFaces.push(...BF({ x0: 0, y0: 0, z0: 0, x1: T, y1: H, z1: DEP }, PAL.side));

  // Dessus global
  allFaces.push(...BF({ x0: 0, y0: H - T, z0: 0, x1: W, y1: H, z1: DEP }, PAL.top));

  // Largeurs normalisées des corps
  const bodyWidths = bodies.map(b => {
    const bw = (typeof b.width === 'number' && b.width > 0) ? b.width / 100 : 0;
    return bw;
  });
  const totalBW  = bodyWidths.reduce((a, c) => a + c, 0);
  const innerW_m = W - 2 * T;
  const scaleW   = totalBW > 0.001 ? innerW_m / totalBW : 1;
  const scaledW  = bodyWidths.map(w => (w > 0 ? w * scaleW : innerW_m / nbBodies));

  let cursorX = T;

  scaledW.forEach((bw, b) => {
    const body    = bodies[b];
    const bx0     = cursorX;
    const bx1     = bx0 + bw;
    const isLast  = b === nbBodies - 1;
    const innerH  = H - 2 * T;

    const nbShelves = Math.max(0, parseInt(body?.shelves ?? 2, 10));
    const nbDrawers = Math.max(0, parseInt(body?.drawers ?? 0, 10));
    const hasRod    = Boolean(body?.rod ?? false);

    // Séparateur droit (ou côté droit final)
    allFaces.push(...BF(
      { x0: bx1, y0: 0, z0: 0, x1: bx1 + T, y1: H, z1: DEP },
      isLast ? PAL.side : PAL.divider
    ));

    // Fond bas
    allFaces.push(...BF({ x0: bx0, y0: 0, z0: 0, x1: bx1, y1: T, z1: DEP }, PAL.bottom));

    // Dos arrière
    allFaces.push(...BF(
      { x0: bx0, y0: T, z0: DEP - T * 0.5, x1: bx1, y1: H - T, z1: DEP },
      PAL.back
    ));

    if (nbDrawers > 0) {
      // ─ TIROIRS (empélés en bas)
      const drawerH    = (innerH * 0.45) / nbDrawers;
      const drawerZone = nbDrawers * drawerH;

      for (let d = 0; d < nbDrawers; d++) {
        const dy0 = T + d * drawerH;
        const dy1 = dy0 + drawerH;
        // Façade
        allFaces.push(...BF(
          { x0: bx0 + 0.012, y0: dy0 + 0.006, z0: -T * 0.8,
            x1: bx1 - 0.012, y1: dy1 - 0.008, z1: 0 },
          PAL.drawer
        ));
        // Poignée
        const hcx = (bx0 + bx1) / 2;
        allFaces.push(...BF(
          { x0: hcx - 0.035, y0: (dy0 + dy1) / 2 - 0.007, z0: -T * 0.8 - 0.018,
            x1: hcx + 0.035, y1: (dy0 + dy1) / 2 + 0.007, z1: -T * 0.8 },
          PAL.handle
        ));
      }

      // Tablette séparatrice au-dessus des tiroirs
      const sepY = T + drawerZone;
      allFaces.push(...BF(
        { x0: bx0, y0: sepY, z0: 0, x1: bx1, y1: sepY + T, z1: DEP },
        PAL.shelf
      ));

      // Tringle au-dessus si hasRod
      if (hasRod) {
        const rodY = sepY + T + (H - T - sepY - T) * 0.65;
        allFaces.push(...BF(
          { x0: bx0 + 0.02, y0: rodY - T * 0.4, z0: DEP * 0.38,
            x1: bx1 - 0.02, y1: rodY + T * 0.4, z1: DEP * 0.62 },
          PAL.rod
        ));
      }

    } else {
      // ─ TABLETTES
      if (nbShelves > 0) {
        const gap = innerH / (nbShelves + 1);
        for (let s = 0; s < nbShelves; s++) {
          const sy = T + gap * (s + 1);
          allFaces.push(...BF(
            { x0: bx0, y0: sy, z0: 0, x1: bx1, y1: sy + T, z1: DEP },
            PAL.shelf
          ));
        }
      }

      // ─ TRINGLE
      if (hasRod) {
        const rodY = T + innerH * (nbShelves > 0 ? 0.78 : 0.65);
        allFaces.push(...BF(
          { x0: bx0 + 0.015, y0: rodY - T * 0.45, z0: DEP * 0.36,
            x1: bx1 - 0.015, y1: rodY + T * 0.45, z1: DEP * 0.64 },
          PAL.rod
        ));
        // Supports
        for (const sx of [bx0 + 0.005, bx1 - 0.025]) {
          allFaces.push(...BF(
            { x0: sx, y0: rodY - T, z0: DEP * 0.36,
              x1: sx + 0.02, y1: rodY + T, z1: DEP * 0.64 },
            PAL.handle
          ));
        }
      }
    }

    cursorX += bw + T;
  });

  // Painter's algorithm
  allFaces.sort((a, b) => a.depth - b.depth);

  const gridPath = buildGrid(W * 2.2, DEP * 2.2, th, ph, sc, OX, OY);
  const dimsFace = buildDimFace(W, H, DEP, th, ph, sc, OX, OY);

  // Nom d'affichage
  const displayName = model?.name || name || 'MEUBLE';

  // ─── Handlers ───────────────────────────────────────────────────────────────────
  const down  = (lx, ly) => { drag.current.on = true; drag.current.lx = lx; drag.current.ly = ly; };
  const up    = ()       => { drag.current.on = false; drag.current.ld = null; };
  const move  = (cx, cy) => {
    if (!drag.current.on) return;
    const dx = cx - drag.current.lx, dy = cy - drag.current.ly;
    setTheta(t => t - dx * 0.007);
    setPhi(p => Math.max(0.02, Math.min(1.45, p + dy * 0.005)));
    drag.current.lx = cx; drag.current.ly = cy;
  };
  const wheel = e => {
    e.preventDefault();
    const d = e.deltaMode === 0 ? e.deltaY / 16 : e.deltaMode === 1 ? e.deltaY : e.deltaY * 10;
    setZoom(z => Math.max(0.25, Math.min(6, z * (1 + d * 0.025))));
  };
  const tStart = e => {
    if (e.touches.length === 1) { down(e.touches[0].clientX, e.touches[0].clientY); drag.current.on = true; }
    if (e.touches.length === 2) {
      drag.current.on = false;
      drag.current.ld = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };
  const tMove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current.on)
      move(e.touches[0].clientX, e.touches[0].clientY);
    if (e.touches.length === 2 && drag.current.ld) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setZoom(z => Math.max(0.25, Math.min(6, z * (drag.current.ld / d))));
      drag.current.ld = d;
    }
  };
  const snap = (t, p, z = 1) => { setTheta(t); setPhi(p); setZoom(z); };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: '#030811', userSelect: 'none', cursor: drag.current.on ? 'grabbing' : 'grab' }}
        onMouseDown={e => down(e.clientX, e.clientY)}
        onMouseUp={up} onMouseLeave={up}
        onMouseMove={e => move(e.clientX, e.clientY)}
        onWheel={wheel}
        onTouchStart={tStart} onTouchEnd={up} onTouchMove={tMove}
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
          style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bg3d" cx="50%" cy="40%" r="60%">
              <stop offset="0%"   stopColor="#0a1628" />
              <stop offset="100%" stopColor="#030811" />
            </radialGradient>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#bg3d)" />
          <path d={gridPath} stroke="#0a1830" strokeWidth="0.6" fill="none" opacity="0.7" />

          {allFaces.map((f, i) => (
            <path key={i} d={f.path} fill={f.fill} stroke={f.stroke}
              strokeWidth={f.sw} opacity={f.a ?? 1} />
          ))}

          {/* Cote largeur */}
          <line x1={dimsFace.p0w.sx} y1={dimsFace.p0w.sy}
                x2={dimsFace.p1w.sx} y2={dimsFace.p1w.sy}
            stroke="#f97316" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.7" />
          <text x={dimsFace.midW.sx} y={dimsFace.midW.sy} textAnchor="middle"
            fontSize="9" fill="#f97316" fontFamily="monospace" opacity="0.9">
            {dims.width} cm
          </text>
          {/* Cote hauteur */}
          <line x1={dimsFace.p0h.sx} y1={dimsFace.p0h.sy}
                x2={dimsFace.p1h.sx} y2={dimsFace.p1h.sy}
            stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.7" />
          <text x={dimsFace.midH.sx} y={dimsFace.midH.sy} textAnchor="middle"
            fontSize="9" fill="#22c55e" fontFamily="monospace" opacity="0.9">
            {dims.height} cm
          </text>
          {/* Cote profondeur */}
          <line x1={dimsFace.p0d.sx} y1={dimsFace.p0d.sy}
                x2={dimsFace.p1d.sx} y2={dimsFace.p1d.sy}
            stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.7" />
          <text x={dimsFace.midD.sx} y={dimsFace.midD.sy} textAnchor="middle"
            fontSize="9" fill="#3b82f6" fontFamily="monospace" opacity="0.9">
            {Math.round(DEP * 100)} cm
          </text>

          {/* Axes XYZ */}
          {(() => {
            const O  = { x: 46, y: SVG_H - 42 };
            const AS = 20;
            const AP = (ax, ay, az) => {
              const p = iso(ax, ay, az, th, ph, AS, O.x, O.y);
              return [p.sx.toFixed(1), p.sy.toFixed(1)];
            };
            return (
              <g opacity="0.75">
                <circle cx={O.x} cy={O.y} r="2" fill="#fff" />
                {[['X',[1,0,0],'#ef4444'],['Y',[0,1,0],'#22c55e'],['Z',[0,0,1],'#3b82f6']].map(([l,v,c]) => {
                  const [x2, y2] = AP(...v);
                  const [xt, yt] = AP(v[0]*1.4, v[1]*1.4, v[2]*1.4);
                  return (
                    <g key={l}>
                      <line x1={O.x} y1={O.y} x2={x2} y2={y2} stroke={c} strokeWidth="1.5" />
                      <text x={xt} y={yt} fontSize="8" fill={c} textAnchor="middle" fontWeight="bold">{l}</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          <text x={SVG_W - 8} y={SVG_H - 8} textAnchor="end"
            fontSize="9" fontFamily="monospace" fill="#f97316" opacity="0.7">
            {displayName.toUpperCase()} • {nbBodies} CORPS
          </text>
        </svg>

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-bold text-orange-400 tracking-widest">3D ISO</span>
        </div>
        <div className="absolute top-3 right-3 flex gap-2">
          <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-mono text-sky-400">
              {nbBodies}×{scaledW[0] > 0 ? Math.round(scaledW[0] * 100) : '?'}cm
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-mono text-slate-300">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Vues rapides */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: '↗️ Iso',      t: 0.52,      p: 0.32, z: 1 },
          { label: '🔄 Face',    t: Math.PI,   p: 0.5,  z: 1 },
          { label: '⬆ Dessus',  t: 0.52,      p: 0.02, z: 0.9 },
          { label: '➡ Côté',    t: Math.PI/2, p: 0.45, z: 1 },
          { label: '↙️ Arrière', t: Math.PI*2, p: 0.35, z: 1 },
        ].map(v => (
          <button key={v.label} onClick={() => snap(v.t, v.p, v.z)}
            className="py-2 text-[10px] font-bold text-slate-400 hover:text-white
              bg-[#070e1a] hover:bg-[#0f1c30] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="bg-[#030811] border border-white/5 rounded-xl p-3">
        <div className="flex flex-wrap gap-3 mb-2">
          {[
            { c: PAL.side.s,    l: 'Montant/Côté' },
            { c: PAL.shelf.s,   l: 'Tablette' },
            { c: PAL.divider.s, l: 'Séparateur' },
            { c: PAL.rod.s,     l: 'Tringle' },
            { c: PAL.drawer.s,  l: 'Tiroir' },
            { c: PAL.door.s,    l: 'Porte' },
            { c: PAL.back.s,    l: 'Dos arrière' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[10px] text-slate-400">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Glisser</b> = rotation</span>
          <span className="text-[10px] text-slate-500">⚙️ <b className="text-slate-400">Molette</b> = zoom</span>
          <span className="text-[10px] text-slate-500">👆 <b className="text-slate-400">1 doigt</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🤟 <b className="text-slate-400">Pincer</b> = zoom</span>
        </div>
      </div>
    </div>
  );
}
