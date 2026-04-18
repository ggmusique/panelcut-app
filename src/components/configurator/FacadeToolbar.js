import React from 'react';

const TOOLS = [
  { id: 'select', label: '👆 Sélection' },
  null,
  { id: 'shelf',  label: '─── Étagère' },
  { id: 'rod',    label: '👔 Tringle' },
  { id: 'drawer', label: '🗄 Tiroir' },
  null,
  { id: 'cote',   label: '📏 Cote' },
  null,
  { id: 'eraser', label: '◻ Gomme' },
];

export default function FacadeToolbar({ activeTool, onChange }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-slate-900 border-b border-white/10 flex-shrink-0 flex-wrap">
      {TOOLS.map((tool, i) =>
        tool === null
          ? <span key={`sep-${i}`} className="text-slate-600 select-none mx-1">|</span>
          : (
            <button
              key={tool.id}
              onClick={() => onChange(tool.id)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                activeTool === tool.id
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {tool.label}
            </button>
          )
      )}
    </div>
  );
}
