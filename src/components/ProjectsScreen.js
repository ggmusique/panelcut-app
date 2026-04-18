import { useState, useEffect, useMemo } from 'react';
import { loadProjects, deleteProject } from '../supabase';
import { Plus, Trash2, FolderOpen, User, Calendar, FileText, Layers, CheckCircle, X, Ruler, Activity } from 'lucide-react';
import ImageUpload    from './ImageUpload';
import ScanWithEditor from './ScanWithEditor';

export default function ProjectsScreen({ onLoad, onNew, user, onScanComplete }) {
  const [projects,    setProjects]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [deleting,    setDeleting]    = useState(null);
  const [showUpload,  setShowUpload]  = useState(false);
  const [showEditor,  setShowEditor]  = useState(false);
  const [lastResult,  setLastResult]  = useState(null);
  const [scanImage,   setScanImage]   = useState(null);
  const [scanResult,  setScanResult]  = useState(null);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await loadProjects();
    setProjects(data || []);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce projet ?')) return;
    setDeleting(id);
    await deleteProject(id);
    setProjects(p => p.filter(p => p.id !== id));
    setDeleting(null);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ImageUpload → (result, imageBase64)
  const handleScanReady = (result, imageBase64) => {
    setScanResult(result);
    setScanImage(imageBase64 || null);
    setShowUpload(false);
    setShowEditor(true);
  };

  // ScanWithEditor → résultat final corrigé (ou initial)
  // On transmet AUSSI l'image base64 pour que l'éditeur de croquis soit disponible
  const handleEditorComplete = (finalResult) => {
    setShowEditor(false);
    setLastResult(finalResult);
    if (onScanComplete) onScanComplete(finalResult, scanImage);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-20 relative font-sans selection:bg-orange-500 selection:text-white">

      {showUpload && (
        <ImageUpload
          onScanComplete={handleScanReady}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 bg-[#060b14] overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                ←
              </button>
              <h1 className="text-white font-bold text-lg">Correction du croquis</h1>
            </div>
            <ScanWithEditor
              initialScanResult={scanResult}
              scanImage={scanImage}
              onComplete={handleEditorComplete}
              onBackToScan={() => { setShowEditor(false); setShowUpload(true); }}
            />
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-gradient-to-b from-[#1a1a1a] to-[#050505] pt-10 pb-32 px-6 relative overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full mix-blend-screen filter blur-[100px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-screen filter blur-[100px] opacity-30" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-2 tracking-tight">
                PanelCut <span className="text-orange-500">Pro</span>
              </h1>
              <p className="text-slate-500 font-medium">Optimiseur de découpe intelligent</p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="text-sm font-medium text-slate-300">{user?.email || 'Invité'}</span>
              <div className="w-8 h-8 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
                {user?.email ? user.email[0].toUpperCase() : 'U'}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowUpload(true)}
              className="group relative inline-flex items-center justify-center gap-3 bg-white text-black hover:bg-orange-500 hover:text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] transform hover:-translate-y-1"
            >
              <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
              <span>Nouveau Projet (Scan IA)</span>
            </button>
            <button
              onClick={onNew}
              className="group relative inline-flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 border border-white/10 hover:border-white/30 transform hover:-translate-y-1"
            >
              <Plus className="w-6 h-6" />
              <span>Nouveau Manuel</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-6 -mt-20 relative z-20">

        {lastResult && (
          <div className="mb-10 bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3 text-green-400">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Analyse Terminée</h3>
                  {lastResult.corrections_applied?.length > 0 && (
                    <p className="text-xs text-green-400 mt-0.5">
                      ✓ {lastResult.corrections_applied.length} correction(s) appliquée(s)
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setLastResult(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>



            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Activity className="w-3 h-3 text-orange-500" />
              Pièces chargées — lance l'optimisation depuis l'écran Pièces
            </div>
          </div>
        )}

        {/* LISTE PROJETS */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-orange-500" />
            Vos Chantiers
          </h2>
          {!loading && (
            <span className="bg-white/10 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-white/5">
              {projects.length} PROJETS
            </span>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4" />
            <p className="text-sm font-medium">Chargement des données...</p>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center shadow-xl">
            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layers className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Aucun projet</h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">Commencez par scanner un plan de découpe pour générer automatiquement votre liste de pièces.</p>
            <button onClick={() => setShowUpload(true)} className="text-orange-500 font-bold hover:text-orange-400 transition-colors">Lancer un scan →</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <div
              key={p.id}
              className="group relative bg-[#111] hover:bg-[#161616] rounded-2xl p-6 border border-white/5 hover:border-orange-500/30 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-between"
              onClick={() => onLoad(p.id)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex justify-between items-start pl-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white group-hover:text-orange-500 transition-colors">
                      {p.name || 'Sans titre'}
                    </h3>
                    {p.results_data && (
                      <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider rounded border border-orange-500/20">
                        Optimisé
                      </span>
                    )}
                  </div>
                  {p.client && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                      <User className="w-4 h-4" />
                      <span>{p.client}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(p.updated_at)}
                    </div>
                    {p.devis_num && (
                      <div className="flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs text-blue-400">
                        <FileText className="w-3.5 h-3.5" />
                        {p.devis_num}
                      </div>
                    )}
                    {p.results_data && (
                      <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20 text-xs text-purple-400">
                        <Ruler className="w-3.5 h-3.5" />
                        {p.results_data.summary?.totalPanels || 0} Panneaux
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                  disabled={deleting === p.id}
                  className="opacity-0 group-hover:opacity-100 p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                  title="Supprimer"
                >
                  {deleting === p.id
                    ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    : <Trash2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
