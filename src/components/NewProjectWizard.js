import { useState } from 'react';
import PanelSelector from './PanelSelector';
import { ChevronRight, ChevronLeft, Settings } from 'lucide-react';

const STEPS = [
  { num: 1, label: 'Informations' },
  { num: 2, label: 'Panneau' },
  { num: 3, label: 'Méthode' },
];

export default function NewProjectWizard({ t, project, onChange, onGoScan, onGoManual, onCancel }) {
  const [step, setStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (key, val) => onChange({ ...project, [key]: val });
  const canNext = step === 1 ? project.name?.trim().length > 0 : true;

  return (
    <div className="min-h-screen bg-[#0f1620] text-slate-200 pb-20 font-sans">

      {/* ── Stepper ── */}
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div className={
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ' +
                  (step === s.num
                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-900/40'
                    : step > s.num
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'bg-white/5 border-white/10 text-slate-500')
                }>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={
                  'text-[11px] font-bold hidden sm:block ' +
                  (step === s.num ? 'text-orange-400' : step > s.num ? 'text-slate-500' : 'text-slate-600')
                }>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={
                  'h-0.5 flex-1 mx-3 transition-all ' +
                  (step > s.num ? 'bg-orange-500/50' : 'bg-white/10')
                } />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ── Étape 1 — Informations ── */}
        {step === 1 && (
          <div className="bg-[#131c2a] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white mb-2">Informations du projet</h2>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
                Nom du projet *
              </label>
              <input
                type="text"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all"
                placeholder="Ex : Cuisine Dupont"
                value={project.name}
                onChange={e => update('name', e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
                Nom du client
              </label>
              <input
                type="text"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                placeholder="Ex : Jean Dupont"
                value={project.client || ''}
                onChange={e => update('client', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
                  Entreprise
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none transition-all"
                  placeholder="Ex : Menuiserie Martin"
                  value={project.company || ''}
                  onChange={e => update('company', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">
                  N° de devis
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none transition-all font-mono"
                  value={project.devisNum || ''}
                  onChange={e => update('devisNum', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 2 — Panneau ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#131c2a] border border-white/5 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Choix du panneau</h2>
              <PanelSelector t={t} project={project} onChange={onChange} />
            </div>

            {/* Paramètres avancés */}
            <div className="bg-[#131c2a] border border-white/5 rounded-2xl overflow-hidden">
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-slate-300 text-sm">
                  <Settings className="w-4 h-4 text-slate-500" />
                  Paramètres avancés
                </span>
                <ChevronRight className={
                  'w-5 h-5 text-slate-500 transition-transform ' +
                  (advancedOpen ? 'rotate-90' : '')
                } />
              </button>
              {advancedOpen && (
                <div className="px-6 pb-6 pt-2 grid grid-cols-3 gap-4 border-t border-white/5">
                  <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Kerf (mm)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:border-orange-500 outline-none"
                      value={project.kerf}
                      onChange={e => update('kerf', parseFloat(e.target.value) || 3)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Tolérance (mm)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:border-orange-500 outline-none"
                      value={project.tolerance}
                      onChange={e => update('tolerance', parseFloat(e.target.value) || 10)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Prix/panneau (€)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:border-green-500 outline-none"
                      value={project.pricePerPanel}
                      onChange={e => update('pricePerPanel', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Étape 3 — Méthode ── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Méthode d'entrée des pièces</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={onGoScan}
                className="group bg-[#131c2a] hover:bg-[#1a2535] border border-white/5 hover:border-orange-500/40 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col gap-4"
              >
                <div className="text-4xl">📷</div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors mb-2">
                    Scanner un croquis
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Photographiez votre dessin à main levée. Claude Vision extrait
                    automatiquement toutes les pièces.
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-orange-500 font-bold text-sm">
                  Lancer le scan <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={onGoManual}
                className="group bg-[#131c2a] hover:bg-[#1a2535] border border-white/5 hover:border-blue-500/40 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col gap-4"
              >
                <div className="text-4xl">✏️</div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                    Saisie manuelle
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Entrez vos pièces une par une avec leurs dimensions et quantités.
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-blue-400 font-bold text-sm">
                  Saisir manuellement <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between pt-2 gap-4">
          <button
            onClick={step === 1 ? onCancel : () => setStep(s => s - 1)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 font-bold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>

          {step < 3 && (
            <button
              onClick={canNext ? () => setStep(s => s + 1) : undefined}
              disabled={!canNext}
              className={
                'flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ' +
                (canNext
                  ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-900/30'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed')
              }
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
