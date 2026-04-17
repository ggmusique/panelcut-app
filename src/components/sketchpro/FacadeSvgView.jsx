import React, { useMemo, useRef, useState, useCallback } from 'react';
import { buildFacadeLayout } from './utils';

const DRAW_W = 920;
const DRAW_H = 500;
const PAD = 72;

// ─── Dégradés et textures bois ────────────────────────────────────────────────
// Toutes les couleurs sont définies dans <defs> via des linearGradient SVG
// pour simuler le grain du bois mélaminé/MDF/contreplaqué.

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
  onMoveObject,
  zoom = 1,
  pan = { x: 0, y: 0 },
}) {
  const svgRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [dragging, setDragging]       = useState(null);

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
    const s = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: s.x, y: s.y };
  }, []);

  const findModuleAtPoint = (x, y) =>
    layout.moduleRects.find((m) => x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height);

  const svgYToCm = (svgY, mRect) => {
    const frac = (svgY - mRect.y) / Math.max(1, mRect.height);
    return Math.max(0, Math.min(cabinetH, (1 - frac) * cabinetH));
  };
  const cmToSvgY = (cm, mRect) => mRect.y + (1 - cm / cabinetH) * mRect.height;

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
      const text = window.prompt('Note', 'Note') || 'Note';
      onAddAnnotation?.('note', p.x, p.y, p.x, p.y, text);
    }
  }, [tool, layout, getSvgPoint, onAddObject, onAddAnnotation]);

  const handleMouseMove = useCallback((e) => {
    const p = getSvgPoint(e);
    if (dragPreview) { setDragPreview((prev) => ({ ...prev, x2: p.x, y2: p.y })); return; }
    if (dragging) {
      const m = layout.moduleRects.find((r) => r.id === dragging.moduleId);
      if (!m) return;
      onMoveObject?.(dragging.moduleId, dragging.collection, dragging.itemId, svgYToCm(p.y, m));
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

  // ─── Vis (petits cercles décoratifs sur les montants) ─────────────────────
  const Screw = ({ x, y }) => (
    <g>
      <circle cx={x} cy={y} r="3.5" fill="url(#gradScrew)" stroke="#555" strokeWidth="0.6" />
      <line x1={x-2} y1={y} x2={x+2} y2={y} stroke="#333" strokeWidth="0.7" />
      <line x1={x} y1={y-2} x2={x} y2={y+2} stroke="#333" strokeWidth="0.7" />
    </g>
  );

  // ─── Poignée aluminium brossé ──────────────────────────────────────────────
  const Handle = ({ cx, cy, vertical = false }) => {
    const hw = vertical ? 5 : 26;
    const hh = vertical ? 26 : 5;
    return (
      <g>
        <rect x={cx - hw / 2} y={cy - hh / 2} width={hw} height={hh} rx="2.5"
          fill="url(#gradHandle)" stroke="#888" strokeWidth="0.8" />
        {/* reflets */}
        {vertical
          ? <line x1={cx - 1} y1={cy - hh/2 + 3} x2={cx - 1} y2={cy + hh/2 - 3} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          : <line x1={cx - hw/2 + 3} y1={cy - 1} x2={cx + hw/2 - 3} y2={cy - 1} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        }
      </g>
    );
  };

  // ─── Bouton supprimer discret ─────────────────────────────────────────────
  const DelBtn = ({ x, y, onClick }) => (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle cx={x} cy={y} r="7" fill="#dc2626" opacity="0.88" />
      <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" pointerEvents="none">×</text>
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
      {/* ═══════════════════════════════════════════════════════════════════
          DEFS — gradients, filtres, textures
      ═══════════════════════════════════════════════════════════════════ */}
      <defs>
        {/* Fond page papier millimétré */}
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#c8d8e8" strokeWidth="0.3" />
        </pattern>
        <pattern id="gridBig" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#a0b8cc" strokeWidth="0.6" />
        </pattern>

        {/* Panneau melaminé face — grain horizontal léger */}
        <linearGradient id="gradPanel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#dfc48a" />
          <stop offset="18%"  stopColor="#e8d09a" />
          <stop offset="35%"  stopColor="#d9bb7a" />
          <stop offset="52%"  stopColor="#ebd8a2" />
          <stop offset="70%"  stopColor="#d4b26e" />
          <stop offset="85%"  stopColor="#e4cb90" />
          <stop offset="100%" stopColor="#cfaa68" />
        </linearGradient>

        {/* Panneau melaminé — variante légèrement plus claire pour traverses */}
        <linearGradient id="gradPanelH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#eedaa8" />
          <stop offset="40%"  stopColor="#e0c688" />
          <stop offset="100%" stopColor="#c9a86a" />
        </linearGradient>

        {/* Fond de caisson (panneau arrière) — plus foncé, aspect HDF */}
        <linearGradient id="gradBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#c4a05a" />
          <stop offset="50%"  stopColor="#b89050" />
          <stop offset="100%" stopColor="#a87e40" />
        </linearGradient>

        {/* Chant ABS — bande foncée sur le bord visible */}
        <linearGradient id="gradEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#7a5820" />
          <stop offset="40%"  stopColor="#9a7030" />
          <stop offset="100%" stopColor="#6a4810" />
        </linearGradient>
        <linearGradient id="gradEdgeH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7a5820" />
          <stop offset="100%" stopColor="#6a4810" />
        </linearGradient>

        {/* Tablette — grain bois */}
        <linearGradient id="gradShelf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d4a862" />
          <stop offset="30%"  stopColor="#c09050" />
          <stop offset="70%"  stopColor="#b88040" />
          <stop offset="100%" stopColor="#c89858" />
        </linearGradient>

        {/* Tiroir face */}
        <linearGradient id="gradDrawer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#eedaa8" />
          <stop offset="15%"  stopColor="#e8cf98" />
          <stop offset="80%"  stopColor="#d8b878" />
          <stop offset="100%" stopColor="#c8a860" />
        </linearGradient>

        {/* Porte battante — aspect melaminé brillant */}
        <linearGradient id="gradDoor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgba(240,225,185,0.92)" />
          <stop offset="50%"  stopColor="rgba(220,200,155,0.88)" />
          <stop offset="100%" stopColor="rgba(195,170,120,0.85)" />
        </linearGradient>

        {/* Porte coulissante — verre dépoli */}
        <linearGradient id="gradSliding" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(200,225,255,0.30)" />
          <stop offset="50%"  stopColor="rgba(220,240,255,0.50)" />
          <stop offset="100%" stopColor="rgba(190,215,250,0.25)" />
        </linearGradient>

        {/* Poignée aluminium brossé */}
        <linearGradient id="gradHandle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e0e0e0" />
          <stop offset="40%"  stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#909090" />
        </linearGradient>

        {/* Vis tête fraisée */}
        <radialGradient id="gradScrew" cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#d0d0d0" />
          <stop offset="60%"  stopColor="#909090" />
          <stop offset="100%" stopColor="#606060" />
        </radialGradient>

        {/* Tringle métal chromé */}
        <linearGradient id="gradRod" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8e8e8" />
          <stop offset="35%"  stopColor="#a0a0a0" />
          <stop offset="60%"  stopColor="#c8c8c8" />
          <stop offset="100%" stopColor="#888888" />
        </linearGradient>

        {/* Ombre portée sous tablette */}
        <filter id="shadowShelf" x="-5%" y="-20%" width="110%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#00000055" />
        </filter>
        {/* Ombre meuble */}
        <filter id="shadowCabinet" x="-3%" y="-2%" width="110%" height="110%">
          <feDropShadow dx="4" dy="6" stdDeviation="6" floodColor="#00000040" />
        </filter>

        {/* Flèches cotes */}
        <marker id="arrowDim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e04020" />
        </marker>
        <marker id="arrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          FOND PAGE — papier technique millimétré
      ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="#f0f4f8" />
      <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="url(#grid)" />
      <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="url(#gridBig)" />

      {/* Cadre de plan */}
      <rect x="8" y="8" width={DRAW_W - 16} height={DRAW_H - 16}
        fill="none" stroke="#94a3b8" strokeWidth="1" />
      <rect x="12" y="12" width={DRAW_W - 24} height={DRAW_H - 24}
        fill="none" stroke="#94a3b8" strokeWidth="0.4" />

      {/* Cartouche bas droit */}
      <rect x={DRAW_W - 200} y={DRAW_H - 38} width="188" height="26" fill="white" stroke="#94a3b8" strokeWidth="0.8" />
      <text x={DRAW_W - 106} y={DRAW_H - 22} textAnchor="middle" fill="#334155" fontSize="8" fontFamily="monospace">
        PANELCUT PRO · PLAN FAÇADE
      </text>
      <text x={DRAW_W - 106} y={DRAW_H - 13} textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">
        {`L=${draftState?.cabinetDims?.width||'?'} H=${draftState?.cabinetDims?.height||'?'} P=${draftState?.cabinetDims?.depth||'?'} cm`}
      </text>

      {/* ═══════════════════════════════════════════════════════════════════
          MEUBLE — ombre portée globale
      ═══════════════════════════════════════════════════════════════════ */}
      {layout.moduleRects.length > 0 && (
        <rect x={ox + 6} y={oy + 8} width={innerW} height={innerH - pl}
          fill="#00000022" rx="2" filter="url(#shadowCabinet)" />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CAISSON — fond HDF
      ═══════════════════════════════════════════════════════════════════ */}
      {layout.moduleRects.length > 0 && (
        <g>
          {/* Fond arrière */}
          <rect x={ox + th} y={oy + th} width={innerW - 2 * th} height={innerH - pl - th}
            fill="url(#gradBack)" />
          {/* Lignes de grain fond */}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i}
              x1={ox + th} y1={oy + th + (i + 1) * (innerH - pl - th) / 9}
              x2={ox + innerW - th} y2={oy + th + (i + 1) * (innerH - pl - th) / 9}
              stroke="#9a7838" strokeWidth="0.4" opacity="0.5" />
          ))}

          {/* Plinthe */}
          {pl > 0 && <>
            <rect x={ox + th * 1.5} y={oy + innerH - pl} width={innerW - th * 3} height={pl}
              fill="url(#gradPanel)" stroke="#8b6820" strokeWidth="1" />
            <rect x={ox + th * 1.5} y={oy + innerH - pl} width={innerW - th * 3} height="3"
              fill="url(#gradEdgeH)" />
          </>}

          {/* ── Montant GAUCHE ── */}
          <rect x={ox} y={oy} width={th} height={innerH - pl}
            fill="url(#gradPanel)" />
          {/* Chant ABS gauche (face visible latérale) */}
          <rect x={ox} y={oy} width="3" height={innerH - pl}
            fill="url(#gradEdge)" />
          {/* Reflet lumineux montant gauche */}
          <rect x={ox + th - 2} y={oy + 4} width="1.5" height={innerH - pl - 8}
            fill="rgba(255,255,255,0.25)" />
          {/* Vis montant gauche */}
          <Screw x={ox + th / 2} y={oy + 18} />
          <Screw x={ox + th / 2} y={oy + innerH - pl - 18} />

          {/* ── Montant DROIT ── */}
          <rect x={ox + innerW - th} y={oy} width={th} height={innerH - pl}
            fill="url(#gradPanel)" />
          {/* Chant ABS droit */}
          <rect x={ox + innerW - 3} y={oy} width="3" height={innerH - pl}
            fill="url(#gradEdge)" />
          {/* Reflet */}
          <rect x={ox + innerW - th} y={oy + 4} width="1.5" height={innerH - pl - 8}
            fill="rgba(255,255,255,0.25)" />
          <Screw x={ox + innerW - th / 2} y={oy + 18} />
          <Screw x={ox + innerW - th / 2} y={oy + innerH - pl - 18} />

          {/* ── Traverse HAUTE ── */}
          <rect x={ox} y={oy} width={innerW} height={th}
            fill="url(#gradPanelH)" />
          {/* Chant haut */}
          <rect x={ox} y={oy} width={innerW} height="3"
            fill="url(#gradEdgeH)" />
          {/* Reflet traverse haute */}
          <rect x={ox + 4} y={oy + th - 2} width={innerW - 8} height="1.5"
            fill="rgba(255,255,255,0.30)" />

          {/* ── Traverse BASSE ── */}
          <rect x={ox} y={oy + innerH - pl - th} width={innerW} height={th}
            fill="url(#gradPanelH)" />
          <rect x={ox} y={oy + innerH - pl - th} width={innerW} height="2"
            fill="url(#gradEdgeH)" />
        </g>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODULES
      ═══════════════════════════════════════════════════════════════════ */}
      {layout.moduleRects.map((mRect, mIdx) => {
        const md = moduleDetailsMap.get(String(mRect.id)) || { shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
        const selected = String(selectedModuleId) === String(mRect.id);

        const ix = mRect.x + th;
        const iw = Math.max(2, mRect.width - 2 * th);
        const iy = mRect.y + th;
        const ih = Math.max(2, mRect.height - 2 * th);

        const fmWidth = draftState?.facadeModules?.find((fm) => String(fm.id) === String(mRect.id))?.width || 0;

        return (
          <g key={mRect.id}>
            {/* Séparateur intermodule */}
            {mIdx > 0 && (
              <g>
                <rect x={mRect.x} y={mRect.y} width={th} height={mRect.height}
                  fill="url(#gradPanel)" stroke="#9a7030" strokeWidth="0.5" />
                <Screw x={mRect.x + th / 2} y={mRect.y + 18} />
                <Screw x={mRect.x + th / 2} y={mRect.y + mRect.height - 18} />
              </g>
            )}

            {/* Zone cliquable + surbrillance sélection */}
            <rect
              x={mRect.x} y={mRect.y} width={mRect.width} height={mRect.height}
              fill={selected ? 'rgba(249,115,22,0.10)' : 'transparent'}
              stroke={selected ? '#f97316' : 'none'}
              strokeWidth={selected ? 2 : 0}
              strokeDasharray={selected ? '6 3' : 'none'}
              onClick={() => onModuleClick?.(mRect.id)}
              style={{ cursor: 'pointer' }}
            />

            {/* Étiquette module — discret en bas */}
            <rect x={ix + iw / 2 - 14} y={mRect.bottom - 18} width="28" height="14" rx="3"
              fill="#1e293b" opacity="0.75" />
            <text x={ix + iw / 2} y={mRect.bottom - 7}
              textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="700" fontFamily="monospace">
              M{mRect.id}
            </text>

            {/* ── TRINGLES ── */}
            {(md.rods || []).map((r) => {
              const yCm = Number.isFinite(Number(r.y)) ? Number(r.y) : cabinetH * 0.85;
              const ry  = cmToSvgY(yCm, mRect);
              const isDragging = dragging?.itemId === r.id;
              return (
                <g key={r.id}>
                  {/* Zone drag */}
                  <rect x={ix} y={ry - 10} width={iw} height={20}
                    fill="transparent" style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'rods', r.id)} />
                  {/* Support gauche */}
                  <rect x={ix + 4} y={ry - 10} width="6" height="20" rx="2"
                    fill="#6b7280" stroke="#4b5563" strokeWidth="0.8" pointerEvents="none" />
                  {/* Support droit */}
                  <rect x={ix + iw - 10} y={ry - 10} width="6" height="20" rx="2"
                    fill="#6b7280" stroke="#4b5563" strokeWidth="0.8" pointerEvents="none" />
                  {/* Tube tringle */}
                  <line x1={ix + 10} x2={ix + iw - 10} y1={ry} y2={ry}
                    stroke="url(#gradRod)" strokeWidth="6" strokeLinecap="round"
                    filter={isDragging ? 'none' : 'url(#shadowShelf)'}
                    pointerEvents="none" />
                  {/* Reflet tube */}
                  <line x1={ix + 12} x2={ix + iw - 12} y1={ry - 1.5} y2={ry - 1.5}
                    stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"
                    pointerEvents="none" />
                  {isDragging && <line x1={ix} x2={ix + iw} y1={ry} y2={ry}
                    stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />}
                  <DelBtn x={ix + iw - 10} y={ry - 14}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'rods', r.id); }} />
                </g>
              );
            })}

            {/* ── TABLETTES ── */}
            {(md.shelves || []).map((s) => {
              const yCm = Number.isFinite(Number(s.y)) ? Number(s.y) : cabinetH / 2;
              const sy  = cmToSvgY(yCm, mRect);
              const shH = Math.max(4, th * 0.85);
              const isDragging = dragging?.itemId === s.id;
              return (
                <g key={s.id} filter={isDragging ? 'none' : 'url(#shadowShelf)'}>
                  {/* Zone drag */}
                  <rect x={ix} y={sy - shH - 6} width={iw} height={shH + 12}
                    fill="transparent" style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'shelves', s.id)} />
                  {/* Corps tablette */}
                  <rect x={ix} y={sy - shH} width={iw} height={shH}
                    fill="url(#gradShelf)" pointerEvents="none" />
                  {/* Chant avant tablette (ABS bois) */}
                  <rect x={ix} y={sy - shH} width={iw} height="3"
                    fill="url(#gradEdgeH)" pointerEvents="none" />
                  {/* Reflet surface */}
                  <rect x={ix + 2} y={sy - shH + 3} width={iw - 4} height="1.5"
                    fill="rgba(255,255,255,0.30)" pointerEvents="none" />
                  {/* Ligne de contact avec le fond */}
                  <line x1={ix} y1={sy} x2={ix + iw} y2={sy}
                    stroke="#7a5820" strokeWidth="0.5" opacity="0.5" pointerEvents="none" />
                  {isDragging && <line x1={mRect.x} x2={mRect.x + mRect.width} y1={sy - shH / 2} y2={sy - shH / 2}
                    stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />}
                  <DelBtn x={ix + iw - 8} y={sy - shH - 2}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'shelves', s.id); }} />
                </g>
              );
            })}

            {/* ── TIROIRS ── */}
            {(md.drawers || []).map((d) => {
              const yCm  = Number.isFinite(Number(d.y)) ? Number(d.y) : cabinetH * 0.3;
              const hCm  = Math.max(3, Number(d.height || 18));
              const topY = cmToSvgY(yCm + hCm, mRect);
              const dh   = Math.max(10, cmToSvgY(yCm, mRect) - topY);
              const isDragging = dragging?.itemId === d.id;
              return (
                <g key={d.id}>
                  <rect x={ix} y={topY - 6} width={iw} height={dh + 12}
                    fill="transparent" style={{ cursor: 'ns-resize' }}
                    onMouseDown={(e) => startDrag(e, mRect.id, 'drawers', d.id)} />
                  {/* Corps tiroir */}
                  <rect x={ix + 1} y={topY} width={iw - 2} height={dh}
                    fill="url(#gradDrawer)" stroke="#9a7030" strokeWidth="1" rx="1"
                    pointerEvents="none" />
                  {/* Chant haut tiroir */}
                  <rect x={ix + 1} y={topY} width={iw - 2} height="3"
                    fill="url(#gradEdgeH)" pointerEvents="none" />
                  {/* Chant bas tiroir */}
                  <rect x={ix + 1} y={topY + dh - 3} width={iw - 2} height="3"
                    fill="#9a7838" opacity="0.6" pointerEvents="none" />
                  {/* Rainure décorative */}
                  <line x1={ix + 4} y1={topY + dh * 0.35} x2={ix + iw - 4} y2={topY + dh * 0.35}
                    stroke="#b08040" strokeWidth="0.6" opacity="0.7" pointerEvents="none" />
                  <line x1={ix + 4} y1={topY + dh * 0.65} x2={ix + iw - 4} y2={topY + dh * 0.65}
                    stroke="#b08040" strokeWidth="0.6" opacity="0.7" pointerEvents="none" />
                  {/* Poignée alu centrée */}
                  <Handle cx={ix + iw / 2} cy={topY + dh / 2} />
                  {isDragging && <rect x={ix} y={topY} width={iw} height={dh}
                    fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" rx="1" pointerEvents="none" />}
                  <DelBtn x={ix + iw - 8} y={topY + 5}
                    onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'drawers', d.id); }} />
                </g>
              );
            })}

            {/* ── PORTES COULISSANTES ── */}
            {(md.slidingDoors || []).length > 0 && (
              <g>
                {/* Rail haut */}
                <rect x={ix} y={iy} width={iw} height="5" fill="#94a3b8" rx="1" />
                {/* Rail bas */}
                <rect x={ix} y={iy + ih - 5} width={iw} height="5" fill="#94a3b8" rx="1" />
                {/* Vantail 1 */}
                <rect x={ix + 2} y={iy + 5} width={iw * 0.52} height={ih - 10}
                  fill="url(#gradSliding)" stroke="#60a5fa" strokeWidth="1.2" />
                <rect x={ix + 4} y={iy + 7} width="1.5" height={ih - 14}
                  fill="rgba(255,255,255,0.5)" />
                <Handle cx={ix + iw * 0.52 - 10} cy={iy + ih / 2} vertical />
                {/* Vantail 2 */}
                <rect x={ix + iw * 0.46} y={iy + 5} width={iw * 0.52} height={ih - 10}
                  fill="url(#gradSliding)" stroke="#60a5fa" strokeWidth="1.2" opacity="0.85" />
                <Handle cx={ix + iw * 0.46 + 10} cy={iy + ih / 2} vertical />
                <DelBtn x={ix + iw - 8} y={iy + 8}
                  onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'slidingDoors', md.slidingDoors[0].id); }} />
              </g>
            )}

            {/* ── PORTES BATTANTES ── */}
            {(md.slidingDoors || []).length === 0 && (md.doors || []).map((d, idx) => {
              const count = Math.max(1, md.doors.length);
              const dw = iw / count;
              const dx = ix + idx * dw;
              const isLeft = idx === 0;
              return (
                <g key={d.id}>
                  {/* Corps porte */}
                  <rect x={dx + 1} y={iy + 1} width={dw - 2} height={ih - 2}
                    fill="url(#gradDoor)" stroke="#9a7830" strokeWidth="1.2" />
                  {/* Cadre intérieur (moulure) */}
                  <rect x={dx + 6} y={iy + 8} width={dw - 12} height={ih - 16}
                    fill="none" stroke="#b08840" strokeWidth="0.8" opacity="0.7" />
                  {/* Reflet */}
                  <rect x={dx + 3} y={iy + 3} width="2" height={ih - 6}
                    fill="rgba(255,255,255,0.22)" />
                  {/* Charnières */}
                  {[0.25, 0.75].map((frac, ci) => (
                    <g key={ci}>
                      <rect
                        x={isLeft ? dx + dw - 5 : dx}
                        y={iy + ih * frac - 6}
                        width="5" height="12" rx="1"
                        fill="#9ca3af" stroke="#6b7280" strokeWidth="0.6" />
                    </g>
                  ))}
                  {/* Poignée */}
                  <Handle
                    cx={isLeft ? dx + 10 : dx + dw - 10}
                    cy={iy + ih / 2}
                    vertical
                  />
                  {idx === 0 && (
                    <DelBtn x={ix + iw - 8} y={iy + 8}
                      onClick={(e) => { e.stopPropagation(); onRemoveObject?.(mRect.id, 'doors', d.id); }} />
                  )}
                </g>
              );
            })}

            {/* ── Cote largeur module (sous le meuble) ── */}
            <line x1={mRect.x + 2} y1={oy + innerH + 14} x2={mRect.x + mRect.width - 2} y2={oy + innerH + 14}
              stroke="#e04020" strokeWidth="0.8"
              markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
            <text x={mRect.x + mRect.width / 2} y={oy + innerH + 26}
              textAnchor="middle" fill="#e04020" fontSize="8" fontWeight="700" fontFamily="monospace">
              {fmWidth.toFixed(1)} cm
            </text>
          </g>
        );
      })}

      {/* ═══════════════════════════════════════════════════════════════════
          COTATIONS GÉNÉRALES
      ═══════════════════════════════════════════════════════════════════ */}
      {/* Cote largeur totale */}
      <line x1={ox} y1={oy - 30} x2={ox + innerW} y2={oy - 30}
        stroke="#e04020" strokeWidth="1"
        markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
      <line x1={ox} y1={oy - 36} x2={ox} y2={oy - 24} stroke="#e04020" strokeWidth="1" />
      <line x1={ox + innerW} y1={oy - 36} x2={ox + innerW} y2={oy - 24} stroke="#e04020" strokeWidth="1" />
      <rect x={ox + innerW / 2 - 22} y={oy - 42} width="44" height="14" rx="3" fill="white" stroke="#e04020" strokeWidth="0.8" />
      <text x={ox + innerW / 2} y={oy - 31} textAnchor="middle" fill="#e04020" fontSize="10" fontWeight="700" fontFamily="monospace">
        {draftState?.cabinetDims?.width || '?'} cm
      </text>

      {/* Cote hauteur totale */}
      <line x1={ox + innerW + 28} y1={oy} x2={ox + innerW + 28} y2={oy + innerH - pl}
        stroke="#e04020" strokeWidth="1"
        markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
      <line x1={ox + innerW + 22} y1={oy} x2={ox + innerW + 34} y2={oy} stroke="#e04020" strokeWidth="1" />
      <line x1={ox + innerW + 22} y1={oy + innerH - pl} x2={ox + innerW + 34} y2={oy + innerH - pl} stroke="#e04020" strokeWidth="1" />
      <rect x={ox + innerW + 32} y={oy + (innerH - pl) / 2 - 7} width="44" height="14" rx="3" fill="white" stroke="#e04020" strokeWidth="0.8" />
      <text x={ox + innerW + 54} y={oy + (innerH - pl) / 2 + 4} textAnchor="middle" fill="#e04020" fontSize="10" fontWeight="700" fontFamily="monospace">
        {draftState?.cabinetDims?.height || '?'} cm
      </text>

      {/* ═══════════════════════════════════════════════════════════════════
          ANNOTATIONS LIBRES
      ═══════════════════════════════════════════════════════════════════ */}
      {(draftState?.facadeItems || []).map((a) => {
        const sel = selectedAnnotationId === a.id;
        if (a.type === 'dim') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={sel ? '#f97316' : '#e04020'} strokeWidth={sel ? 2 : 1.5}
              markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
            <rect x={(a.x1+a.x2)/2-24} y={(a.y1+a.y2)/2-9} width="48" height="14" rx="4"
              fill="white" stroke={sel ? '#f97316' : '#e04020'} strokeWidth="0.8" />
            <text x={(a.x1+a.x2)/2} y={(a.y1+a.y2)/2+2} textAnchor="middle"
              fill={sel ? '#f97316' : '#e04020'} fontSize="9" fontWeight="700" fontFamily="monospace">
              {a.label || 'cote'}
            </text>
          </g>
        );
        if (a.type === 'arrow') return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke="#dc2626" strokeWidth={sel ? 2 : 1.5} markerEnd="url(#arrowRed)" />
            {a.label && <text x={a.x2 + 5} y={a.y2 - 4} fill="#dc2626" fontSize="9" fontWeight="700" fontFamily="monospace">{a.label}</text>}
          </g>
        );
        return (
          <g key={a.id} onClick={() => onAnnotationClick?.(a.id)} style={{ cursor: 'pointer' }}>
            <rect x={a.x1 - 40} y={a.y1 - 12} width="80" height="18" rx="6"
              fill="white" stroke={sel ? '#f97316' : '#0891b2'} strokeWidth="1" />
            <text x={a.x1} y={a.y1 + 2} textAnchor="middle" fill="#0e7490"
              fontSize="9" fontWeight="700" fontFamily="monospace">
              {a.label || 'note'}
            </text>
          </g>
        );
      })}

      {/* Preview tracé cote en cours */}
      {dragPreview && (
        <line x1={dragPreview.x1} y1={dragPreview.y1} x2={dragPreview.x2} y2={dragPreview.y2}
          stroke={dragPreview.type === 'dim' ? '#f97316' : '#dc2626'}
          strokeWidth="1.5" strokeDasharray="5 3" />
      )}
    </svg>
  );
}
