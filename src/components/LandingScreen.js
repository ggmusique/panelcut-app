import { useAuth } from '../contexts/AuthContext';

export default function LandingScreen({ onNew, onHistory, onAuth }) {
  const { user } = useAuth();
  const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

  const steps = [
    { num: 1, label: 'Décrivez votre projet', desc: 'Nom, client, type de panneau' },
    { num: 2, label: 'Choisissez le panneau', desc: 'Catalogue ou sur mesure' },
    { num: 3, label: 'Importez vos pièces', desc: 'Scan IA ou saisie manuelle' },
    { num: 4, label: 'Obtenez le plan', desc: 'Découpe optimisée + PDF' },
  ];

  return (
    <div className="min-h-screen bg-[#0f1620] text-slate-200 font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5">
        <span className="text-xl font-black text-white tracking-tight">
          PanelCut <span className="text-orange-500">Pro</span>
        </span>
        <button
          onClick={onAuth}
          className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/30 text-sm font-medium transition-colors"
        >
          {user ? user.email : 'Connexion'}
        </button>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto w-full px-6 md:px-12 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
          De votre croquis à la<br />
          <span className="text-orange-500">liste de découpe</span>,<br />
          en quelques secondes
        </h1>
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Photographiez votre dessin, laissez l'IA extraire toutes les pièces,
          et obtenez un plan de découpe optimisé instantanément.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onNew}
            className="px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl text-lg shadow-lg shadow-orange-900/40 transition-all hover:-translate-y-1"
          >
            ✦ Nouveau projet
          </button>
          <button
            onClick={onHistory}
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-lg border border-white/10 hover:border-white/20 transition-all hover:-translate-y-1"
          >
            📁 Voir mes projets
          </button>
        </div>
      </section>

      {/* ── Features (asymmetric 2+1 layout) ── */}
      <section className="max-w-6xl mx-auto w-full px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Wide card */}
          <div className="md:col-span-2 bg-[#131c2a] border border-white/5 rounded-2xl p-8 flex flex-col gap-4">
            <div className="text-4xl">📷</div>
            <h3 className="text-xl font-bold text-white">Scanner un croquis</h3>
            <p className="text-slate-400 leading-relaxed">
              Photographiez votre dessin à main levée, Claude Vision extrait toutes les
              pièces automatiquement avec leurs dimensions et quantités.
            </p>
          </div>
          {/* Tall card */}
          <div className="bg-[#131c2a] border border-white/5 rounded-2xl p-8 flex flex-col gap-4">
            <div className="text-4xl">✏️</div>
            <h3 className="text-xl font-bold text-white">Corriger et annoter</h3>
            <p className="text-slate-400 leading-relaxed">
              Ajoutez des cotes, corrigez les erreurs directement sur le croquis,
              relancez l'analyse.
            </p>
          </div>
          {/* Wide card (offset) */}
          <div className="md:col-start-2 md:col-span-2 bg-[#131c2a] border border-white/5 rounded-2xl p-8 flex flex-col gap-4">
            <div className="text-4xl">⚙️</div>
            <h3 className="text-xl font-bold text-white">Optimiser la découpe</h3>
            <p className="text-slate-400 leading-relaxed">
              L'algorithme place toutes les pièces sur vos panneaux en minimisant les
              chutes et en maximisant l'utilisation de la matière.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto w-full px-6 md:px-12 py-16 border-t border-white/5">
        <h2 className="text-2xl font-bold text-white text-center mb-12">Comment ça marche</h2>
        <div className="flex flex-col md:flex-row items-stretch gap-8 md:gap-0">
          {steps.map((step, i) => (
            <div key={step.num} className="flex md:flex-col items-center flex-1 gap-4 md:gap-0">
              <div className="flex md:flex-col items-center flex-1 md:gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-lg flex-shrink-0 shadow-lg shadow-orange-900/40">
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block h-px w-full bg-gradient-to-r from-orange-500/40 to-white/5 mx-4" />
                )}
              </div>
              <div className="md:text-center mt-0 md:mt-3 flex-1">
                <div className="font-bold text-white text-sm">{step.label}</div>
                <div className="text-xs text-slate-500 mt-1">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-white/5 px-6 py-5 flex items-center justify-between text-xs text-slate-600">
        <span>PanelCut Pro · v{APP_VERSION}</span>
        <a
          href="https://github.com/ggmusique/panelcut-app"
          className="hover:text-slate-400 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </footer>

    </div>
  );
}
