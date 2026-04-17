import React, { useState } from 'react';

export default function ModuleInspector({ draftState, selectedModuleId, setSelectedModuleId, setModuleWidth }) {
  // localWidths garde la valeur brute (string) pendant la frappe pour autoriser le point décimal
  const [localWidths, setLocalWidths] = useState({});

  const handleChange = (id, val) => {
    setLocalWidths((prev) => ({ ...prev, [id]: val }));
  };

  const handleBlur = (id) => {
    const raw = localWidths[id];
    if (raw === undefined) return;
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) setModuleWidth(id, n);
    setLocalWidths((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };

  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
      <h3 className="text-sm font-semibold text-slate-100 mb-2">Modules</h3>
      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {(draftState.facadeModules || []).map((m) => {
          const displayVal = localWidths[m.id] !== undefined ? localWidths[m.id] : m.width;
          return (
            <div key={m.id} className={`rounded-xl border p-2 ${String(m.id) === String(selectedModuleId) ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
              <button onClick={() => setSelectedModuleId(m.id)} className="text-xs font-medium text-left w-full text-slate-100">Module {m.id}</button>
              <label className="text-[11px] text-slate-300 mt-1 block">Largeur (cm)
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={displayVal}
                  onChange={(e) => handleChange(m.id, e.target.value)}
                  onBlur={() => handleBlur(m.id)}
                  className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs"
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
