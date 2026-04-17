import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const CONFIG = [
  ['shelves',      'Tablettes',           'y'],
  ['drawers',      'Tiroirs',             'y'],
  ['rods',         'Tringles',            'y'],
  ['doors',        'Portes battantes',    'kind'],
  ['slidingDoors', 'Portes coulissantes', 'kind'],
];

export default function ObjectsPanel({ selectedModuleDetail, selectedModuleId, updateModuleObject, removeModuleObject }) {
  // localY garde la valeur brute pendant la frappe (pour autoriser le point décimal)
  const [localY, setLocalY] = useState({});

  if (!selectedModuleDetail || !selectedModuleId) {
    return (
      <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 text-xs text-slate-500">
        Sélectionnez un module pour éditer ses objets.
      </section>
    );
  }

  const handleYChange = (key, id, val) => setLocalY((p) => ({ ...p, [`${key}-${id}`]: val }));
  const handleYBlur  = (key, id) => {
    const k = `${key}-${id}`;
    const raw = localY[k];
    if (raw === undefined) return;
    const n = parseFloat(raw);
    if (!isNaN(n)) updateModuleObject(selectedModuleId, key, id, { y: n });
    setLocalY((p) => { const next = { ...p }; delete next[k]; return next; });
  };

  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Objets — module {selectedModuleId}</h3>
      {CONFIG.map(([key, label, field]) => (
        <div key={key} className="space-y-1">
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          {(selectedModuleDetail[key] || []).map((obj) => {
            const yKey = `${key}-${obj.id}`;
            const yVal = localY[yKey] !== undefined ? localY[yKey] : obj.y;
            return (
              <div key={obj.id} className="rounded-lg bg-slate-950/70 border border-slate-700 px-2 py-1 flex items-center gap-2">
                {field === 'y' ? (
                  <>
                    <span className="text-[10px] text-slate-500 shrink-0">Y cm</span>
                    <input
                      type="number" step="0.5" min="0"
                      value={yVal}
                      onChange={(e) => handleYChange(key, obj.id, e.target.value)}
                      onBlur={() => handleYBlur(key, obj.id)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                    />
                  </>
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
                  <>
                    <span className="text-[10px] text-slate-500 shrink-0">H cm</span>
                    <input
                      type="number" step="0.5" min="5"
                      value={obj.height ?? 18}
                      onChange={(e) => updateModuleObject(selectedModuleId, key, obj.id, { height: parseFloat(e.target.value) || 18 })}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
                    />
                  </>
                )}
                <button
                  onClick={() => removeModuleObject(selectedModuleId, key, obj.id)}
                  className="ml-auto text-red-400 hover:text-red-300"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {(selectedModuleDetail[key] || []).length === 0 && <p className="text-[11px] text-slate-500">Aucun élément</p>}
        </div>
      ))}
    </section>
  );
}
