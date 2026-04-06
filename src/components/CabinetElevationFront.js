import React, { useState, useRef, useCallback } from 'react';

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeModules(cabinet) {
  const raw = Array.isArray(cabinet?.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);

  if (detailed.length > 0) {
    return detailed.map((m, i) => {
      const w = Math.max(0, toNum(m.width ?? m.w ?? m.largeur, 0));
      let rods = [];
      if (Array.isArray(m.rods) && m.rods.length > 0) {
        rods = m.rods.map(r => (typeof r === 'object' && r !== null ? toNum(r.y, null) : null)).filter(y => y !== null && y >= 0);
      } else if (m.rod) {
        if (typeof m.rod === 'object' && m.rod.y != null) rods = [toNum(m.rod.y, 0)];
        else if (m.rod === true || m.tringle === true || m.hanging === true) rods = [null];
      }
      const rawShelves = m.shelves ?? m.nb_shelves ?? 0;
      let shelfPositions = [];
      if (Array.isArray(rawShelves)) {
        shelfPositions = rawShelves.map(s => (typeof s === 'object' && s !== null ? toNum(s.y, null) : toNum(s, null))).filter(y => y !== null && y >= 0);
      }
      const nbShelves = shelfPositions.length > 0 ? shelfPositions.length : Math.max(0, parseInt(rawShelves, 10) || 0);
      const rawDrawers = m.drawers ?? m.nb_drawers ?? 0;
      let drawerItems = [];
      if (Array.isArray(rawDrawers)) {
        drawerItems = rawDrawers.filter(d => typeof d === 'object' && d !== null).map(d => ({ y: toNum(d.y, null), h: toNum(d.height ?? d.h ?? 20, 20) })).filter(d => d.y !== null && d.y >= 0);
      }
      const nbDrawers = drawerItems.length > 0 ? drawerItems.length : Math.max(0, parseInt(rawDrawers, 10) || 0);
      return {
        id: m.id ?? i + 1, width: w, rods, shelves: nbShelves, shelfPositions,
        drawers: nbDrawers, drawerItems,
        doors: Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10)),
        joints: m.joints ?? null,
      };
    }).filter(m => m.width > 0);
  }

  const W = Math.max(0, toNum(cabinet?.width, 0));
  const nb = Math.max(1, parseInt(cabinet?.nb_dividers ?? 4, 10) + 1);
  const mw = W > 0 ? W / nb : 0;
  return Array.from({ length: nb }, (_, i) => ({
    id: i + 1, width: mw, rods: [], shelves: 2, shelfPositions: [],
    drawers: 0, drawerItems: [], doors: 1, joints: null,
  }));
}

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * CabinetElevationFront v3
 * – Double montants interactifs (joints[] cliquables)
 * – Tringles multiples déplaçables
 * – Tablettes déplaçables
 * – Portes simples / demi-portes
 */
export default function CabinetElevationFront({ cabinet, name = 'Meuble' }) {
  if (!cabinet?.width || !cabinet?.height) {
    return <div className="text-center py-8 text-slate-500">Dimensions indisponibles.</div>;
  }

  const modules = normalizeModules(cabinet);
  const W  = toNum(cabinet.width, 0);
  const H  = toNum(cabinet.height, 0);
  const PL = Math.max(0, toNum(cabinet.plinth, 0));
  const TH = Math.max(0.5, toNum(cabinet.thickness ?? 1.8, 1.8)); // épaisseur en cm

  // ── Layout SVG ──────────────────────────────────────────────────────────────
  const PAD    = 60;
  const DRAW_W = 860;
  const DRAW_H = 450;
  const PLINTH_PX = PL > 0 ? Math.round((PL / H) * DRAW_H) : 14;
  const INNER_H   = DRAW_H - PLINTH_PX;

  const sx = DRAW_W / Math.max(1, W);
  const sy = INNER_H / Math.max(1, H - PL);
  const thPx = TH * sx; // épaisseur 1 panneau en px

  const ox = PAD;
  const oy = PAD + 30;

  const svgW = PAD * 2 + DRAW_W + 40;
  const svgH = PAD * 2 + DRAW_H + 120;

  // ── State : joints entre modules (simple | double) ───────────────────────
  const [joints, setJoints] = useState(() =>
    modules.slice(0, -1).map((_, i) => modules[i]?.joints ?? 'single')
  );

  // ── State : éléments flottants (tringles/tablettes déplaçables) ───────────
  const [floatEls, setFloatEls] = useState(() => {
    const els = [];
    modules.forEach((m, mi) => {
      m.rods.forEach((yCm) => els.push({ id: uid(), type: 'rod',   modIdx: mi, yCm: yCm ?? (H * 0.7) }));
    });
    return els;
  });

  const [activeTool, setActiveTool] = useState(null); // 'rod' | 'shelf' | 'door' | 'move' | 'erase'
  const [dragging, setDragging] = useState(null); // { id, startY, startYCm }
  const svgRef = useRef(null);

  // ── Calcul positions X des modules (tenant compte des doubles montants) ──
  const moduleRects = (() => {
    const totalSepPx = joints.reduce((acc, j) => acc + (j === 'double' ? 2 * thPx : thPx), 0) + 2 * thPx;
    const avail      = DRAW_W - totalSepPx;
    const totalModW  = modules.reduce((a, m) => a + m.width, 0);
    const modScale   = avail / Math.max(1, totalModW);

    let xCur = ox + thPx;
    return modules.map((m, i) => {
      const wPx = m.width * modScale;
      const r = { ...m, x: xCur, w: wPx };
      xCur += wPx + (i < modules.length - 1 ? (joints[i] === 'double' ? 2 * thPx : thPx) : thPx);
      return r;
    });
  })();

  const toggleJoint = (i) => setJoints(prev => prev.map((j, idx) => idx === i ? (j === 'double' ? 'single' : 'double') : j));

  const cmToY = useCallback((yCm) => oy + INNER_H - yCm * sy, [oy, INNER_H, sy]);

  // SVG coords
  const getSVGY = (e) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const scaleY = svgH / rect.height;
    return (e.clientY - rect.top) * scaleY;
  };

  const findModuleAt = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (svgW / rect.width);
    const py = (e.clientY - rect.top)  * (svgH / rect.height);
    return moduleRects.find(mr => px >= mr.x && px <= mr.x + mr.w && py >= oy && py <= oy + INNER_H) ?? null;
  };

  const handleSVGClick = (e) => {
    if (!activeTool || activeTool === 'move') return;
    const mr = findModuleAt(e);
    if (!mr) return;
    const py   = getSVGY(e);
    const yCm  = Math.max(1, Math.min(H - PL - 1, (oy + INNER_H - py) / sy));

    if (activeTool === 'rod') {
      setFloatEls(prev => [...prev, { id: uid(), type: 'rod',   modIdx: mr.id - 1, yCm }]);
    } else if (activeTool === 'shelf') {
      setFloatEls(prev => [...prev, { id: uid(), type: 'shelf', modIdx: mr.id - 1, yCm }]);
    } else if (activeTool === 'door') {
      setFloatEls(prev => {
        const existing = prev.filter(f => f.type === 'door' && f.modIdx === mr.id - 1);
        if (existing.length >= 2) return prev;
        return [...prev, { id: uid(), type: 'door', modIdx: mr.id - 1, yCm: 0.5 }];
      });
    } else if (activeTool === 'erase') {
      // handled in element click
    }
  };

  const startDrag = (e, elId) => {
    e.stopPropagation();
    if (activeTool !== 'move') return;
    const el = floatEls.find(f => f.id === elId);
    if (!el) return;
    setDragging({ id: elId, startY: getSVGY(e), startYCm: el.yCm });
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const dy   = getSVGY(e) - dragging.startY;
    const dyCm = -dy / sy;
    setFloatEls(prev => prev.map(f =>
      f.id === dragging.id ? { ...f, yCm: Math.max(1, Math.min(H - PL - 1, dragging.startYCm + dyCm)) } : f
    ));
  };

  const onMouseUp = () => setDragging(null);

  const eraseEl = (e, elId) => {
    e.stopPropagation();
    if (activeTool !== 'erase') return;
    setFloatEls(prev => prev.filter(f => f.id !== elId));
  };

  const TOOL_BTNS = [
    { id: 'rod',   icon: '👔', label: 'Tringle',  color: '#f472b6' },
    { id: 'shelf', icon: '📦', label: 'Tablette', color: '#34d399' },
    { id: 'door',  icon: '🚪', label: 'Porte',    color: '#60a5fa' },
    { id: 'move',  icon: '✋', label: 'Déplacer', color: '#e2e8f0' },
    { id: 'erase', icon: '🗑️', label: 'Effacer',  color: '#f87171' },
  ];

  return (
    <div className="relative flex flex-col gap-2">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600/20 to-blue-600/20 rounded-xl blur-lg" />

      {/* Barre outils */}
      <div className="relative flex flex-wrap gap-2 p-2 bg-slate-900/80 rounded-t-xl border border-slate-700">
        <span className="text-xs text-slate-400 self-center mr-1">Outils :</span>
        {TOOL_BTNS.map(tb => (
          <button key={tb.id}
            onClick={() => setActiveTool(t => t === tb.id ? null : tb.id)}
            className={`px-3 py-1 rounded text-xs font-bold border-2 transition-all ${
              activeTool === tb.id ? 'text-white' : 'border-transparent bg-slate-800 text-slate-400'
            }`}
            style={activeTool === tb.id ? { borderColor: tb.color, background: tb.color + '22', color: tb.color } : {}}
          >{tb.icon} {tb.label}</button>
        ))}
        <span className="text-xs text-slate-500 self-center ml-auto">
          {activeTool === 'rod'   && '👆 Cliquez dans un module pour ajouter une tringle'}
          {activeTool === 'shelf' && '👆 Cliquez pour ajouter une tablette'}
          {activeTool === 'door'  && '👆 1 clic = porte, 2 clics = demi-portes'}
          {activeTool === 'move'  && '✋ Glissez une tringle (•rose) ou tablette (•vert)'}
          {activeTool === 'erase' && '🗑️ Cliquez un élément pour le supprimer'}
        </span>
      </div>

      {/* Barre joints */}
      <div className="relative flex flex-wrap gap-2 px-2 pb-1 bg-slate-900/60 border-x border-slate-700">
        <span className="text-xs text-slate-400 self-center">🔩 Joints :</span>
        {joints.map((j, i) => (
          <button key={i}
            onClick={() => toggleJoint(i)}
            className={`px-2 py-0.5 rounded text-xs font-bold border transition-all ${
              j === 'double'
                ? 'bg-amber-900/40 text-amber-300 border-amber-500'
                : 'bg-slate-800 text-slate-400 border-slate-600'
            }`}
          >
            M{i+1}|M{i+2} {j === 'double' ? '⬛⬛ Double' : '▪️ Simple'}
          </button>
        ))}
      </div>

      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="relative w-full h-auto bg-white rounded-b-xl border border-slate-200 shadow-xl"
        style={{ cursor: activeTool && activeTool !== 'move' ? 'crosshair' : activeTool === 'move' ? 'default' : 'default' }}
        onClick={handleSVGClick}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          <marker id="arrR" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#dc2626" /></marker>
          <marker id="arrL" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M8 0L0 4L8 8Z" fill="#dc2626" /></marker>
          <marker id="arrU" viewBox="0 0 8 8" refX="4" refY="1" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 8L4 0L8 8Z" fill="#dc2626" /></marker>
          <marker id="arrD" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L4 8L8 0Z" fill="#dc2626" /></marker>
          <linearGradient id="gWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dcc89a" /><stop offset="50%" stopColor="#f5ede0" /><stop offset="100%" stopColor="#dcc89a" />
          </linearGradient>
          <linearGradient id="gDoor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e8dcc8" stopOpacity="0.8" /><stop offset="100%" stopColor="#f5ede0" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Titre */}
        <text x={svgW/2} y={22} textAnchor="middle" fontSize={13} fontWeight="700" fill="#334155">{name} — {W} × {H} cm</text>

        {/* Corps extérieur */}
        <rect x={ox} y={oy} width={DRAW_W} height={DRAW_H} fill="#f8f5ef" stroke="#374151" strokeWidth={2.5} />
        {/* Panneau dessus */}
        <rect x={ox} y={oy} width={DRAW_W} height={10} fill="#e5e7eb" stroke="#374151" strokeWidth={0.5} />
        {/* Joue gauche */}
        <rect x={ox} y={oy} width={thPx} height={INNER_H} fill="url(#gWood)" stroke="#8b6914" strokeWidth={1} />
        {/* Joue droite */}
        <rect x={ox + DRAW_W - thPx} y={oy} width={thPx} height={INNER_H} fill="url(#gWood)" stroke="#8b6914" strokeWidth={1} />

        {/* Plinthe */}
        {PL > 0 && (
          <>
            <rect x={ox} y={oy+INNER_H} width={DRAW_W} height={PLINTH_PX} fill="#e2e8f0" stroke="#374151" strokeWidth={1} />
            <text x={ox+DRAW_W/2} y={oy+INNER_H+PLINTH_PX/2+4} textAnchor="middle" fontSize={9} fill="#94a3b8">Plinthe {PL} cm</text>
          </>
        )}

        {/* ── Séparateurs entre modules ── */}
        {moduleRects.map((m, i) => {
          if (i >= moduleRects.length - 1) return null;
          const sepX = m.x + m.w;
          const isDouble = joints[i] === 'double';
          return (
            <g key={`sep-${i}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); toggleJoint(i); }}
              title={isDouble ? 'Double montant — cliquer pour simple' : 'Montant simple — cliquer pour double'}
            >
              {isDouble ? (
                <>
                  <rect x={sepX}       y={oy} width={thPx} height={INNER_H} fill="url(#gWood)" stroke="#8b6914" strokeWidth={0.8} />
                  <rect x={sepX+thPx}  y={oy} width={thPx} height={INNER_H} fill="url(#gWood)" stroke="#8b6914" strokeWidth={0.8} />
                  <line x1={sepX+thPx} y1={oy+4} x2={sepX+thPx} y2={oy+INNER_H-4}
                    stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
                  <text x={sepX+thPx} y={oy+INNER_H+28} textAnchor="middle" fontSize={8} fill="#d97706" fontWeight="700">⬛⬛</text>
                </>
              ) : (
                <rect x={sepX} y={oy} width={thPx} height={INNER_H} fill="url(#gWood)" stroke="#8b6914" strokeWidth={0.8} />
              )}
            </g>
          );
        })}

        {/* ── Modules ── */}
        {moduleRects.map((m) => {
          const mx  = m.x;
          const mw  = m.w;
          const mid = mx + mw / 2;

          // Fond module
          const fond = <rect key={`fond-${m.id}`} x={mx} y={oy} width={mw} height={INNER_H} fill="#faf5ed" stroke="none" opacity={0.4} />;

          // Tablettes statiques (shelfPositions)
          const staticShelves = m.shelfPositions.length > 0
            ? m.shelfPositions.map((yCm, si) => (
                <rect key={`shelf-${m.id}-${si}`} x={mx+4} y={cmToY(yCm)-4} width={mw-8} height={5} fill="#6b7280" rx={1} />
              ))
            : m.shelves > 0
              ? Array.from({ length: m.shelves }, (_, si) => (
                  <rect key={`shelf-${m.id}-${si}`} x={mx+4} y={oy+((si+1)/(m.shelves+1))*INNER_H-2} width={mw-8} height={5} fill="#6b7280" rx={1} />
                ))
              : null;

          // Tiroirs
          const drawerElems = m.drawerItems.length > 0
            ? m.drawerItems.map((d, di) => {
                const dyTop = cmToY(d.y + d.h);
                const dhPx  = d.h * sy;
                return (
                  <g key={`drawer-${m.id}-${di}`}>
                    <rect x={mx+6} y={dyTop} width={mw-12} height={Math.max(dhPx,12)} fill="rgba(139,92,246,0.08)" stroke="#6d28d9" strokeWidth={1.3} rx={2} />
                    <rect x={mx+mw/2-18} y={dyTop+Math.max(dhPx,12)/2-4} width={36} height={8} rx={4} fill="none" stroke="#4c1d95" strokeWidth={1.8} />
                  </g>
                );
              })
            : m.drawers > 0
              ? Array.from({ length: m.drawers }, (_, di) => {
                  const totalH = INNER_H * 0.38;
                  const dh = totalH / m.drawers;
                  const dyTop = oy + INNER_H - totalH + di * dh;
                  return (
                    <g key={`drawer-${m.id}-${di}`}>
                      <rect x={mx+6} y={dyTop+2} width={mw-12} height={dh-4} fill="rgba(139,92,246,0.08)" stroke="#6d28d9" strokeWidth={1.3} rx={2} />
                      <rect x={mx+mw/2-18} y={dyTop+dh/2-4} width={36} height={8} rx={4} fill="none" stroke="#4c1d95" strokeWidth={1.8} />
                    </g>
                  );
                })
              : null;

          // Numéro
          const numElem = (
            <g key={`num-${m.id}`}>
              <circle cx={mid} cy={oy+INNER_H*0.5} r={16} fill="none" stroke="#dc2626" strokeWidth={1.8} />
              <text x={mid} y={oy+INNER_H*0.5+5} textAnchor="middle" fontSize={14} fontWeight="700" fill="#dc2626">{m.id}</text>
            </g>
          );

          // Cote
          const coteY = oy + DRAW_H + 36;
          const coteElem = (
            <g key={`cote-${m.id}`}>
              <line x1={mx} y1={coteY} x2={mx+mw} y2={coteY} stroke="#dc2626" strokeWidth={1.5} markerStart="url(#arrL)" markerEnd="url(#arrR)" />
              <line x1={mx}    y1={coteY-5} x2={mx}    y2={coteY+5} stroke="#dc2626" strokeWidth={1.2} />
              <line x1={mx+mw} y1={coteY-5} x2={mx+mw} y2={coteY+5} stroke="#dc2626" strokeWidth={1.2} />
              <text x={mid} y={coteY-7} textAnchor="middle" fontSize={10} fontWeight="700" fill="#b45309">{m.width.toFixed(1)} cm</text>
            </g>
          );

          return (
            <g key={`module-${m.id}`}>
              {fond}
              {staticShelves}
              {drawerElems}
              {numElem}
              {coteElem}
            </g>
          );
        })}

        {/* ── Éléments flottants (tringles + tablettes + portes interactifs) ── */}
        {floatEls.map((el) => {
          const mr = moduleRects[el.modIdx];
          if (!mr) return null;
          const mx  = mr.x;
          const mw  = mr.w;
          const mid = mx + mw / 2;
          const epy = cmToY(el.yCm);

          if (el.type === 'rod') {
            return (
              <g key={el.id} style={{ cursor: activeTool === 'move' ? 'ns-resize' : activeTool === 'erase' ? 'pointer' : 'default' }}
                onMouseDown={(e) => startDrag(e, el.id)} onClick={(e) => eraseEl(e, el.id)}>
                <rect x={mx+8} y={epy-9} width={7} height={16} fill="#6b7280" rx={2} />
                <rect x={mx+mw-15} y={epy-9} width={7} height={16} fill="#6b7280" rx={2} />
                <line x1={mx+16} y1={epy} x2={mx+mw-15} y2={epy} stroke="#374151" strokeWidth={5} strokeLinecap="round" />
                <line x1={mx+16} y1={epy-2} x2={mx+mw-15} y2={epy-2} stroke="#d1d5db" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
                <circle cx={mid} cy={epy} r={6} fill="#f472b6" stroke="white" strokeWidth={1.5}
                  style={{ cursor: activeTool === 'move' ? 'ns-resize' : 'default' }} />
              </g>
            );
          }
          if (el.type === 'shelf') {
            return (
              <g key={el.id} style={{ cursor: activeTool === 'move' ? 'ns-resize' : activeTool === 'erase' ? 'pointer' : 'default' }}
                onMouseDown={(e) => startDrag(e, el.id)} onClick={(e) => eraseEl(e, el.id)}>
                <rect x={mx+2} y={epy-3.5} width={mw-4} height={6} fill="#d1a87a" stroke="#8b6914" strokeWidth={1} rx={1} />
                <circle cx={mx+9}   cy={epy} r={2.5} fill="#8b6914" />
                <circle cx={mx+mw-9} cy={epy} r={2.5} fill="#8b6914" />
                <circle cx={mid} cy={epy} r={6} fill="#34d399" stroke="white" strokeWidth={1.5}
                  style={{ cursor: activeTool === 'move' ? 'ns-resize' : 'default' }} />
              </g>
            );
          }
          if (el.type === 'door') {
            const doorsInMod = floatEls.filter(f => f.type === 'door' && f.modIdx === el.modIdx);
            const nd  = doorsInMod.length;
            const idx = doorsInMod.indexOf(el);
            const dw  = nd === 2 ? mw / 2 : mw;
            const dx  = nd === 2 && idx === 1 ? mx + mw / 2 : mx;
            const pad = Math.max(6, dw * 0.08);
            const hx  = idx === 0 ? dx + dw - 12 : dx + 8;
            return (
              <g key={el.id} style={{ cursor: activeTool === 'erase' ? 'pointer' : 'default' }}
                onClick={(e) => eraseEl(e, el.id)}>
                <rect x={dx+2} y={oy+2} width={dw-4} height={INNER_H-4} fill="url(#gDoor)" stroke="#374151" strokeWidth={1.5} rx={1} />
                <rect x={dx+pad} y={oy+pad} width={dw-2*pad} height={INNER_H-2*pad} fill="none" stroke="#374151" strokeWidth={0.7} opacity={0.4} />
                <rect x={hx-4} y={oy+INNER_H/2-10} width={8} height={20} fill="#9ca3af" stroke="#6b7280" strokeWidth={0.8} rx={3} />
              </g>
            );
          }
          return null;
        })}

        {/* Cote largeur totale */}
        <line x1={ox} y1={oy-18} x2={ox+DRAW_W} y2={oy-18} stroke="#dc2626" strokeWidth={1.5} markerStart="url(#arrL)" markerEnd="url(#arrR)" />
        <text x={ox+DRAW_W/2} y={oy-24} textAnchor="middle" fontSize={11} fontWeight="700" fill="#b45309">{W} cm{PL > 0 ? ` + ${PL} cm plinthe` : ''}</text>

        {/* Cote hauteur droite */}
        <line x1={ox+DRAW_W+18} y1={oy} x2={ox+DRAW_W+18} y2={oy+DRAW_H} stroke="#dc2626" strokeWidth={1.5} markerStart="url(#arrU)" markerEnd="url(#arrD)" />
        <text x={ox+DRAW_W+34} y={oy+DRAW_H/2}
          transform={`rotate(90 ${ox+DRAW_W+34} ${oy+DRAW_H/2})`}
          textAnchor="middle" fontSize={11} fontWeight="700" fill="#b45309">{H} cm</text>

        <text x={ox-14} y={oy+INNER_H/2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(270 ${ox-14} ${oy+INNER_H/2})`}>+3</text>
        <text x={ox+30} y={oy+6} textAnchor="middle" fontSize={10} fill="#6b7280">+3</text>
      </svg>
    </div>
  );
}
