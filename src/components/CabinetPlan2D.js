/**
 * CabinetPlan2D.js — 3 vues orthogonales industrielles : Face / Côté / Dessus
 * Reçoit : cabinet { width, height, depth, thickness, plinth, panels[], modules[] }
 * Toutes les dimensions sont en cm.
 */

const COLORS = {
  panel:    { fill: '#1e293b', stroke: '#94a3b8', strokeW: 1.5 },
  shelf:    { fill: '#0f2027', stroke: '#38bdf8', strokeW: 1 },
  door:     { fill: 'rgba(249,115,22,0.10)', stroke: '#f97316', strokeW: 1 },
  back:     { fill: '#0a1120', stroke: '#475569', strokeW: 1 },
  divider:  { fill: '#162032', stroke: '#7dd3fc', strokeW: 1 },
  drawer:   { fill: 'rgba(168,85,247,0.12)', stroke: '#a855f7', strokeW: 1 },
  dim:      '#64748b',
  dimLine:  '#334155',
  text:     '#e2e8f0',
  grid:     'rgba(255,255,255,0.03)',
  title:    '#f97316',
  cartouche:'#0f172a',
};

function colorFor(role) {
  if (role === 'shelf')        return COLORS.shelf;
  if (role === 'back')         return COLORS.back;
  if (role === 'door')         return COLORS.door;
  if (role === 'divider')      return COLORS.divider;
  if (role === 'drawer_front') return COLORS.drawer;
  return COLORS.panel;
}

// ── Cotation helper ─────────────────────────────────────────────────────────
function DimH({ x1, x2, y, label, color = COLORS.dim }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={color} strokeWidth="0.8" />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={color} strokeWidth="0.8" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.6" markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
      <text x={mid} y={y - 6} textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">{label}</text>
    </g>
  );
}
function DimV({ x, y1, y2, label, color = COLORS.dim }) {
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke={color} strokeWidth="0.8" />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke={color} strokeWidth="0.8" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="0.6" markerStart="url(#arrowU)" markerEnd="url(#arrowD)" />
      <text x={x - 10} y={mid + 3} textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace"
        transform={`rotate(-90 ${x - 10} ${mid + 3})`}>{label}</text>
    </g>
  );
}

// ── SVG Defs communes ────────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      <pattern id="p2d-grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M10 0L0 0 0 10" fill="none" stroke={COLORS.grid} strokeWidth="0.5" />
      </pattern>
      <marker id="arrowR" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0L6 3L0 6" fill="none" stroke={COLORS.dim} strokeWidth="1" />
      </marker>
      <marker id="arrowL" viewBox="0 0 6 6" refX="1" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M0 0L6 3L0 6" fill="none" stroke={COLORS.dim} strokeWidth="1" />
      </marker>
      <marker id="arrowU" viewBox="0 0 6 6" refX="3" refY="1" markerWidth="4" markerHeight="4" orient="270">
        <path d="M0 6L3 0L6 6" fill="none" stroke={COLORS.dim} strokeWidth="1" />
      </marker>
      <marker id="arrowD" viewBox="0 0 6 6" refX="3" refY="5" markerWidth="4" markerHeight="4" orient="90">
        <path d="M0 0L3 6L6 0" fill="none" stroke={COLORS.dim} strokeWidth="1" />
      </marker>
    </defs>
  );
}

// ── Vue de Face ─────────────────────────────────────────────────────────────
function ViewFace({ cab, scale, ox, oy }) {
  const W = cab.width  * scale;
  const H = cab.height * scale;
  const t = (cab.thickness || 1.8) * scale;
  const pl = (cab.plinth || 0) * scale;
  const panels = cab.panels || [];

  // Filtre les panneaux visibles de face (pas les fonds)
  const visible = panels.filter(p => p.role !== 'back');

  return (
    <g transform={`translate(${ox},${oy})`}>
      {/* fond de vue */}
      <rect x={0} y={0} width={W} height={H} fill="url(#p2d-grid)" stroke={COLORS.panel.stroke} strokeWidth="1" rx="1" />

      {/* Panneaux */}
      {visible.map((p, i) => {
        const px = p.x * scale;
        const py = (cab.height - p.y - p.h) * scale; // retournement Y (SVG = Y vers le bas)
        const pw = (p.role === 'side' ? (cab.depth || 60) > 0 ? t : p.w * scale : p.w * scale);
        // Pour la vue de face, les côtés montrent leur épaisseur
        const drawW = (p.role === 'side') ? t : p.w * scale;
        const drawH = p.h * scale;
        const c = colorFor(p.role);
        return (
          <g key={i}>
            <rect x={px} y={py} width={Math.max(drawW, 1)} height={Math.max(drawH, 1)}
              fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
            {drawW > 20 && drawH > 10 && (
              <text x={px + drawW / 2} y={py + drawH / 2 + 3} textAnchor="middle" fontSize="6"
                fill={COLORS.text} fontFamily="monospace" opacity="0.7">
                {p.name?.slice(0, 8)}
              </text>
            )}
          </g>
        );
      })}

      {/* plinthe */}
      {pl > 0 && (
        <rect x={t} y={H - pl} width={W - 2 * t} height={pl}
          fill="rgba(100,116,139,0.15)" stroke={COLORS.dimLine} strokeWidth="0.8" strokeDasharray="3,2" />
      )}

      {/* Cotations */}
      <DimH x1={0} x2={W} y={-14} label={`${cab.width} cm`} />
      <DimV x={W + 14} y1={0} y2={H} label={`${cab.height} cm`} />
      {pl > 0 && <DimV x={-18} y1={H - pl} y2={H} label={`${cab.plinth} cm`} />}

      {/* Séparations des modules */}
      {(cab.modules || []).map((mod, i) => {
        if (i === 0) return null;
        const mx = mod.x * scale;
        return <line key={i} x1={mx} y1={pl} x2={mx} y2={H - t} stroke={COLORS.divider.stroke} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />;
      })}

      {/* Label de vue */}
      <text x={W / 2} y={H + 22} textAnchor="middle" fontSize="9" fontWeight="700" fill={COLORS.title} fontFamily="sans-serif">VUE DE FACE</text>
    </g>
  );
}

// ── Vue de Côté ─────────────────────────────────────────────────────────────
function ViewSide({ cab, scale, ox, oy }) {
  const D = (cab.depth || 60) * scale;
  const H = cab.height * scale;
  const t = (cab.thickness || 1.8) * scale;
  const pl = (cab.plinth || 0) * scale;

  const shelves = (cab.panels || []).filter(p => p.role === 'shelf' || p.role === 'bottom' || p.role === 'top');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={D} height={H} fill="url(#p2d-grid)" stroke={COLORS.panel.stroke} strokeWidth="1" rx="1" />

      {/* Côté extérieur (silhouette) */}
      <rect x={0} y={0} width={t} height={H} fill={COLORS.panel.fill} stroke={COLORS.panel.stroke} strokeWidth={COLORS.panel.strokeW} />
      <rect x={D - t} y={0} width={t} height={H} fill={COLORS.panel.fill} stroke={COLORS.panel.stroke} strokeWidth={COLORS.panel.strokeW} />

      {/* Fond */}
      <rect x={D - t} y={0} width={t} height={H} fill={COLORS.back.fill} stroke={COLORS.back.stroke} strokeWidth="1" />

      {/* Tablettes / fond bas / dessus */}
      {shelves.map((s, i) => {
        const sy = (cab.height - s.y - s.h) * scale;
        const sh = s.h * scale;
        const c = colorFor(s.role);
        return (
          <rect key={i} x={t} y={sy} width={D - 2 * t} height={Math.max(sh, t)}
            fill={c.fill} stroke={c.stroke} strokeWidth={c.strokeW} />
        );
      })}

      {/* Plinthe */}
      {pl > 0 && (
        <rect x={0} y={H - pl} width={D - t} height={pl}
          fill="rgba(100,116,139,0.15)" stroke={COLORS.dimLine} strokeWidth="0.8" strokeDasharray="3,2" />
      )}

      <DimH x1={0} x2={D} y={-14} label={`${cab.depth} cm`} />
      <DimV x={D + 14} y1={0} y2={H} label={`${cab.height} cm`} />

      <text x={D / 2} y={H + 22} textAnchor="middle" fontSize="9" fontWeight="700" fill={COLORS.title} fontFamily="sans-serif">VUE DE CÔTÉ</text>
    </g>
  );
}

// ── Vue de Dessus ────────────────────────────────────────────────────────────
function ViewTop({ cab, scale, ox, oy }) {
  const W = cab.width * scale;
  const D = (cab.depth || 60) * scale;
  const t = (cab.thickness || 1.8) * scale;

  const dividers = (cab.panels || []).filter(p => p.role === 'side' || p.role === 'divider');

  return (
    <g transform={`translate(${ox},${oy})`}>
      <rect x={0} y={0} width={W} height={D} fill="url(#p2d-grid)" stroke={COLORS.panel.stroke} strokeWidth="1" rx="1" />

      {/* Contour extérieur */}
      <rect x={0} y={0} width={t} height={D} fill={COLORS.panel.fill} stroke={COLORS.panel.stroke} strokeWidth={COLORS.panel.strokeW} />
      <rect x={W - t} y={0} width={t} height={D} fill={COLORS.panel.fill} stroke={COLORS.panel.stroke} strokeWidth={COLORS.panel.strokeW} />
      <rect x={0} y={0} width={W} height={t} fill={COLORS.panel.fill} stroke={COLORS.panel.stroke} strokeWidth={COLORS.panel.strokeW} />
      <rect x={t} y={D - t} width={W - 2 * t} height={t} fill={COLORS.back.fill} stroke={COLORS.back.stroke} strokeWidth="1" />

      {/* Séparations verticales */}
      {dividers.filter(p => p.role === 'divider').map((p, i) => (
        <rect key={i} x={p.x * scale} y={t} width={t} height={D - 2 * t}
          fill={COLORS.divider.fill} stroke={COLORS.divider.stroke} strokeWidth={COLORS.divider.strokeW} />
      ))}

      <DimH x1={0} x2={W} y={-14} label={`${cab.width} cm`} />
      <DimV x={W + 14} y1={0} y2={D} label={`${cab.depth} cm`} />

      <text x={W / 2} y={D + 22} textAnchor="middle" fontSize="9" fontWeight="700" fill={COLORS.title} fontFamily="sans-serif">VUE DE DESSUS</text>
    </g>
  );
}

// ── Cartouche ────────────────────────────────────────────────────────────────
function Cartouche({ x, y, w, h, name, scale, width, height, depth }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={COLORS.cartouche} stroke="#334155" strokeWidth="1" rx="3" />
      <line x1={x} y1={y + 18} x2={x + w} y2={y + 18} stroke="#334155" strokeWidth="0.5" />
      <text x={x + 6} y={y + 12} fontSize="10" fontWeight="700" fill={COLORS.title} fontFamily="sans-serif">
        PanelCut Pro — Plan industriel
      </text>
      <text x={x + 6} y={y + 28} fontSize="8" fill="#94a3b8" fontFamily="monospace">MEUBLE : {name}</text>
      <text x={x + 6} y={y + 39} fontSize="8" fill="#64748b" fontFamily="monospace">
        L{width}×H{height}×P{depth} cm  •  Éch. ~1:{Math.round(1 / scale)}
      </text>
      <text x={x + 6} y={y + 50} fontSize="7" fill="#475569" fontFamily="monospace">
        {new Date().toLocaleDateString('fr-FR')}  •  Toutes cotes en cm
      </text>
    </g>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function CabinetPlan2D({ cabinet, name = 'Meuble' }) {
  if (!cabinet || !cabinet.width || !cabinet.height) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <p className="text-3xl mb-3">📐</p>
        <p>Dimensions du meuble non disponibles.</p>
        <p className="text-xs mt-1 text-slate-600">Le scan n'a pas pu extraire les dimensions globales.</p>
      </div>
    );
  }

  // Calcul de l'échelle pour que les 3 vues tiennent dans 800px de large
  const MARGIN   = 40;  // marge cotations
  const GAP      = 30;  // espace entre vues
  const CART_H   = 65;  // hauteur cartouche
  const MAX_W    = 800;

  const totalCmW = cabinet.width + (cabinet.depth || 60) + GAP / 1 + 2 * MARGIN;
  const scale    = Math.min(3.5, (MAX_W - 2 * MARGIN - GAP) / totalCmW);

  const faceW  = cabinet.width  * scale;
  const faceH  = cabinet.height * scale;
  const sideW  = (cabinet.depth || 60) * scale;
  const topH   = (cabinet.depth || 60) * scale;

  const svgW   = faceW + GAP + sideW + 2 * MARGIN + 30;
  const svgH   = faceH + GAP + topH  + 2 * MARGIN + CART_H + 50;

  // Origines des 3 vues
  const faceOX  = MARGIN + 20;
  const faceOY  = MARGIN + 20;
  const sideOX  = faceOX + faceW + GAP;
  const sideOY  = faceOY;
  const topOX   = faceOX;
  const topOY   = faceOY + faceH + GAP;

  const cartX   = 0;
  const cartY   = svgH - CART_H - 4;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-orange-500 rounded-xl opacity-10 blur" />
      <svg
        viewBox={`0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}`}
        className="relative w-full h-auto bg-[#060d18] rounded-xl border border-white/10"
        style={{ display: 'block' }}
      >
        <Defs />
        <rect x={0} y={0} width={svgW} height={svgH} fill="url(#p2d-grid)" />

        {/* Titre global */}
        <text x={svgW / 2} y={14} textAnchor="middle" fontSize="11" fontWeight="700"
          fill={COLORS.title} fontFamily="sans-serif" letterSpacing="1">
          PLAN TECHNIQUE — {(name || 'MEUBLE').toUpperCase()}
        </text>

        <ViewFace cab={cabinet} scale={scale} ox={faceOX} oy={faceOY} />
        <ViewSide cab={cabinet} scale={scale} ox={sideOX} oy={sideOY} />
        <ViewTop  cab={cabinet} scale={scale} ox={topOX}  oy={topOY} />

        {/* Ligne d'alignement face/dessus */}
        <line x1={faceOX} y1={topOY - 5} x2={faceOX + faceW} y2={topOY - 5}
          stroke={COLORS.dimLine} strokeWidth="0.4" strokeDasharray="4,3" opacity="0.4" />
        {/* Ligne d'alignement face/côté */}
        <line x1={sideOX - 5} y1={sideOY} x2={sideOX - 5} y2={sideOY + faceH}
          stroke={COLORS.dimLine} strokeWidth="0.4" strokeDasharray="4,3" opacity="0.4" />

        <Cartouche
          x={cartX + 4} y={cartY} w={svgW - 8} h={CART_H - 4}
          name={name} scale={scale}
          width={cabinet.width} height={cabinet.height} depth={cabinet.depth || 60}
        />
      </svg>
    </div>
  );
}
