/**
 * CabinetPlan3D.js — Vue isométrique SVG pure
 *
 * NOUVELLE APPROCHE : plus de Three.js / WebGL / canvas.
 * Projection isométrique standard calculée en JS pur, rendu en SVG React.
 * Avantages :
 *   • Zéro problème de zoom (SVG scale = CSS transform, jamais de noir)
 *   • Zéro near/far plane clipping
 *   • Zéro ResizeObserver / setSize / context perdu
 *   • Rotation orbitale par drag (souris + touch)
 *   • Zoom par molette/pinch via CSS transform
 *   • Rendu instantané, SSR-safe
 */
import { useRef, useState, useEffect, useCallback } from 'react';

// ── Couleurs par rôle ──────────────────────────────────────────────────
const COLORS = {
  side:         { face: '#1e3a5f', top: '#243f66', left: '#162d4a', stroke: '#475569' },
  top:          { face: '#1e4a6f', top: '#7dd3fc', left: '#1a3d5a', stroke: '#7dd3fc' },
  bottom:       { face: '#1e3a5f', top: '#2a4a70', left: '#162d4a', stroke: '#38bdf8' },
  shelf:        { face: '#0f3050', top: '#38bdf8', left: '#0a2540', stroke: '#38bdf8' },
  divider:      { face: '#0f3050', top: '#93c5fd', left: '#0a2540', stroke: '#93c5fd' },
  back:         { face: '#06111e', top: '#0d1f33', left: '#040d17', stroke: '#1e3a5f', alpha: 0.7 },
  door:         { face: '#f9731620', top: '#f97316', left: '#c2410c', stroke: '#f97316', alpha: 0.25 },
  drawer_front: { face: '#a855f720', top: '#a855f7', left: '#7e22ce', stroke: '#a855f7', alpha: 0.28 },
  default:      { face: '#1a2f4a', top: '#243a5a', left: '#111f33', stroke: '#64748b' },
};
const col = r => COLORS[r] || COLORS.default;

// ── Projection isométrique ─────────────────────────────────────────────────
// Rotation orbitale : theta (horizontal) + phi (vertical)
// Puis projection isométrique standard (angle fixe 30° en Y)
function project3D(x, y, z, theta, phi, scale, ox, oy) {
  // Rotation Y (theta)
  const rx = x * Math.cos(theta) + z * Math.sin(theta);
  const rz = -x * Math.sin(theta) + z * Math.cos(theta);
  // Rotation X (phi)
  const ry2 = y * Math.cos(phi) - rz * Math.sin(phi);
  const rz2 = y * Math.sin(phi) + rz * Math.cos(phi);
  // Projection plan
  return {
    sx: ox + rx * scale,
    sy: oy - ry2 * scale,
    depth: rz2,  // pour trier les faces (painter’s algorithm)
  };
}

function pt(x, y, z, theta, phi, scale, ox, oy) {
  const p = project3D(x, y, z, theta, phi, scale, ox, oy);
  return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
}

function ptDepth(x, y, z, theta, phi, scale, ox, oy) {
  return project3D(x, y, z, theta, phi, scale, ox, oy).depth;
}

// ── Construction des faces d’un panneau (6 faces, on garde face/dessus/gauche) ──
function buildFaces(panel, cab, theta, phi, scale, ox, oy) {
  const m = v => v / 100;
  const W = m(cab.width), H = m(cab.height), D = m(cab.depth || 60), T = m(cab.thickness || 1.8);
  const role = panel.role || 'default';
  const c = col(role);

  // Calculer la boîte 3D (x0,y0,z0) coin bas-gauche-avant + (bw, bh, bd) dimensions
  let x0, y0, z0, bw, bh, bd;
  const px = m(panel.x ?? 0), py = m(panel.y ?? 0);
  const pw = m(panel.w ?? cab.width), ph = m(panel.h ?? cab.height);

  if (['side', 'divider'].includes(role)) {
    x0 = px; y0 = py; z0 = 0; bw = T; bh = ph; bd = D;
  } else if (['top', 'bottom', 'shelf'].includes(role)) {
    x0 = px; y0 = py; z0 = 0; bw = pw; bh = T; bd = D;
  } else if (role === 'back') {
    x0 = px; y0 = py; z0 = D - T; bw = pw; bh = ph; bd = T;
  } else if (['door', 'drawer_front'].includes(role)) {
    x0 = px; y0 = py; z0 = -T; bw = pw; bh = ph; bd = T;
  } else {
    x0 = px; y0 = py; z0 = 0; bw = pw; bh = ph; bd = T;
  }

  // Centrer sur l’origine (milieu du meuble)
  const cx = W / 2, cy = 0, cz = D / 2;
  const ax = x => x - cx, ay = y => y, az = z => z - cz;

  const P = (x, y, z) => pt(ax(x), ay(y), az(z), theta, phi, scale, ox, oy);
  const Pd = (x, y, z) => ptDepth(ax(x), ay(y), az(z), theta, phi, scale, ox, oy);

  const x1 = x0 + bw, y1 = y0 + bh, z1 = z0 + bd;

  // Depth du centre pour painter’s algorithm
  const depth = Pd(x0 + bw/2, y0 + bh/2, z0 + bd/2);
  const alpha = c.alpha ?? 1;

  const faces = [];

  // Face avant (z = z0)
  faces.push({
    depth: depth - 0.001,
    path: `M${P(x0,y0,z0)} L${P(x1,y0,z0)} L${P(x1,y1,z0)} L${P(x0,y1,z0)} Z`,
    fill: c.face, stroke: c.stroke, alpha,
  });
  // Face dessus (y = y1)
  faces.push({
    depth: depth + 0.001,
    path: `M${P(x0,y1,z0)} L${P(x1,y1,z0)} L${P(x1,y1,z1)} L${P(x0,y1,z1)} Z`,
    fill: c.top, stroke: c.stroke, alpha,
  });
  // Face droite (x = x1)
  faces.push({
    depth: depth,
    path: `M${P(x1,y0,z0)} L${P(x1,y0,z1)} L${P(x1,y1,z1)} L${P(x1,y1,z0)} Z`,
    fill: c.left, stroke: c.stroke, alpha,
  });

  return faces;
}

// ── Grille de sol isométrique ───────────────────────────────────────────────
function buildGrid(W, D, theta, phi, scale, ox, oy, step) {
  const lines = [];
  const ax = x => x - W/2, az = z => z - D/2;
  const P = (x, z) => pt(ax(x), 0, az(z), theta, phi, scale, ox, oy);
  for (let x = 0; x <= W; x += step)
    lines.push(`M${P(x, 0)} L${P(x, D)}`);
  for (let z = 0; z <= D; z += step)
    lines.push(`M${P(0, z)} L${P(W, z)}`);
  return lines.join(' ');
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function CabinetPlan3D({ cabinet, name = 'Meuble' }) {
  const SVG_W = 560, SVG_H = 420;
  const OX = SVG_W / 2, OY = SVG_H * 0.62;

  // ─ État orbite
  const [theta, setTheta] = useState(0.55);
  const [phi,   setPhi]   = useState(0.35);
  const [zoom,  setZoom]  = useState(1);
  const drag = useRef({ active: false, lastX: 0, lastY: 0, lastDist: null });

  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-4xl">📦</div>
        <p className="text-white font-bold">Vue 3D non disponible</p>
        <p className="text-sm text-slate-400 max-w-xs">Dimensions manquantes — relancez un scan IA.</p>
      </div>
    );
  }

  const m = v => v / 100;
  const W = m(cabinet.width), H = m(cabinet.height), D = m(cabinet.depth || 60);
  const maxDim = Math.max(W, H, D);
  // Échelle de base : on veut que la plus grande dim fasse ~160px
  const BASE_SCALE = 160 / maxDim;
  const scale = BASE_SCALE * zoom;

  // ─ Construire toutes les faces + grille
  const panels = cabinet.panels || [];
  let allFaces = [];

  for (const p of panels) {
    const faces = buildFaces(p, cabinet, theta, phi, scale, OX, OY);
    allFaces = allFaces.concat(faces);
  }

  // Fallback : pas de panneaux → afficher le contour du meuble
  const fallbackFaces = panels.length === 0 ? buildFaces(
    { role: 'default', x: 0, y: 0, w: cabinet.width, h: cabinet.height },
    cabinet, theta, phi, scale, OX, OY
  ) : [];
  allFaces = allFaces.concat(fallbackFaces);

  // Painter’s algorithm : trier par depth croissant (faces les plus loin = dessinées en premier)
  allFaces.sort((a, b) => a.depth - b.depth);

  // Grille de sol
  const step = Math.max(0.1, maxDim / 6);
  const gridPath = buildGrid(W * 2.5, D * 2.5, theta, phi, scale, OX, OY, step);

  // ─ Handlers drag + zoom ──────────────────────────────────────
  const onMouseDown = e => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
  };
  const onMouseUp   = () => { drag.current.active = false; };
  const onMouseMove = e => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    setTheta(t => t - dx * 0.008);
    setPhi(p => Math.max(0.05, Math.min(1.4, p + dy * 0.005)));
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
  };
  const onWheel = e => {
    e.preventDefault();
    let lines = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 10 : e.deltaY / 16;
    setZoom(z => Math.max(0.3, Math.min(5, z * (1 + lines * 0.03))));
  };
  const onTouchStart = e => {
    if (e.touches.length === 1) {
      drag.current.active = true;
      drag.current.lastX = e.touches[0].clientX;
      drag.current.lastY = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      drag.current.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      drag.current.lastDist = Math.hypot(dx, dy);
    }
  };
  const onTouchEnd   = () => { drag.current.active = false; drag.current.lastDist = null; };
  const onTouchMove  = e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current.active) {
      const dx = e.touches[0].clientX - drag.current.lastX;
      const dy = e.touches[0].clientY - drag.current.lastY;
      setTheta(t => t - dx * 0.010);
      setPhi(p => Math.max(0.05, Math.min(1.4, p + dy * 0.007)));
      drag.current.lastX = e.touches[0].clientX;
      drag.current.lastY = e.touches[0].clientY;
    }
    if (e.touches.length === 2 && drag.current.lastDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      setZoom(z => Math.max(0.3, Math.min(5, z * (drag.current.lastDist / d))));
      drag.current.lastDist = d;
    }
  };

  // ─ Vues rapides ─────────────────────────────────────────────────────
  const snap = (t, p, z = 1) => { setTheta(t); setPhi(p); setZoom(z); };

  return (
    <div className="flex flex-col gap-3">
      {/* SVG isométrique */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#04090f]"
        style={{ width: '100%', userSelect: 'none', cursor: drag.current.active ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fond */}
          <rect width={SVG_W} height={SVG_H} fill="#04090f" />

          {/* Grille de sol */}
          <path d={gridPath} stroke="#0a1830" strokeWidth="0.8" fill="none" opacity="0.8" />

          {/* Toutes les faces triées (painter’s algo) */}
          {allFaces.map((f, i) => (
            <path
              key={i}
              d={f.path}
              fill={f.fill}
              stroke={f.stroke}
              strokeWidth="0.8"
              opacity={f.alpha ?? 1}
            />
          ))}

          {/* Label titre */}
          <text x={SVG_W - 8} y={SVG_H - 8} textAnchor="end"
            fontSize="10" fontFamily="monospace" fontWeight="bold"
            fill="#f97316" opacity="0.8">
            VUE 3D • {(name || 'MEUBLE').toUpperCase()}
          </text>
          <text x={8} y={SVG_H - 8} textAnchor="start"
            fontSize="9" fontFamily="monospace" fill="#64748b">
            {cabinet.width}×{cabinet.height}×{cabinet.depth || 60} cm
          </text>

          {/* Axes XYZ pour repère */}
          {(() => {
            const O = { x: 48, y: SVG_H - 48 };
            const AS = 22;
            const axPt = (ax, ay, az) => {
              const p = project3D(ax, ay, az, theta, phi, AS, O.x, O.y);
              return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
            };
            return (
              <g opacity="0.7">
                <circle cx={O.x} cy={O.y} r="2" fill="#fff" />
                <line x1={O.x} y1={O.y} x2={axPt(1,0,0).split(',')[0]} y2={axPt(1,0,0).split(',')[1]} stroke="#ef4444" strokeWidth="1.5" />
                <text x={axPt(1.3,0,0).split(',')[0]} y={axPt(1.3,0,0).split(',')[1]} fontSize="8" fill="#ef4444" textAnchor="middle" fontWeight="bold">X</text>
                <line x1={O.x} y1={O.y} x2={axPt(0,1,0).split(',')[0]} y2={axPt(0,1,0).split(',')[1]} stroke="#22c55e" strokeWidth="1.5" />
                <text x={axPt(0,1.3,0).split(',')[0]} y={axPt(0,1.3,0).split(',')[1]} fontSize="8" fill="#22c55e" textAnchor="middle" fontWeight="bold">Y</text>
                <line x1={O.x} y1={O.y} x2={axPt(0,0,1).split(',')[0]} y2={axPt(0,0,1).split(',')[1]} stroke="#3b82f6" strokeWidth="1.5" />
                <text x={axPt(0,0,1.3).split(',')[0]} y={axPt(0,0,1.3).split(',')[1]} fontSize="8" fill="#3b82f6" textAnchor="middle" fontWeight="bold">Z</text>
              </g>
            );
          })()}
        </svg>

        {/* Overlay infos */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
          <span className="text-[10px] font-bold text-orange-400 tracking-widest">VUE 3D ISO • SVG</span>
        </div>
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 pointer-events-none">
          <span className="text-[10px] font-mono text-slate-300">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Vues rapides */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: '🔄 Face',   t: Math.PI,     p: 0.5,  z: 1   },
          { label: '↗ Iso',    t: 0.55,        p: 0.35, z: 1   },
          { label: '⬆ Dessus', t: 0.55,        p: 0.02, z: 0.9 },
          { label: '➡ Côté',   t: Math.PI / 2, p: 0.5,  z: 1   },
          { label: '↙ Arrière',t: 0,           p: 0.35, z: 1   },
        ].map(v => (
          <button key={v.label} onClick={() => snap(v.t, v.p, v.z)}
            className="py-2 text-[10px] font-bold text-slate-400 hover:text-white bg-[#0a0f1a] hover:bg-[#111827] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      {/* Aide */}
      <div className="bg-[#04090f] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Glisser</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Molette</b> = zoom</span>
          <span className="text-[10px] text-slate-500">👆 <b className="text-slate-400">1 doigt</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🤏 <b className="text-slate-400">Pincer</b> = zoom</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { c: '#475569', l: 'Montant/Côté' }, { c: '#7dd3fc', l: 'Dessus' },
            { c: '#38bdf8', l: 'Tablette' },      { c: '#f97316', l: 'Porte' },
            { c: '#a855f7', l: 'Tiroir' },         { c: '#1e3a5f', l: 'Fond arrière' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[10px] text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
