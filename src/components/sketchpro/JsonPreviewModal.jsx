import React from 'react';

export default function JsonPreviewModal({ open, onClose, data }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-700 bg-[#111827] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-100">Prévisualiser JSON</h3>
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm">Fermer</button>
        </div>
        <pre className="p-4 text-xs text-slate-200 overflow-auto max-h-[75vh]">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
