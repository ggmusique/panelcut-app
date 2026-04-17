import React, { useMemo, useRef, useState, useCallback } from 'react';
import { buildFacadeLayout } from './utils';

const DRAW_W = 860;
const DRAW_H = 450;
const PAD = 60;

// Couleurs bois
const C = {
  wood:       '#e8d5a3',
  woodDark:   '#c9a84c',
  woodStroke: '#8b6914',
  panel:      '#d4b878',
  panelEdge:  '#a07820',
  fond:       '#c8b07c',
  fondStroke: '#7a5c10',
  shelf:      '#b0926a',
  shelfEdge:  '#7a5c10',
  rod:        '#6b7280',
  rodActive:  '#f97316',
  drawer:     '#f0e0c0',
  drawerEdge: '#8b6914',
  door:       'rgba(220,210,180,0.5)',
  doorEdge:   '#8b6914',
  sliding:    'rgba(147,197,253,0.25)',
  slidingEdge:'#60a5fa',
  del:        '#ef4444',
  sel:        '#f97316',
  dim:        '#ef4444',
};

export default function FacadeSvgView({
  draftState,
  selectedModuleId,
  selectedItemId,
  selectedAnnotationId,
  tool,
  onModuleClick,
  onItemClick,
  onAddObject,
  onAnnotationClick,
  onAddAnnotation,
  onRemoveObject,
  onMoveObject,   // (moduleId, collection, itemId, newYcm) => void
  zoom = 1,
  pan = { x: 0, y: 0 },
}) {
  const svgRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);  // cote en cours
  const [dragging, setDragging] = useState(null);        // { moduleId, collection, itemId, startY }

  const layout = useMemo(
    () => buildFacadeLayout(draftState?.facadeModules || [], draftState?.cabinetDims || {}, DRAW_W, DRAW_H, PAD),
    [draftState?.facadeModules, draftState?.cabinetDims]
  );

  const moduleDetailsMap = useMemo(() => {
    const map = new Map();
    (draftState?.moduleDetails || []).forEach((d) => map.set(String(d.moduleId), d));
    return map;
  }, [draftState?.moduleDetails]);

  const cabinetH = Math.max(1, Number(draftState?.cabinetDims?.height || 220));
  const TH = Math.max(0.1, Number(draftState?.cabinetDims?.thickness || 1.8));

  // Convertit event souris → coordonnées dans l'espace viewBox SVG
  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const s = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: s.x, y: s.y };
  }, []);

  const findModuleAtPoint = (x, y) =>
    layout.moduleRects.find((m) => x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height);

  // Y pixel SVG → cm depuis le bas (intérieur module)
  const svgYToCm = (svgY, mRect) => {
    const frac = (svgY - mRect.y) / Math.max(1, mRect.height);
    return Math.max(0, Math.min(cabinetH, (1 - frac) * cabinetH));
  };

  // cm depuis le bas → Y pixel SVG
  const cmToSvgY = (cm, mRect) => {
    const frac = 1 - cm / cabinetH;
    return mRect.y + frac * mRect.height;
  };

  // --- Handlers globaux ---
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const p = getSvgPoint(e);

    if (tool === 'dimension' || tool === 'arrow') {
      setDragPreview({ type: tool === 'dimension' ? 'dim' : 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }

    const objectTools = ['shelf', 'drawer', 'rod', 'door', 'sliding_door'];
    if (objectTools.includes(tool)) {
      const m = findModuleAtPoint(p.x, p.y);
      if (!m) return;
      const yCm = svgYToCm(p.y, m);
      onAddObject?.(m.id, tool, yCm);
      return;
    }

    if (tool === 'note') {
      const text = window.prompt('Note', 'Note') || 'Note';
      onAddAnnotation?.('note', p.x, p.y, p.x, p.y, text);
    }
  }, [tool, layout, getSvgPoint, onAddObject, onAddAnnotation]);

  const handleMouseMove = useCallback((e) => {
    const p = getSvgPoint(e);

    if (dragPreview) {
      setDragPreview((prev) => ({ ...prev, x2: p.x, y2: p.y }));
      return;
    }

    if (dragging) {
      const m = layout.moduleRects.find((r) => r.id === dragging.moduleId);
      if (!m) return;
      const yCm = svgYToCm(p.y, m);
      onMoveObject?.(dragging.moduleId, dragging.collection, dragging.itemId, yCm);
    }
  }, [dragPreview, dragging, layout, getSvgPoint, onMoveObject]);

  const handleMouseUp = useCallback((e) => {
    if (dragPreview) {
      const p = getSvgPoint(e);
      onAddAnnotation?.(dragPreview.type, dragPreview.x1, dragPreview.y1, p.x, p.y, '');
      setDragPreview(null);
      return;
    }
    setDragging(null);
  }, [dragPreview, getSvgPoint, onAddAnnotation]);

  const startDrag = (e, moduleId, collection, itemId) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging({ moduleId, collection, itemId });
  };

  const cursor = dragging ? 'ns-resize'
    : tool === 'erase' ? 'not-allowed'
    : tool === 'select' ? 'default'
    : 'crosshair';

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${DRAW_W} ${DRAW_H}`}
      className="w-full h-full select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDragging(null); setDragPreview(null); }}
      style={{ cursor }}
    >
      {/* Fond page */}
      <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="#f8fafc" />

      {/* ─── Corps du meuble ─── */}
      {layout.moduleRects.length > 0 && (() => {
        const first = layout.moduleRects[0];
        const last  = layout.moduleRects[layout.moduleRects.length - 1];
        const ox = layout.ox;
        const oy = layout.oy;
        const iW = layout.innerW;
        const iH = layout.innerH;
        const pl = layout.plinthPx;
        const th = layout.thicknessPx;

        return (
          <g>
            {/* Fond (plaque arrière) */}
            <rect x={ox + th} y={oy + th} width={iW - 2 * th} height={iH - pl - th}
              fill={C.fond} stroke={C.fondStroke} strokeWidth="1" />

            {/* Plinthe */}
            {pl > 0 && <rect x={ox} y={oy + iH - pl} width={iW} height={pl}
              fill={C.panel} stroke={C.woodStroke} strokeWidth="1.5" />}

            {/* Montant gauche */}
            <rect x={ox} y={oy} width={th} height={iH - pl}
              fill={C.panel} stroke={C.panelEdge} strokeWidth="1.5" />
            {/* Chant montant gauche (côté visible) */}
            <rect x={ox} y={oy} width={th} height={iH - pl}
              fill="none" stroke={C.woodStroke} strokeWidth="2.5" />

            {/* Montant droit */}
            <rect x={ox + iW - th} y={oy} width={th} height={iH - pl}
              fill={C.panel} stroke={C.panelEdge} strokeWidth="1.5" />
            <rect x={ox + iW - th} y={oy} width={th} height={iH - pl}
              fill="none" stroke={C.woodStroke} strokeWidth="2.5" />

            {/* Traverse haute */}
            <rect x={ox} y={oy} width={iW} height={th}
              fill={C.panel} stroke={C.panelEdge} strokeWidth="1.5" />

            {/* Traverse basse (au-dessus plinthe) */}
            <rect x={ox} y={oy + iH - pl - th} width={iW} height={th}
              fill={C.panel} stroke={C.panelEdge} strokeWidth="1.5" />
          </g>
        );
      })()}

      {/* ─── Modules ─── */}
      {layout.moduleRects.map((mRect) => {
        const md = moduleDetailsMap.get(String(mRect.id)) || { shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
        const selected = String(selectedModuleId) === String(mRect.id);
        const moduleTop    = mRect.y;
        const moduleBottom = mRect.bottom;
        const interiorH    = Math.max(1, moduleBottom - moduleTop);
        const th = layout.thicknessPx;

        // Zone intérieure (entre les panneaux)
        const ix = mRect.x + th;          // x intérieur gauche
        const iw = mRect.width - 2 * th;  // largeur intérieure
        const iy = mRect.y + th;           // y intérieur haut
        const ih = mRect.height - 2 * th; // hauteur intérieure

        return (
          <g key={mRect.id}>
            {/* Séparateur vertical (montant intermodule) */}
            {mRect !== layout.moduleRects[0] && (
              <rect x={mRect.x} y={moduleTop} width={th} height={mRect.height}
                fill={C.panel} stroke={C.panelEdge} strokeWidth="1" />
            )}

            {/* Fond de module (légèrement différent pour distinguer) */}
            <rect
              x={mRect.x} y={mRect.y} width={mRect.width} height={mRect.height}
              fill={selected ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0)'}
              stroke={selected ? C.sel : 'none'}
              strokeWidth={selected ? 2 : 0}
              onClick={() => onModuleClick?.(mRect.id)}
              style={{ cursor: 'pointer' }}
            />

            {/* Numéro module */}
            <circle cx={mRect.x + mRect.width / 2} cy={moduleTop + th + 16} r="13"
              fill="none" stroke={C.del} strokeWidth="1.5" />
            <text x={mRect.x + mRect.width / 2} y={moduleTop + th + 21}
              textAnchor="middle" fill={C.del} fontSize="11" fontWeight="700">{mRect.id}</text>

            {/* ── Tringles ── */}
            {(md.rods || []).map((r) => {
              const yCm = Number.isFinite(Number(r.y)) ? Number(r.y) : cabinetH * 0.88;
              const ry  = cmToSvgY(yCm, mRect);
              const active = selectedItemId === r.id || (dragging?.itemId === r.id);
              return (
                <g key={r.id}>
                  {/* Zone de drag (plus large) */}
                  <rect
                    x={ix} y={ry - 8} width={iw} height={16}
                    fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'rods', r.id)}
                  />
                  <line x1={ix + 4} x2={ix + iw - 4} y1={ry} y2={ry}
                    stroke={active ? C.rodActive : C.rod} strokeWidth="5" strokeLinecap="round"
                    pointerEvents="none" />
                  <circle cx={ix + 4}     cy={ry} r="3" fill="#9ca3af" pointerEvents="none" />
                  <circle cx={ix + iw - 4} cy={ry} r="3" fill="#9ca3af" pointerEvents="none" />
                  {/* Bouton supprimer */}
                  <g onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'rods', r.id); }}
                    style={{ cursor: 'pointer' }}>
                    <rect x={ix + iw - 18} y={ry - 9} width="16" height="16" rx="3" fill={C.del} opacity="0.85" />
                    <text x={ix + iw - 10} y={ry + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
                  </g>
                </g>
              );
            })}

            {/* ── Tablettes ── */}
            {(md.shelves || []).map((s) => {
              const yCm = Number.isFinite(Number(s.y)) ? Number(s.y) : cabinetH / 2;
              const sy  = cmToSvgY(yCm, mRect);
              const active = selectedItemId === s.id || (dragging?.itemId === s.id);
              return (
                <g key={s.id}>
                  <rect
                    x={ix} y={sy - 7} width={iw} height={14}
                    fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'shelves', s.id)}
                  />
                  <rect x={ix} y={sy - 2} width={iw} height="4"
                    fill={C.shelf}
                    stroke={active ? C.sel : C.shelfEdge}
                    strokeWidth={active ? 2 : 1}
                    pointerEvents="none"
                  />
                  {/* Chant tablette */}
                  <rect x={ix} y={sy - 2} width={iw} height="4"
                    fill="none" stroke={active ? C.sel : C.woodStroke} strokeWidth={active ? 2 : 0.5}
                    pointerEvents="none" />
                  {/* Supprimer */}
                  <g onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'shelves', s.id); }}
                    style={{ cursor: 'pointer' }}>
                    <rect x={ix + iw - 18} y={sy - 9} width="16" height="16" rx="3" fill={C.del} opacity="0.85" />
                    <text x={ix + iw - 10} y={sy + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
                  </g>
                </g>
              );
            })}

            {/* ── Tiroirs ── */}
            {(md.drawers || []).map((d) => {
              const yCm  = Number.isFinite(Number(d.y)) ? Number(d.y) : cabinetH * 0.35;
              const hCm  = Math.max(3, Number(d.height || 18));
              const topY = cmToSvgY(yCm + hCm, mRect);
              const dh   = Math.max(8, cmToSvgY(yCm, mRect) - topY);
              const active = selectedItemId === d.id || (dragging?.itemId === d.id);
              return (
                <g key={d.id}>
                  <rect
                    x={ix} y={topY - 4} width={iw} height={dh + 8}
                    fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'drawers', d.id)}
                  />
                  <rect x={ix} y={topY} width={iw} height={dh}
                    fill={C.drawer}
                    stroke={active ? C.sel : C.drawerEdge}
                    strokeWidth={active ? 2 : 1} rx="2"
                    pointerEvents="none"
                  />
                  {/* Chant visible tiroir */}
                  <rect x={ix} y={topY} width={iw} height={3}
                    fill={C.panel} stroke={C.woodStroke} strokeWidth="0.5" pointerEvents="none" />
                  {/* Poignée */}
                  <ellipse cx={ix + iw / 2} cy={topY + dh / 2} rx="10" ry="4"
                    fill="#9ca3af" pointerEvents="none" />
                  {/* Supprimer */}
                  <g onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'drawers', d.id); }}
                    style={{ cursor: 'pointer' }}>
                    <rect x={ix + iw - 18} y={topY + 2} width="16" height="16" rx="3" fill={C.del} opacity="0.85" />
                    <text x={ix + iw - 10} y={topY + 14} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
                  </g>
                </g>
              );
            })}

            {/* ── Portes coulissantes ── */}
            {(md.slidingDoors || []).length > 0 && (
              <g>
                <rect x={ix} y={iy} width={iw * 0.55} height={ih}
                  fill={C.sliding} stroke={C.slidingEdge} strokeWidth="1" />
                <rect x={ix + iw * 0.40} y={iy} width={iw * 0.55} height={ih}
                  fill={C.sliding} stroke={C.slidingEdge} strokeWidth="1" opacity="0.8" />
                <line x1={ix} y1={iy + 8} x2={ix + iw} y2={iy + 8} stroke={C.slidingEdge} strokeWidth="1" />
                <line x1={ix} y1={iy + ih - 8} x2={ix + iw} y2={iy + ih - 8} stroke={C.slidingEdge} strokeWidth="1" />
                <g onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'slidingDoors', md.slidingDoors[0].id); }}
                  style={{ cursor: 'pointer' }}>
                  <rect x={ix + iw - 18} y={iy + 2} width="16" height="16" rx="3" fill={C.del} opacity="0.85" />
                  <text x={ix + iw - 10} y={iy + 14} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
                </g>
              </g>
            )}

            {/* ── Portes battantes ── */}
            {(md.slidingDoors || []).length === 0 && (md.doors || []).map((d, idx) => {
              const count = Math.max(1, md.doors.length);
              const dw = iw / count;
              const dx = ix + idx * dw;
              const active = selectedItemId === d.id;
              return (
                <g key={d.id}>
                  <rect x={dx} y={iy} width={dw} height={ih}
                    fill={C.door}
                    stroke={active ? C.sel : C.doorEdge}
                    strokeWidth={active ? 2 : 1} />
                  {/* Poignée */}
                  <rect
                    x={idx === 0 ? dx + dw - 8 : dx + 4}
                    y={iy + ih / 2 - 10}
                    width="4" height="20" fill="#6b7280" rx="2"
                  />
                  {idx === 0 && (
                    <g onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'doors', d.id); }}
                      style={{ cursor: 'pointer' }}>
                      <rect x={ix + iw - 18} y={iy + 2} width="16" height="16" rx="3" fill={C.del} opacity="0.85" />
                      <text x={ix + iw - 10} y={iy + 14} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Cote largeur module */}
            <line x1={mRect.x} y1={layout.oy + layout.innerH + 10} x2={mRect.x + mRect.width} y2={layout.oy + layout.innerH + 10}
              stroke={C.del} strokeWidth="1" />
            <text x={mRect.x + mRect.width / 2} y={layout.oy + layout.innerH + 22}
              textAnchor="middle" fill={C.del} fontSize="9" fontWeight="700">
              {(draftState?.facadeModules?.find((fm) => String(fm.id) === String(mRect.id))?.width || 0).toFixed(1)} cm
            </text>
          </g>
        );
      })}

      {/* ─── Annotations libres ─── */}
      {(draftState?.facadeItems || []).map((a) => {
        const sel = selectedAnnotationId === a.id;
        if (a.type === 'dim') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={C.sel} strokeWidth={sel ? 2.6 : 1.8}
              markerStart="url(#annArrowOrange)" markerEnd="url(#annArrowOrange)" />
            <rect x={(a.x1+a.x2)/2-28} y={(a.y1+a.y2)/2-16} width="56" height="16" rx="4" fill="#0f172a" stroke={C.sel} />
            <text x={(a.x1+a.x2)/2} y={(a.y1+a.y2)/2-4} textAnchor="middle" fill={C.sel} fontSize="10" fontWeight="700">{a.label||'cote'}</text>
          </g>
        );
        if (a.type === 'arrow') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={C.del} strokeWidth={sel ? 2.6 : 2} markerEnd="url(#annArrowRed)" />
            {a.label && <text x={a.x2+4} y={a.y2-4} fill={C.del} fontSize="10" fontWeight="700">{a.label}</text>}
          </g>
        );
        return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <rect x={a.x1-42} y={a.y1-14} width="84" height="22" rx="8" fill="rgba(255,255,255,0.88)" stroke={sel ? C.sel : '#22d3ee'} />
            <text x={a.x1} y={a.y1+1} textAnchor="middle" fill="#0891b2" fontSize="10" fontWeight="700">{a.label||'note'}</text>
          </g>
        );
      })}

      {/* Cote largeur totale */}
      <line x1={layout.ox} y1={layout.oy-28} x2={layout.ox+layout.innerW} y2={layout.oy-28} stroke={C.dim} strokeWidth="1.5" />
      <line x1={layout.ox} y1={layout.oy-34} x2={layout.ox} y2={layout.oy-22} stroke={C.dim} strokeWidth="1.5" />
      <line x1={layout.ox+layout.innerW} y1={layout.oy-34} x2={layout.ox+layout.innerW} y2={layout.oy-22} stroke={C.dim} strokeWidth="1.5" />
      <text x={layout.ox+layout.innerW/2} y={layout.oy-31} textAnchor="middle" fill={C.dim} fontSize="12" fontWeight="700">{draftState?.cabinetDims?.width||'?'} cm</text>

      {/* Cote hauteur totale */}
      <line x1={layout.ox+layout.innerW+24} y1={layout.oy} x2={layout.ox+layout.innerW+24} y2={layout.oy+layout.innerH} stroke={C.dim} strokeWidth="1.5" />
      <text
        x={layout.ox+layout.innerW+36} y={layout.oy+layout.innerH/2}
        transform={`rotate(90 ${layout.ox+layout.innerW+36} ${layout.oy+layout.innerH/2})`}
        textAnchor="middle" fill={C.dim} fontSize="12" fontWeight="700"
      >{draftState?.cabinetDims?.height||'?'} cm</text>

      {/* Preview drag cote */}
      {dragPreview && (
        <line x1={dragPreview.x1} y1={dragPreview.y1} x2={dragPreview.x2} y2={dragPreview.y2}
          stroke={dragPreview.type==='dim'?C.sel:C.del} strokeWidth="2" strokeDasharray="4 3" />
      )}

      <defs>
        <marker id="annArrowOrange" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.sel} />
        </marker>
        <marker id="annArrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.del} />
        </marker>
      </defs>
    </svg>
  );
}
