import React from 'react';
import { Trash2 } from 'lucide-react';

export default function AnnotationsPanel({ annotations, selectedAnnotationId, setSelectedAnnotationId, updateFacadeAnnotation, removeFacadeAnnotation }) {
  return (
    <section className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
      <h3 className="text-sm font-semibold text-slate-100 mb-2">Annotations libres</h3>
      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {annotations.map((a) => (
          <div key={a.id} className={`rounded-lg border p-2 ${selectedAnnotationId === a.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700 bg-slate-950/60'}`}>
            <button onClick={() => setSelectedAnnotationId(a.id)} className="text-xs text-slate-300">{a.type}</button>
            <input
              value={a.label || ''}
              onChange={(e) => updateFacadeAnnotation(a.id, { label: e.target.value })}
              className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
            />
            <button onClick={() => removeFacadeAnnotation(a.id)} className="mt-1 text-red-400 text-xs inline-flex items-center gap-1"><Trash2 size={12} /> Supprimer</button>
          </div>
        ))}
        {annotations.length === 0 && <p className="text-xs text-slate-500">Aucune annotation</p>}
      </div>
    </section>
  );
}
