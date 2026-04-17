import React from 'react';
import { Save, Send, AlertCircle, Eye } from 'lucide-react';

export default function RefineBar({ alerts, isSending, sendError, onSave, onPreview, onSend, onCancel }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-400">État:</span>
      {alerts.ok && <span className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">OK</span>}
      {alerts.critical.length > 0 && <span className="text-xs px-2 py-1 rounded bg-red-500/15 text-red-300 border border-red-500/30">{alerts.critical.length} critique(s)</span>}
      {alerts.warnings.length > 0 && <span className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">{alerts.warnings.length} avertissement(s)</span>}

      <div className="ml-auto flex items-center gap-2">
        <button onClick={onSave} className="px-3 py-2 rounded-xl text-xs border border-slate-600 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1"><Save size={14} /> Sauver brouillon</button>
        <button onClick={onPreview} className="px-3 py-2 rounded-xl text-xs border border-slate-600 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1"><Eye size={14} /> Prévisualiser JSON</button>
        <button
          onClick={onSend}
          disabled={alerts.critical.length > 0 || isSending}
          className="px-3 py-2 rounded-xl text-xs bg-orange-500 text-black font-semibold disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Send size={14} /> {isSending ? 'Envoi...' : 'Envoyer à Claude'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 rounded-xl text-xs border border-slate-600 bg-slate-800 hover:bg-slate-700">Retour</button>
      </div>
      {sendError && <p className="w-full text-xs text-red-300 inline-flex items-center gap-1"><AlertCircle size={14} /> {sendError}</p>}
    </div>
  );
}
