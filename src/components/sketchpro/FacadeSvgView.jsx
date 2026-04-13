import React, { useMemo, useRef, useState } from 'react';
import { buildFacadeLayout } from './utils';

const DRAW_W = 860;
const DRAW_H = 450;
const PAD = 60;

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
  zoom = 1,
  pan = { x: 0, y: 0 },
  image,
}) {
  const svgRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);

  const layout = useMemo(
    () => buildFacadeLayout(draftState?.facadeModules || [], draftState?.cabinetDims || {}, DRAW_W, DRAW_H, PAD),
    [draftState?.facadeModules, draftState?.cabinetDims]
  );

  const moduleDetailsMap = useMemo(() => {
    const map = new Map();
    (draftState?.moduleDetails || []).forEach((d) => map.set(String(d.moduleId), d));
    return map;
  }, [draftState?.moduleDetails]);

  const getLocalPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / Math.max(0.0001, zoom);
    const y = (e.clientY - rect.top - pan.y) / Math.max(0.0001, zoom);
    return { x, y };
  };

  const findModuleAtPoint = (x, y) => layout.moduleRects.find((m) => x >= m.x && x <= m.x + m.width && y >= m.y && y <= m.y + m.height);

  const handleMouseDown = (e) => {
    const p = getLocalPoint(e);
    if (tool === 'dimension' || tool === 'arrow') {
      setDragPreview({ type: tool === 'dimension' ? 'dim' : 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }

    const objectTools = ['shelf', 'drawer', 'rod', 'door', 'sliding_door'];
    if (objectTools.includes(tool)) {
      const m = findModuleAtPoint(p.x, p.y);
      if (!m) return;
      const yPercent = ((p.y - m.y) / Math.max(1, m.height)) * 100;
      onAddObject?.(m.id, tool, Math.max(0, Math.min(100, yPercent)));
    }

    if (tool === 'note') {
      const text = window.prompt('Note', 'Note') || 'Note';
      onAddAnnotation?.('note', p.x, p.y, p.x, p.y, text);
    }
  };

  const handleMouseMove = (e) => {
    if (!dragPreview) return;
    const p = getLocalPoint(e);
    setDragPreview((prev) => ({ ...prev, x2: p.x, y2: p.y }));
  };

  const handleMouseUp = (e) => {
    if (!dragPreview) return;
    const p = getLocalPoint(e);
    onAddAnnotation?.(dragPreview.type, dragPreview.x1, dragPreview.y1, p.x, p.y, '');
    setDragPreview(null);
  };

  const cursor = tool === 'erase'
    ? 'not-allowed'
    : (tool === 'select' ? 'default' : 'crosshair');

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${DRAW_W} ${DRAW_H}`}
      className="w-full h-full"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor }}
    >
      <rect x="0" y="0" width={DRAW_W} height={DRAW_H} fill="#f8fafc" />

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        {image && (
          <image href={image} x="0" y="0" width={DRAW_W} height={DRAW_H} preserveAspectRatio="xMidYMid slice" opacity="0.25" />
        )}

        <rect x={layout.ox} y={layout.oy} width={layout.innerW} height={layout.innerH} fill="#f3ead8" stroke="#8b6914" strokeWidth="2.5" />
        <rect
          x={layout.ox}
          y={layout.oy + layout.innerH - layout.plinthPx}
          width={layout.innerW}
          height={layout.plinthPx}
          fill="#c8b07c"
          stroke="#8b6914"
          strokeWidth="1.5"
        />

        {layout.moduleRects.map((mRect) => {
          const md = moduleDetailsMap.get(String(mRect.id)) || { shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
          const selected = String(selectedModuleId) === String(mRect.id);

          const moduleTop = mRect.y;
          const moduleBottom = mRect.bottom;
          const interiorH = Math.max(1, moduleBottom - moduleTop);
          const cabinetInteriorCm = Math.max(1, Number(draftState?.cabinetDims?.height || 0) - Number(draftState?.cabinetDims?.plinth || 0));
          const autoRodY = layout.cmToY(cabinetInteriorCm * 0.88);

          return (
            <g key={mRect.id} onClick={() => onModuleClick?.(mRect.id)} style={{ cursor: 'pointer' }}>
              <rect x={mRect.x} y={mRect.y} width={mRect.width} height={mRect.height} fill="rgba(255,255,255,0.05)" stroke="#8b6914" strokeWidth="1" />
              {selected && (
                <rect x={mRect.x} y={mRect.y} width={mRect.width} height={mRect.height} fill="rgba(249,115,22,0.10)" stroke="#f97316" strokeWidth={2} />
              )}

              {(md.rods || []).map((r) => {
                const ry = Number.isFinite(Number(r.y)) ? layout.cmToY(Number(r.y)) : autoRodY;
                const active = selectedItemId === r.id;
                return (
                  <g key={r.id} onClick={(e) => { e.stopPropagation(); onItemClick?.(mRect.id, 'rod', r.id); }}>
                    <line x1={mRect.x + 10} x2={mRect.x + mRect.width - 10} y1={ry} y2={ry} stroke={active ? '#f97316' : '#4b5563'} strokeWidth="5" strokeLinecap="round" />
                    <circle cx={mRect.x + 10} cy={ry} r="3" fill="#6b7280" />
                    <circle cx={mRect.x + mRect.width - 10} cy={ry} r="3" fill="#6b7280" />
                    <circle cx={mRect.x + mRect.width / 2} cy={ry} r="2" fill="#d1d5db" />
                  </g>
                );
              })}

              {(md.shelves || []).map((s) => {
                const sy = layout.cmToY(Number(s.y || 0));
                const active = selectedItemId === s.id;
                return (
                  <rect
                    key={s.id}
                    x={mRect.x + 3}
                    y={sy - 2}
                    width={mRect.width - 6}
                    height="4"
                    fill="#9ca3af"
                    stroke={active ? '#f97316' : '#6b7280'}
                    strokeWidth={active ? 1.6 : 0.8}
                    onClick={(e) => { e.stopPropagation(); onItemClick?.(mRect.id, 'shelf', s.id); }}
                  />
                );
              })}

              {(md.drawers || []).map((d) => {
                const yCm = Number.isFinite(Number(d.y)) ? Number(d.y) : cabinetInteriorCm * 0.35;
                const hCm = Math.max(5, Number(d.height || 18));
                const topY = layout.cmToY(yCm + hCm);
                const bottomY = layout.cmToY(yCm);
                const dh = Math.max(10, bottomY - topY);
                const active = selectedItemId === d.id;
                return (
                  <g key={d.id} onClick={(e) => { e.stopPropagation(); onItemClick?.(mRect.id, 'drawer', d.id); }}>
                    <rect x={mRect.x + 4} y={topY} width={mRect.width - 8} height={dh} fill="#f5ede0" stroke={active ? '#f97316' : '#8b6914'} strokeWidth={active ? 1.8 : 1} rx="2" />
                    <ellipse cx={mRect.x + mRect.width / 2} cy={topY + dh / 2} rx="12" ry="4" fill="#9ca3af" />
                  </g>
                );
              })}

              {(md.slidingDoors || []).length > 0 && (
                <g onClick={(e) => { e.stopPropagation(); onItemClick?.(mRect.id, 'slidingDoor', md.slidingDoors[0].id); }}>
                  <line x1={mRect.x + 5} y1={moduleTop + 8} x2={mRect.x + mRect.width - 5} y2={moduleTop + 8} stroke="#60a5fa" strokeWidth="1.5" />
                  <line x1={mRect.x + 5} y1={moduleBottom - 8} x2={mRect.x + mRect.width - 5} y2={moduleBottom - 8} stroke="#60a5fa" strokeWidth="1.5" />
                  <rect x={mRect.x + 8} y={moduleTop + 12} width={mRect.width * 0.55} height={interiorH - 24} fill="rgba(147,197,253,0.2)" stroke="#60a5fa" />
                  <rect x={mRect.x + mRect.width * 0.38} y={moduleTop + 12} width={mRect.width * 0.55} height={interiorH - 24} fill="rgba(147,197,253,0.3)" stroke="#3b82f6" />
                </g>
              )}

              {(md.slidingDoors || []).length === 0 && (md.doors || []).map((d, idx) => {
                const count = Math.max(1, md.doors.length);
                const dw = mRect.width / count;
                const dx = mRect.x + idx * dw;
                const active = selectedItemId === d.id;
                const handleX = idx === 0 ? dx + dw - 10 : dx + 7;
                return (
                  <g key={d.id} onClick={(e) => { e.stopPropagation(); onItemClick?.(mRect.id, 'door', d.id); }}>
                    <rect x={dx + 2} y={moduleTop + 3} width={dw - 4} height={interiorH - 6} fill="rgba(229,231,235,0.45)" stroke={active ? '#f97316' : '#8b6914'} strokeWidth={active ? 1.8 : 1.2} />
                    <rect x={handleX} y={moduleTop + interiorH / 2 - 10} width="4" height="20" fill="#6b7280" rx="2" />
                  </g>
                );
              })}

              <circle cx={mRect.x + mRect.width / 2} cy={moduleTop + 24} r="14" fill="none" stroke="#ef4444" strokeWidth="2" />
              <text x={mRect.x + mRect.width / 2} y={moduleTop + 29} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="700">{mRect.id}</text>

              <line x1={mRect.x} y1={layout.oy + layout.innerH + 12} x2={mRect.x + mRect.width} y2={layout.oy + layout.innerH + 12} stroke="#ef4444" strokeWidth="1" />
              <text x={mRect.x + mRect.width / 2} y={layout.oy + layout.innerH + 25} textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="700">
                {(draftState?.facadeModules?.find((fm) => String(fm.id) === String(mRect.id))?.width || 0).toFixed?.(1) || 0} cm
              </text>
            </g>
          );
        })}

        {(draftState?.facadeItems || []).map((a) => {
          const selected = selectedAnnotationId === a.id;
          if (a.type === 'dim') {
            return (
              <g key={a.id} onClick={() => onAnnotationClick?.(a.id)}>
                <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#f97316" strokeWidth={selected ? 2.6 : 1.8} markerStart="url(#annArrowOrange)" markerEnd="url(#annArrowOrange)" />
                <rect x={(a.x1 + a.x2) / 2 - 28} y={(a.y1 + a.y2) / 2 - 16} width="56" height="16" rx="4" fill="#0f172a" stroke="#f97316" />
                <text x={(a.x1 + a.x2) / 2} y={(a.y1 + a.y2) / 2 - 4} textAnchor="middle" fill="#f97316" fontSize="10" fontWeight="700">{a.label || 'cote'}</text>
              </g>
            );
          }
          if (a.type === 'arrow') {
            return (
              <g key={a.id} onClick={() => onAnnotationClick?.(a.id)}>
                <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#ef4444" strokeWidth={selected ? 2.6 : 2} markerEnd="url(#annArrowRed)" />
                {a.label && <text x={a.x2 + 4} y={a.y2 - 4} fill="#ef4444" fontSize="10" fontWeight="700">{a.label}</text>}
              </g>
            );
          }
          return (
            <g key={a.id} onClick={() => onAnnotationClick?.(a.id)}>
              <rect x={a.x1 - 42} y={a.y1 - 14} width="84" height="22" rx="8" fill="rgba(255,255,255,0.88)" stroke={selected ? '#f97316' : '#22d3ee'} />
              <text x={a.x1} y={a.y1 + 1} textAnchor="middle" fill="#0891b2" fontSize="10" fontWeight="700">{a.label || 'note'}</text>
            </g>
          );
        })}

        <line x1={layout.ox} y1={layout.oy - 28} x2={layout.ox + layout.innerW} y2={layout.oy - 28} stroke="#ef4444" strokeWidth="1.5" />
        <line x1={layout.ox} y1={layout.oy - 34} x2={layout.ox} y2={layout.oy - 22} stroke="#ef4444" strokeWidth="1.5" />
        <line x1={layout.ox + layout.innerW} y1={layout.oy - 34} x2={layout.ox + layout.innerW} y2={layout.oy - 22} stroke="#ef4444" strokeWidth="1.5" />
        <text x={layout.ox + layout.innerW / 2} y={layout.oy - 31} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="700">{draftState?.cabinetDims?.width || '?'} cm</text>

        <line x1={layout.ox + layout.innerW + 24} y1={layout.oy} x2={layout.ox + layout.innerW + 24} y2={layout.oy + layout.innerH} stroke="#ef4444" strokeWidth="1.5" />
        <text
          x={layout.ox + layout.innerW + 36}
          y={layout.oy + layout.innerH / 2}
          transform={`rotate(90 ${layout.ox + layout.innerW + 36} ${layout.oy + layout.innerH / 2})`}
          textAnchor="middle"
          fill="#ef4444"
          fontSize="12"
          fontWeight="700"
        >
          {draftState?.cabinetDims?.height || '?'} cm
        </text>

        {dragPreview && (
          <line x1={dragPreview.x1} y1={dragPreview.y1} x2={dragPreview.x2} y2={dragPreview.y2} stroke={dragPreview.type === 'dim' ? '#f97316' : '#ef4444'} strokeWidth="2" strokeDasharray="4 3" />
        )}
      </g>

      <defs>
        <marker id="annArrowOrange" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
        </marker>
        <marker id="annArrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}
