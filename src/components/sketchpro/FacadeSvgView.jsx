import React, { useMemo } from 'react';
import { fromPercentY, layoutModulesPx } from './utils';

export default function FacadeSvgView({
  width = 1100,
  height = 700,
  draftState,
  selectedModuleId,
  selectedAnnotationId,
  onSelectModule,
  onSelectAnnotation,
}) {
  const modulesPx = useMemo(() => layoutModulesPx(draftState.facadeModules, width, 50, 50), [draftState.facadeModules, width]);
  const top = 58;
  const bottom = 60;
  const innerH = height - top - bottom;

  const moduleDetailMap = useMemo(() => {
    const map = new Map();
    (draftState.moduleDetails || []).forEach((d) => map.set(String(d.moduleId), d));
    return map;
  }, [draftState.moduleDetails]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 pointer-events-auto">
      <rect x="50" y={top} width={width - 100} height={innerH} fill="rgba(250,245,235,0.85)" stroke="#8b6914" strokeWidth="2" rx="8" />
      {modulesPx.map((m) => {
        const md = moduleDetailMap.get(String(m.id)) || { shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
        const isSelected = String(selectedModuleId) === String(m.id);
        return (
          <g key={m.id}>
            <rect
              x={m.x}
              y={top}
              width={m.width}
              height={innerH}
              fill={isSelected ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)'}
              stroke={isSelected ? '#fb923c' : '#7c5a25'}
              strokeWidth={isSelected ? 2 : 1}
              onClick={() => onSelectModule?.(m.id)}
            />

            {(md.shelves || []).map((s) => {
              const y = fromPercentY(Number(s.y || 50), top, innerH);
              return <line key={s.id} x1={m.x + 4} x2={m.x + m.width - 4} y1={y} y2={y} stroke="#10b981" strokeWidth="3" />;
            })}

            {(md.rods || []).map((r) => {
              const y = fromPercentY(Number(r.y || 50), top, innerH);
              return <line key={r.id} x1={m.x + 12} x2={m.x + m.width - 12} y1={y} y2={y} stroke="#ec4899" strokeWidth="4" strokeLinecap="round" />;
            })}

            {(md.drawers || []).map((d) => {
              const y = fromPercentY(Number(d.y || 40), top, innerH);
              const h = Math.max(14, (Number(d.height || 18) / 220) * innerH);
              return (
                <g key={d.id}>
                  <rect x={m.x + 6} y={y - h / 2} width={Math.max(16, m.width - 12)} height={h} fill="#f5deb3" stroke="#9a7b3f" strokeWidth="1" rx="3" />
                  <rect x={m.x + m.width / 2 - 12} y={y - 3} width="24" height="6" fill="#6b7280" rx="3" />
                </g>
              );
            })}

            {(md.doors || []).map((d, idx) => {
              const doorCount = Math.max(1, md.doors.length);
              const dw = m.width / doorCount;
              const dx = m.x + idx * dw;
              return <rect key={d.id} x={dx + 2} y={top + 2} width={dw - 4} height={innerH - 4} fill="rgba(191,219,254,0.12)" stroke="#60a5fa" strokeWidth="1" />;
            })}

            {(md.slidingDoors || []).map((d, idx) => {
              const dw = Math.max(24, m.width * 0.58);
              const dx = idx % 2 === 0 ? m.x + 4 : m.x + m.width - dw - 4;
              return <rect key={d.id} x={dx} y={top + 8} width={dw} height={innerH - 16} fill="rgba(147,197,253,0.25)" stroke="#3b82f6" strokeWidth="1.3" />;
            })}
          </g>
        );
      })}

      {(draftState.facadeItems || []).map((a) => {
        const selected = selectedAnnotationId === a.id;
        if (a.type === 'dim' || a.type === 'arrow') {
          return (
            <g key={a.id} onClick={() => onSelectAnnotation?.(a.id)}>
              <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.type === 'arrow' ? '#ef4444' : '#f97316'} strokeWidth={selected ? 3 : 2} markerEnd={a.type === 'arrow' ? 'url(#spArrowHead)' : undefined} />
              <text x={(a.x1 + a.x2) / 2} y={(a.y1 + a.y2) / 2 - 6} textAnchor="middle" fill="#fb923c" fontSize="11" fontWeight="700">{a.label || a.type}</text>
            </g>
          );
        }
        return (
          <g key={a.id} onClick={() => onSelectAnnotation?.(a.id)}>
            <rect x={(a.x1 || 0) - 34} y={(a.y1 || 0) - 14} width="68" height="20" rx="8" fill="rgba(15,23,42,0.95)" stroke={selected ? '#f97316' : '#22d3ee'} />
            <text x={a.x1} y={a.y1} textAnchor="middle" fill="#22d3ee" fontSize="11" fontWeight="600">{a.label || 'note'}</text>
          </g>
        );
      })}

      <line x1="50" y1="28" x2={width - 50} y2="28" stroke="#ef4444" strokeWidth="1.4" />
      <text x={width / 2} y="22" textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="700">{draftState.cabinetDims.width || '?'} cm</text>
      <line x1={width - 24} y1={top} x2={width - 24} y2={height - bottom} stroke="#ef4444" strokeWidth="1.4" />
      <text x={width - 10} y={height / 2} transform={`rotate(90 ${width - 10} ${height / 2})`} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="700">{draftState.cabinetDims.height || '?'} cm</text>

      <defs>
        <marker id="spArrowHead" markerWidth="9" markerHeight="6" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}
