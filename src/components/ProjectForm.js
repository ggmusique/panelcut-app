import PanelSelector from './PanelSelector';
import { FolderOpen, User, Building, FileText, Settings, ChevronRight, Ruler, Maximize2 } from 'lucide-react';

export default function ProjectForm({ t, project, onChange, onNext }) {
  const update = (key, val) => onChange({ ...project, [key]: val });

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-32 relative font-sans">
      
      <header className="bg-gradient-to-b from-[#1a1a1a] to-[#050505] pt-8 pb-12 px-6 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/30">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            {t.newProject}
          </h1>
          <p className="text-slate-400">{t.configuration}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 -mt-8 relative z-10 space-y-6">
        
        {/* CARTE 1: INFORMATIONS */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-400" />
              {t.info}
            </h2>

            <div className="space-y-5">
              <div className="group/input">
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {t.projectName}
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all font-medium"
                  placeholder={t.projectPlaceholder}
                  value={project.name}
                  onChange={e => update('name', e.target.value)}
                />
              </div>

              <div className="group/input">
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  {t.client}
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-medium"
                  placeholder={t.clientPlaceholder}
                  value={project.client || ''}
                  onChange={e => update('client', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group/input">
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                    <Building className="w-3.5 h-3.5" />
                    {t.company}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none transition-all font-medium"
                    placeholder={t.companyPlaceholder}
                    value={project.company || ''}
                    onChange={e => update('company', e.target.value)}
                  />
                </div>
                <div className="group/input">
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    {t.devisNum}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none transition-all font-medium font-mono"
                    placeholder="DEV-2024-001"
                    value={project.devisNum || ''}
                    onChange={e => update('devisNum', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARTE 2: PANNEAU */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-orange-400" />
              {t.panelType}
            </h2>
            <PanelSelector t={t} project={project} onChange={onChange} />
          </div>
        </div>

        {/* CARTE 3: OPTIONS */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              {t.cutOptions}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="group/input">
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5" />
                  {t.kerf} (mm)
                </label>
                <input
                  type="number"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white font-mono font-bold text-lg focus:border-orange-500 outline-none"
                  value={project.kerf}
                  onChange={e => update('kerf', parseFloat(e.target.value) || 3)}
                />
              </div>
              <div className="group/input">
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5" />
                  {t.tolerance} (mm)
                </label>
                <input
                  type="number"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 text-white font-mono font-bold text-lg focus:border-orange-500 outline-none"
                  value={project.tolerance}
                  onChange={e => update('tolerance', parseFloat(e.target.value) || 10)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto">
            <button 
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black text-lg py-4 rounded-2xl shadow-2xl shadow-orange-900/40 transform transition-all hover:-translate-y-1 flex items-center justify-center gap-3"
              onClick={onNext}
            >
              <span>{t.pieces}</span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}