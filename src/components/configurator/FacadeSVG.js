import React, { useMemo, useRef, useState } from 'react';

const WOOD_STROKE = '#7a5b32';
const DIM_COLOR = '#dc2626';
const MARGIN = { l: 70, r: 55, t: 60, b: 70 };

const uid = () => Math.random().toString(36).slice(2, 9);

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function FacadeSVG({
  cabinet,
  svgRef: externalSvgRef,
  activeTool = 'select',
  onModuleChange,
  annotations = [],
  onAnnotationsChange,
}) {
  const localSvgRef = useRef(null);
  const svgRef = externalSvgRef || localSvgRef;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredModule, setHoveredModule] = useState(null);
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [drag, setDrag] = useState({ active: false, moduleIdx: null, type: null, itemIdx: null });
  const [dimFirstPoint, setDimFirstPoint] = useState(null);
  const [pendingDim, setPendingDim] = useState(null);
  const [dimLabel, setDimLabel] = useState('');

  if (!cabinet) return null;

  const {
    totalWidth: W = 240,
    heightLeft: HL = 220,
    heightRight: HR = 220,
    plinth: PL = 10,
    thickness: TH = 1.8,
    modules = [],
    edgeType = 'none',
  } = cabinet;

  const SVG_W = 980;
  const SVG_H = 620;
  const drawW = SVG_W - MARGIN.l - MARGIN.r;
  const drawH = SVG_H - MARGIN.t - MARGIN.b;
  const sx = drawW / Math.max(1, W);
  const sy = drawH / Math.max(1, Math.max(HL, HR));

  const ox = MARGIN.l;
  const oy = MARGIN.t;
  const plPxL = PL * sy;
  const plPxR = PL * sy;
  const thPxY = Math.max(2, TH * sy);
  const thPxX = Math.max(2, TH * sx);

  const nbMod = modules.length;
  const totalStiles = 2 * TH + (nbMod > 1 ? (nbMod - 1) * 2 * TH : 0);
  const netTotal = Math.max(1, W - totalStiles);
  const sumModW = modules.reduce((s, m) => s + (m.width || 0), 0);
  const modScale = sumModW > 0 ? netTotal / sumModW : 1;

  const modRects = useMemo(() => {
    let curX = ox + thPxX;
    return modules.map((m, i) => {
      const netWPx = m.width * modScale * sx;
      const modHL = toNum(m.heightLeft ?? HL, HL);
      const modHR = toNum(m.heightRight ?? HR, HR);
      const hlPx = modHL * sy;
      const hrPx = modHR * sy;
      const rect = {
        i,
        m,
        x: curX,
        w: netWPx,
        modHL,
        modHR,
        tl: { x: curX, y: oy + thPxY },
        tr: { x: curX + netWPx, y: oy + thPxY },
        bl: { x: curX, y: oy + hlPx - PL * sy - thPxY },
        br: { x: curX + netWPx, y: oy + hrPx - PL * sy - thPxY },
      };
      curX += netWPx + 2 * thPxX;
      return rect;
    });
  }, [modules, modScale, sx, sy, HL, HR, PL, oy, thPxY, thPxX]);

  const edgeTone = edgeType === 'none' ? '#b48a56' : '#d7c3a1';
  const cursor =
    activeTool === 'shelf' || activeTool === 'rod' || activeTool === 'drawer'
      ? 'cell'
      : activeTool === 'dim'
        ? 'crosshair'
        : activeTool === 'erase'
          ? 'not-allowed'
          : 'default';

  const clientToSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * SVG_W,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * SVG_H,
    };
  };

  const findHoveredModule = (x, y) => {
    for (const r of modRects) {
      if (x >= r.tl.x && x <= r.tr.x && y >= r.tl.y && y <= r.bl.y) return r.i;
    }
    return null;
  };

  const moduleYFromBottom = (rect, ySvg) => {
    const y = (rect.bl.y - ySvg) / sy;
    return clamp(y, 0, Math.max(0, rect.modHL - PL - TH * 2));
  };

  const updateModuleContent = (moduleIdx, updater) => {
    const mod = modules[moduleIdx];
    if (!mod || !onModuleChange) return;
    onModuleChange(moduleIdx, updater(mod));
  };

  const placeByTool = (moduleIdx, yFromBottom) => {
    updateModuleContent(moduleIdx, (mod) => {
      const content = mod.content || {};
      const shelves = [...(content.shelves || [])];
      const rods = [...(content.rods || [])];
      const drawers = [...(content.drawers || [])];
      if (activeTool === 'shelf') shelves.push({ id: uid(), yFromBottom });
      if (activeTool === 'rod') rods.push({ id: uid(), yFromBottom, diameter: 2.5 });
      if (activeTool === 'drawer') {
        drawers.push({
          id: uid(),
          yFromBottom,
          height: 18,
          pieces: { face: true, avantCaisse: true, arriereCaisse: true, flancG: true, flancD: true, fond: true },
        });
      }
      return { ...mod, content: { ...content, shelves, rods, drawers } };
    });
  };

  const updateItemY = (payload, yFromBottom) => {
    updateModuleContent(payload.moduleIdx, (mod) => {
      const content = mod.content || {};
      if (payload.type === 'shelf') {
        const shelves = [...(content.shelves || [])];
        if (!shelves[payload.itemIdx]) return mod;
        shelves[payload.itemIdx] = { ...shelves[payload.itemIdx], yFromBottom };
        return { ...mod, content: { ...content, shelves } };
      }
      if (payload.type === 'rod') {
        const rods = [...(content.rods || [])];
        if (!rods[payload.itemIdx]) return mod;
        rods[payload.itemIdx] = { ...rods[payload.itemIdx], yFromBottom };
        return { ...mod, content: { ...content, rods } };
      }
      if (payload.type === 'drawer') {
        const drawers = [...(content.drawers || [])];
        if (!drawers[payload.itemIdx]) return mod;
        drawers[payload.itemIdx] = { ...drawers[payload.itemIdx], yFromBottom };
        return { ...mod, content: { ...content, drawers } };
      }
      return mod;
    });
  };

  const deleteItem = (payload) => {
    updateModuleContent(payload.moduleIdx, (mod) => {
      const content = mod.content || {};
      if (payload.type === 'shelf') return { ...mod, content: { ...content, shelves: (content.shelves || []).filter((_, i) => i !== payload.itemIdx) } };
      if (payload.type === 'rod') return { ...mod, content: { ...content, rods: (content.rods || []).filter((_, i) => i !== payload.itemIdx) } };
      if (payload.type === 'drawer') return { ...mod, content: { ...content, drawers: (content.drawers || []).filter((_, i) => i !== payload.itemIdx) } };
      return mod;
    });
  };

  const handleSvgMouseMove = (e) => {
    const pos = clientToSvg(e.clientX, e.clientY);
    setMousePos(pos);
    const mIdx = findHoveredModule(pos.x, pos.y);
    setHoveredModule(mIdx);
    if (drag.active && mIdx === drag.moduleIdx) {
      const rect = modRects[mIdx];
      updateItemY(drag, moduleYFromBottom(rect, pos.y));
    }
  };

  const handleSvgMouseUp = () => setDrag({ active: false, moduleIdx: null, type: null, itemIdx: null });

  const handleModuleClick = (moduleIdx) => {
    const rect = modRects[moduleIdx];
    if (!rect) return;
    const yFromBottom = moduleYFromBottom(rect, mousePos.y);
    if (activeTool === 'shelf' || activeTool === 'rod' || activeTool === 'drawer') {
      placeByTool(moduleIdx, yFromBottom);
      return;
    }
    if (activeTool === 'dim') {
      if (!dimFirstPoint) setDimFirstPoint({ x: mousePos.x, y: mousePos.y });
      else {
        setPendingDim({ x1: dimFirstPoint.x, y1: dimFirstPoint.y, x2: mousePos.x, y2: mousePos.y });
        setDimFirstPoint(null);
      }
    }
  };

  const commitPendingDim = () => {
    if (!pendingDim) return;
    const label = dimLabel.trim() || `${Math.hypot(pendingDim.x2 - pendingDim.x1, pendingDim.y2 - pendingDim.y1).toFixed(0)} px`;
    onAnnotationsChange?.([...(annotations || []), { id: uid(), ...pendingDim, label }]);
    setPendingDim(null);
    setDimLabel('');
  };

  const cancelPendingDim = () => {
    setPendingDim(null);
    setDimFirstPoint(null);
    setDimLabel('');
  };

  const previewRect = hoveredModule != null ? modRects[hoveredModule] : null;
  const previewYFromBottom = previewRect ? moduleYFromBottom(previewRect, mousePos.y) : 0;
  const previewY = previewRect ? previewRect.bl.y - previewYFromBottom * sy : 0;
  const drawerPreviewH = 18 * sy;

  const boxHL = toNum(HL, 220) * sy;
  const boxHR = toNum(HR, 220) * sy;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto bg-[#f8f6f2] rounded-xl border border-slate-300 shadow-xl"
        style={{ cursor }}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
      >
        <defs>
          <pattern id="woodGrainFine" width="56" height="18" patternUnits="userSpaceOnUse">
            <rect width="56" height="18" fill="#f5ede0" />
            <path d="M0 2 H56 M0 9 H56 M0 15 H56" stroke="#d9c3a0" strokeWidth="0.9" opacity="0.45" />
            <path d="M0 6 C8 4 16 8 24 6 C32 4 40 8 48 6 C52 5 56 5 56 5" stroke="#c9ac84" strokeWidth="0.6" opacity="0.35" fill="none" />
          </pattern>
          <pattern id="woodGrainDark" width="64" height="20" patternUnits="userSpaceOnUse">
            <rect width="64" height="20" fill="#d7bf99" />
            <path d="M0 4 H64 M0 11 H64 M0 17 H64" stroke="#b89467" strokeWidth="0.85" opacity="0.3" />
          </pattern>
          <linearGradient id="metalBrushed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#b7c1cc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="plinthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#baa077" />
            <stop offset="100%" stopColor="#9f855b" />
          </linearGradient>
          <linearGradient id="drawerFrontGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e9dcc7" />
            <stop offset="50%" stopColor="#f8f0e4" />
            <stop offset="100%" stopColor="#dbc8ab" />
          </linearGradient>
          <linearGradient id="doorFrontGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ecdfcb" />
            <stop offset="50%" stopColor="#f9f4eb" />
            <stop offset="100%" stopColor="#deccb0" />
          </linearGradient>
          <marker id="arrR2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill={DIM_COLOR} /></marker>
          <marker id="arrL2" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M8 0L0 4L8 8Z" fill={DIM_COLOR} /></marker>
          <marker id="arrDim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#22d3ee" /></marker>
        </defs>

        <text x={SVG_W / 2} y={24} textAnchor="middle" fontSize={13} fontWeight="700" fill="#334155">
          Vue façade — {W} × {Math.max(HL, HR)} cm {Math.abs(HL - HR) > 0.1 ? `(biais: G${HL} / D${HR})` : ''}
        </text>

        <polygon points={`${ox},${oy} ${ox + drawW},${oy + (boxHR - boxHL)} ${ox + drawW},${oy + boxHR} ${ox},${oy + boxHL}`} fill="url(#woodGrainFine)" stroke={WOOD_STROKE} strokeWidth="2.5" />
        <rect x={ox} y={oy + boxHL - plPxL} width={drawW} height={Math.max(plPxL, plPxR)} fill="url(#plinthGrad)" stroke="#7b613a" strokeWidth="1.2" opacity="0.96" />
        <polygon
          points={`${ox},${oy} ${ox + drawW},${oy + (boxHR - boxHL)} ${ox + drawW},${oy + (boxHR - boxHL) + thPxY} ${ox},${oy + thPxY}`}
          fill="url(#woodGrainDark)"
          stroke={WOOD_STROKE}
          strokeWidth={Math.max(1.2, thPxY * 0.2)}
        />

        {modRects.map((r, i) => {
          const mod = modules[i];
          const content = mod.content || {};
          const cmToY = (yCm) => r.bl.y - yCm * sy;
          const doorCount = (content.doors || []).reduce((sum, d) => sum + Math.max(1, Number(d?.count) || 1), 0);

          const renderShelf = (sh, si) => {
            const id = `shelf-${i}-${si}`;
            const yPx = cmToY(sh.yFromBottom ?? 0);
            const hovered = hoveredItemId === id && activeTool === 'erase';
            return (
              <g key={id} opacity={hovered ? 0.4 : 1} onMouseEnter={() => setHoveredItemId(id)} onMouseLeave={() => setHoveredItemId(null)}>
                <rect
                  x={r.tl.x + 2}
                  y={yPx - Math.max(2.2, thPxY * 0.52)}
                  width={r.w - 4}
                  height={Math.max(4.4, thPxY * 1.04)}
                  fill="url(#woodGrainDark)"
                  stroke={WOOD_STROKE}
                  strokeWidth="0.8"
                  rx="1"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select') setDrag({ active: true, moduleIdx: i, type: 'shelf', itemIdx: si });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'erase') deleteItem({ moduleIdx: i, type: 'shelf', itemIdx: si });
                  }}
                />
                <line x1={r.tl.x + 3} y1={yPx + Math.max(1.8, thPxY * 0.55)} x2={r.tr.x - 3} y2={yPx + Math.max(1.8, thPxY * 0.55)} stroke={edgeTone} strokeWidth="1" opacity="0.9" />
              </g>
            );
          };

          const renderRod = (rod, ri) => {
            const id = `rod-${i}-${ri}`;
            const yPx = cmToY(rod.yFromBottom ?? 0);
            const d = Math.max(1.4, (rod.diameter || 2.5) * (sx * 0.45));
            const hovered = hoveredItemId === id && activeTool === 'erase';
            return (
              <g key={id} opacity={hovered ? 0.4 : 1} onMouseEnter={() => setHoveredItemId(id)} onMouseLeave={() => setHoveredItemId(null)}>
                <line
                  x1={r.tl.x + 10}
                  x2={r.tr.x - 10}
                  y1={yPx}
                  y2={yPx}
                  stroke="url(#metalBrushed)"
                  strokeWidth={d}
                  strokeLinecap="round"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select') setDrag({ active: true, moduleIdx: i, type: 'rod', itemIdx: ri });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'erase') deleteItem({ moduleIdx: i, type: 'rod', itemIdx: ri });
                  }}
                />
                <circle cx={r.tl.x + 9} cy={yPx} r={Math.max(2.4, d * 0.62)} fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
                <circle cx={r.tr.x - 9} cy={yPx} r={Math.max(2.4, d * 0.62)} fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
              </g>
            );
          };

          const renderDrawer = (dr, di) => {
            const id = `drawer-${i}-${di}`;
            const yTop = cmToY((dr.yFromBottom ?? 0) + (dr.height ?? 18));
            const hPx = (dr.height ?? 18) * sy;
            const hovered = hoveredItemId === id && activeTool === 'erase';
            const railInset = Math.max(2, thPxX * 0.25);
            return (
              <g key={id} opacity={hovered ? 0.4 : 1} onMouseEnter={() => setHoveredItemId(id)} onMouseLeave={() => setHoveredItemId(null)}>
                <rect
                  x={r.tl.x + 2}
                  y={yTop}
                  width={r.w - 4}
                  height={hPx}
                  fill="url(#drawerFrontGrad)"
                  stroke={WOOD_STROKE}
                  strokeWidth="1"
                  rx="1.5"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select') setDrag({ active: true, moduleIdx: i, type: 'drawer', itemIdx: di });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'erase') deleteItem({ moduleIdx: i, type: 'drawer', itemIdx: di });
                  }}
                />
                <line x1={r.tl.x + 5} y1={yTop + hPx - Math.max(2, thPxY * 0.35)} x2={r.tr.x - 5} y2={yTop + hPx - Math.max(2, thPxY * 0.35)} stroke="#ab8455" strokeWidth="0.9" opacity="0.8" />
                <rect x={r.tl.x + railInset} y={yTop + hPx * 0.35} width="4" height={Math.max(8, hPx * 0.28)} fill="#9ca3af" opacity="0.9" rx="1" />
                <rect x={r.tr.x - railInset - 4} y={yTop + hPx * 0.35} width="4" height={Math.max(8, hPx * 0.28)} fill="#9ca3af" opacity="0.9" rx="1" />
                <rect x={r.tl.x + r.w / 2 - 16} y={yTop + hPx / 2 - 3.2} width="32" height="6.4" fill="url(#metalBrushed)" stroke="#64748b" strokeWidth="0.8" rx="3.2" />
              </g>
            );
          };

          const renderDoors = () => {
            if (doorCount <= 0 || (content.drawers || []).length > 0) return null;
            const count = Math.min(2, doorCount);
            const gap = 2;
            const dW = (r.w - gap * (count - 1) - 4) / count;
            const doorTop = r.tl.y + 2;
            const doorBottom = r.bl.y - 2;
            const doorHeight = Math.max(10, doorBottom - doorTop);
            return Array.from({ length: count }, (_, idx) => {
              const x = r.tl.x + 2 + idx * (dW + gap);
              const isLeft = idx === 0;
              const hx = isLeft ? x + dW - 6 : x + 6;
              const hingeX = isLeft ? x + 2.5 : x + dW - 2.5;
              return (
                <g key={`door-${i}-${idx}`} opacity="0.9" pointerEvents="none">
                  <rect x={x} y={doorTop} width={dW} height={doorHeight} fill="url(#doorFrontGrad)" stroke="#8a6940" strokeWidth="0.8" rx="1" />
                  <line x1={x + 2} y1={doorTop + 14} x2={x + dW - 2} y2={doorTop + 14} stroke="#c7a674" strokeWidth="0.7" opacity="0.6" />
                  <rect x={hx - 1.4} y={doorTop + doorHeight * 0.45} width="2.8" height={Math.max(16, doorHeight * 0.12)} fill="url(#metalBrushed)" stroke="#64748b" strokeWidth="0.5" rx="1.4" />
                  <circle cx={hingeX} cy={doorTop + 18} r="1.7" fill="#94a3b8" />
                  <circle cx={hingeX} cy={doorTop + doorHeight - 18} r="1.7" fill="#94a3b8" />
                </g>
              );
            });
          };

          return (
            <g key={`mod-${i}`}>
              <polygon points={`${r.tl.x},${r.tl.y} ${r.tr.x},${r.tr.y} ${r.br.x},${r.br.y} ${r.bl.x},${r.bl.y}`} fill="transparent" onClick={() => handleModuleClick(i)} />
              <polygon points={`${r.tl.x},${r.tl.y} ${r.tr.x},${r.tr.y} ${r.br.x},${r.br.y} ${r.bl.x},${r.bl.y}`} fill="rgba(255,255,255,0.03)" stroke={WOOD_STROKE} strokeWidth="1" />
              {renderDoors()}
              {(content.shelves || []).map(renderShelf)}
              {(content.rods || []).map(renderRod)}
              {(content.drawers || []).map(renderDrawer)}

              <circle cx={r.tl.x + r.w / 2} cy={r.tl.y + 14} r={10.5} fill="#1e293b" opacity="0.9" />
              <text x={r.tl.x + r.w / 2} y={r.tl.y + 18} textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="700">{i + 1}</text>

              <line x1={r.tl.x} y1={oy + Math.max(boxHL, boxHR) + 20} x2={r.tl.x + r.w} y2={oy + Math.max(boxHL, boxHR) + 20} stroke={DIM_COLOR} strokeWidth="1" markerStart="url(#arrL2)" markerEnd="url(#arrR2)" />
              <text x={r.tl.x + r.w / 2} y={oy + Math.max(boxHL, boxHR) + 32} textAnchor="middle" fill={DIM_COLOR} fontSize="10">{(mod.width || 0).toFixed(1)} cm</text>

              {drag.active && drag.moduleIdx === i && (
                <g pointerEvents="none">
                  <rect x={r.tr.x + 5} y={mousePos.y - 12} width="46" height="18" rx="4" fill="#1e293b" opacity="0.95" />
                  <text x={r.tr.x + 28} y={mousePos.y + 1} fontSize="11" textAnchor="middle" fill="white" fontWeight="700">
                    {moduleYFromBottom(r, mousePos.y).toFixed(0)} cm
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {(activeTool === 'shelf' || activeTool === 'rod' || activeTool === 'drawer') && previewRect && (
          <g pointerEvents="none">
            {activeTool === 'shelf' && <line x1={previewRect.tl.x} y1={previewY} x2={previewRect.tr.x} y2={previewY} stroke="#e8d5b0" strokeWidth={Math.max(4, thPxY * 0.95)} opacity="0.55" />}
            {activeTool === 'rod' && <line x1={previewRect.tl.x} y1={previewY} x2={previewRect.tr.x} y2={previewY} stroke="#c0c0c0" strokeWidth="3" strokeDasharray="6 3" opacity="0.55" />}
            {activeTool === 'drawer' && <rect x={previewRect.tl.x + 2} y={previewY - drawerPreviewH} width={previewRect.w - 4} height={drawerPreviewH} fill="rgba(180,140,95,0.2)" stroke="#8b6914" strokeWidth="1" strokeDasharray="4 2" />}
            <rect x={previewRect.tr.x + 6} y={previewY - 15} width="42" height="14" rx="3" fill="#f1f5f9" opacity="0.95" />
            <text x={previewRect.tr.x + 27} y={previewY - 5} fill="#0f172a" textAnchor="middle" fontSize="10" fontWeight="700">{previewYFromBottom.toFixed(0)} cm</text>
          </g>
        )}

        {dimFirstPoint && <circle cx={dimFirstPoint.x} cy={dimFirstPoint.y} r="4" fill="#f97316" />}

        {(annotations || []).map((a) => {
          const mx = (a.x1 + a.x2) / 2;
          const my = (a.y1 + a.y2) / 2;
          const id = `dim-${a.id}`;
          const hovered = hoveredItemId === id && activeTool === 'erase';
          return (
            <g key={a.id}>
              <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 3" markerStart="url(#arrDim)" markerEnd="url(#arrDim)" opacity={hovered ? 0.4 : 1} />
              <g
                onMouseEnter={() => setHoveredItemId(id)}
                onMouseLeave={() => setHoveredItemId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool !== 'erase') return;
                  onAnnotationsChange?.((annotations || []).filter((x) => x.id !== a.id));
                }}
              >
                <rect x={mx - 34} y={my - 11} width="68" height="20" rx="6" fill="#0e7490" opacity={hovered ? 0.4 : 1} />
                <text x={mx} y={my + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="500">{a.label}</text>
              </g>
            </g>
          );
        })}
      </svg>

      {pendingDim && (
        <input
          autoFocus
          value={dimLabel}
          onChange={(e) => setDimLabel(e.target.value)}
          placeholder="ex: 78 cm"
          className="absolute px-2 py-1 text-xs bg-slate-800 text-white border border-cyan-500/50 rounded"
          style={{
            left: `${(((pendingDim.x1 + pendingDim.x2) / 2 / SVG_W) * 100).toFixed(2)}%`,
            top: `${(((pendingDim.y1 + pendingDim.y2) / 2 / SVG_H) * 100).toFixed(2)}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onBlur={commitPendingDim}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitPendingDim();
            if (e.key === 'Escape') cancelPendingDim();
          }}
        />
      )}
    </div>
  );
}
