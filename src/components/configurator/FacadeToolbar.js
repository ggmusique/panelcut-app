const TOOLS = [
  { id: 'select', label: '↖ Sélection' },
  null,
  { id: 'shelf', label: '─── Étagère' },
  { id: 'rod', label: '| Tringle' },
  { id: 'drawer', label: '▭ Tiroir' },
  null,
  { id: 'dim', label: '📏 Cote' },
  null,
  { id: 'erase', label: '◻ Gomme' },
];

export default function FacadeToolbar({ activeTool, onToolChange }) {
  return (
    <div className="bg-slate-900 border-b border-white/10 px-3 py-2 flex items-center gap-1">
      {TOOLS.map((tool, idx) => {
        if (tool === null) return <div key={`sep-${idx}`} className="w-px h-5 bg-white/10 mx-1" />;
        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange?.(tool.id)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              active
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}
