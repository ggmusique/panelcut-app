import React from 'react';

export default function JsonPreviewModal({ open, onClose, payload }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 p-4 grid place-items-center">
      <div className="w-full max-w-5xl max-h-[86vh] rounded-2xl border border-slate-700 bg-[#0f1620] overflow-hidden shadow-2xl">
        <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4">
          <h3 className="text-slate-100 font-semibold">Prévisualisation JSON métier</h3>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">Fermer</button>
        </div>
        <pre className="p-4 text-xs text-slate-200 overflow-auto max-h-[78vh]">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}
