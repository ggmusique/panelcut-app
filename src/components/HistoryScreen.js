import { useState, useEffect } from 'react';
import { loadProjects, loadProject, deleteProject, saveProject } from '../supabase';
import {
  Plus, Trash2, Copy, FolderOpen, User, Calendar, FileText,
  Layers, Search, X, CheckCircle, Ruler,
} from 'lucide-react';
import ImageUpload    from './ImageUpload';
import ScanWithEditor from './ScanWithEditor';

export default function HistoryScreen({ user, onNew, onLoad, onScanComplete, onBack }) {
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(null);
  const [duplicating, setDuplicating] = useState(null);
  const [search,     setSearch]     = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [scanImage,  setScanImage]  = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (user) fetchProjects();
    else setLoading(false);
  }, [user]);

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

  const handleDuplicate = async (id) => {
    setDuplicating(id);
    const { data } = await loadProject(id);
    if (data) {
      const original = data.project_data || {};
      const copy = {
        ...original,
        supabaseId: null,
        name: 'Copie de ' + (original.name || 'Sans titre'),
        devisNum: 'DV-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6),
      };
      await saveProject(copy, null);
      await fetchProjects();
    }
    setDuplicating(null);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleScanReady = (result, imageBase64) => {
    setScanResult(result);
    setScanImage(imageBase64 || null);
    setShowUpload(false);
    setShowEditor(true);
  };

  const handleEditorComplete = (finalResult) => {
    setShowEditor(false);
    setLastResult(finalResult);
    if (onScanComplete) onScanComplete(finalResult, scanImage);
  };

  const filtered = projects.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.name   || '').toLowerCase().includes(q) ||
      (p.client || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0f1620] text-slate-200 pb-20 font-sans">

      {/* ── Scan modals ── */}
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

      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
            >
              ← Retour
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-orange-500" />
              Mes projets
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 text-white font-bold rounded-xl text-sm transition-all"
            >
              📷 Scanner
            </button>
            <button
              onClick={onNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-900/30"
            >
              <Plus className="w-4 h-4" /> Nouveau projet
            </button>
          </div>
        </div>

        {/* Search bar */}
        {user && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              className="w-full bg-[#131c2a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all"
              placeholder="Rechercher par nom ou client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6">

        {/* ── Not logged in ── */}
        {!user && (
          <div className="bg-[#131c2a] border border-white/5 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-white mb-3">Connexion requise</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Connectez-vous pour accéder à vos projets enregistrés.
            </p>
          </div>
        )}

        {/* ── Scan result banner ── */}
        {lastResult && (
          <div className="mb-8 bg-[#131c2a] border border-green-500/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold">Analyse terminée</span>
              </div>
              <button onClick={() => setLastResult(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">{lastResult.pieces?.length || 0}</div>
                <div className="text-[11px] text-slate-400 uppercase mt-1">Pièces</div>
              </div>
              {lastResult.cabinet && (
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-orange-400">{lastResult.cabinet.width}×{lastResult.cabinet.height}</div>
                  <div className="text-[11px] text-slate-400 uppercase mt-1">L×H (cm)</div>
                </div>
              )}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {lastResult.confidence ? Math.round(lastResult.confidence * 100) + '%' : '—'}
                </div>
                <div className="text-[11px] text-slate-400 uppercase mt-1">Confiance IA</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {user && loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500 mb-4" />
            <p className="text-sm font-medium">Chargement des projets…</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {user && !loading && projects.length === 0 && (
          <div className="bg-[#131c2a] border border-white/5 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Aucun projet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Commencez par créer un nouveau projet ou scanner un croquis.
            </p>
            <button
              onClick={onNew}
              className="text-orange-500 font-bold hover:text-orange-400 transition-colors"
            >
              Créer un projet →
            </button>
          </div>
        )}

        {/* ── No search results ── */}
        {user && !loading && projects.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            Aucun résultat pour « {search} »
          </div>
        )}

        {/* ── Project grid ── */}
        {user && !loading && filtered.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500">
                {filtered.length} projet{filtered.length > 1 ? 's' : ''}
                {search ? ' trouvé' + (filtered.length > 1 ? 's' : '') : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={onLoad}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  deleting={deleting}
                  duplicating={duplicating}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function ProjectCard({ project: p, onOpen, onDuplicate, onDelete, deleting, duplicating, formatDate }) {
  return (
    <div className="group relative bg-[#131c2a] hover:bg-[#1a2535] rounded-2xl p-5 border border-white/5 hover:border-orange-500/30 transition-all duration-200 shadow-md overflow-hidden flex flex-col gap-3">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-2xl" />

      {/* Name + badge */}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white group-hover:text-orange-400 transition-colors truncate">
            {p.name || 'Sans titre'}
          </h3>
          {p.client && (
            <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{p.client}</span>
            </div>
          )}
        </div>
        {p.results_data && (
          <span className="flex-shrink-0 px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider rounded border border-orange-500/20">
            Optimisé
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 pl-1">
        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(p.updated_at)}
        </div>
        {p.devis_num && (
          <div className="flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 text-xs text-blue-400">
            <FileText className="w-3.5 h-3.5" />
            {p.devis_num}
          </div>
        )}
        {p.results_data && (
          <div className="flex items-center gap-1.5 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 text-xs text-purple-400">
            <Ruler className="w-3.5 h-3.5" />
            {p.results_data.summary?.totalPanels || 0} panneaux
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-1 pt-1 border-t border-white/5">
        <button
          onClick={() => onOpen(p.id)}
          className="flex-1 py-2 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          Ouvrir
        </button>
        <button
          onClick={() => onDuplicate(p.id)}
          disabled={duplicating === p.id}
          className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          title="Dupliquer"
        >
          {duplicating === p.id
            ? <div className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDelete(p.id)}
          disabled={deleting === p.id}
          className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          title="Supprimer"
        >
          {deleting === p.id
            ? <div className="w-3.5 h-3.5 border border-red-500 border-t-transparent rounded-full animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
