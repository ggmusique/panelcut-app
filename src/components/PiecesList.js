import { useState } from 'react';
import Scanner from './Scanner';

const EMPTY_PIECE = { name: '', length: '', height: '', qty: 1 };

export default function PiecesList({ t, project, onChange, onOptimize, computing }) {
  const [editing, setEditing] = useState(null); // index or 'new'
  const [draft, setDraft]     = useState(EMPTY_PIECE);
  const [error, setError]     = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [activeFurniture, setActiveFurniture] = useState(null); // index du meuble actif
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
    // Retire aussi les pièces de ce meuble
    const newPieces = pieces.filter(p => p.furnitureId !== fId);
    onChange({ ...project, furniture: newFurniture, pieces: newPieces });
    if (activeFurniture === fi) setActiveFurniture(null);
  };

  // Pièces du meuble actif (ou toutes si pas de meuble sélectionné)
  const activeFurnitureId = activeFurniture !== null ? furniture[activeFurniture]?.id : null;
  const activeFurnitureName = activeFurniture !== null ? furniture[activeFurniture]?.name : null;
  const filteredPieces = activeFurnitureId
    ? pieces.filter(p => p.furnitureId === activeFurnitureId)
    : pieces;

  const handleScannedPieces = (scanned) => {
    // Tag les pièces avec le meuble actif si sélectionné
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
    <div className="pieces-screen">
      {showScanner && (
        <Scanner
          t={t}
          onPiecesDetected={handleScannedPieces}
          onClose={() => setShowScanner(false)}
        />
      )}
      <button
        className="btn btn--scan btn--large"
        onClick={() => setShowScanner(true)}
      >
        📷 Scanner un plan
      </button>
      {/* Meubles */}
      <div className="furniture-bar">
        <button
          className={`furn-btn ${activeFurniture === null ? 'furn-btn--active' : ''}`}
          onClick={() => setActiveFurniture(null)}
        >
          Toutes les pièces ({pieces.length})
        </button>
        {furniture.map((f, fi) => (
          <div key={f.id} className="furn-item">
            <button
              className={`furn-btn ${activeFurniture === fi ? 'furn-btn--active' : ''}`}
              onClick={() => setActiveFurniture(fi)}
            >
              {f.name} ({pieces.filter(p => p.furnitureId === f.id).length})
            </button>
            <button className="furn-delete" onClick={() => deleteFurniture(fi)}>✕</button>
          </div>
        ))}
        {!showAddFurniture ? (
          <button className="furn-btn furn-btn--add" onClick={() => setShowAddFurniture(true)}>
            + Meuble
          </button>
        ) : (
          <div className="furn-add-form">
            <input
              className="input" type="text" autoFocus
              placeholder="Ex: Meuble 1 et 5"
              value={newFurnitureName}
              onChange={e => setNewFurnitureName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFurniture()}
            />
            <button className="btn btn--primary" onClick={addFurniture}>OK</button>
            <button className="btn btn--ghost" onClick={() => setShowAddFurniture(false)}>✕</button>
          </div>
        )}
      </div>

      {activeFurnitureName && (
        <div className="furn-context">
          📦 Pièces de <strong>{activeFurnitureName}</strong> — scanner ou saisir ci-dessous
        </div>
      )}

      {/* Liste */}
      {filteredPieces.length === 0 && editing === null && (
        <div className="empty-state">{t.no_pieces}</div>
      )}

      {filteredPieces.map((p) => {
        const i = pieces.indexOf(p);
        return (
          <div key={i} className={`piece-row ${editing === i ? 'piece-row--editing' : ''}`}>
            {editing === i ? (
              <PieceEditor
                t={t} draft={draft} error={error}
                onChange={updateDraft}
                onSave={savePiece}
                onCancel={() => { setEditing(null); setError(''); }}
              />
            ) : (
              <PieceItem
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

      {/* Formulaire nouveau */}
      {editing === 'new' && (
        <div className="piece-row piece-row--editing">
          <PieceEditor
            t={t} draft={draft} error={error}
            onChange={updateDraft}
            onSave={savePiece}
            onCancel={() => { setEditing(null); setError(''); }}
          />
        </div>
      )}

      {/* Actions */}
      {editing === null && (
        <button className="btn btn--ghost btn--large" onClick={startNew}>
          {t.addPiece}
        </button>
      )}

      {/* Optimize */}
      {pieces.length > 0 && editing === null && (
        <div className="optimize-bar">
          <div className="optimize-info">
            <span className="optimize-count">{totalPcs} {t.pieces_count}</span>
            <span className="optimize-panel">Panneau {project.panel.w}×{project.panel.h}cm</span>
          </div>
          <button
            className="btn btn--primary btn--large"
            onClick={onOptimize}
            disabled={computing}
          >
            {computing ? t.optimizing : t.optimize}
          </button>
        </div>
      )}
    </div>
  );
}

function PieceItem({ piece, onEdit, onDelete, onDuplicate, t }) {
  const [showActions, setShowActions] = useState(false);
  return (
    <div className="piece-item" onClick={() => setShowActions(s => !s)}>
      <div className="piece-main">
        <div className="piece-name">{piece.name}</div>
        <div className="piece-dims">
          {piece.length} × {piece.height} cm
          <span className="piece-qty">× {piece.qty}</span>
        </div>
      </div>
      <div className={`piece-actions ${showActions ? 'piece-actions--open' : ''}`}>
        <button className="action-btn action-btn--edit"   onClick={e => { e.stopPropagation(); onEdit(); }}>✏️</button>
        <button className="action-btn action-btn--dup"    onClick={e => { e.stopPropagation(); onDuplicate(); }}>⧉</button>
        <button className="action-btn action-btn--delete" onClick={e => { e.stopPropagation(); onDelete(); }}>🗑</button>
      </div>
    </div>
  );
}

function PieceEditor({ t, draft, error, onChange, onSave, onCancel }) {
  return (
    <div className="piece-editor">
      <div className="editor-row">
        <input
          className="input" type="text"
          placeholder={t.pieceName}
          value={draft.name}
          onChange={e => onChange('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="editor-row editor-row--nums">
        <div className="editor-field">
          <label className="label">{t.pieceLength}</label>
          <input className="input input--num" type="number"
            min="1" step="0.1" value={draft.length}
            onChange={e => onChange('length', e.target.value)} />
        </div>
        <div className="editor-field">
          <label className="label">{t.pieceHeight}</label>
          <input className="input input--num" type="number"
            min="1" step="0.1" value={draft.height}
            onChange={e => onChange('height', e.target.value)} />
        </div>
        <div className="editor-field editor-field--qty">
          <label className="label">{t.pieceQty}</label>
          <input className="input input--num" type="number"
            min="1" step="1" value={draft.qty}
            onChange={e => onChange('qty', e.target.value)} />
        </div>
      </div>
      {error && <div className="editor-error">{error}</div>}
      <div className="editor-btns">
        <button className="btn btn--ghost" onClick={onCancel}>{t.cancel}</button>
        <button className="btn btn--primary" onClick={onSave}>{t.save}</button>
      </div>
    </div>
  );
}
