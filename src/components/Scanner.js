import { useState, useRef } from 'react';
import { interpretScan } from '../interpretation/interpretScan';
import { buildCabinetModel } from '../interpretation/buildCabinetModel';
import { generatePiecesFromModel } from '../interpretation/generatePiecesFromModel';
import CabinetPreview3D from './CabinetPreview3D';
import CabinetPlan2D from './CabinetPlan2D';

const SERVER_URL = 'https://panelcut-server.vercel.app';

export default function Scanner({ t, onPiecesDetected, onClose }) {
  const [status, setStatus] = useState('idle'); 
  const [preview, setPreview] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [cabinetModel, setCabinetModel] = useState(null);
  const inputRef = useRef();

  /* =========================
     FILE HANDLING
  ========================= */
  const handleFile = (file) => {
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const MAX = 1600;
      let w = img.width;
      let h = img.height;

      if (w > MAX || h > MAX) {
        if (w > h) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const jpeg = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(objectUrl);

      setPreview(jpeg);
      setStatus('preview');
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg('Impossible de lire cette image');
      setStatus('error');
    };

    img.src = objectUrl;
  };

  /* =========================
     SCAN PIPELINE
  ========================= */
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

      const scanResult = await res.json();

      if (!res.ok || scanResult?.error) {
        throw new Error(scanResult.error || 'server_error');
      }

      /* ===== PATCH IMPORTANT ===== */
      const hasCabinet =
        scanResult?.cabinet?.width &&
        scanResult?.cabinet?.height &&
        scanResult?.cabinet?.depth;

      // Compat ancien flow (pieces seules)
      if (Array.isArray(scanResult?.pieces) && !hasCabinet) {
        onPiecesDetected(scanResult.pieces);
        return;
      }

      /* ===== NOUVEAU FLOW MEUBLE ===== */
      const normalizedScan = interpretScan(scanResult);
      const nextCabinetModel = buildCabinetModel(normalizedScan);

      if (
        !nextCabinetModel?.dimensions?.width ||
        !nextCabinetModel?.dimensions?.height ||
        !nextCabinetModel?.dimensions?.depth
      ) {
        setErrorMsg('Dimensions incomplètes détectées');
        setStatus('error');
        return;
      }

      setCabinetModel(nextCabinetModel);
      setStatus('cabinet-preview');

    } catch (err) {
      console.error(err);
      setErrorMsg('Erreur lors du scan');
      setStatus('error');
    }
  };

  /* =========================
     CONFIRMATION MEUBLE
  ========================= */
  const confirmCabinetModel = () => {
    if (!cabinetModel) return;

    const generatedPieces = generatePiecesFromModel(cabinetModel);

    if (!generatedPieces.length) {
      setErrorMsg('Aucune pièce générée');
      setStatus('error');
      return;
    }

    setPieces(generatedPieces);
    setSelected(new Set(generatedPieces.map((_, i) => i)));
    setStatus('done');
  };

  const togglePiece = (i) => {
    setSelected((s) => {
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

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">

        <div className="scanner-header">
          <span className="scanner-title">📷 Scanner un plan</span>
          <button className="scanner-close" onClick={onClose}>✕</button>
        </div>

        {status === 'idle' && (
          <div className="scanner-body">
            <div className="drop-zone" onClick={() => inputRef.current?.click()}>
              <div className="drop-icon">📄</div>
              <div className="drop-text">Prendre une photo ou choisir un fichier</div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {status === 'preview' && (
          <div className="scanner-body">
            <img src={preview} alt="Plan" className="scan-preview" />
            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Reprendre</button>
              <button className="btn btn--primary" onClick={scan}>🔍 Analyser</button>
            </div>
          </div>
        )}

        {status === 'scanning' && (
          <div className="scanner-body scanner-body--center">
            <div className="scan-spinner" />
            <div>Analyse du plan…</div>
          </div>
        )}

        {status === 'error' && (
          <div className="scanner-body scanner-body--center">
            <div>⚠️ {errorMsg}</div>
            <button className="btn btn--ghost" onClick={reset}>↩ Réessayer</button>
          </div>
        )}

        {status === 'cabinet-preview' && cabinetModel && (
          <div className="scanner-body">
            <h3>Validation des dimensions</h3>

            <CabinetPreview3D model={cabinetModel} />
            <CabinetPlan2D model={cabinetModel} />

            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Rescanner</button>
              <button className="btn btn--primary" onClick={confirmCabinetModel}>
                ✓ Générer les pièces
              </button>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="scanner-body">
            {pieces.map((p, i) => (
              <div
                key={i}
                className={`scan-piece-row ${selected.has(i) ? 'selected' : ''}`}
                onClick={() => togglePiece(i)}
              >
                {selected.has(i) ? '☑' : '☐'} {p.name} — {p.length} × {p.height} cm × {p.qty}
              </div>
            ))}

            <div className="scanner-btns">
              <button className="btn btn--ghost" onClick={reset}>↩ Rescanner</button>
              <button className="btn btn--primary" onClick={confirm}>
                ✓ Ajouter les pièces
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
