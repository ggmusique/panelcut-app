import { useState, useRef } from 'react';
import { interpretScan } from '../interpretation/interpretScan';
import { buildCabinetModel } from '../interpretation/buildCabinetModel';
import { generatePiecesFromModel } from '../interpretation/generatePiecesFromModel';
import CabinetPreview3D from './CabinetPreview3D';

const SERVER_URL = 'https://panelcut-server.vercel.app';

export default function Scanner({ t, onPiecesDetected, onClose }) {
  const [status, setStatus]   = useState('idle'); // idle | preview | scanning | cabinet-preview | done | error
  const [preview, setPreview] = useState(null);
  const [pieces, setPieces]   = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [cabinetModel, setCabinetModel] = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;

    // Convertit en JPEG via Canvas (gère HEIC iPhone + réduit la taille)
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Redimensionne si trop grande (max 1600px) pour accélérer le scan
      const MAX = 1600;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // Exporte en JPEG 0.85 — lisible par Claude Vision
      const jpeg = canvas.toDataURL('image/jpeg', 0.85);
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
      // Extrait base64 pur (sans le préfixe data:image/jpeg;base64,)
      const [header, base64] = preview.split(',');
      const mediaType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const res = await fetch(`${SERVER_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      const scanResult = await res.json();

      if (!res.ok || scanResult.error) {
        throw new Error(scanResult.error || 'server_error');
      }

      const normalizedScan = interpretScan(scanResult);
      const nextCabinetModel = buildCabinetModel(normalizedScan);

      if (!nextCabinetModel?.dimensions?.width || !nextCabinetModel?.dimensions?.height || !nextCabinetModel?.dimensions?.depth) {
        setErrorMsg('Dimensions incomplètes — vérifie le scan avant génération');
        setStatus('error');
        return;
      }

      setCabinetModel(nextCabinetModel);
      setStatus('cabinet-preview');

    } catch (err) {
      console.error('Scan error:', err);
      setErrorMsg(
        err.message === 'too_many_requests'
          ? '20 scans/heure max atteints — réessaie plus tard'
          : err.message === 'api_key_missing'
          ? 'Clé API manquante sur le serveur'
          : 'Erreur réseau — vérifie ta connexion'
      );
      setStatus('error');
    }
  };


  const confirmCabinetModel = () => {
    if (!cabinetModel) return;
    const generatedPieces = generatePiecesFromModel(cabinetModel);

    if (generatedPieces.length === 0) {
      setErrorMsg('Aucune pièce générée — ajuste les dimensions puis rescane');
      setStatus('error');
      return;
    }

    setPieces(generatedPieces);
    setSelected(new Set(generatedPieces.map((_, i) => i)));
    setStatus('done');
  };

  const togglePiece = (i) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const confirm = () => {
    const confirmed = pieces.filter((_, i) => selected.has(i));
    onPiecesDetected(confirmed);
  };

  const reset = () => {
    setStatus('idle');
    setPreview(null);
    setPieces([]);
    setSelected(new Set());
    setCabinetModel(null);
    setErrorMsg('');
  };

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">

        {/* Header */}
        <div className="scanner-header">
          <span className="scanner-title">📷 Scanner un plan</span>
          <button className="scanner-close" onClick={onClose}>✕</button>
        </div>

        {/* Idle — bouton photo */}
        {status === 'idle' && (
          <div className="scanner-body">
            <div
              className="drop-zone"
              onClick={() => inputRef.current?.click()}
            >
              <div className="drop-icon">📄</div>
              <div className="drop-text">Prendre une photo ou choisir un fichier</div>
              <div className="drop-sub">JPG, PNG — plan à main levée ou imprimé</div>
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

        {/* Preview */}
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

        {/* Scanning */}
        {status === 'scanning' && (
          <div className="scanner-body scanner-body--center">
            <div className="scan-spinner" />
            <div className="scan-loading-text">Analyse du plan en cours…</div>
            <div className="scan-loading-sub">Claude Vision lit les cotes</div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="scanner-body scanner-body--center">
            <div className="scan-error-icon">⚠️</div>
            <div className="scan-error-text">{errorMsg}</div>
            <button className="btn btn--ghost" onClick={reset}>↩ Réessayer</button>
          </div>
        )}


        {/* Validation meuble 3D avant génération des pièces */}
        {status === 'cabinet-preview' && (
          <div className="scanner-body">
            <div className="scan-result-header">
              <span className="scan-result-title">Validation des dimensions détectées</span>
              <span className="scan-result-hint">Vérifie le meuble 3D avant extraction des pièces</span>
            </div>

            <CabinetPreview3D model={cabinetModel} />

            <div className="scan-result-note">
              📐 Contrôle visuel: largeur, hauteur, profondeur et modules internes
            </div>

            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Rescanner</button>
              <button className="btn btn--primary" onClick={confirmCabinetModel}>
                ✓ Générer les pièces
              </button>
            </div>
          </div>
        )}

        {/* Résultats — validation */}
        {status === 'done' && (
          <div className="scanner-body">
            <div className="scan-result-header">
              <span className="scan-result-title">
                {pieces.length} pièce{pieces.length > 1 ? 's' : ''} détectée{pieces.length > 1 ? 's' : ''}
              </span>
              <span className="scan-result-hint">Coche/décoche pour corriger</span>
            </div>

            <div className="scan-pieces-list">
              {pieces.map((p, i) => (
                <div
                  key={i}
                  className={`scan-piece-row ${selected.has(i) ? 'scan-piece-row--selected' : ''}`}
                  onClick={() => togglePiece(i)}
                >
                  <div className="scan-piece-check">
                    {selected.has(i) ? '☑' : '☐'}
                  </div>
                  <div className="scan-piece-info">
                    <div className="scan-piece-name">{p.name}</div>
                    <div className="scan-piece-dims">
                      {p.length} × {p.height} cm
                      <span className="scan-piece-qty">× {p.qty}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="scan-result-note">
              📝 Les cotes peuvent nécessiter une correction manuelle
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
