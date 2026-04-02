import { useState, useRef } from 'react';

const SERVER_URL = 'https://panelcut-server.vercel.app';

// Couleur par rôle
const ROLE_COLORS = {
  side:         { bg: '#dbeafe', text: '#1d4ed8', label: 'Côté' },
  top:          { bg: '#dcfce7', text: '#15803d', label: 'Dessus' },
  bottom:       { bg: '#fef9c3', text: '#a16207', label: 'Fond bas' },
  shelf:        { bg: '#ede9fe', text: '#6d28d9', label: 'Tablette' },
  divider:      { bg: '#ffedd5', text: '#c2410c', label: 'Séparation' },
  back:         { bg: '#e0f2fe', text: '#0369a1', label: 'Dos' },
  door:         { bg: '#fce7f3', text: '#9d174d', label: 'Porte' },
  drawer_front: { bg: '#f0fdf4', text: '#166534', label: 'Facade tiroir' },
  drawer_box:   { bg: '#f0fdf4', text: '#15803d', label: 'Caisse tiroir' },
  other:        { bg: '#f1f5f9', text: '#475569', label: 'Autre' },
};

const CABINET_TYPE_ICON = {
  armoire: '🚪', bibliotheque: '📚', cuisine: '🍳',
  bureau: '🖥️', commode: '🗄️', autre: '📦',
};

export default function Scanner({ t, onPiecesDetected, onClose }) {
  const [status, setStatus]   = useState('idle');
  const [preview, setPreview] = useState(null);
  const [pieces, setPieces]   = useState([]);
  const [cabinet, setCabinet] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [editNotes, setEditNotes] = useState({});
  const inputRef = useRef();

  // Compression + conversion HEIC → JPEG
  const handleFile = async (file) => {
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      // Redimensionne à max 1920px (plus grande que avant pour meilleure lecture des cotes)
      const MAX = 1920;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Fond blanc (important pour les plans à fond clair)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      // Augmente légèrement le contraste pour mieux lire les cotes
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const jpeg = canvas.toDataURL('image/jpeg', 0.92); // qualité 92% pour les petits textes
      URL.revokeObjectURL(objectUrl);
      setPreview(jpeg);
      setStatus('preview');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg('Impossible de lire cette image — essaie un autre format');
      setStatus('error');
    };
    img.src = objectUrl;
  };

  const scan = async () => {
    if (!preview) return;
    setStatus('scanning');
    setErrorMsg('');

    try {
      const [header, base64] = preview.split(',');
      const mediaType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const res = await fetch(`${SERVER_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'server_error');
      }

      if (!data.pieces || data.pieces.length === 0) {
        setErrorMsg('Aucune pièce détectée — essaie avec une meilleure photo');
        setStatus('error');
        return;
      }

      setPieces(data.pieces);
      setCabinet(data.cabinet || null);
      setSelected(new Set(data.pieces.map((_, i) => i)));
      setEditNotes({});
      setStatus('done');

    } catch (err) {
      console.error('Scan error:', err);
      setErrorMsg(
        err.message === 'too_many_requests'
          ? '30 scans/heure max atteints — réessaie plus tard'
          : err.message === 'api_key_missing'
          ? 'Clé API manquante sur le serveur'
          : err.message === 'no_pieces'
          ? 'Aucune pièce détectée — essaie avec une meilleure photo ou un plan plus lisible'
          : 'Erreur réseau — vérifie ta connexion'
      );
      setStatus('error');
    }
  };

  const togglePiece = (i) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === pieces.length) setSelected(new Set());
    else setSelected(new Set(pieces.map((_, i) => i)));
  };

  const confirm = () => {
    const confirmed = pieces
      .filter((_, i) => selected.has(i))
      .map((p, i) => ({
        ...p,
        notes: editNotes[i] !== undefined ? editNotes[i] : p.notes,
      }));
    onPiecesDetected(confirmed, cabinet);
  };

  const reset = () => {
    setStatus('idle');
    setPreview(null);
    setPieces([]);
    setCabinet(null);
    setSelected(new Set());
    setEditNotes({});
    setErrorMsg('');
  };

  // Confidence bar color
  const confColor = (c) =>
    c >= 0.8 ? '#16a34a' : c >= 0.5 ? '#d97706' : '#dc2626';

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">

        {/* Header */}
        <div className="scanner-header">
          <span className="scanner-title">📷 Scanner un plan</span>
          <button className="scanner-close" onClick={onClose}>✕</button>
        </div>

        {/* ── IDLE ─────────────────────────────────────────────────── */}
        {status === 'idle' && (
          <div className="scanner-body">
            <div className="drop-zone" onClick={() => inputRef.current?.click()}>
              <div className="drop-icon">📄</div>
              <div className="drop-text">Prendre une photo ou choisir un fichier</div>
              <div className="drop-sub">JPG, PNG, HEIC — plan à main levée ou imprimé</div>
              <div className="drop-tips">
                <div className="drop-tip">✅ Éclairage uniforme</div>
                <div className="drop-tip">✅ Plan à plat, cadré droit</div>
                <div className="drop-tip">✅ Cotes visibles et lisibles</div>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        {status === 'preview' && (
          <div className="scanner-body">
            <img src={preview} alt="Plan" className="scan-preview" />
            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Reprendre</button>
              <button className="btn btn--primary" onClick={scan}>
                🔍 Analyser avec l'IA
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ─────────────────────────────────────────────── */}
        {status === 'scanning' && (
          <div className="scanner-body scanner-body--center">
            <div className="scan-spinner" />
            <div className="scan-loading-text">Analyse du plan en cours…</div>
            <div className="scan-loading-sub">Passe 1 — lecture de la structure</div>
            <div className="scan-loading-sub" style={{ marginTop: 4, opacity: 0.6 }}>
              Passe 2 — extraction des pièces
            </div>
            <div className="scan-loading-note">
              ⏱ 10–20 secondes selon la complexité
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="scanner-body scanner-body--center">
            <div className="scan-error-icon">⚠️</div>
            <div className="scan-error-text">{errorMsg}</div>
            <button className="btn btn--ghost" onClick={reset}>↩ Réessayer</button>
          </div>
        )}

        {/* ── DONE : résultats ─────────────────────────────────────── */}
        {status === 'done' && (
          <div className="scanner-body">

            {/* Résumé meuble (si passe 1 a réussi) */}
            {cabinet && cabinet.width && (
              <div className="cabinet-summary">
                <div className="cabinet-summary-header">
                  <span className="cabinet-type-icon">
                    {CABINET_TYPE_ICON[cabinet.type] || '📦'}
                  </span>
                  <div className="cabinet-summary-info">
                    <div className="cabinet-summary-name">
                      {cabinet.name || cabinet.type || 'Meuble'}
                    </div>
                    <div className="cabinet-summary-dims">
                      {cabinet.width} × {cabinet.height} × {cabinet.depth} cm
                      <span className="cabinet-mat"> · {cabinet.material}</span>
                    </div>
                    <div className="cabinet-summary-counts">
                      {cabinet.nb_shelves > 0 && <span>📐 {cabinet.nb_shelves} tablette{cabinet.nb_shelves > 1 ? 's' : ''}</span>}
                      {cabinet.nb_doors   > 0 && <span>🚪 {cabinet.nb_doors} porte{cabinet.nb_doors > 1 ? 's' : ''}</span>}
                      {cabinet.nb_drawers > 0 && <span>🗄️ {cabinet.nb_drawers} tiroir{cabinet.nb_drawers > 1 ? 's' : ''}</span>}
                      {cabinet.nb_dividers > 0 && <span>↕ {cabinet.nb_dividers} séparation{cabinet.nb_dividers > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  {/* Barre de confiance */}
                  <div className="cabinet-confidence">
                    <div className="conf-label">Confiance</div>
                    <div className="conf-bar">
                      <div
                        className="conf-fill"
                        style={{
                          width: `${Math.round((cabinet.confidence || 0.5) * 100)}%`,
                          background: confColor(cabinet.confidence || 0.5),
                        }}
                      />
                    </div>
                    <div className="conf-pct" style={{ color: confColor(cabinet.confidence || 0.5) }}>
                      {Math.round((cabinet.confidence || 0.5) * 100)}%
                    </div>
                  </div>
                </div>
                {cabinet.scale_note && (
                  <div className="cabinet-scale-note">📏 {cabinet.scale_note}</div>
                )}
              </div>
            )}

            {/* Titre + toggle tout */}
            <div className="scan-result-header">
              <span className="scan-result-title">
                {pieces.length} pièce{pieces.length > 1 ? 's' : ''} détectée{pieces.length > 1 ? 's' : ''}
              </span>
              <button className="scan-toggle-all" onClick={toggleAll}>
                {selected.size === pieces.length ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>

            {/* Liste des pièces */}
            <div className="scan-pieces-list">
              {pieces.map((p, i) => {
                const roleInfo = ROLE_COLORS[p.role] || ROLE_COLORS.other;
                const isSelected = selected.has(i);
                return (
                  <div
                    key={i}
                    className={`scan-piece-row ${isSelected ? 'scan-piece-row--selected' : ''}`}
                    onClick={() => togglePiece(i)}
                  >
                    <div className="scan-piece-check">
                      {isSelected ? '☑' : '☐'}
                    </div>
                    <div className="scan-piece-info">
                      <div className="scan-piece-top">
                        <div className="scan-piece-name">{p.name}</div>
                        <span
                          className="scan-piece-role-badge"
                          style={{ background: roleInfo.bg, color: roleInfo.text }}
                        >
                          {roleInfo.label}
                        </span>
                      </div>
                      <div className="scan-piece-dims">
                        <span className="dim-main">{p.length} × {p.height} cm</span>
                        <span className="dim-thick">ép. {p.thickness} cm</span>
                        <span className="scan-piece-qty">× {p.qty}</span>
                        {p.material && p.material !== 'inconnu' && (
                          <span className="dim-mat">{p.material}</span>
                        )}
                      </div>
                      {/* Notes IA + éditable */}
                      {(p.notes || editNotes[i] !== undefined) && (
                        <input
                          className="scan-piece-note-input"
                          value={editNotes[i] !== undefined ? editNotes[i] : (p.notes || '')}
                          placeholder="Note…"
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditNotes(n => ({ ...n, [i]: e.target.value }))}
                        />
                      )}
                      {/* Bouton pour ajouter une note si vide */}
                      {!p.notes && editNotes[i] === undefined && (
                        <button
                          className="scan-add-note-btn"
                          onClick={e => { e.stopPropagation(); setEditNotes(n => ({ ...n, [i]: '' })); }}
                        >
                          + note
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Rescanner</button>
              <button
                className="btn btn--primary"
                onClick={confirm}
                disabled={selected.size === 0}
              >
                ✓ Ajouter {selected.size} pièce{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
