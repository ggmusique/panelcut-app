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
  const [cabinetModel, setCabinetModel] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef();

  /* ===================== IMAGE LOAD ===================== */

  const handleFile = (file) => {
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const MAX = 1600;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      setPreview(canvas.toDataURL('image/jpeg', 0.85));
      setStatus('preview');
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMsg('Image invalide');
      setStatus('error');
    };

    img.src = url;
  };

  /* ===================== SCAN ===================== */

  const scan = async () => {
    if (!preview) return;
    setStatus('scanning');
    setErrorMsg('');

    try {
      const [, base64] = preview.split(',');
      const res = await fetch(`${SERVER_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      });

      const scanResult = await res.json();
      if (!res.ok || scanResult.error) {
        throw new Error(scanResult.error || 'scan_error');
      }

      // Compat pièces seules
      if (Array.isArray(scanResult?.pieces)) {
        onPiecesDetected(scanResult.pieces);
        return;
      }

      const normalized = interpretScan(scanResult);
      const model = buildCabinetModel(normalized);

      if (!model?.dimensions?.width || !model?.dimensions?.height || !model?.dimensions?.depth) {
        throw new Error('dimensions_invalides');
      }

      setCabinetModel(model);
      setStatus('cabinet-preview');

    } catch (e) {
      console.error(e);
      setErrorMsg('Erreur lors du scan');
      setStatus('error');
    }
  };

  /* ===================== PIECES ===================== */

  const generatePieces = () => {
    if (!cabinetModel) return;

    const generated = generatePiecesFromModel(cabinetModel);
    setPieces(generated);
    setSelected(new Set(generated.map((_, i) => i)));
    setStatus('done');
  };

  const confirmPieces = () => {
    const confirmed = pieces.filter((_, i) => selected.has(i));
    onPiecesDetected(confirmed);
  };

  const reset = () => {
    setStatus('idle');
    setPreview(null);
    setCabinetModel(null);
    setPieces([]);
    setSelected(new Set());
    setErrorMsg('');
  };

  /* ===================== UI ===================== */

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">

        <div className="scanner-header">
          <span>📷 Scanner un plan</span>
          <button onClick={onClose}>✕</button>
        </div>

        {status === 'idle' && (
          <div className="scanner-body">
            <div className="drop-zone" onClick={() => inputRef.current.click()}>
              📄 Choisir une image
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {status === 'preview' && (
          <div className="scanner-body">
            <img src={preview} className="scan-preview" />
            <button onClick={scan}>🔍 Analyser</button>
            <button onClick={reset}>↩ Reprendre</button>
          </div>
        )}

        {status === 'scanning' && (
          <div className="scanner-body">Analyse en cours…</div>
        )}

        {status === 'cabinet-preview' && cabinetModel && (
          <div className="scanner-body">
            <CabinetPreview3D model={cabinetModel} />
            <CabinetPlan2D model={cabinetModel} />

            <div className="scanner-btns">
              <button onClick={reset}>↩ Rescanner</button>
              <button onClick={generatePieces}>✓ Générer les pièces</button>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="scanner-body">

            {/* ✅ ON GARDE LES PLANS */}
            <CabinetPreview3D model={cabinetModel} />
            <CabinetPlan2D model={cabinetModel} />

            <button onClick={() => setStatus('cabinet-preview')}>
              ← Retour aux plans
            </button>

            <div className="scan-pieces-list">
              {pieces.map((p, i) => (
                <div key={i} onClick={() => {
                  const n = new Set(selected);
                  n.has(i) ? n.delete(i) : n.add(i);
                  setSelected(n);
                }}>
                  {selected.has(i) ? '☑' : '☐'} {p.name} — {p.length} × {p.height} × {p.qty}
                </div>
              ))}
            </div>

            <button disabled={!selected.size} onClick={confirmPieces}>
              ✓ Ajouter les pièces
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="scanner-body">
            ⚠️ {errorMsg}
            <button onClick={reset}>↩ Recommencer</button>
          </div>
        )}

      </div>
    </div>
  );
}
