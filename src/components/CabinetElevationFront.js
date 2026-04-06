import React from 'react';

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * Normalise les modules depuis cabinet.modules[]
 * Supporte rods[] (tableau de tringles multiples) et rod (legacy booléen/objet)
 */
function normalizeModules(cabinet) {
  const raw = Array.isArray(cabinet?.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);

  if (detailed.length > 0) {
    return detailed.map((m, i) => {
      const w = Math.max(0, toNum(m.width ?? m.w ?? m.largeur, 0));

      // --- Tringles : rods[] nouveau format OU rod legacy ---
      let rods = [];
      if (Array.isArray(m.rods) && m.rods.length > 0) {
        rods = m.rods
          .map(r => (typeof r === 'object' && r !== null ? toNum(r.y, null) : null))
          .filter(y => y !== null && y >= 0);
      } else if (m.rod) {
        if (typeof m.rod === 'object' && m.rod.y != null) {
          rods = [toNum(m.rod.y, 0)];
        } else if (m.rod === true || m.tringle === true || m.hanging === true) {
          rods = [null]; // position auto
        }
      }

      // --- Tablettes ---
      const rawShelves = m.shelves ?? m.nb_shelves ?? 0;
      let shelfPositions = [];
      if (Array.isArray(rawShelves)) {
        shelfPositions = rawShelves
          .map(s => (typeof s === 'object' && s !== null ? toNum(s.y, null) : toNum(s, null)))
          .filter(y => y !== null && y >= 0);
      }
      const nbShelves = shelfPositions.length > 0 ? shelfPositions.length : Math.max(0, parseInt(rawShelves, 10) || 0);

      // --- Tiroirs ---
      const rawDrawers = m.drawers ?? m.nb_drawers ?? 0;
      let drawerItems = [];
      if (Array.isArray(rawDrawers)) {
        drawerItems = rawDrawers
          .filter(d => typeof d === 'object' && d !== null)
          .map(d => ({ y: toNum(d.y, null), h: toNum(d.height ?? d.h ?? 20, 20) }))
          .filter(d => d.y !== null && d.y >= 0);
      }
      const nbDrawers = drawerItems.length > 0 ? drawerItems.length : Math.max(0, parseInt(rawDrawers, 10) || 0);

      return {
        id: m.id ?? i + 1,
        width: w,
        rods,
        shelves: nbShelves,
        shelfPositions,
        drawers: nbDrawers,
        drawerItems,
        doors: Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10)),
      };
    }).filter(m => m.width > 0);
  }

  // Fallback : modules génériques
  const W = Math.max(0, toNum(cabinet?.width, 0));
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 4, 10) + 1);
  const mw = W > 0 ? W / nb : 0;
  return Array.from({ length: nb }, (_, i) => ({
    id: i + 1,
    width: mw,
    rods: [],
    shelves: 2,
    shelfPositions: [],
    drawers: 0,
    drawerItems: [],
    doors: 1,
  }));
}

export default function CabinetElevationFront({ cabinet, name = 'Meuble' }) {
  if (!cabinet?.width || !cabinet?.height) {
    return <div className="text-center py-8 text-slate-500">Dimensions indisponibles.</div>;
  }

  const modules = normalizeModules(cabinet);
  const W  = toNum(cabinet.width, 0);
  const H  = toNum(cabinet.height, 0);
  const PL = Math.max(0, toNum(cabinet.plinth, 0));

  // ── Layout SVG ──
  const PAD    = 60;   // marges
  const DRAW_W = 860;  // largeur dessin
  const DRAW_H = 450;  // hauteur dessin (incluant plinthe)
  const PLINTH_PX = PL > 0 ? Math.round((PL / H) * DRAW_H) : 14;
  const INNER_H   = DRAW_H - PLINTH_PX; // hauteur utile intérieure

  const sx = DRAW_W / Math.max(1, W);
  const sy = INNER_H / Math.max(1, H - PL); // échelle y sur hauteur utile

  const ox = PAD;
  const oy = PAD + 30; // origine Y du dessus du meuble

  // Calcul positions X des modules
  let cursor = 0;
  const moduleRects = modules.map((m) => {
    const x = ox + cursor * sx;
    const w = m.width * sx;
    cursor += m.width;
    return { ...m, x, w };
  });

  const svgW = PAD * 2 + DRAW_W + 40;
  const svgH = PAD * 2 + DRAW_H + 120;

  // ── Helpers position px ──
  // y en cm depuis bas intérieur → px depuis dessus
  const cmToY = (yCm) => oy + INNER_H - yCm * sy;

  // Position auto pour une tringle : 88% de la hauteur intérieure
  const autoRodY = oy + INNER_H * 0.12;

  return (
    <div className="relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600/20 to-blue-600/20 rounded-xl blur-lg" />
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="relative w-full h-auto bg-white rounded-xl border border-slate-200 shadow-xl"
      >
        <defs>
          <marker id="arrR" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L8 4L0 8Z" fill="#dc2626" />
          </marker>
          <marker id="arrL" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M8 0L0 4L8 8Z" fill="#dc2626" />
          </marker>
          <marker id="arrU" viewBox="0 0 8 8" refX="4" refY="1" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 8L4 0L8 8Z" fill="#dc2626" />
          </marker>
          <marker id="arrD" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L4 8L8 0Z" fill="#dc2626" />
          </marker>
        </defs>

        {/* Titre */}
        <text x={svgW / 2} y={22} textAnchor="middle" fontSize={13} fontWeight="700" fill="#334155">
          {name} — {W} × {H} cm
        </text>

        {/* Corps extérieur */}
        <rect x={ox} y={oy} width={DRAW_W} height={DRAW_H} fill="#f8fafc" stroke="#374151" strokeWidth={2.5} />

        {/* Plinthe */}
        {PL > 0 && (
          <>
            <rect x={ox} y={oy + INNER_H} width={DRAW_W} height={PLINTH_PX} fill="#e2e8f0" stroke="#374151" strokeWidth={1} />
            <text x={ox + DRAW_W / 2} y={oy + INNER_H + PLINTH_PX / 2 + 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
              Plinthe {PL} cm
            </text>
          </>
        )}

        {/* Panneau dessus */}
        <rect x={ox} y={oy} width={DRAW_W} height={10} fill="#e5e7eb" stroke="#374151" strokeWidth={0.5} />

        {/* ── Modules ── */}
        {moduleRects.map((m) => {
          const mx  = m.x;
          const mw  = m.w;
          const mid = mx + mw / 2;

          // ─ Séparateur vertical
          const sep = (
            <rect key={`sep-${m.id}`} x={mx + mw - 3} y={oy} width={6} height={INNER_H} fill="#d1d5db" stroke="#9ca3af" strokeWidth={0.5} />
          );

          // ─ Tringles (une ou plusieurs)
          const rodElems = m.rods.map((yCm, ri) => {
            const ryPx = yCm !== null ? cmToY(yCm) : autoRodY + ri * (INNER_H * 0.3);
            return (
              <g key={`rod-${m.id}-${ri}`}>
                <line x1={mx + 8} y1={ryPx} x2={mx + mw - 8} y2={ryPx} stroke="#374151" strokeWidth={4} strokeLinecap="round" />
                <circle cx={mx + 8}      cy={ryPx - 4} r={5} fill="#9ca3af" stroke="#374151" strokeWidth={1.5} />
                <circle cx={mx + mw - 8} cy={ryPx - 4} r={5} fill="#9ca3af" stroke="#374151" strokeWidth={1.5} />
                <line x1={mid} y1={ryPx - 10} x2={mid} y2={ryPx} stroke="#6b7280" strokeWidth={2} />
                <circle cx={mid} cy={ryPx - 11} r={3} fill="none" stroke="#6b7280" strokeWidth={2} />
              </g>
            );
          });

          // ─ Tablettes
          const shelfElems = m.shelfPositions.length > 0
            ? m.shelfPositions.map((yCm, si) => {
                const syPx = cmToY(yCm);
                return (
                  <rect key={`shelf-${m.id}-${si}`}
                    x={mx + 4} y={syPx - 4}
                    width={mw - 8} height={5}
                    fill="#6b7280" stroke="none" rx={1}
                  />
                );
              })
            : m.shelves > 0
              ? Array.from({ length: m.shelves }, (_, si) => {
                  const syPx = oy + ((si + 1) / (m.shelves + 1)) * INNER_H;
                  return (
                    <rect key={`shelf-${m.id}-${si}`}
                      x={mx + 4} y={syPx - 2}
                      width={mw - 8} height={5}
                      fill="#6b7280" stroke="none" rx={1}
                    />
                  );
                })
              : null;

          // ─ Tiroirs
          const drawerElems = m.drawerItems.length > 0
            ? m.drawerItems.map((d, di) => {
                const dyTop = cmToY(d.y + d.h);
                const dhPx  = d.h * sy;
                return (
                  <g key={`drawer-${m.id}-${di}`}>
                    <rect x={mx + 6} y={dyTop} width={mw - 12} height={Math.max(dhPx, 12)}
                      fill="rgba(139,92,246,0.08)" stroke="#6d28d9" strokeWidth={1.3} rx={2}
                    />
                    <rect
                      x={mx + mw / 2 - 18} y={dyTop + Math.max(dhPx, 12) / 2 - 4}
                      width={36} height={8} rx={4}
                      fill="none" stroke="#4c1d95" strokeWidth={1.8}
                    />
                  </g>
                );
              })
            : m.drawers > 0
              ? Array.from({ length: m.drawers }, (_, di) => {
                  const totalH = INNER_H * 0.38;
                  const dh     = totalH / m.drawers;
                  const dyTop  = oy + INNER_H - totalH + di * dh;
                  return (
                    <g key={`drawer-${m.id}-${di}`}>
                      <rect x={mx + 6} y={dyTop + 2} width={mw - 12} height={dh - 4}
                        fill="rgba(139,92,246,0.08)" stroke="#6d28d9" strokeWidth={1.3} rx={2}
                      />
                      <rect
                        x={mx + mw / 2 - 18} y={dyTop + dh / 2 - 4}
                        width={36} height={8} rx={4}
                        fill="none" stroke="#4c1d95" strokeWidth={1.8}
                      />
                    </g>
                  );
                })
              : null;

          // ─ Numéro du module
          const numElem = (
            <g key={`num-${m.id}`}>
              <circle cx={mid} cy={oy + INNER_H * 0.5} r={16} fill="none" stroke="#dc2626" strokeWidth={1.8} />
              <text x={mid} y={oy + INNER_H * 0.5 + 5} textAnchor="middle" fontSize={14} fontWeight="700" fill="#dc2626">{m.id}</text>
            </g>
          );

          // ─ Cote largeur module
          const coteY  = oy + DRAW_H + 36;
          const coteElem = (
            <g key={`cote-${m.id}`}>
              <line x1={mx} y1={coteY} x2={mx + mw} y2={coteY} stroke="#dc2626" strokeWidth={1.5}
                markerStart="url(#arrL)" markerEnd="url(#arrR)" />
              <line x1={mx}      y1={coteY - 5} x2={mx}      y2={coteY + 5} stroke="#dc2626" strokeWidth={1.2} />
              <line x1={mx + mw} y1={coteY - 5} x2={mx + mw} y2={coteY + 5} stroke="#dc2626" strokeWidth={1.2} />
              <text x={mid} y={coteY - 7} textAnchor="middle" fontSize={10} fontWeight="700" fill="#b45309">
                {m.width.toFixed(1)} cm
              </text>
            </g>
          );

          return (
            <g key={`module-${m.id}`}>
              {sep}
              {rodElems}
              {shelfElems}
              {drawerElems}
              {numElem}
              {coteElem}
            </g>
          );
        })}

        {/* Cote largeur totale */}
        <line
          x1={ox} y1={oy - 18} x2={ox + DRAW_W} y2={oy - 18}
          stroke="#dc2626" strokeWidth={1.5}
          markerStart="url(#arrL)" markerEnd="url(#arrR)"
        />
        <text x={ox + DRAW_W / 2} y={oy - 24} textAnchor="middle" fontSize={11} fontWeight="700" fill="#b45309">
          {W} cm{PL > 0 ? ` + ${PL} cm plinthe` : ''}
        </text>

        {/* Cote hauteur droite */}
        <line
          x1={ox + DRAW_W + 18} y1={oy}
          x2={ox + DRAW_W + 18} y2={oy + DRAW_H}
          stroke="#dc2626" strokeWidth={1.5}
          markerStart="url(#arrU)" markerEnd="url(#arrD)"
        />
        <text
          x={ox + DRAW_W + 34}
          y={oy + DRAW_H / 2}
          transform={`rotate(90 ${ox + DRAW_W + 34} ${oy + DRAW_H / 2})`}
          textAnchor="middle" fontSize={11} fontWeight="700" fill="#b45309"
        >
          {H} cm
        </text>

        {/* Labels +3 épaisseur */}
        <text x={ox - 14} y={oy + INNER_H / 2} textAnchor="middle" fontSize={10} fill="#6b7280"
          transform={`rotate(270 ${ox - 14} ${oy + INNER_H / 2})`}>
          +3
        </text>
        <text x={ox + 30} y={oy + 6} textAnchor="middle" fontSize={10} fill="#6b7280">+3</text>

      </svg>
    </div>
  );
}
