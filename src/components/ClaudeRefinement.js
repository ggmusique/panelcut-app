/**
 * ClaudeRefinement.js — Modal de relance Claude Vision avec image annotée
 *
 * IMPORTANT : L'appel Claude passe OBLIGATOIREMENT par le serveur Vercel.
 * Appeler api.anthropic.com directement depuis le browser = NetworkError (CORS bloqué).
 */
import { useState } from 'react';

const SERVER_URL = 'https://panelcut-server.vercel.app';

// Prompt de raffinement envoyé au serveur
const buildUserPrompt = (initialResult, annotationSummary, extraNotes) => {
  const cabinet = initialResult?.cabinet || {};
  const initialSummary = cabinet.width
    ? `Scan initial : ${cabinet.width}×${cabinet.height}×${cabinet.depth ?? '?'} cm, ` +
      `${cabinet.nb_shelves ?? '?'} tablettes, ${cabinet.nb_drawers ?? '?'} tiroirs, ` +
      `${cabinet.nb_dividers ?? '?'} séparateurs.`
    : 'Pas de scan initial disponible.';

  return [
    'Voici le croquis ANNOTÉ avec mes corrections (annotations colorées).',
    '',
    initialSummary,
    '',
    annotationSummary ? `Annotations visibles :\n${annotationSummary}` : '',
    extraNotes        ? `Corrections supplémentaires :\n${extraNotes}`  : '',
    '',
    "PRIORITÉ : les cotes et annotations sur l'image sont EXACTES — utilise-les en priorité.",
    'Retourne le JSON des pièces uniquement.',
  ].filter(Boolean).join('\n');
};

export default function ClaudeRefinement({
  annotatedImage,  // string base64 PNG (avec ou sans préfixe data:...)
  annotations,     // array d'éléments SVG
  initialResult,   // scanResult initial
  apiKey,          // non utilisé — la clé reste sur le serveur
  onComplete,      // (newScanResult) => void
  onCancel,
}) {
  const [extraNotes, setExtraNotes] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // Résumé textuel des annotations
  const annotationSummary = (annotations || [])
    .filter(a => a.type === 'dim' || a.type === 'note')
    .map(a => {
      if (a.type === 'dim')  return `Cote annotée : ${a.label || '?'}`;
      if (a.type === 'note') return `Note : ${a.text}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');

  const handleRefine = async () => {
    if (!annotatedImage) { setError("Aucune image à envoyer."); return; }
    setLoading(true);
    setError(null);

    // Nettoyer le base64 (retirer le préfixe data:image/...;base64, si présent)
    const base64Data = annotatedImage.includes(',')
      ? annotatedImage.split(',')[1]
      : annotatedImage;

    const userPrompt = buildUserPrompt(initialResult, annotationSummary, extraNotes);

    try {
      // ✅ Passe par le serveur Vercel — jamais directement vers api.anthropic.com
      // Essaie d'abord /api/refine (endpoint dédié), sinon fallback sur /api/scan
      let response = await fetch(`${SERVER_URL}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image:      base64Data,
          mediaType:  'image/png',
          prompt:     userPrompt,
          context:    initialResult || null,
        }),
      });

      // Si /api/refine n'existe pas encore, fallback sur /api/scan
      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${SERVER_URL}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image:     base64Data,
            mediaType: 'image/png',
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || errData.message ||
          (response.status === 429
            ? '30 analyses/heure atteint — réessaie dans quelques minutes'
            : `Erreur serveur ${response.status}`)
        );
      }

      const data = await response.json();

      // Le serveur retourne soit directement l'objet, soit { result: {...} }
      const parsed = data.result || data;

      if (!parsed || (!parsed.pieces && !parsed.cabinet)) {
        throw new Error('Réponse du serveur invalide (pas de pièces ni de cabinet)');
      }

      onComplete(parsed);

    } catch (e) {
      console.error('ClaudeRefinement error:', e);
      if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
        setError('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
      } else {
        setError(e.message || 'Erreur inconnue');
      }
    } finally {
      setLoading(false);
    }
  };

  const cabinet = initialResult?.cabinet || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1620] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">🚀 Relancer Claude Vision</h2>
            <p className="text-slate-400 text-sm">Vérifiez avant d'envoyer</p>
          </div>
          <button onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Aperçu image annotée */}
          {annotatedImage && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">
                Image annotée qui sera envoyée à Claude
              </p>
              <div className="rounded-xl overflow-hidden border border-white/10">
                <img src={annotatedImage} alt="Croquis annoté"
                  className="w-full max-h-64 object-contain bg-gray-900" />
              </div>
            </div>
          )}

          {/* Résumé scan initial */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-3">
              Données du scan initial
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Largeur',      value: cabinet.width      ? `${cabinet.width} cm`      : '?' },
                { label: 'Hauteur',      value: cabinet.height     ? `${cabinet.height} cm`     : '?' },
                { label: 'Profondeur',   value: cabinet.depth      ? `${cabinet.depth} cm`      : '?' },
                { label: 'Tablettes',    value: cabinet.nb_shelves  ?? '?' },
                { label: 'Tiroirs',      value: cabinet.nb_drawers  ?? '?' },
                { label: 'Séparateurs',  value: cabinet.nb_dividers ?? '?' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/5 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">{label}</p>
                  <p className="text-white font-bold text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Annotations détectées */}
          {annotationSummary && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
              <p className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-2">
                📌 Annotations sur le croquis
              </p>
              <pre className="text-sm text-orange-300 whitespace-pre-wrap font-mono">
                {annotationSummary}
              </pre>
            </div>
          )}

          {/* Corrections textuelles supplémentaires */}
          <div>
            <label className="block text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">
              ✍️ Corrections supplémentaires (optionnel)
            </label>
            <textarea
              value={extraNotes}
              onChange={e => setExtraNotes(e.target.value)}
              placeholder={`Ex:\n- La hauteur totale est 220 cm et non 200 cm\n- Il y a 4 tiroirs de 15 cm chacun\n- Profondeur réelle = 58 cm`}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-400 text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-red-400 text-sm font-bold">Erreur</p>
                <p className="text-red-300 text-xs mt-0.5 font-mono">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/5 text-slate-400 border border-white/10 hover:text-white transition-all">
              Annuler
            </button>
            <button
              onClick={handleRefine}
              disabled={loading || !annotatedImage}
              className={
                'px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ' +
                (loading
                  ? 'bg-orange-800 text-orange-300 cursor-wait'
                  : 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer')
              }
            >
              {loading ? '⏳ Analyse en cours…' : '🚀 Envoyer à Claude'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
