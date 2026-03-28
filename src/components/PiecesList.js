import { useState } from 'react';
import Scanner from './Scanner';
import { Plus, Trash2, Copy, Edit2, ScanLine, Box, Layers, ChevronRight, Save, X, AlertCircle } from 'lucide-react';

const EMPTY_PIECE = { name: '', length: '', height: '', qty: 1 };

export default function PiecesList({ t, project, onChange, onOptimize, computing }) {
  const [editing, setEditing] = useState(null); // index or 'new'
  const [draft, setDraft]     = useState(EMPTY_PIECE);
  const [error, setError]     = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [activeFurniture, setActiveFurniture] = useState(null);
  const [newFurnitureName, setNewFurnitureName] = useState('');
  const [showAddFurniture, setShowAddFurniture] = useState(false);

  const pieces = project.pieces || [];

  const updateDraft = (key, val) => setDraft(d => ({ ...d, [key]: val }));

  const validate = () => {
    if (!draft.name.trim())       return 'Nom requis';
    if (!draft.length || draft.length <= 0) return 'Longueur invalide';
    if (!draft.height || draft.height <= 0) return 'Hauteur invalide';
    if (!draft.qty || draft.qty < 1)        return 'Quantité invalide';
    return '';
  };

  const savePiece = () => {
    const err = validate();
    if (err) { setError(err); return; }
    const piece = {
      name:   draft.name.trim(),
      length: parseFloat(draft.length),
      height: parseFloat(draft.height),
      qty:    parseInt(draft.qty, 10),
    };
    let newPieces;
    if (editing === 'new') {
      newPieces = [...pieces, piece];
    } else {
      newPieces = pieces.map((p, i) => i === editing ? piece : p);
    }
    onChange({ ...project, pieces: newPieces });
    setEditing(null);
    setDraft(EMPTY_PIECE);
    setError('');
  };

  const deletePiece = i => {
    onChange({ ...project, pieces: pieces.filter((_, idx) => idx !== i) });
  };

  const duplicatePiece = i => {
    const p = pieces[i];
    onChange({ ...project, pieces: [...pieces, { ...p }] });
  };

  const startEdit = i => {
    setDraft({ ...pieces[i] });
    setEditing(i);
    setError('');
  };

  const startNew = () => {
    setDraft(EMPTY_PIECE);
    setEditing('new');
    setError('');
  };

  // Gestion meubles
  const furniture = project.furniture || [];

  const addFurniture = () => {
    if (!newFurnitureName.trim()) return;
    const newF = { id: Date.now(), name: newFurnitureName.trim() };
    onChange({ ...project, furniture: [...furniture, newF] });
    setActiveFurniture(furniture.length);
    setNewFurnitureName('');
    setShowAddFurniture(false);
  };

  const deleteFurniture = (fi) => {
    const fId = furniture[fi].id;
    const newFurniture = furniture.filter((_, i) => i !== fi);
    const newPieces = pieces.filter(p => p.furnitureId !== fId);
    onChange({ ...project, furniture: newFurniture, pieces: newPieces });
    if (activeFurniture === fi) setActiveFurniture(null);
  };

  const activeFurnitureId = activeFurniture !== null ? furniture[activeFurniture]?.id : null;
  const activeFurnitureName = activeFurniture !== null ? furniture[activeFurniture]?.name : null;
  const filteredPieces = activeFurnitureId
    ? pieces.filter(p => p.furnitureId === activeFurnitureId)
    : pieces;

  const handleScannedPieces = (scanned) => {
    const tagged = scanned.map(p => ({
      ...p,
      furnitureId: activeFurnitureId || null,
      furnitureName: activeFurnitureName || null,
    }));
    onChange({ ...project, pieces: [...pieces, ...tagged] });
    setShowScanner(false);
  };

  const totalPcs = pieces.reduce((s, p) => s + (p.qty || 1), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-32 relative font-sans">
      
      {/* MODAL SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-orange-500" />
                Scanner un plan
              </h3>
              <button onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <Scanner t={t} onPiecesDetected={handleScannedPieces} onClose={() => setShowScanner(false)} />
            </div>
          </div>
        </div>
      )}

      {/* HEADER ACTIONS */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 pb-4 pt-4">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          
          {/* Bouton Scanner Principal */}
          <button
            onClick={() => setShowScanner(true)}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 transition-all transform hover:-translate-y-0.5"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <div className="relative flex items-center justify-center gap-3">
              <ScanLine className="w-6 h-6" />
              <span>Scanner un nouveau plan</span>
            </div>
          </button>

          {/* Barre de Meubles (Onglets) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activeFurniture === null 
                  ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                  : 'bg-[#111] text-slate-400 border-white/5 hover:bg-[#1a1a1a] hover:text-white'
              }`}
              onClick={() => setActiveFurniture(null)}
            >
              <Layers className="w-4 h-4 inline mr-2 -mt-0.5" />
              Tout ({pieces.length})
            </button>

            {furniture.map((f, fi) => (
              <div key={f.id} className="flex-shrink-0 flex items-center gap-1">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    activeFurniture === fi 
                      ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                      : 'bg-[#111] text-slate-400 border-white/5 hover:bg-[#1a1a1a] hover:text-white'
                  }`}
                  onClick={() => setActiveFurniture(fi)}
                >
                  <Box className="w-4 h-4 inline mr-2 -mt-0.5" />
                  {f.name}
                </button>
                <button 
                  onClick={() => deleteFurniture(fi)}
                  className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {!showAddFurniture ? (
              <button 
                className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[#111] text-slate-400 border border-dashed border-white/20 hover:border-orange-500/50 hover:text-orange-500 transition-all"
                onClick={() => setShowAddFurniture(true)}
              >
                <Plus className="w-4 h-4 inline" />
              </button>
            ) : (
              <div className="flex-shrink-0 flex items-center gap-2 bg-[#111] p-1.5 rounded-lg border border-orange-500/30 animate-fade-in">
                <input
                  className="bg-transparent text-white text-sm px-2 py-1 outline-none w-32 placeholder-slate-600"
                  type="text" autoFocus
                  placeholder="Nom du meuble..."
                  value={newFurnitureName}
                  onChange={e => setNewFurnitureName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFurniture()}
                />
                <button className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors" onClick={addFurniture}>
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors" onClick={() => setShowAddFurniture(false)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          {activeFurnitureName && (
            <div className="text-xs text-orange-400 font-medium flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
              <Box className="w-3.5 h-3.5" />
              Édition de : <span className="text-white font-bold">{activeFurnitureName}</span>
            </div>
          )}
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        
        {filteredPieces.length === 0 && editing === null && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center">
            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Aucune pièce</h3>
            <p className="text-slate-500 text-sm">Scannez un plan ou ajoutez une pièce manuellement.</p>
          </div>
        )}

        {/* LISTE DES PIÈCES */}
        {filteredPieces.map((p) => {
          const i = pieces.indexOf(p);
          return (
            <div key={i} className="group relative bg-[#111] hover:bg-[#161616] rounded-xl p-4 border border-white/5 hover:border-orange-500/30 transition-all duration-300 shadow-sm hover:shadow-[0_4px_20px_-5px_rgba(249,115,22,0.15)]">
              {editing === i ? (
                <PieceEditorDark
                  t={t} draft={draft} error={error}
                  onChange={updateDraft}
                  onSave={savePiece}
                  onCancel={() => { setEditing(null); setError(''); }}
                />
              ) : (
                <PieceItemDark
                  piece={p}
                  onEdit={() => startEdit(i)}
                  onDelete={() => deletePiece(i)}
                  onDuplicate={() => duplicatePiece(i)}
                  t={t}
                />
              )}
            </div>
          );
        })}

        {/* FORMULAIRE NOUVELLE PIÈCE */}
        {editing === 'new' && (
          <div className="bg-[#111] rounded-xl p-4 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)] animate-fade-in-up">
            <PieceEditorDark
              t={t} draft={draft} error={error}
              onChange={updateDraft}
              onSave={savePiece}
              onCancel={() => { setEditing(null); setError(''); }}
            />
          </div>
        )}

        {/* BOUTON AJOUTER */}
        {editing === null && (
          <button 
            className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 text-slate-500 font-bold hover:border-orange-500/50 hover:text-orange-500 hover:bg-orange-500/5 transition-all flex items-center justify-center gap-2"
            onClick={startNew}
          >
            <Plus className="w-5 h-5" />
            Ajouter une pièce manuellement
          </button>
        )}

        {/* BARRE D'OPTIMISATION FLOTTANTE */}
        {pieces.length > 0 && editing === null && (
          <div className="fixed bottom-6 left-0 right-0 z-40 px-4">
            <div className="max-w-4xl mx-auto bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                  <Layers className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white leading-none">{totalPcs}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-1">Pièces à couper</div>
                </div>
                <div className="hidden sm:block h-8 w-px bg-white/10 mx-2"></div>
                <div className="hidden sm:block text-sm text-slate-300">
                  Panneau <span className="text-white font-bold">{project.panel.w}×{project.panel.h}</span> cm
                </div>
              </div>
              
              <button
                className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${
                  computing 
                    ? 'bg-slate-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-orange-900/30'
                }`}
                onClick={onOptimize}
                disabled={computing}
              >
                {computing ? 'Calcul en cours...' : 'Lancer l\'optimisation'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- COMPOSANTS INTERNES STYLE DARK ---

function PieceItemDark({ piece, onEdit, onDelete, onDuplicate, t }) {
  const [showActions, setShowActions] = useState(false);
  
  return (
    <div className="flex items-center justify-between" onClick={() => setShowActions(s => !s)}>
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="text-lg font-bold text-white truncate">{piece.name}</h4>
          {piece.furnitureName && (
            <span className="text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
              {piece.furnitureName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
            <span className="text-white font-mono">{piece.length}</span>
            <span className="text-slate-600">×</span>
            <span className="text-white font-mono">{piece.height}</span>
            <span className="text-xs text-slate-500 ml-1">cm</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
            <span className="text-xs uppercase font-bold text-slate-500 mr-1">Qté</span>
            <span className="text-white font-bold text-base">{piece.qty}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 transition-all duration-300 ${showActions ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
          <button className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Dupliquer">
            <Copy className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors" onClick={e => { e.stopPropagation(); onEdit(); }} title="Modifier">
            <Edit2 className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" onClick={e => { e.stopPropagation(); onDelete(); }} title="Supprimer">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <button className={`p-2 text-slate-600 transition-transform ${showActions ? 'rotate-180' : ''}`} onClick={() => setShowActions(!showActions)}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function PieceEditorDark({ t, draft, error, onChange, onSave, onCancel }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Nom de la pièce</label>
        <input
          className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
          type="text"
          placeholder="Ex: Montant gauche"
          value={draft.name}
          onChange={e => onChange('name', e.target.value)}
          autoFocus
        />
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Longueur (cm)</label>
          <input 
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
            type="number" step="0.1" 
            value={draft.length}
            onChange={e => onChange('length', e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Hauteur (cm)</label>
          <input 
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
            type="number" step="0.1" 
            value={draft.height}
            onChange={e => onChange('height', e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Quantité</label>
          <input 
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
            type="number" step="1" 
            value={draft.qty}
            onChange={e => onChange('qty', e.target.value)} 
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button 
          className="flex-1 py-3 rounded-lg border border-white/10 text-slate-400 font-bold hover:bg-white/5 hover:text-white transition-colors" 
          onClick={onCancel}
        >
          Annuler
        </button>
        <button 
          className="flex-1 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg shadow-orange-900/20 transition-all transform hover:-translate-y-0.5" 
          onClick={onSave}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
