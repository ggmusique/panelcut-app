/**
 * BoardList.js — Liste des planches à débiter
 * Reçoit : results.panels[], project.pieces[]
 * Affiche : par panneau, la liste des pièces avec dimensions et repère couleur
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Printer } from 'lucide-react';

const PIECE_COLORS = [
  '#f59e0b','#3b82f6','#10b981','#a855f7','#ef4444','#14b8a6','#f97316','#6366f1',
  '#ec4899','#84cc16','#0ea5e9','#d97706',
];

function cm(tenthsMm) {
  const v = tenthsMm / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function colorFor(name, map) {
  if (!map[name]) {
    const idx = Object.keys(map).length % PIECE_COLORS.length;
    map[name] = PIECE_COLORS[idx];
  }
  return map[name];
}

export default function BoardList({ results, project }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }));
  const colorMap = {};

  // Compte global de chaque pièce
  const totalMap = {};
  for (const panel of results.panels) {
    for (const p of panel.placed) {
      if (!totalMap[p.name]) totalMap[p.name] = { name: p.name, qty: 0, l: p.l, h: p.h };
      totalMap[p.name].qty++;
    }
  }

  const totals = Object.values(totalMap).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">

      {/* ── Récap global ────────────────────────────────────────────────── */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Liste complète des pièces
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2 pr-3 text-[10px] text-slate-500 font-bold uppercase">Nom</th>
                <th className="text-right py-2 pr-3 text-[10px] text-slate-500 font-bold uppercase">L (cm)</th>
                <th className="text-right py-2 pr-3 text-[10px] text-slate-500 font-bold uppercase">H (cm)</th>
                <th className="text-right py-2 text-[10px] text-slate-500 font-bold uppercase">Qté</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((p, i) => {
                const col = colorFor(p.name, colorMap);
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: col }} />
                        <span className="text-white font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{cm(p.l)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{cm(p.h)}</td>
                    <td className="py-2 text-right">
                      <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg text-xs">{p.qty}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Par panneau ─────────────────────────────────────────────────── */}
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
        Détail par panneau ({results.panels.length} panneau{results.panels.length > 1 ? 'x' : ''})
      </div>
      {results.panels.map((panel, pi) => {
        const open = !!expanded[pi];
        // Groupe les pièces identiques
        const pmap = {};
        for (const p of panel.placed) {
          const key = `${p.name}|${p.l}|${p.h}`;
          if (!pmap[key]) pmap[key] = { ...p, qty: 0 };
          pmap[key].qty++;
        }
        const pieces = Object.values(pmap);

        return (
          <div key={pi} className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(pi)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-black text-orange-400">
                  {pi + 1}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">
                    Panneau {pi + 1}
                    <span className="text-slate-500 font-normal ml-2 text-xs">
                      {project.panel.w}×{project.panel.h} cm
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {panel.placed.length} pièce{panel.placed.length > 1 ? 's' : ''} — {panel.utilizationPct}% utilisé
                  </div>
                </div>
              </div>
              {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {open && (
              <div className="border-t border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0a0a0a]">
                      <th className="text-left px-4 py-2 text-[10px] text-slate-500 font-bold uppercase">Pièce</th>
                      <th className="text-right px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">L</th>
                      <th className="text-right px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">H</th>
                      <th className="text-right px-4 py-2 text-[10px] text-slate-500 font-bold uppercase">Qté</th>
                      <th className="text-right px-4 py-2 text-[10px] text-slate-500 font-bold uppercase">↺</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((p, pi2) => {
                      const col = colorFor(p.name, colorMap);
                      return (
                        <tr key={pi2} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-sm" style={{ background: col }} />
                              <span className="text-white">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300 text-xs">{cm(p.l)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300 text-xs">{cm(p.h)}</td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-white font-bold text-xs bg-white/10 px-1.5 py-0.5 rounded">{p.qty}</span>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-slate-500">
                            {p.rotated ? <span className="text-purple-400">↺</span> : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Tip impression */}
      <div className="flex items-center gap-2 text-[11px] text-slate-600 px-1">
        <Printer className="w-3 h-3" />
        <span>Utilisez PDF pour imprimer cette liste en atelier.</span>
      </div>
    </div>
  );
}
