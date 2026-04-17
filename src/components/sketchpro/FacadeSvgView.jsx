import React, { useMemo, useRef, useState, useCallback } from 'react';
import { buildFacadeLayout } from './utils';

const DRAW_W = 960;
const DRAW_H = 520;
const PAD = 80;

export default function FacadeSvgView({
  draftState,
  selectedModuleId,
  selectedAnnotationId,
  tool,
  onModuleClick,
  onAddObject,
  onAnnotationClick,
  onAddAnnotation,
  onRemoveObject,
  onMoveObject,
  zoom = 1,
  pan = { x: 0, y: 0 },
}) {
  const svgRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null); // { moduleId, collection, itemId }

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

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }, []);

  const findModuleAtPoint = (x, y) =>
    layout.moduleRects.find((m) => x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height);

  const svgYToCm = (svgY, mRect) => {
    const frac = (svgY - mRect.y) / Math.max(1, mRect.height);
    return Math.max(0, Math.min(cabinetH, (1 - frac) * cabinetH));
  };
  const cmToSvgY = (cm, mRect) => mRect.y + (1 - Math.min(1, Math.max(0, cm / cabinetH))) * mRect.height;

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
      onAddObject?.(m.id, tool, svgYToCm(p.y, m));
      return;
    }
    if (tool === 'note') {
      const text = window.prompt('Note', '') || 'Note';
      onAddAnnotation?.('note', p.x, p.y, p.x, p.y, text);
    }
  }, [tool, layout, getSvgPoint, onAddObject, onAddAnnotation]);

  const handleMouseMove = useCallback((e) => {
    const p = getSvgPoint(e);
    if (dragPreview) { setDragPreview((prev) => ({ ...prev, x2: p.x, y2: p.y })); return; }
    if (dragging) {
      const m = layout.moduleRects.find((r) => r.id === dragging.moduleId);
      if (m) onMoveObject?.(dragging.moduleId, dragging.collection, dragging.itemId, svgYToCm(p.y, m));
    }
  }, [dragPreview, dragging, layout, getSvgPoint, onMoveObject]);

  const handleMouseUp = useCallback((e) => {
    if (dragPreview) {
      const p = getSvgPoint(e);
      onAddAnnotation?.(dragPreview.type, dragPreview.x1, dragPreview.y1, p.x, p.y, '');
      setDragPreview(null); return;
    }
    setDragging(null);
  }, [dragPreview, getSvgPoint, onAddAnnotation]);

  const startDrag = (e, moduleId, collection, itemId) => {
    e.stopPropagation(); e.preventDefault();
    setDragging({ moduleId, collection, itemId });
  };

  const cursor = dragging ? 'ns-resize' : tool === 'erase' ? 'not-allowed' : tool === 'select' ? 'default' : 'crosshair';
  const { ox, oy, innerW, innerH, thicknessPx: th, plinthPx: pl } = layout;

  // Icône poubelle SVG sobre
  const TrashIcon = ({ x, y, onClick, visible }) => (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: visible ? 1 : 0, transition: 'opacity 0.15s' }}
      pointerEvents={visible ? 'all' : 'none'}
    >
      <rect x={x - 11} y={y - 11} width={22} height={22} rx={4}
        fill="#1e293b" stroke="#475569" strokeWidth="1" />
      {/* corps poubelle */}
      <rect x={x - 5} y={y - 3} width={10} height={8} rx={1}
        fill="none" stroke="#94a3b8" strokeWidth={1.3} />
      {/* couvercle */}
      <line x1={x - 7} y1={y - 3} x2={x + 7} y2={y - 3} stroke="#94a3b8" strokeWidth={1.3} />
      <line x1={x - 2} y1={y - 5} x2={x + 2} y2={y - 5} stroke="#94a3b8" strokeWidth={1.3} strokeLinecap="round" />
      {/* traits intérieurs */}
      <line x1={x - 2} y1={y - 1} x2={x - 2} y2={y + 4} stroke="#94a3b8" strokeWidth={1} />
      <line x1={x + 2} y1={y - 1} x2={x + 2} y2={y + 4} stroke="#94a3b8" strokeWidth={1} />
    </g>
  );

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%"
      viewBox={`0 0 ${DRAW_W} ${DRAW_H}`}
      className="w-full h-full select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDragging(null); setDragPreview(null); }}
      style={{ cursor }}
    >
      <defs>
        {/* Bois clair mélaminé — face frontale */}
        <linearGradient id="gWoodFace" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#f2e0b0" />
          <stop offset="20%"  stopColor="#f8ead8" />
          <stop offset="45%"  stopColor="#f0d898" />
          <stop offset="65%"  stopColor="#f8e8c8" />
          <stop offset="85%"  stopColor="#ead4a0" />
          <stop offset="100%" stopColor="#e8cc98" />
        </linearGradient>

        {/* Bois — face interne (côté vu de l'intérieur, plus sombre) */}
        <linearGradient id="gWoodInner" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#d4b870" />
          <stop offset="50%"  stopColor="#c8a858" />
          <stop offset="100%" stopColor="#b89848" />
        </linearGradient>

        {/* Fond de caisson HDF */}
        <linearGradient id="gBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#c8a850" />
          <stop offset="100%" stopColor="#a88840" />
        </linearGradient>

        {/* Tablette */}
        <linearGradient id="gShelf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0d898" />
          <stop offset="40%"  stopColor="#d8b870" />
          <stop offset="100%" stopColor="#c0a060" />
        </linearGradient>

        {/* Tiroir face */}
        <linearGradient id="gDrawer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f8e8c0" />
          <stop offset="50%"  stopColor="#ecd4a0" />
          <stop offset="100%" stopColor="#d8bc80" />
        </linearGradient>

        {/* Porte bois */}
        <linearGradient id="gDoor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f5e5c0" />
          <stop offset="100%" stopColor="#d8c090" />
        </linearGradient>

        {/* Verre dépoli porte coulissante */}
        <linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(210,230,255,0.55)" />
          <stop offset="50%"  stopColor="rgba(235,245,255,0.75)" />
          <stop offset="100%" stopColor="rgba(200,220,250,0.50)" />
        </linearGradient>

        {/* Poignée alu */}
        <linearGradient id="gHandle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8e8e8" />
          <stop offset="40%"  stopColor="#b0b8c0" />
          <stop offset="100%" stopColor="#888890" />
        </linearGradient>

        {/* Tringle chromée */}
        <linearGradient id="gRod" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0f0f0" />
          <stop offset="30%"  stopColor="#a8b0b8" />
          <stop offset="60%"  stopColor="#d8dce0" />
          <stop offset="100%" stopColor="#808890" />
        </linearGradient>

        {/* Ombre douce */}
        <filter id="fShadow" x="-10%" y="-10%" width="130%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#00000030" />
        </filter>
        <filter id="fShadowCabinet" x="-4%" y="-2%" width="115%" height="115%">
          <feDropShadow dx="5" dy="8" stdDeviation="8" floodColor="#00000030" />
        </filter>

        {/* Flèche cote */}
        <marker id="mDim" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 Z" fill="#d42020" />
        </marker>
        <marker id="mArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 Z" fill="#c02020" />
        </marker>
      </defs>

      {/* ── FOND blanc cassé ── */}
      <rect x={0} y={0} width={DRAW_W} height={DRAW_H} fill="#f7f4ee" />

      {/* ── OMBRE GLOBALE DU MEUBLE ── */}
      {layout.moduleRects.length > 0 && (
        <rect x={ox + 6} y={oy + 8} width={innerW} height={innerH - pl}
          fill="#00000020" rx={2} filter="url(#fShadowCabinet)" />
      )}

      {/* ── STRUCTURE CAISSON ── */}
      {layout.moduleRects.length > 0 && (() => {
        const bx = ox, by = oy, bw = innerW, bh = innerH - pl;
        return (
          <g>
            {/* Fond HDF */}
            <rect x={bx + th} y={by + th} width={bw - 2*th} height={bh - th}
              fill="url(#gBack)" />

            {/* Montant gauche */}
            <rect x={bx} y={by} width={th} height={bh} fill="url(#gWoodFace)" stroke="#c0980080" strokeWidth={0.5} />
            {/* Ombre intérieure gauche (profondeur) */}
            <rect x={bx + th} y={by + th} width={6} height={bh - th}
              fill="url(#gWoodInner)" opacity={0.5} />

            {/* Montant droit */}
            <rect x={bx + bw - th} y={by} width={th} height={bh} fill="url(#gWoodFace)" stroke="#c0980080" strokeWidth={0.5} />
            {/* Ombre intérieure droite */}
            <rect x={bx + bw - th - 6} y={by + th} width={6} height={bh - th}
              fill="url(#gWoodInner)" opacity={0.5} />

            {/* Traverse haute */}
            <rect x={bx} y={by} width={bw} height={th} fill="url(#gWoodFace)" stroke="#c0980080" strokeWidth={0.5} />
            {/* Ombre traverse haute */}
            <rect x={bx + th} y={by + th} width={bw - 2*th} height={5}
              fill="#00000018" />

            {/* Traverse basse */}
            <rect x={bx} y={by + bh - th} width={bw} height={th} fill="url(#gWoodFace)" stroke="#c0980080" strokeWidth={0.5} />

            {/* Plinthe */}
            {pl > 0 && (
              <rect x={bx + th * 1.5} y={by + bh} width={bw - th * 3} height={pl}
                fill="url(#gWoodFace)" stroke="#c0980060" strokeWidth={0.5} />
            )}
          </g>
        );
      })()}

      {/* ── MODULES ── */}
      {layout.moduleRects.map((mRect, mIdx) => {
        const md = moduleDetailsMap.get(String(mRect.id)) || { shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
        const selected = String(selectedModuleId) === String(mRect.id);
        const ix = mRect.x + th;
        const iw = Math.max(2, mRect.width - 2 * th);
        const iy = mRect.y + th;
        const ih = Math.max(2, mRect.height - 2 * th);
        const fmWidth = (draftState?.facadeModules?.find((fm) => String(fm.id) === String(mRect.id))?.width || 0).toFixed(1);

        return (
          <g key={mRect.id}>
            {/* Séparateur */}
            {mIdx > 0 && (
              <rect x={mRect.x} y={mRect.y} width={th} height={mRect.height}
                fill="url(#gWoodFace)" stroke="#b8900060" strokeWidth={0.5} />
            )}

            {/* Zone de sélection module */}
            <rect x={mRect.x} y={mRect.y} width={mRect.width} height={mRect.height}
              fill={selected ? 'rgba(220,60,20,0.07)' : 'transparent'}
              stroke={selected ? '#d43010' : 'transparent'}
              strokeWidth={selected ? 1.5 : 0}
              strokeDasharray={selected ? '6 3' : 'none'}
              onClick={() => onModuleClick?.(mRect.id)}
              style={{ cursor: 'pointer' }}
            />

            {/* Numéro module cerclé rouge (style référence) */}
            <circle cx={ix + iw / 2} cy={iy + 26} r={14}
              fill="white" stroke="#d43010" strokeWidth={1.5} />
            <text x={ix + iw / 2} y={iy + 31}
              textAnchor="middle" fill="#d43010" fontSize={12} fontWeight="700" fontFamily="Arial, sans-serif">
              {mRect.id}
            </text>

            {/* ── TRINGLES ── */}
            {(md.rods || []).map((r) => {
              const yCm = Number.isFinite(Number(r.y)) ? Number(r.y) : cabinetH * 0.85;
              const ry = cmToSvgY(yCm, mRect);
              const isHov = hoveredItem?.itemId === r.id;
              const isDrag = dragging?.itemId === r.id;
              return (
                <g key={r.id}
                  onMouseEnter={() => setHoveredItem({ moduleId: mRect.id, collection: 'rods', itemId: r.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Zone drag invisible */}
                  <rect x={ix} y={ry - 12} width={iw} height={24} fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'rods', r.id)} />
                  {/* Support gauche */}
                  <rect x={ix + 8} y={ry - 12} width={8} height={24} rx={3}
                    fill="#909090" stroke="#606060" strokeWidth={0.8} pointerEvents="none" />
                  {/* Support droit */}
                  <rect x={ix + iw - 16} y={ry - 12} width={8} height={24} rx={3}
                    fill="#909090" stroke="#606060" strokeWidth={0.8} pointerEvents="none" />
                  {/* Tube tringle */}
                  <rect x={ix + 16} y={ry - 4} width={iw - 32} height={8} rx={4}
                    fill="url(#gRod)" stroke="#80888888" strokeWidth={0.5} pointerEvents="none" />
                  {/* Reflet */}
                  <rect x={ix + 20} y={ry - 2} width={iw - 40} height={2} rx={1}
                    fill="rgba(255,255,255,0.7)" pointerEvents="none" />
                  {/* Ligne guide drag */}
                  {isDrag && <line x1={mRect.x} x2={mRect.x + mRect.width} y1={ry} y2={ry}
                    stroke="#d43010" strokeWidth={1} strokeDasharray="5 3" pointerEvents="none" />}
                  <TrashIcon
                    x={ix + iw - 14} y={ry - 16}
                    visible={isHov}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'rods', r.id); }}
                  />
                </g>
              );
            })}

            {/* ── TABLETTES ── */}
            {(md.shelves || []).map((s) => {
              const yCm = Number.isFinite(Number(s.y)) ? Number(s.y) : cabinetH / 2;
              const sy = cmToSvgY(yCm, mRect);
              const shH = Math.max(5, th * 0.9);
              const isHov = hoveredItem?.itemId === s.id;
              const isDrag = dragging?.itemId === s.id;
              return (
                <g key={s.id}
                  onMouseEnter={() => setHoveredItem({ moduleId: mRect.id, collection: 'shelves', itemId: s.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <rect x={ix} y={sy - shH - 8} width={iw} height={shH + 16} fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'shelves', s.id)} />
                  {/* Corps tablette */}
                  <rect x={ix} y={sy - shH} width={iw} height={shH}
                    fill="url(#gShelf)" filter="url(#fShadow)" pointerEvents="none" />
                  {/* Chant avant */}
                  <rect x={ix} y={sy - shH} width={iw} height={2.5}
                    fill="#a07828" pointerEvents="none" />
                  {/* Reflet surface */}
                  <rect x={ix + 4} y={sy - shH + 3} width={iw * 0.4} height={1.5}
                    fill="rgba(255,255,255,0.5)" pointerEvents="none" />
                  {/* Ombre sous tablette */}
                  <rect x={ix} y={sy} width={iw} height={3}
                    fill="#00000018" pointerEvents="none" />
                  {isDrag && <line x1={mRect.x} x2={mRect.x + mRect.width} y1={sy - shH / 2} y2={sy - shH / 2}
                    stroke="#d43010" strokeWidth={1} strokeDasharray="5 3" pointerEvents="none" />}
                  <TrashIcon
                    x={ix + iw - 14} y={sy - shH - 8}
                    visible={isHov}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'shelves', s.id); }}
                  />
                </g>
              );
            })}

            {/* ── TIROIRS ── */}
            {(md.drawers || []).map((d) => {
              const yCm = Number.isFinite(Number(d.y)) ? Number(d.y) : cabinetH * 0.3;
              const hCm = Math.max(3, Number(d.height || 18));
              const topY = cmToSvgY(yCm + hCm, mRect);
              const dh = Math.max(12, cmToSvgY(yCm, mRect) - topY);
              const isHov = hoveredItem?.itemId === d.id;
              const isDrag = dragging?.itemId === d.id;
              return (
                <g key={d.id}
                  onMouseEnter={() => setHoveredItem({ moduleId: mRect.id, collection: 'drawers', itemId: d.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <rect x={ix} y={topY - 5} width={iw} height={dh + 10} fill="transparent"
                    style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'drawers', d.id)} />
                  {/* Façade tiroir */}
                  <rect x={ix + 1} y={topY} width={iw - 2} height={dh}
                    fill="url(#gDrawer)" stroke="#b09040" strokeWidth={0.8} rx={1} pointerEvents="none" />
                  {/* Chant haut */}
                  <rect x={ix + 1} y={topY} width={iw - 2} height={2.5}
                    fill="#9a7828" pointerEvents="none" />
                  {/* Ligne de joint bas */}
                  <rect x={ix + 1} y={topY + dh - 2} width={iw - 2} height={2}
                    fill="#9a782870" pointerEvents="none" />
                  {/* Reflet */}
                  <rect x={ix + 6} y={topY + 4} width={iw * 0.35} height={1.5}
                    fill="rgba(255,255,255,0.55)" pointerEvents="none" />
                  {/* Poignée alu fine centrée */}
                  <rect x={ix + iw / 2 - 22} y={topY + dh / 2 - 3} width={44} height={6} rx={3}
                    fill="url(#gHandle)" stroke="#80808880" strokeWidth={0.6} pointerEvents="none" />
                  <rect x={ix + iw / 2 - 18} y={topY + dh / 2 - 1} width={36} height={1.5}
                    fill="rgba(255,255,255,0.6)" pointerEvents="none" />
                  {isDrag && <rect x={ix + 1} y={topY} width={iw - 2} height={dh}
                    fill="none" stroke="#d43010" strokeWidth={1.2} strokeDasharray="5 3" rx={1} pointerEvents="none" />}
                  <TrashIcon
                    x={ix + iw - 14} y={topY + 8}
                    visible={isHov}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'drawers', d.id); }}
                  />
                </g>
              );
            })}

            {/* ── PORTES COULISSANTES ── */}
            {(md.slidingDoors || []).length > 0 && (() => {
              const isHov = hoveredItem?.moduleId === mRect.id && hoveredItem?.collection === 'slidingDoors';
              return (
                <g
                  onMouseEnter={() => setHoveredItem({ moduleId: mRect.id, collection: 'slidingDoors', itemId: md.slidingDoors[0].id })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Rail haut */}
                  <rect x={ix} y={iy} width={iw} height={4} fill="#b0b8c0" rx={1} />
                  {/* Rail bas */}
                  <rect x={ix} y={iy + ih - 4} width={iw} height={4} fill="#b0b8c0" rx={1} />
                  {/* Vantail arrière */}
                  <rect x={ix + iw * 0.44} y={iy + 4} width={iw * 0.54} height={ih - 8}
                    fill="url(#gGlass)" stroke="#90a8c0" strokeWidth={1.2} />
                  <rect x={ix + iw * 0.46} y={iy + 10} width={2} height={ih - 20}
                    fill="rgba(255,255,255,0.6)" />
                  {/* Vantail avant */}
                  <rect x={ix + 2} y={iy + 4} width={iw * 0.54} height={ih - 8}
                    fill="url(#gGlass)" stroke="#90a8c0" strokeWidth={1.2} opacity={0.9} />
                  <rect x={ix + 8} y={iy + 10} width={2} height={ih - 20}
                    fill="rgba(255,255,255,0.6)" />
                  {/* Poignées */}
                  <rect x={ix + iw * 0.44 - 4} y={iy + ih / 2 - 18} width={5} height={36} rx={2.5}
                    fill="url(#gHandle)" stroke="#80808880" strokeWidth={0.6} />
                  <rect x={ix + iw * 0.56 - 1} y={iy + ih / 2 - 18} width={5} height={36} rx={2.5}
                    fill="url(#gHandle)" stroke="#80808880" strokeWidth={0.6} />
                  <TrashIcon
                    x={ix + iw - 14} y={iy + 10}
                    visible={isHov}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'slidingDoors', md.slidingDoors[0].id); }}
                  />
                </g>
              );
            })()}

            {/* ── PORTES BATTANTES ── */}
            {(md.slidingDoors || []).length === 0 && (md.doors || []).map((d, idx) => {
              const count = Math.max(1, md.doors.length);
              const dw = iw / count;
              const dx = ix + idx * dw;
              const isLeft = idx === 0;
              const isHov = hoveredItem?.itemId === d.id;
              return (
                <g key={d.id}
                  onMouseEnter={() => setHoveredItem({ moduleId: mRect.id, collection: 'doors', itemId: d.id })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Corps porte */}
                  <rect x={dx + 1} y={iy + 1} width={dw - 2} height={ih - 2}
                    fill="url(#gDoor)" stroke="#b09030" strokeWidth={1} />
                  {/* Cadre moulure */}
                  <rect x={dx + 7} y={iy + 9} width={dw - 14} height={ih - 18}
                    fill="none" stroke="#c0a04080" strokeWidth={1} />
                  {/* Reflet */}
                  <rect x={dx + 4} y={iy + 3} width={2} height={ih - 6}
                    fill="rgba(255,255,255,0.28)" />
                  {/* Charnières */}
                  {[0.22, 0.78].map((f, ci) => (
                    <rect key={ci}
                      x={isLeft ? dx + dw - 5 : dx}
                      y={iy + ih * f - 8} width={5} height={16} rx={1}
                      fill="#a0a8b0" stroke="#70787880" strokeWidth={0.5}
                    />
                  ))}
                  {/* Poignée */}
                  <rect
                    x={isLeft ? dx + 8 : dx + dw - 13}
                    y={iy + ih / 2 - 20}
                    width={5} height={40} rx={2.5}
                    fill="url(#gHandle)" stroke="#80808880" strokeWidth={0.6}
                  />
                  {idx === 0 && (
                    <TrashIcon
                      x={ix + iw - 14} y={iy + 10}
                      visible={isHov}
                      onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'doors', d.id); }}
                    />
                  )}
                </g>
              );
            })}

            {/* Cote largeur module */}
            <line
              x1={mRect.x + 2} y1={oy + innerH + 18}
              x2={mRect.x + mRect.width - 2} y2={oy + innerH + 18}
              stroke="#d42020" strokeWidth={0.9}
              markerStart="url(#mDim)" markerEnd="url(#mDim)"
            />
            <line x1={mRect.x} y1={oy + innerH + 12} x2={mRect.x} y2={oy + innerH + 24} stroke="#d42020" strokeWidth={0.8} />
            <line x1={mRect.x + mRect.width} y1={oy + innerH + 12} x2={mRect.x + mRect.width} y2={oy + innerH + 24} stroke="#d42020" strokeWidth={0.8} />
            <text x={mRect.x + mRect.width / 2} y={oy + innerH + 33}
              textAnchor="middle" fill="#d42020" fontSize={9} fontWeight="600" fontFamily="Arial, sans-serif">
              {fmWidth} cm
            </text>
          </g>
        );
      })}

      {/* ── COTES GÉNÉRALES ── */}
      {/* Largeur totale */}
      <line x1={ox} y1={oy - 32} x2={ox + innerW} y2={oy - 32}
        stroke="#d42020" strokeWidth={1}
        markerStart="url(#mDim)" markerEnd="url(#mDim)" />
      <line x1={ox} y1={oy - 38} x2={ox} y2={oy - 26} stroke="#d42020" strokeWidth={0.9} />
      <line x1={ox + innerW} y1={oy - 38} x2={ox + innerW} y2={oy - 26} stroke="#d42020" strokeWidth={0.9} />
      <rect x={ox + innerW / 2 - 26} y={oy - 46} width={52} height={16} rx={3}
        fill="white" stroke="#d42020" strokeWidth={0.8} />
      <text x={ox + innerW / 2} y={oy - 34} textAnchor="middle"
        fill="#d42020" fontSize={11} fontWeight="700" fontFamily="Arial, sans-serif">
        {draftState?.cabinetDims?.width || '?'} cm
      </text>

      {/* Hauteur totale */}
      <line x1={ox + innerW + 32} y1={oy} x2={ox + innerW + 32} y2={oy + innerH - pl}
        stroke="#d42020" strokeWidth={1}
        markerStart="url(#mDim)" markerEnd="url(#mDim)" />
      <line x1={ox + innerW + 26} y1={oy} x2={ox + innerW + 38} y2={oy} stroke="#d42020" strokeWidth={0.9} />
      <line x1={ox + innerW + 26} y1={oy + innerH - pl} x2={ox + innerW + 38} y2={oy + innerH - pl} stroke="#d42020" strokeWidth={0.9} />
      <g transform={`rotate(-90, ${ox + innerW + 54}, ${oy + (innerH - pl) / 2})`}>
        <rect x={ox + innerW + 54 - 26} y={oy + (innerH - pl) / 2 - 8} width={52} height={16} rx={3}
          fill="white" stroke="#d42020" strokeWidth={0.8} />
        <text x={ox + innerW + 54} y={oy + (innerH - pl) / 2 + 5} textAnchor="middle"
          fill="#d42020" fontSize={11} fontWeight="700" fontFamily="Arial, sans-serif">
          {draftState?.cabinetDims?.height || '?'} cm
        </text>
      </g>

      {/* ── ANNOTATIONS LIBRES ── */}
      {(draftState?.facadeItems || []).map((a) => {
        const sel = selectedAnnotationId === a.id;
        if (a.type === 'dim') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={sel ? '#f97316' : '#d42020'} strokeWidth={sel ? 2 : 1.2}
              markerStart="url(#mDim)" markerEnd="url(#mDim)" />
            <rect x={(a.x1+a.x2)/2 - 24} y={(a.y1+a.y2)/2 - 9} width={48} height={16} rx={4}
              fill="white" stroke={sel ? '#f97316' : '#d42020'} strokeWidth={0.8} />
            <text x={(a.x1+a.x2)/2} y={(a.y1+a.y2)/2 + 4} textAnchor="middle"
              fill={sel ? '#f97316' : '#d42020'} fontSize={9} fontWeight="700" fontFamily="Arial, sans-serif">
              {a.label || 'cote'}
            </text>
          </g>
        );
        if (a.type === 'arrow') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke="#c02020" strokeWidth={sel ? 2 : 1.5} markerEnd="url(#mArrow)" />
            {a.label && <text x={a.x2 + 5} y={a.y2 - 3} fill="#c02020" fontSize={9} fontFamily="Arial, sans-serif">{a.label}</text>}
          </g>
        );
        return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <rect x={a.x1 - 38} y={a.y1 - 11} width={76} height={18} rx={5}
              fill="white" stroke={sel ? '#f97316' : '#0ea5e9'} strokeWidth={1} />
            <text x={a.x1} y={a.y1 + 3} textAnchor="middle"
              fill="#0369a1" fontSize={9} fontWeight="600" fontFamily="Arial, sans-serif">
              {a.label || 'note'}
            </text>
          </g>
        );
      })}

      {/* Preview tracé cote */}
      {dragPreview && (
        <line x1={dragPreview.x1} y1={dragPreview.y1} x2={dragPreview.x2} y2={dragPreview.y2}
          stroke={dragPreview.type === 'dim' ? '#f97316' : '#c02020'}
          strokeWidth={1.5} strokeDasharray="5 3" />
      )}
    </svg>
  );
}
