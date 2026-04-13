import React from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';

export default function InspectorPanel({
  cabinetDims,
  setCabinetDims,
  moduleIndex,
  setModuleIndex,
  moduleObjects,
  annotations,
  updateAnnotation,
  removeAnnotation,
  alerts,
  extraNotes,
  setExtraNotes,
  resultJson,
  mobile = false,
  open,
  setOpen,
}) {
  const panelCls = mobile
    ? `fixed left-0 right-0 bottom-14 z-40 rounded-t-2xl border border-slate-700 bg-[#111827]/95 backdrop-blur transition-transform ${open ? 'translate-y-0' : 'translate-y-[88%]'}`
    : 'w-80 border-l border-slate-800 bg-[#0b1119]';

  return (
    <aside className={panelCls}>
      {mobile && (
        <button onClick={() => setOpen((v) => !v)} className="w-full py-2 text-xs text-slate-400 border-b border-slate-700">
          {open ? 'Fermer inspecteur' : 'Ouvrir inspecteur'}
        </button>
      )}
      <div className="p-3 space-y-4 max-h-[80vh] overflow-auto">
        <section className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold mb-2">Cabinet</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['width', 'height', 'depth', 'thickness', 'modulesCount'].map((k) => (
              <label key={k} className="text-slate-300 capitalize">{k}
                <input value={cabinetDims[k]} onChange={(e) => setCabinetDims((v) => ({ ...v, [k]: e.target.value }))} className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold mb-2">Module sélectionné</h3>
          <label className="text-xs text-slate-300">Module
            <input value={moduleIndex} onChange={(e) => setModuleIndex(e.target.value)} className="mt-1 w-full px-2 py-1 rounded bg-slate-950 border border-slate-700" />
          </label>
          <div className="mt-2 space-y-1 text-xs">
            {moduleObjects.map((obj) => (
              <div key={obj.id} className="flex items-center justify-between rounded bg-slate-800/70 px-2 py-1">
                <span>{obj.type} · {obj.label || 'sans label'}</span>
                <button onClick={() => removeAnnotation(obj.id)} className="text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
            {moduleObjects.length === 0 && <p className="text-slate-500">Aucun objet</p>}
          </div>
        </section>

        <section className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold mb-2">Annotations</h3>
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {annotations.map((a) => (
              <div key={a.id} className="rounded bg-slate-800/70 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{a.type}</span>
                  <button onClick={() => removeAnnotation(a.id)} className="text-red-400"><Trash2 size={14} /></button>
                </div>
                <input value={a.label || ''} onChange={(e) => updateAnnotation(a.id, { label: e.target.value })} className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-slate-900/60 border border-slate-700 p-3 text-xs space-y-2">
          <h3 className="text-sm font-semibold">Alertes</h3>
          {alerts.critical.map((m) => <div key={m} className="text-red-400 flex items-center gap-1"><AlertTriangle size={14} /> CRITIQUE: {m}</div>)}
          {alerts.warning.map((m) => <div key={m} className="text-amber-400 flex items-center gap-1"><AlertTriangle size={14} /> AVERTISSEMENT: {m}</div>)}
          {alerts.ok && <div className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> OK</div>}
        </section>

        <section className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
          <h3 className="text-sm font-semibold mb-2">Corrections textuelles</h3>
          <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} className="w-full h-24 px-2 py-2 text-xs rounded bg-slate-950 border border-slate-700" />
        </section>

        <details className="rounded-xl bg-slate-900/60 border border-slate-700 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Prévisualisation JSON</summary>
          <pre className="text-[10px] text-slate-300 overflow-auto mt-2">{JSON.stringify(resultJson, null, 2)}</pre>
        </details>
      </div>
    </aside>
  );
}
