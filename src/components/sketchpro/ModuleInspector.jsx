import React, { useState } from 'react';

export default function ModuleInspector({ draftState, selectedModuleId, setSelectedModuleId, setModuleWidth, setCabinetDim }) {
  const [localWidths, setLocalWidths] = useState({});
  const [localDims, setLocalDims] = useState({});

  const handleWidthChange = (id, val) => setLocalWidths((p) => ({ ...p, [id]: val }));
  const handleWidthBlur = (id) => {
    const raw = localWidths[id];
    if (raw === undefined) return;
    const n = parseFloat(raw.replace(',', '.'));
    if (!isNaN(n) && n > 0) setModuleWidth(id, n);
    setLocalWidths((p) => { const nx = { ...p }; delete nx[id]; return nx; });
  };

  const handleDimChange = (key, val) => setLocalDims((p) => ({ ...p, [key]: val }));
  const handleDimBlur = (key) => {
    const raw = localDims[key];
    if (raw === undefined) return;
    const n = parseFloat(String(raw).replace(',', '.'));
    if (!isNaN(n) && n > 0) setCabinetDim?.(key, n);
    setLocalDims((p) => { const nx = { ...p }; delete nx[key]; return nx; });
  };

  const dims = draftState?.cabinetDims || {};
  const depthVal = localDims.depth !== undefined ? localDims.depth : (dims.depth ?? '');

  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Modules</h3>

      {/* Champ profondeur global */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-2">
        <label className="text-[11px] text-slate-300 block">Profondeur meuble (cm)
          <input
            type="text"
            inputMode="decimal"
            value={depthVal}
            onChange={(e) => handleDimChange('depth', e.target.value)}
            onBlur={() => handleDimBlur('depth')}
            placeholder="ex: 58"
            className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
          />
        </label>
      </div>

      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {(draftState.facadeModules || []).map((m) => {
          const displayVal = localWidths[m.id] !== undefined ? localWidths[m.id] : m.width;
          return (
            <div key={m.id} className={`rounded-xl border p-2 ${
              String(m.id) === String(selectedModuleId)
                ? 'border-orange-500/50 bg-orange-500/10'
                : 'border-slate-700 bg-slate-900/40'
            }`}>
              <button onClick={() => setSelectedModuleId(m.id)} className="text-xs font-medium text-left w-full text-slate-100">
                Module {m.id}
              </button>
              <label className="text-[11px] text-slate-300 mt-1 block">Largeur (cm)
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayVal}
                  onChange={(e) => handleWidthChange(m.id, e.target.value)}
                  onBlur={() => handleWidthBlur(m.id)}
                  className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
