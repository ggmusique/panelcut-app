import React, { useState } from 'react';

export default function ObjectConfigPopover({ popover, onConfirm, onClose }) {
  const [label, setLabel] = useState(popover?.type || '');
  const [y, setY] = useState(popover?.config?.y ?? 50);
  const [height, setHeight] = useState(popover?.config?.height ?? 18);

  if (!popover) return null;

  return (
    <div className="absolute z-30 bg-[#111827]/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur"
      style={{ left: popover.x + 12, top: popover.y + 12 }}>
      <div className="text-xs text-slate-400 mb-2">Configurer objet ({popover.type})</div>
      <div className="space-y-2">
        <label className="block text-xs text-slate-300">Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded" />
        </label>
        <label className="block text-xs text-slate-300">Y (cm)
          <input type="number" value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded" />
        </label>
        {popover.type === 'drawer' && (
          <label className="block text-xs text-slate-300">Hauteur (cm)
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded" />
          </label>
        )}
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <button onClick={onClose} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">Annuler</button>
        <button
          onClick={() => onConfirm({ ...popover, label, config: { ...popover.config, y: Number(y), height: Number(height) } })}
          className="px-2 py-1 text-xs rounded bg-orange-500 hover:bg-orange-400 text-black font-semibold"
        >Valider</button>
      </div>
    </div>
  );
}
