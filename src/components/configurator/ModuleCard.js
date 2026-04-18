import { useState } from 'react';
import DrawerDetail from './DrawerDetail';

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultDrawer = () => ({
  id: uid(),
  height: 18,
  yFromBottom: 0,
  pieces: { face: true, avanCaisse: true, arriereCaisse: true, flancGauche: true, flancDroit: true, fond: true },
});

const defaultShelf  = () => ({ id: uid(), yFromBottom: 45 });
const defaultRod    = () => ({ id: uid(), yFromBottom: 160, diameter: 2.5 });
const defaultDoor   = () => ({ id: uid(), type: 'swing', count: 1 });

/**
 * ModuleCard — collapsible card for one cabinet module.
 */
export default function ModuleCard({ module, index, onChange, onDelete, globalDepth, globalThickness, globalHL, globalHR }) {
  const [open, setOpen] = useState(false);

  const content  = module.content  || {};
  const shelves  = content.shelves  || [];
  const drawers  = content.drawers  || [];
  const rods     = content.rods     || [];
  const doors    = content.doors    || [];

  const netW  = module.width          || 60;
  const depth = globalDepth           || 58;
  const th    = globalThickness       || 1.8;
  const hl    = module.heightLeft     ?? globalHL  ?? 220;
  const hr    = module.heightRight    ?? globalHR  ?? 220;
  const isBiais = Math.abs(hl - hr) > 0.1;

  const update = (patch) => onChange({ ...module, ...patch });
  const updateContent = (patch) => onChange({ ...module, content: { ...content, ...patch } });

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-[#1a2535]">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="w-6 h-6 rounded-full bg-orange-500 text-black text-xs font-black flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-bold text-slate-200">Module {index + 1}</span>
        <label className="flex items-center gap-1 text-xs text-slate-400" onClick={e => e.stopPropagation()}>
          L
          <input
            type="number"
            min="5"
            value={netW}
            onChange={e => update({ width: Math.max(5, Number(e.target.value) || 60) })}
            className="w-16 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
          />
          cm
        </label>
        {isBiais && (
          <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5">BIAIS</span>
        )}
        {drawers.length > 0 && <span className="text-[10px] text-blue-400">🗄️×{drawers.length}</span>}
        {shelves.length > 0 && <span className="text-[10px] text-green-400">📦×{shelves.length}</span>}
        {rods.length   > 0 && <span className="text-[10px] text-pink-400">👔×{rods.length}</span>}
        {doors.length  > 0 && <span className="text-[10px] text-sky-400">🚪</span>}
        <span className="text-slate-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">

          {/* Fond */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={module.hasFond !== false}
              onChange={e => update({ hasFond: e.target.checked })}
              className="accent-orange-500"
            />
            Fond de caisse
          </label>

          {/* Biais local */}
          <div className="flex flex-wrap gap-2 items-center text-xs text-slate-400">
            <span className="font-bold text-amber-400">Hauteurs module</span>
            <label className="flex items-center gap-1">
              G
              <input
                type="number" min="10"
                value={hl}
                onChange={e => update({ heightLeft: Math.max(10, Number(e.target.value) || hl) })}
                className="w-16 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
              />
              cm
            </label>
            <label className="flex items-center gap-1">
              D
              <input
                type="number" min="10"
                value={hr}
                onChange={e => update({ heightRight: Math.max(10, Number(e.target.value) || hr) })}
                className="w-16 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
              />
              cm
            </label>
            {isBiais && (
              <span className="text-amber-400 text-[10px]">⚠️ Module en biais</span>
            )}
            <button
              className="ml-auto text-xs text-slate-500 hover:text-slate-300"
              onClick={() => { update({ heightLeft: globalHL, heightRight: globalHR }); }}
              title="Réinitialiser aux valeurs globales"
            >
              ↺ Reset
            </button>
          </div>

          {/* Drawers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400">🗄️ Tiroirs</span>
              <button
                onClick={() => updateContent({ drawers: [...drawers, defaultDrawer()] })}
                className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                + Ajouter
              </button>
            </div>
            {drawers.map((dr, di) => (
              <DrawerDetail
                key={dr.id || di}
                drawer={dr}
                moduleNetWidth={netW}
                depth={depth}
                thickness={th}
                onChange={(updated) => {
                  const next = drawers.map((d, idx) => idx === di ? updated : d);
                  updateContent({ drawers: next });
                }}
                onDelete={() => updateContent({ drawers: drawers.filter((_, idx) => idx !== di) })}
              />
            ))}
          </div>

          {/* Shelves */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-green-400">📦 Étagères</span>
              <button
                onClick={() => updateContent({ shelves: [...shelves, defaultShelf()] })}
                className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
              >
                + Ajouter
              </button>
            </div>
            {shelves.map((sh, si) => (
              <div key={sh.id || si} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Étagère {si + 1}</span>
                <label className="flex items-center gap-1 text-slate-300">
                  Pos.
                  <input
                    type="number" min="0"
                    value={sh.yFromBottom ?? 45}
                    onChange={e => {
                      const next = shelves.map((s, idx) => idx === si ? { ...s, yFromBottom: Math.max(0, Number(e.target.value) || 0) } : s);
                      updateContent({ shelves: next });
                    }}
                    className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
                  />
                  cm
                </label>
                <button
                  onClick={() => updateContent({ shelves: shelves.filter((_, idx) => idx !== si) })}
                  className="text-red-400 hover:text-red-300 ml-auto"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Rods */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-pink-400">👔 Tringles</span>
              <button
                onClick={() => updateContent({ rods: [...rods, defaultRod()] })}
                className="text-xs px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 transition-colors"
              >
                + Ajouter
              </button>
            </div>
            {rods.map((rod, ri) => (
              <div key={rod.id || ri} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Tringle {ri + 1}</span>
                <label className="flex items-center gap-1 text-slate-300">
                  Pos.
                  <input
                    type="number" min="0"
                    value={rod.yFromBottom ?? 160}
                    onChange={e => {
                      const next = rods.map((r, idx) => idx === ri ? { ...r, yFromBottom: Math.max(0, Number(e.target.value) || 0) } : r);
                      updateContent({ rods: next });
                    }}
                    className="w-14 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
                  />
                  cm
                </label>
                <label className="flex items-center gap-1 text-slate-300">
                  Ø
                  <input
                    type="number" min="1" step="0.5"
                    value={rod.diameter ?? 2.5}
                    onChange={e => {
                      const next = rods.map((r, idx) => idx === ri ? { ...r, diameter: Math.max(1, Number(e.target.value) || 2.5) } : r);
                      updateContent({ rods: next });
                    }}
                    className="w-12 ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200"
                  />
                  cm
                </label>
                <span className="text-[10px] text-pink-300">Longueur: {netW.toFixed(1)} cm</span>
                <button
                  onClick={() => updateContent({ rods: rods.filter((_, idx) => idx !== ri) })}
                  className="text-red-400 hover:text-red-300 ml-auto"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Doors */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-400">🚪 Portes</span>
              {doors.length < 2 && (
                <button
                  onClick={() => updateContent({ doors: [...doors, defaultDoor()] })}
                  className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors"
                >
                  + Ajouter
                </button>
              )}
            </div>
            {doors.map((door, doi) => (
              <div key={door.id || doi} className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={door.type}
                  onChange={e => {
                    const next = doors.map((d, idx) => idx === doi ? { ...d, type: e.target.value, count: e.target.value === 'sliding' ? 2 : d.count } : d);
                    updateContent({ doors: next });
                  }}
                  className="px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
                >
                  <option value="swing">Battante</option>
                  <option value="sliding">Coulissante</option>
                </select>
                {door.type === 'swing' && (
                  <label className="flex items-center gap-1 text-slate-300">
                    Vantaux
                    <select
                      value={door.count ?? 1}
                      onChange={e => {
                        const next = doors.map((d, idx) => idx === doi ? { ...d, count: Number(e.target.value) } : d);
                        updateContent({ doors: next });
                      }}
                      className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-white/20 rounded text-slate-200 text-xs"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </label>
                )}
                <button
                  onClick={() => updateContent({ doors: doors.filter((_, idx) => idx !== doi) })}
                  className="text-red-400 hover:text-red-300 ml-auto"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Delete module */}
          <div className="pt-1 border-t border-white/5">
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
            >
              🗑️ Supprimer ce module
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
