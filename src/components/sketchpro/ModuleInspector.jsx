import React from 'react';

export default function ModuleInspector({ draftState, selectedModuleId, setSelectedModuleId, setModuleWidth }) {
  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
      <h3 className="text-sm font-semibold text-slate-100 mb-2">Modules</h3>
      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {(draftState.facadeModules || []).map((m) => (
          <div key={m.id} className={`rounded-xl border p-2 ${String(m.id) === String(selectedModuleId) ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
            <button onClick={() => setSelectedModuleId(m.id)} className="text-xs font-medium text-left w-full text-slate-100">Module {m.id}</button>
            <label className="text-[11px] text-slate-300 mt-1 block">Largeur
              <input
                value={m.width}
                onChange={(e) => setModuleWidth(m.id, e.target.value)}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs"
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
