/**
 * ClaudeRefinement.js — Modal de relance Claude Vision avec image annotée
 *
 * Flux :
 *  1. Reçoit l'image PNG annotée (base64) depuis SketchEditor
 *  2. Affiche un résumé du scan initial + champ de corrections textuelles
 *  3. Envoie à Claude : image annotée + corrections + contexte initial
 *  4. Retourne le nouveau scanResult via onComplete
 */
import { useState } from 'react';

// Prompt système pour la relance
const REFINE_SYSTEM = `Tu es un expert en ébénisterie et menuiserie industrielle.
Tu analyses un croquis de meuble avec des annotations de correction.
Tes annotations (cotes en cyan ↔, notes en vert 💬, traits oranges ✏️) sont des CORRECTIONS prioritaires sur le scan initial.

Extrait les dimensions corrigées et retourne UNIQUEMENT ce JSON :
{
  "cabinet": {
    "width": <largeur totale cm>,
    "height": <hauteur totale cm>,
    "depth": <profondeur cm>,
    "thickness": <épaisseur panneau mm, défaut 18>,
    "nb_shelves": <nb tablettes>,
    "nb_drawers": <nb tiroirs>,
    "nb_dividers": <nb séparateurs verticaux>,
    "nb_doors": <nb portes>,
    "nb_rods": <nb tringles>,
    "plinth": <hauteur socle cm ou 0>
  },
  "pieces": [
    { "name": <nom pièce>, "length": <cm>, "height": <cm>, "qty": <nb>, "role": <rôle> }
  ],
  "confidence": <0.0 à 1.0>,
  "corrections_applied": [<liste des corrections prises en compte>]
}`;

export default function ClaudeRefinement({
  annotatedImage,   // string base64 PNG
  annotations,      // array d'éléments SVG
  initialResult,    // scanResult initial
  apiKey,           // clé Claude (depuis App)
  onComplete,       // (newScanResult) => void
  onCancel,
}) {
  const [extraNotes, setExtraNotes]   = useState('');
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState(null);
  const [step,       setStep]         = useState('review'); // 'review' | 'loading' | 'done'

  // Résumé des annotations sous forme texte
  const annotationSummary = annotations
    .filter(a => a.type === 'dim' || a.type === 'note')
    .map(a => {
      if (a.type === 'dim')  return `Cote annotée : ${a.label || '?'}`;
      if (a.type === 'note') return `Note : ${a.text}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');

  const handleRefine = async () => {
    if (!annotatedImage) return;
    setLoading(true);
    setError(null);
    setStep('loading');

    // Construire le prompt utilisateur
    const initialSummary = initialResult?.cabinet
      ? `Scan initial : ${initialResult.cabinet.width}×${initialResult.cabinet.height}×${initialResult.cabinet.depth ?? '?'} cm, ` +
        `${initialResult.cabinet.nb_shelves ?? '?'} tablettes, ${initialResult.cabinet.nb_drawers ?? '?'} tiroirs, ` +
        `${initialResult.cabinet.nb_dividers ?? '?'} séparateurs.`
      : 'Pas de scan initial disponible.';

    const userPrompt = [
      'Voici le croquis ANNOTÉ avec mes corrections (annotations colorées).',
      '',
      initialSummary,
      '',
      annotationSummary ? `Annotations visibles :\n${annotationSummary}` : '',
      extraNotes ? `Corrections supplémentaires :\n${extraNotes}` : '',
      '',
      "PRIORITÉ : les cotes et annotations sur l'image sont EXACTES — utilise-les en priorité sur ta propre interprétation.",
      'Retourne le JSON uniquement.',
    ].filter(Boolean).join('\n');

    // Extraire le base64 pur (sans le préfixe data:image/png;base64,)
    const base64Data = annotatedImage.includes(',')
      ? annotatedImage.split(',')[1]
      : annotatedImage;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 2048,
          system: REFINE_SYSTEM,
          messages: [{
            role: 'user',
            content: [
              {
                type:       'image',
                source: {
                  type:       'base64',
                  media_type: 'image/png',
                  data:       base64Data,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erreur API ${response.status}`);
      }

      const data   = await response.json();
      const text   = data.content?.[0]?.text || '';
      const match  = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Réponse Claude invalide (pas de JSON)');

      const parsed = JSON.parse(match[0]);
      setStep('done');
      onComplete(parsed);
    } catch (e) {
      setError(e.message || 'Erreur inconnue');
      setStep('review');
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
              <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">Image annotée qui sera envoyée à Claude</p>
              <div className="rounded-xl overflow-hidden border border-white/10">
                <img src={annotatedImage} alt="Croquis annoté" className="w-full max-h-64 object-contain bg-gray-900" />
              </div>
            </div>
          )}

          {/* Résumé scan initial */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-3">Données du scan initial</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Largeur',    value: cabinet.width     ? `${cabinet.width} cm`    : '?' },
                { label: 'Hauteur',    value: cabinet.height    ? `${cabinet.height} cm`   : '?' },
                { label: 'Profondeur', value: cabinet.depth     ? `${cabinet.depth} cm`    : '?' },
                { label: 'Tablettes', value: cabinet.nb_shelves  ?? '?' },
                { label: 'Tiroirs',   value: cabinet.nb_drawers  ?? '?' },
                { label: 'Séparateurs', value: cabinet.nb_dividers ?? '?' },
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
              <p className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-2">📌 Annotations sur le croquis</p>
              <pre className="text-sm text-orange-300 whitespace-pre-wrap font-mono">{annotationSummary}</pre>
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
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm font-mono">⚠️ {error}</p>
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
              }>
              {loading ? '⏳ Analyse en cours…' : '🚀 Envoyer à Claude'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
