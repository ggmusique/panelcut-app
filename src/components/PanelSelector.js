import { useState } from 'react';
import { PANEL_CATALOG, MATERIAL_COLORS } from '../catalog';
import { Check, Plus, X, Ruler, Euro, ChevronRight, Palette } from 'lucide-react';

export default function PanelSelector({ t, project, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customPanel, setCustomPanel] = useState({ name: '', material: 'Perso', thickness: 18, w: 244, h: 122, price: 0 });
  const selected = project.selectedPanel || null;
  const selectPanel = (panel) => onChange({ ...project, selectedPanel: panel, panel: { w: panel.w, h: panel.h }, pricePerPanel: panel.price });
  const addCustom = () => { if (!customPanel.name || !customPanel.w || !customPanel.h) return; selectPanel({ ...customPanel, id: 'custom-'+Date.now() }); setShowCustom(false); };
  const materials = [...new Set(PANEL_CATALOG.map(p => p.material))];

  return (
    <div className="space-y-6">
      {selected && (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] border border-orange-500/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0 border-2 border-white/10" style={{ background: MATERIAL_COLORS[selected.material]||'#607D8B', boxShadow: `0 0 20px ${MATERIAL_COLORS[selected.material]||'#607D8B'}40` }}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1"><Check className="w-5 h-5 text-green-400"/><span className="text-xs font-bold text-green-400 uppercase">Sélectionné</span></div>
              <h3 className="text-xl font-black text-white mb-1 truncate">{selected.name}</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><Ruler className="w-4 h-4"/>{selected.w}×{selected.h} cm</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span className="flex items-center gap-1.5"><Euro className="w-4 h-4"/>{selected.price.toFixed(2)} €</span>
                <span className="px-2 py-0.5 bg-white/5 rounded text-xs border border-white/5">{selected.thickness}mm</span>
              </div>
            </div>
            <button onClick={()=>onChange({...project, selectedPanel:null})} className="px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-sm">Changer</button>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5">
            <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Prix unitaire (€)</label>
            <div className="relative max-w-xs"><Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"/><input className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white font-mono font-bold focus:border-green-500 outline-none" type="number" step="0.1" value={project.pricePerPanel} onChange={e=>onChange({...project, pricePerPanel:parseFloat(e.target.value)||0})}/></div>
          </div>
        </div>
      )}
      {!selected && (
        <div className="space-y-8">
          {materials.map(mat => (
            <div key={mat}>
              <div className="flex items-center gap-3 mb-4"><div className="w-4 h-4 rounded-full shadow-lg" style={{background:MATERIAL_COLORS[mat]||'#607D8B'}}/><h3 className="text-lg font-bold text-white">{mat}</h3><div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PANEL_CATALOG.filter(p=>p.material===mat).map(panel=>(
                  <button key={panel.id} onClick={()=>selectPanel(panel)} className="group relative bg-[#111] hover:bg-[#161616] border border-white/5 hover:border-orange-500/50 rounded-xl p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start mb-2"><h4 className="font-bold text-white group-hover:text-orange-400">{panel.name}</h4><div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-orange-500 group-hover:text-white flex items-center justify-center transition-all"><ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0"/></div></div>
                    <div className="relative z-10 flex items-center gap-4 text-sm text-slate-400"><span className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5"/>{panel.w}×{panel.h} cm</span><span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded">{panel.price.toFixed(2)}€</span></div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="flex items-center gap-3 mb-4"><div className="w-4 h-4 rounded-full bg-slate-500"/><h3 className="text-lg font-bold text-white">Personnalisé</h3><div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div></div>
            {!showCustom ? (
              <button onClick={()=>setShowCustom(true)} className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 text-slate-500 font-bold hover:border-orange-500/50 hover:text-orange-500 hover:bg-orange-500/5 transition-all flex items-center justify-center gap-3"><div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-5 h-5"/></div><span>Ajouter un panneau sur mesure</span></button>
            ) : (
              <div className="bg-[#111] border border-orange-500/30 rounded-2xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-white flex items-center gap-2"><Palette className="w-5 h-5 text-orange-400"/>Configuration</h4><button onClick={()=>setShowCustom(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5"/></button></div>
                <input className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:border-orange-500 outline-none" placeholder="Nom (ex: Merisier)" value={customPanel.name} onChange={e=>setCustomPanel(p=>({...p,name:e.target.value}))}/>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><label className="text-[10px] text-slate-500 uppercase font-bold">Longueur</label><input className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-orange-500 outline-none" type="number" value={customPanel.w} onChange={e=>setCustomPanel(p=>({...p,w:parseFloat(e.target.value)||244}))}/></div>
                  <div><label className="text-[10px] text-slate-500 uppercase font-bold">Largeur</label><input className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-orange-500 outline-none" type="number" value={customPanel.h} onChange={e=>setCustomPanel(p=>({...p,h:parseFloat(e.target.value)||122}))}/></div>
                  <div><label className="text-[10px] text-slate-500 uppercase font-bold">Prix</label><input className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-green-500 outline-none" type="number" step="0.1" value={customPanel.price} onChange={e=>setCustomPanel(p=>({...p,price:parseFloat(e.target.value)||0}))}/></div>
                </div>
                <div className="flex gap-3"><button className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold hover:bg-white/5" onClick={()=>setShowCustom(false)}>Annuler</button><button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold shadow-lg" onClick={addCustom}>Valider</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
