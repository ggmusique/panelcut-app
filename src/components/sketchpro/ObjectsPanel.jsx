import React from 'react';
import { Trash2 } from 'lucide-react';

const CONFIG = [
  ['shelves', 'Tablettes', 'y'],
  ['drawers', 'Tiroirs', 'y'],
  ['rods', 'Tringles', 'y'],
  ['doors', 'Portes battantes', 'kind'],
  ['slidingDoors', 'Portes coulissantes', 'kind'],
];

export default function ObjectsPanel({ selectedModuleDetail, selectedModuleId, updateModuleObject, removeModuleObject }) {
  if (!selectedModuleDetail || !selectedModuleId) {
    return (
      <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 text-xs text-slate-500">
        Sélectionnez un module pour éditer ses objets.
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Objets du module {selectedModuleId}</h3>
      {CONFIG.map(([key, label, field]) => (
        <div key={key} className="space-y-1">
          <p className="text-xs text-slate-300">{label}</p>
          {(selectedModuleDetail[key] || []).map((obj) => (
            <div key={obj.id} className="rounded-lg bg-slate-950/70 border border-slate-700 px-2 py-1 flex items-center gap-2">
              {field === 'y' ? (
                <input
                  value={obj.y}
                  onChange={(e) => updateModuleObject(selectedModuleId, key, obj.id, { y: Number(e.target.value) })}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                />
              ) : (
                <select
                  value={obj.kind || 'single'}
                  onChange={(e) => updateModuleObject(selectedModuleId, key, obj.id, { kind: e.target.value })}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                >
                  <option value="single">simple</option>
                  <option value="double">double</option>
                </select>
              )}
              {key === 'drawers' && (
                <input
                  value={obj.height}
                  onChange={(e) => updateModuleObject(selectedModuleId, key, obj.id, { height: Number(e.target.value) })}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                />
              )}
              <button onClick={() => removeModuleObject(selectedModuleId, key, obj.id)} className="ml-auto text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          {(selectedModuleDetail[key] || []).length === 0 && <p className="text-[11px] text-slate-500">Aucun élément</p>}
        </div>
      ))}
    </section>
  );
}
