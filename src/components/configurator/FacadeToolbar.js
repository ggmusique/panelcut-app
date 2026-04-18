const TOOLS = [
  { id: 'select', icon: '👆', label: 'Sélection', tone: 'slate' },
  null,
  { id: 'shelf', icon: '───', label: 'Étagère', tone: 'wood' },
  { id: 'rod', icon: '👔', label: 'Tringle', tone: 'metal' },
  { id: 'drawer', icon: '🗄', label: 'Tiroir', tone: 'wood' },
  null,
  { id: 'dim', icon: '📏', label: 'Cote', tone: 'cyan' },
  null,
  { id: 'erase', icon: '◻', label: 'Gomme', tone: 'red' },
];

const toneClass = {
  slate: 'text-slate-300',
  wood: 'text-amber-200',
  metal: 'text-indigo-200',
  cyan: 'text-cyan-200',
  red: 'text-rose-200',
};

export default function FacadeToolbar({ activeTool, onToolChange }) {
  return (
    <div className="bg-slate-900 border-b border-white/10 px-3 py-2 flex items-center gap-1 overflow-x-auto">
      {TOOLS.map((tool, idx) => {
        if (tool === null) {
          return <div key={`sep-${idx}`} className="w-px h-5 bg-white/10 mx-1 shrink-0" />;
        }

        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToolChange?.(tool.id)}
            title={tool.label}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all duration-150 border shrink-0 ${
              active
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.15)]'
                : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={`mr-1 ${active ? 'text-orange-300' : toneClass[tool.tone] || ''}`}>{tool.icon}</span>
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}
