import React from 'react';

const typeColor = {
  dim: '#f97316',
  note: '#22d3ee',
  arrow: '#ef4444',
  shelf: '#34d399',
  drawer: '#f59e0b',
  rod: '#f472b6',
  door: '#60a5fa',
  sliding_door: '#93c5fd',
};

export default function AnnotationLayer({ annotations, selectedId, onSelect, onDoubleClickLabel }) {
  return (
    <g>
      {annotations.map((a) => {
        const color = typeColor[a.type] || '#e2e8f0';
        const selected = selectedId === a.id;
        if (a.type === 'dim' || a.type === 'arrow') {
          return (
            <g key={a.id} onClick={() => onSelect(a.id)} onDoubleClick={() => onDoubleClickLabel(a)} style={{ cursor: 'pointer' }}>
              <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={color} strokeWidth={selected ? 3 : 2} markerEnd={a.type === 'arrow' ? 'url(#arrowHead)' : undefined} />
              <circle cx={a.x1} cy={a.y1} r="3" fill={color} />
              <circle cx={a.x2} cy={a.y2} r="3" fill={color} />
              <rect x={(a.x1 + a.x2) / 2 - 34} y={(a.y1 + a.y2) / 2 - 18} width="68" height="18" rx="6" fill="#0f1620" stroke={color} />
              <text x={(a.x1 + a.x2) / 2} y={(a.y1 + a.y2) / 2 - 5} textAnchor="middle" fill={color} fontSize="11" fontWeight="700">{a.label || a.type}</text>
            </g>
          );
        }
        return (
          <g key={a.id} onClick={() => onSelect(a.id)} onDoubleClick={() => onDoubleClickLabel(a)} style={{ cursor: 'pointer' }}>
            <rect x={a.x1 - 40} y={a.y1 - 15} width="80" height="22" rx="8" fill="#111827" stroke={color} strokeWidth={selected ? 2 : 1} />
            <text x={a.x1} y={a.y1} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">{a.label || a.type}</text>
          </g>
        );
      })}
      <defs>
        <marker id="arrowHead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
      </defs>
    </g>
  );
}
