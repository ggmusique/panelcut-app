import { useState } from 'react';
import Scanner from './Scanner';
import { Plus, Trash2, Copy, Edit2, ScanLine, Box, Layers, ChevronRight, Save, X, AlertCircle } from 'lucide-react';

const EMPTY_PIECE = { name: '', length: '', height: '', qty: 1 };

/** Returns true when a piece is a rod/tringle (not cut from wood panels). */
const isRodPiece = (p) =>
  p.isRod === true ||
  p.type === 'rod' ||
  /tringle/i.test(String(p.name || ''));

export default function PiecesList({ t, project, onChange, onOptimize, computing }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft]     = useState(EMPTY_PIECE);
  const [error, setError]     = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [activeFurniture, setActiveFurniture] = useState(null);
  const [newFurnitureName, setNewFurnitureName] = useState('');
  const [showAddFurniture, setShowAddFurniture] = useState(false);

  const pieces = project.pieces || [];
  const woodPieces = pieces.filter(p => !isRodPiece(p));
  const rodPieces  = pieces.filter(p =>  isRodPiece(p));
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
    const piece = { name: draft.name.trim(), length: parseFloat(draft.length), height: parseFloat(draft.height), qty: parseInt(draft.qty, 10) };
    let newPieces;
    if (editing === 'new') { newPieces = [...pieces, piece]; }
    else { newPieces = pieces.map((p, i) => i === editing ? piece : p); }
    onChange({ ...project, pieces: newPieces });
    setEditing(null); setDraft(EMPTY_PIECE); setError('');
  };

  const deletePiece = i => onChange({ ...project, pieces: pieces.filter((_, idx) => idx !== i) });
  const duplicatePiece = i => { const p = pieces[i]; onChange({ ...project, pieces: [...pieces, { ...p }] }); };
  const startEdit = i => { setDraft({ ...pieces[i] }); setEditing(i); setError(''); };
  const startNew = () => { setDraft(EMPTY_PIECE); setEditing('new'); setError(''); };

  const furniture = project.furniture || [];
  const addFurniture = () => {
    if (!newFurnitureName.trim()) return;
    const newF = { id: Date.now(), name: newFurnitureName.trim() };
    onChange({ ...project, furniture: [...furniture, newF] });
    setActiveFurniture(furniture.length); setNewFurnitureName(''); setShowAddFurniture(false);
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
  const filteredPieces = activeFurnitureId ? pieces.filter(p => p.furnitureId === activeFurnitureId) : pieces;

  const handleScannedPieces = (scanned) => {
    const tagged = scanned.map(p => ({ ...p, furnitureId: activeFurnitureId || null, furnitureName: activeFurnitureName || null }));
    onChange({ ...project, pieces: [...pieces, ...tagged] });
    setShowScanner(false);
  };

  const totalPcs = woodPieces.reduce((s, p) => s + (p.qty || 1), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-32 relative font-sans">

      {/* MODAL SCANNER */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-orange-500" /> Scanner un plan
              </h3>
              <button onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4">
              <Scanner t={t} onPiecesDetected={handleScannedPieces} onClose={() => setShowScanner(false)} />
            </div>
          </div>
        </div>
      )}

      {/* LAYOUT PRINCIPAL: sidebar gauche + liste droite sur desktop */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* SIDEBAR GAUCHE: actions + meubles */}
          <div className="space-y-4 lg:sticky lg:top-20">

            {/* Bouton Scanner */}
            <button
              onClick={() => setShowScanner(true)}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 transition-all transform hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <div className="relative flex items-center justify-center gap-3">
                <ScanLine className="w-6 h-6" />
                <span>Scanner un plan</span>
              </div>
            </button>

            {/* Meubles */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Meubles / Groupes</h3>
              <div className="flex flex-col gap-2">
                <button
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    activeFurniture === null 
                      ? 'bg-white text-black border-white' 
                      : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5 hover:text-white'
                  }`}
                  onClick={() => setActiveFurniture(null)}
                >
                  <Layers className="w-4 h-4" /> Tout ({pieces.length})
                </button>
                {furniture.map((f, fi) => (
                  <div key={f.id} className="flex items-center gap-1">
                    <button
                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        activeFurniture === fi 
                          ? 'bg-orange-500 text-white border-orange-500' 
                          : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5 hover:text-white'
                      }`}
                      onClick={() => setActiveFurniture(fi)}
                    >
                      <Box className="w-4 h-4" /> {f.name}
                    </button>
                    <button onClick={() => deleteFurniture(fi)} className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {!showAddFurniture ? (
                  <button 
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 border border-dashed border-white/20 hover:border-orange-500/50 hover:text-orange-500 transition-all"
                    onClick={() => setShowAddFurniture(true)}
                  >
                    <Plus className="w-4 h-4" /> Ajouter un groupe
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-[#0a0a0a] p-1.5 rounded-lg border border-orange-500/30">
                    <input
                      className="bg-transparent text-white text-sm px-2 py-1 outline-none flex-1 placeholder-slate-600"
                      type="text" autoFocus placeholder="Nom..."
                      value={newFurnitureName}
                      onChange={e => setNewFurnitureName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addFurniture()}
                    />
                    <button className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md" onClick={addFurniture}><Save className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 bg-slate-700 text-white rounded-md" onClick={() => setShowAddFurniture(false)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Barre d'optimisation (visible sur desktop dans la sidebar) */}
            {pieces.length > 0 && editing === null && (
              <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                    <Layers className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{totalPcs}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Pièces bois à couper</div>
                  </div>
                </div>
                {rodPieces.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-pink-400 bg-pink-500/10 px-3 py-1.5 rounded-lg border border-pink-500/20">
                    <span>🔩</span>
                    <span><strong>{rodPieces.reduce((s, p) => s + (p.qty || 1), 0)}</strong> tringle(s) — non optimisée(s)</span>
                  </div>
                )}
                <div className="text-sm text-slate-300">
                  Panneau <span className="text-white font-bold">{project.panel.w}×{project.panel.h}</span> cm
                </div>
                <button
                  className={`w-full px-4 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                    computing || woodPieces.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500'
                  }`}
                  onClick={onOptimize}
                  disabled={computing || woodPieces.length === 0}
                >
                  {computing ? 'Calcul...' : woodPieces.length === 0 ? 'Aucune pièce bois' : 'Lancer l\'optimisation'}
                </button>
              </div>
            )}
          </div>

          {/* LISTE DES PIÈCES */}
          <div className="space-y-3">
            {activeFurnitureName && (
              <div className="text-xs text-orange-400 font-medium flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                <Box className="w-3.5 h-3.5" />
                Édition de : <span className="text-white font-bold">{activeFurnitureName}</span>
              </div>
            )}

            {filteredPieces.length === 0 && editing === null && (
              <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center">
                <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Aucune pièce</h3>
                <p className="text-slate-500 text-sm">Scannez un plan ou ajoutez une pièce manuellement.</p>
              </div>
            )}

            {filteredPieces.map((p) => {
              const i = pieces.indexOf(p);
              const isRod = isRodPiece(p);
              return (
                <div key={i} className={`group relative rounded-xl p-4 border transition-all duration-300 ${
                  isRod
                    ? 'bg-[#111] hover:bg-[#161616] border-pink-500/20 hover:border-pink-500/40'
                    : 'bg-[#111] hover:bg-[#161616] border-white/5 hover:border-orange-500/30'
                }`}>
                  {editing === i ? (
                    <PieceEditorDark t={t} draft={draft} error={error} onChange={updateDraft} onSave={savePiece} onCancel={() => { setEditing(null); setError(''); }} />
                  ) : (
                    <PieceItemDark piece={p} onEdit={() => startEdit(i)} onDelete={() => deletePiece(i)} onDuplicate={() => duplicatePiece(i)} t={t} />
                  )}
                </div>
              );
            })}

            {editing === 'new' && (
              <div className="bg-[#111] rounded-xl p-4 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                <PieceEditorDark t={t} draft={draft} error={error} onChange={updateDraft} onSave={savePiece} onCancel={() => { setEditing(null); setError(''); }} />
              </div>
            )}

            {editing === null && (
              <button 
                className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 text-slate-500 font-bold hover:border-orange-500/50 hover:text-orange-500 hover:bg-orange-500/5 transition-all flex items-center justify-center gap-2"
                onClick={startNew}
              >
                <Plus className="w-5 h-5" /> Ajouter une pièce manuellement
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BARRE FLOTTANTE MOBILE uniquement */}
      {pieces.length > 0 && editing === null && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-4 lg:hidden">
          <div className="max-w-4xl mx-auto bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                <Layers className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{totalPcs}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-1">
                  Pièces bois{rodPieces.length > 0 && <span className="ml-1 text-pink-400">· {rodPieces.reduce((s,p) => s + (p.qty||1), 0)} 🔩</span>}
                </div>
              </div>
            </div>
            <button
              className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                computing || woodPieces.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-orange-600 to-red-600'
              }`}
              onClick={onOptimize}
              disabled={computing || woodPieces.length === 0}
            >
              {computing ? 'Calcul...' : 'Optimiser'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PieceItemDark({ piece, onEdit, onDelete, onDuplicate, t }) {
  const [showActions, setShowActions] = useState(false);
  const isRod = isRodPiece(piece);
  return (
    <div className="flex items-center justify-between" onClick={() => setShowActions(s => !s)}>
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          {isRod && <span className="text-base" title="Tringle — non optimisée">🔩</span>}
          <h4 className="text-lg font-bold text-white truncate">{piece.name}</h4>
          {isRod && (
            <span className="text-[10px] uppercase tracking-wider bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded border border-pink-500/20">Non optimisée</span>
          )}
          {piece.furnitureName && (
            <span className="text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{piece.furnitureName}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isRod ? 'bg-pink-500' : 'bg-orange-500'}`}></span>
            <span className="text-white font-mono">{piece.length}</span>
            <span className="text-slate-600">×</span>
            <span className="text-white font-mono">{piece.height}</span>
            <span className="text-xs text-slate-500 ml-1">cm</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isRod ? 'bg-pink-400' : 'bg-purple-500'}`}></span>
            <span className="text-xs uppercase font-bold text-slate-500 mr-1">Qté</span>
            <span className="text-white font-bold text-base">{piece.qty}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 transition-all duration-300 ${showActions ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
          <button className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg" onClick={e => { e.stopPropagation(); onDuplicate(); }}><Copy className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg" onClick={e => { e.stopPropagation(); onEdit(); }}><Edit2 className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" onClick={e => { e.stopPropagation(); onDelete(); }}><Trash2 className="w-5 h-5" /></button>
        </div>
        <button className={`p-2 text-slate-600 transition-transform ${showActions ? 'rotate-180' : ''}`}><ChevronRight className="w-5 h-5" /></button>
      </div>
    </div>
  );
}

function PieceEditorDark({ t, draft, error, onChange, onSave, onCancel }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Nom de la pièce</label>
        <input className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
          type="text" placeholder="Ex: Montant gauche" value={draft.name} onChange={e => onChange('name', e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Longueur (cm)</label>
          <input className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 outline-none" type="number" step="0.1" value={draft.length} onChange={e => onChange('length', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Hauteur (cm)</label>
          <input className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 outline-none" type="number" step="0.1" value={draft.height} onChange={e => onChange('height', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Quantité</label>
          <input className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-orange-500 outline-none" type="number" step="1" value={draft.qty} onChange={e => onChange('qty', e.target.value)} />
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button className="flex-1 py-3 rounded-lg border border-white/10 text-slate-400 font-bold hover:bg-white/5 hover:text-white transition-colors" onClick={onCancel}>Annuler</button>
        <button className="flex-1 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg transition-all" onClick={onSave}>Enregistrer</button>
      </div>
    </div>
  );
}