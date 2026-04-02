/**
 * CabinetPlan3D.js — Vue isométrique SVG pure (zéro lib externe)
 * Projection iso standard : axe X = droite-bas, Y = gauche-bas, Z = haut
 * Reçoit : cabinet { width, height, depth, thickness, plinth, panels[] }
 * Toutes les dimensions en cm.
 */

// ── Projection isométrique ──────────────────────────────────────────────────
// Convention : (cx, cy, cz) => (svgX, svgY)
// cx = gauche→droite du meuble, cy = avant→arrière, cz = bas→haut
const ISO_SCALE = 4; // px par cm (ajusté dynamiquement)

function iso(cx, cy, cz, scale = ISO_SCALE) {
  const s = scale;
  const x = (cx - cy) * Math.cos(Math.PI / 6) * s;
  const y = (cx + cy) * Math.sin(Math.PI / 6) * s - cz * s;
  return [x, y];
}

function pt(cx, cy, cz, scale) {
  const [x, y] = iso(cx, cy, cz, scale);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

// ── Couleurs par rôle ───────────────────────────────────────────────────────
const ROLE_COLORS = {
  side:         { fill: '#1e3a5f', stroke: '#60a5fa', strokeW: 1.2 },
  back:         { fill: '#0f1f38', stroke: '#334155', strokeW: 0.8 },
  top:          { fill: '#1e3a5f', stroke: '#93c5fd', strokeW: 1.2 },
  bottom:       { fill: '#1e3a5f', stroke: '#93c5fd', strokeW: 1 },
  shelf:        { fill: '#0f2a3f', stroke: '#38bdf8', strokeW: 1 },
  divider:      { fill: '#162032', stroke: '#7dd3fc', strokeW: 0.9 },
  door:         { fill: 'rgba(249,115,22,0.15)', stroke: '#f97316', strokeW: 1.2 },
  drawer_front: { fill: 'rgba(168,85,247,0.15)', stroke: '#a855f7', strokeW: 1 },
  default:      { fill: '#1a2f4a', stroke: '#64748b', strokeW: 1 },
};

function colorFor(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.default;
}

// Luminosité relative des 3 faces (haut = clair, droite = moyen, gauche = sombre)
function lighten(hex, factor) {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((n >> 8)  & 0xff) * factor));
  const b = Math.min(255, Math.round(( n        & 0xff) * factor));
  return `rgb(${r},${g},${b})`;
}

// ── Rendu d'un panneau en 3 faces iso ──────────────────────────────────────
// Un panneau est une boîte aplatie (l'une des 3 dims = épaisseur)
// On détermine quelle face montrer selon le rôle.
function PanelBox({ panel, cab, scale, key: _key }) {
  const t  = cab.thickness || 1.8;
  const { x: px, y: py, z: pz, w, h, role } = panel;
  const c  = colorFor(role);

  // Détermination des dimensions 3D du panneau selon son rôle
  let cx1, cy1, cz1, cx2, cy2, cz2; // coin bas-avant-gauche + coin haut-arrière-droit
  switch (role) {
    case 'side':
    case 'divider':
      // Plan vertical parallèle à la profondeur : épaisseur sur X
      cx1 = px;     cy1 = 0;   cz1 = pz;
      cx2 = px + t; cy2 = cab.depth; cz2 = pz + h;
      break;
    case 'back':
      // Plan vertical parallèle à la largeur : épaisseur sur Y (fond)
      cx1 = px;     cy1 = cab.depth - t; cz1 = pz;
      cx2 = px + w; cy2 = cab.depth;     cz2 = pz + h;
      break;
    case 'top':
    case 'bottom':
    case 'shelf':
      // Plan horizontal : épaisseur sur Z
      cx1 = px;     cy1 = 0;            cz1 = pz;
      cx2 = px + w; cy2 = cab.depth;    cz2 = pz + t;
      break;
    case 'door':
      // Panneau vertical face avant : épaisseur sur Y
      cx1 = px;     cy1 = 0;   cz1 = pz;
      cx2 = px + w; cy2 = t;   cz2 = pz + h;
      break;
    case 'drawer_front':
      cx1 = px;     cy1 = 0;   cz1 = pz;
      cx2 = px + w; cy2 = t;   cz2 = pz + h;
      break;
    default:
      cx1 = px;     cy1 = 0;   cz1 = pz;
      cx2 = px + w; cy2 = cab.depth; cz2 = pz + h;
  }

  const dx = cx2 - cx1, dy = cy2 - cy1, dz = cz2 - cz1;
  const fillTop    = lighten(c.fill, 1.8);
  const fillRight  = lighten(c.fill, 1.3);
  const fillLeft   = c.fill;

  // Face du dessus (visible si Z > 0)
  const topFace = `${pt(cx1,cy1,cz2,scale)} ${pt(cx2,cy1,cz2,scale)} ${pt(cx2,cy2,cz2,scale)} ${pt(cx1,cy2,cz2,scale)}`;
  // Face de droite (avant, Y=cy1)
  const frontFace = `${pt(cx1,cy1,cz1,scale)} ${pt(cx2,cy1,cz1,scale)} ${pt(cx2,cy1,cz2,scale)} ${pt(cx1,cy1,cz2,scale)}`;
  // Face de gauche (côté, X=cx2)
  const sideFace  = `${pt(cx2,cy1,cz1,scale)} ${pt(cx2,cy2,cz1,scale)} ${pt(cx2,cy2,cz2,scale)} ${pt(cx2,cy1,cz2,scale)}`;

  return (
    <g opacity={role === 'back' ? 0.35 : 1}>
      {/* Face gauche */}
      {dy > 0.5 && (
        <polygon points={sideFace} fill={fillLeft} stroke={c.stroke} strokeWidth={c.strokeW * 0.7} strokeLinejoin="round" />
      )}
      {/* Face avant */}
      {dy > 0 && (
        <polygon points={frontFace} fill={fillRight} stroke={c.stroke} strokeWidth={c.strokeW * 0.9} strokeLinejoin="round" />
      )}
      {/* Face du dessus */}
      {dz > 0.5 && (
        <polygon points={topFace} fill={fillTop} stroke={c.stroke} strokeWidth={c.strokeW} strokeLinejoin="round" />
      )}
    </g>
  );
}

// ── Axes de référence ───────────────────────────────────────────────────────
function AxisHelper({ cab, scale, ox, oy }) {
  const L = 18;
  const o = iso(0, 0, 0, scale);
  const xA = iso(L / scale, 0, 0, scale);
  const yA = iso(0, L / scale, 0, scale);
  const zA = iso(0, 0, L / scale, scale);
  const c = [ox + o[0], oy + o[1]];
  return (
    <g>
      <line x1={c[0]} y1={c[1]} x2={ox + xA[0]} y2={oy + xA[1]} stroke="#ef4444" strokeWidth="1.5" />
      <text x={ox + xA[0] + 3} y={oy + xA[1] + 3} fontSize="7" fill="#ef4444" fontFamily="monospace">X</text>
      <line x1={c[0]} y1={c[1]} x2={ox + yA[0]} y2={oy + yA[1]} stroke="#22c55e" strokeWidth="1.5" />
      <text x={ox + yA[0] - 8} y={oy + yA[1] + 3} fontSize="7" fill="#22c55e" fontFamily="monospace">Y</text>
      <line x1={c[0]} y1={c[1]} x2={ox + zA[0]} y2={oy + zA[1]} stroke="#60a5fa" strokeWidth="1.5" />
      <text x={ox + zA[0] + 3} y={oy + zA[1]} fontSize="7" fill="#60a5fa" fontFamily="monospace">Z</text>
    </g>
  );
}

// ── Silhouette du meuble (boîte filaire) ────────────────────────────────────
function CabinetWireframe({ cab, scale, ox, oy }) {
  const W = cab.width, D = cab.depth || 60, H = cab.height;
  const edges = [
    // Base
    [[0,0,0],[W,0,0]], [[W,0,0],[W,D,0]], [[W,D,0],[0,D,0]], [[0,D,0],[0,0,0]],
    // Sommet
    [[0,0,H],[W,0,H]], [[W,0,H],[W,D,H]], [[W,D,H],[0,D,H]], [[0,D,H],[0,0,H]],
    // Montants
    [[0,0,0],[0,0,H]], [[W,0,0],[W,0,H]], [[W,D,0],[W,D,H]], [[0,D,0],[0,D,H]],
  ];
  return (
    <g>
      {edges.map(([[x1,y1,z1],[x2,y2,z2]], i) => {
        const [ax, ay] = iso(x1, y1, z1, scale);
        const [bx, by] = iso(x2, y2, z2, scale);
        return (
          <line key={i}
            x1={ox + ax} y1={oy + ay} x2={ox + bx} y2={oy + by}
            stroke="#1e3a5f" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
        );
      })}
    </g>
  );
}

// ── Cotations 3D ────────────────────────────────────────────────────────────
function DimLine3D({ p1, p2, label, color, scale, ox, oy, offset = [0, -10] }) {
  const [ax, ay] = iso(...p1, scale);
  const [bx, by] = iso(...p2, scale);
  const mx = (ax + bx) / 2 + offset[0];
  const my = (ay + by) / 2 + offset[1];
  return (
    <g>
      <line x1={ox+ax} y1={oy+ay} x2={ox+bx} y2={oy+by} stroke={color} strokeWidth="0.8"
        markerStart="url(#iso-arrow-s)" markerEnd="url(#iso-arrow-e)" />
      <text x={ox+mx} y={oy+my} textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace"
        style={{textShadow:'0 0 4px #000'}}>{label}</text>
    </g>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function CabinetPlan3D({ cabinet, name = 'Meuble' }) {
  if (!cabinet || !cabinet.width || !cabinet.height) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <p className="text-3xl mb-3">📦</p>
        <p>Dimensions du meuble non disponibles pour la vue 3D.</p>
      </div>
    );
  }

  const cab = {
    ...cabinet,
    depth: cabinet.depth || 60,
    thickness: cabinet.thickness || 1.8,
    plinth: cabinet.plinth || 0,
    panels: cabinet.panels || [],
  };

  // Calcul de l'échelle pour tenir dans ~480px de large
  const MAX_SVG_W = 480;
  const rawSpan = (cab.width + cab.depth) * Math.cos(Math.PI / 6);
  const scale = Math.min(5, Math.max(1.5, (MAX_SVG_W - 80) / rawSpan));

  // Bounding box de la projection
  const corners = [
    [0, 0, 0], [cab.width, 0, 0], [0, cab.depth, 0], [cab.width, cab.depth, 0],
    [0, 0, cab.height], [cab.width, 0, cab.height], [0, cab.depth, cab.height], [cab.width, cab.depth, cab.height],
  ];
  const xs = corners.map(([cx, cy, cz]) => iso(cx, cy, cz, scale)[0]);
  const ys = corners.map(([cx, cy, cz]) => iso(cx, cy, cz, scale)[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const PAD   = 50;
  const CART  = 58;
  const svgW  = maxX - minX + PAD * 2;
  const svgH  = maxY - minY + PAD * 2 + CART;
  const ox    = PAD - minX;
  const oy    = PAD - minY;

  // Tri des panneaux par profondeur de peintre (plus loin = dessiné en premier)
  // Clé de tri : avg(cx+cy) croissant = plus à l'arrière
  const sortedPanels = [...cab.panels].sort((a, b) => {
    const depthA = (a.x || 0) + ((a.role === 'back') ? cab.depth : (cab.depth / 2));
    const depthB = (b.x || 0) + ((b.role === 'back') ? cab.depth : (cab.depth / 2));
    return depthB - depthA;
  });

  // Si aucun panneau, on dessine juste la silhouette
  const hasPanels = sortedPanels.length > 0;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-xl opacity-10 blur" />
      <svg
        viewBox={`0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}`}
        className="relative w-full h-auto bg-[#04090f] rounded-xl border border-white/10"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern id="iso-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="iso-bg" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="100%" stopColor="#020608" />
          </radialGradient>
          <marker id="iso-arrow-s" viewBox="0 0 6 6" refX="1" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0L6 3L0 6" fill="none" stroke="#64748b" strokeWidth="1" />
          </marker>
          <marker id="iso-arrow-e" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L6 3L0 6" fill="none" stroke="#64748b" strokeWidth="1" />
          </marker>
        </defs>

        <rect x={0} y={0} width={svgW} height={svgH} fill="url(#iso-bg)" />
        <rect x={0} y={0} width={svgW} height={svgH} fill="url(#iso-grid)" />

        {/* Titre */}
        <text x={svgW / 2} y={14} textAnchor="middle" fontSize="10" fontWeight="700"
          fill="#f97316" fontFamily="sans-serif" letterSpacing="1">
          VUE ISOMÉTRIQUE — {(name || 'MEUBLE').toUpperCase()}
        </text>

        {/* Silhouette filaire */}
        <CabinetWireframe cab={cab} scale={scale} ox={ox} oy={oy} />

        {/* Panneaux */}
        {hasPanels
          ? sortedPanels.map((panel, i) => (
              panel.w > 0 && panel.h > 0
                ? <PanelBox key={i} panel={panel} cab={cab} scale={scale} ox={ox} oy={oy} />
                : null
            ))
          : (
            /* Fallback : boîte pleine si pas de panels */
            <>
              {/* Face gauche */}
              <polygon
                points={`${pt(0,0,0,scale)} ${pt(0,cab.depth,0,scale)} ${pt(0,cab.depth,cab.height,scale)} ${pt(0,0,cab.height,scale)}`
                  .split(' ').map(p => { const [x,y] = p.split(','); return `${ox+parseFloat(x)},${oy+parseFloat(y)}`; }).join(' ')}
                fill="#1a2f4a" stroke="#60a5fa" strokeWidth="1"
              />
              {/* Face avant */}
              <polygon
                points={`${pt(0,0,0,scale)} ${pt(cab.width,0,0,scale)} ${pt(cab.width,0,cab.height,scale)} ${pt(0,0,cab.height,scale)}`
                  .split(' ').map(p => { const [x,y] = p.split(','); return `${ox+parseFloat(x)},${oy+parseFloat(y)}`; }).join(' ')}
                fill="#1e3a5f" stroke="#93c5fd" strokeWidth="1"
              />
              {/* Dessus */}
              <polygon
                points={`${pt(0,0,cab.height,scale)} ${pt(cab.width,0,cab.height,scale)} ${pt(cab.width,cab.depth,cab.height,scale)} ${pt(0,cab.depth,cab.height,scale)}`
                  .split(' ').map(p => { const [x,y] = p.split(','); return `${ox+parseFloat(x)},${oy+parseFloat(y)}`; }).join(' ')}
                fill="#2a4f7a" stroke="#93c5fd" strokeWidth="1"
              />
            </>
          )
        }

        {/* Axes */}
        <AxisHelper cab={cab} scale={scale} ox={ox} oy={oy} />

        {/* Cotations */}
        <DimLine3D
          p1={[0, cab.depth + 4, 0]} p2={[cab.width, cab.depth + 4, 0]}
          label={`L ${cab.width} cm`} color="#f59e0b" scale={scale} ox={ox} oy={oy} offset={[0, 8]}
        />
        <DimLine3D
          p1={[cab.width + 4, 0, 0]} p2={[cab.width + 4, cab.depth, 0]}
          label={`P ${cab.depth} cm`} color="#22c55e" scale={scale} ox={ox} oy={oy} offset={[10, 0]}
        />
        <DimLine3D
          p1={[cab.width + 4, 0, 0]} p2={[cab.width + 4, 0, cab.height]}
          label={`H ${cab.height} cm`} color="#60a5fa" scale={scale} ox={ox} oy={oy} offset={[12, 0]}
        />

        {/* Cartouche */}
        <rect x={2} y={svgH - CART + 2} width={svgW - 4} height={CART - 4}
          fill="#04090f" stroke="#1e3a5f" strokeWidth="0.8" rx="3" />
        <line x1={2} y1={svgH - CART + 18} x2={svgW - 2} y2={svgH - CART + 18}
          stroke="#1e3a5f" strokeWidth="0.5" />
        <text x={svgW / 2} y={svgH - CART + 13} textAnchor="middle" fontSize="9" fontWeight="700"
          fill="#f97316" fontFamily="sans-serif">PanelCut Pro — Vue isométrique</text>
        <text x={8} y={svgH - CART + 30} fontSize="7.5" fill="#64748b" fontFamily="monospace">
          {`${cab.width}×${cab.height}×${cab.depth} cm — ép. ${cab.thickness} cm`}
        </text>
        <text x={8} y={svgH - CART + 42} fontSize="7" fill="#475569" fontFamily="monospace">
          {`${sortedPanels.length} panneaux structurels — ${new Date().toLocaleDateString('fr-FR')}`}
        </text>
        <text x={svgW - 8} y={svgH - CART + 30} textAnchor="end" fontSize="7" fill="#334155" fontFamily="monospace">
          x=Largeur · y=Profondeur · z=Hauteur
        </text>
      </svg>
    </div>
  );
}
