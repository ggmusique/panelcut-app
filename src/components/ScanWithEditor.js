/**
 * ScanWithEditor.js — Wrapper qui orchestre :
 *  1. Le composant de scan IA existant (photo → Claude → résultat brut)
 *  2. L'éditeur de croquis SketchEditor (annotations)
 *  3. La relance Claude ClaudeRefinement (image annotée → résultat affiné)
 *
 * Props :
 *  onComplete(scanResult) — appelé quand le résultat final est prêt
 *  apiKey                 — clé Anthropic
 */
import { useState } from 'react';
import SketchEditor     from './SketchEditor';
import ClaudeRefinement from './ClaudeRefinement';

const STEP = {
  SCAN:   'scan',     // scan initial en cours / terminé
  EDITOR: 'editor',  // éditeur de croquis ouvert
  REFINE: 'refine',  // modal de relance Claude
  DONE:   'done',    // résultat final OK
};

export default function ScanWithEditor({ initialScanResult, scanImage, apiKey, onComplete, onBackToScan }) {
  const [step,            setStep]            = useState(
    initialScanResult ? STEP.EDITOR : STEP.SCAN
  );
  const [scanResult,      setScanResult]      = useState(initialScanResult || null);
  const [annotatedPNG,    setAnnotatedPNG]    = useState(null);
  const [annotations,     setAnnotations]     = useState([]);
  const [refinedResult,   setRefinedResult]   = useState(null);

  // 1. Résultat du scan initial reçu → passer à l'éditeur
  const handleScanReady = (result, image) => {
    setScanResult(result);
    setStep(STEP.EDITOR);
  };

  // 2. Export PNG depuis l'éditeur → ouvrir modal relance
  const handleEditorExport = (png, els) => {
    setAnnotatedPNG(png);
    setAnnotations(els);
    setStep(STEP.REFINE);
  };

  // 3. Résultat raffiné reçu → terminé
  const handleRefinementDone = (newResult) => {
    setRefinedResult(newResult);
    // Merge : on garde les pièces raffinées, on enrichit avec les données initiales si manquant
    const merged = {
      ...scanResult,
      ...newResult,
      cabinet: { ...(scanResult?.cabinet || {}), ...(newResult?.cabinet || {}) },
      pieces:  newResult.pieces?.length ? newResult.pieces : (scanResult?.pieces || []),
    };
    onComplete(merged);
  };

  // Bouton "Utiliser tel quel" (sans relancer Claude)
  const handleUseAsIs = () => {
    if (scanResult) onComplete(scanResult);
  };

  return (
    <div className="w-full">
      {/* ─ Étape EDITOR ─ */}
      {step === STEP.EDITOR && (
        <div className="flex flex-col gap-4">
          <SketchEditor
            scanImage={scanImage}
            initialResult={scanResult}
            onExport={handleEditorExport}
            onCancel={onBackToScan}
            onComplete={handleRefinementDone}
          />

          {/* Bouton bypass : utiliser le scan initial sans corriger */}
          <div className="flex justify-between items-center bg-white/3 rounded-xl p-4 border border-white/5">
            <div>
              <p className="text-sm text-white font-bold">Résultat actuel suffisant ?</p>
              <p className="text-xs text-slate-400">Utiliser le scan initial sans relancer l'IA</p>
            </div>
            <button
              onClick={handleUseAsIs}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-green-700 hover:bg-green-600 text-white transition-all shadow"
            >
              ✅ Utiliser tel quel →
            </button>
          </div>
        </div>
      )}

      {/* ─ Étape REFINE ─ */}
      {step === STEP.REFINE && (
        <ClaudeRefinement
          annotatedImage={annotatedPNG}
          annotations={annotations}
          initialResult={scanResult}
          apiKey={apiKey}
          onComplete={handleRefinementDone}
          onCancel={() => setStep(STEP.EDITOR)}
        />
      )}
    </div>
  );
}
