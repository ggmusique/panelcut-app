import React, { useState, useRef } from 'react';
import { useProjectForm } from '../hooks/useProjectForm';
import { prepareImageForScan } from '../utils/ocrExtract';

// ─── Prompt Claude Vision — paramétré par l'épaisseur choisie par l'utilisateur ─
const getVisionPrompt = (thickness) => `Tu es un expert en lecture de plans de menuiserie. 
Analyse l'image et décompose-la en structures réelles.
ÉPAISSEUR GÉNÉRALE : ${thickness} cm.

STRUCTURE DU JSON :
{
  "width": <largeur_hors_tout>,
  "height": <hauteur_hors_tout>,
  "depth": <profondeur>,
  "plinth": <hauteur_socle_si_visible>,
  "modules": [
    {
      "x_start": <position_bord_gauche_interieur>,
      "width": <largeur_interieure_nette>,
      "shelves": [ {"y": <hauteur_tablette>} ],
      "drawers": [],
      "rod": {"y": <hauteur_tringle>} ou null
    }
  ]
}

CONSIGNES DE PRÉCISION :
1. Ne crée pas de modules identiques par défaut. Observe bien les séparations verticales.
2. Si tu vois une grande zone vide avec une barre, c'est une penderie ("rod").
3. Le "x_start" du premier module est TOUJOURS égal à ${thickness}.
4. La somme (épaisseur + largeur_module + épaisseur...) doit être égale à la largeur totale.
5. Ne retourne QUE le JSON, aucun commentaire.`;

// ─── Prompt de correction ─
const getCorrectionPrompt = (thickness, userInstructions, previousData) =>
  `Tu es un expert en ébénisterie et menuiserie. Corrige le JSON du meuble ci-dessous en suivant STRICTEMENT les instructions de l'utilisateur.

JSON actuel (à corriger) :
${JSON.stringify(previousData, null, 2)}

INSTRUCTIONS DE CORRECTION :
${userInstructions}

Règles absolues :
- thickness = ${thickness} (épaisseur panneau imposée — ne jamais modifier)
- x_start du premier module = ${thickness}
- x_start de chaque module suivant = x_start_précédent + width_précédent + ${thickness}
- La somme de tous les modules doit respecter : width_totale = ${thickness} + (Σ width_modules) + (nb_modules × ${thickness})
- Les positions y sont en cm depuis le bas intérieur (au-dessus du fond bas)
- Retourne UNIQUEMENT le JSON corrigé (même structure), sans aucun commentaire.

Structure attendue :
{
  "width": <cm>, "height": <cm>, "depth": <cm>, "plinth": <cm>,
  "modules": [ { "x_start": <cm>, "width": <cm>,
    "shelves": [{"y":<cm>}], "drawers": [{"y":<cm>,"height":<cm>}],
    "rod": {"y":<cm>} ou null, "doors": <n> } ]
}`;

/**
 * ProjectForm — formulaire unifié de configuration de projet.
 *
 * Props :
 *  - t                : objet de traductions i18n
 *  - project          : objet projet courant
 *  - onChange         : callback appelé à chaque modification du projet
 *  - onNext           : callback "Pièces →" (showScanActions=false)
 *  - showScanActions  : boolean — si true, affiche les boutons de scan à la place de onNext
 *  - onGoScan         : callback(scanResult, scanImageBase64, scanMode) — résultat du scan
 *  - onGoManual       : callback — bouton "Saisie manuelle"
 *  - onCancel         : callback — bouton Annuler / Retour
 *  - scanning         : (optionnel) état de scan externe pour affichage
 */
export default function ProjectForm({
  t,
  project,
  onChange,
  onNext,
  showScanActions = false,
  onGoScan,
  onGoManual,
  onCancel,
  scanning: externalScanning,
}) {
  // ── Logique formulaire via hook ──
  const {
    name, setName,
    client, setClient,
    company, setCompany,
    devisNum, setDevisNum,
    panelW, setPanelW,
    panelH, setPanelH,
    panelThickness, setPanelThickness,
    panelLabel, setPanelLabel,
    customLabel, setCustomLabel,
    grainDirection, setGrainDirection,
    edgeType, setEdgeType,
    supplierRef, setSupplierRef,
    displayUnit, setDisplayUnit,
    kerf, setKerf,
    tolerance, setTolerance,
    pricePerPanel, pricePerM2,
    handlePriceChange,
    displayValue,
    parseInput,
    isFormValid,
    thicknessOptions,
    materialOptions,
    edgeOptions,
    grainOptions,
    standardSizes,
  } = useProjectForm(project, onChange, t);
  
  // ── État pour le scan (utilisé uniquement quand showScanActions=true) ──
  const fileInputRef = useRef(null);
  const processedImageRef = useRef(null);
  const pendingScanModeRef = useRef('full');
  const [scanning, setScanning] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [lastScanResult, setLastScanResult] = useState(null);

  const isScanning = externalScanning || scanning;

  const triggerFilePicker = (mode = 'full') => {
    pendingScanModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanning(true);
    const scanMode = pendingScanModeRef.current || 'full';
    try {
      const originalBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { processedImage, ocrNumbers } = await prepareImageForScan(originalBase64);
      processedImageRef.current = processedImage;
      const base64Data = processedImage.split(',')[1];
      const response = await fetch('https://panelcut-server.vercel.app/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mediaType: 'image/jpeg', ocrNumbers, scanMode }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${response.status})`);
      }
      const scanResult = await response.json();
      setLastScanResult(scanResult);
      if (onGoScan) onGoScan(scanResult, processedImage, scanMode);
    } catch (err) {
      console.error('💥 Échec complet du scan:', err);
      alert(`❌ Échec du scan : ${err.message}`);
    } finally {
      setScanning(false);
      pendingScanModeRef.current = 'full';
      event.target.value = null;
    }
  };

  const handleCorrection = async () => {
    if (!processedImageRef.current || !correctionText.trim()) return;
    setCorrecting(true);
    try {
      const base64Data = processedImageRef.current.split(',')[1];
      const payload = {
        image: base64Data,
        mediaType: 'image/jpeg',
        prompt: getCorrectionPrompt(panelThickness, correctionText.trim(), lastScanResult),
      };
      const response = await fetch('https://panelcut-server.vercel.app/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${response.status})`);
      }
      const scanResult = await response.json();
      const correctedResult = {
        ...scanResult,
        cabinet: { ...(scanResult?.cabinet || {}), thickness: panelThickness },
        thickness: panelThickness,
      };
      setLastScanResult(correctedResult);
      setShowCorrection(false);
      setCorrectionText('');
      if (onGoScan) onGoScan(correctedResult, processedImageRef.current, 'full');
    } catch (err) {
      console.error('💥 Échec de la rectification:', err);
      alert(`❌ Rectification échouée : ${err.message}`);
    } finally {
      setCorrecting(false);
    }
  };

  const isStandardSize = standardSizes.some((s) => s.w === panelW && s.h === panelH);

  // ── Sections du formulaire (identiques dans les deux modes) ──
  const formSections = (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Projet */}
      <section className="p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t?.section_project || 'Projet'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_name || 'Nom du projet'} *
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t?.placeholder_project_name || 'Ex: Armoire cuisine Dupont'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_client || 'Client'}
            </label>
            <input type="text" value={client} onChange={(e) => setClient(e.target.value)}
              placeholder={t?.placeholder_client || 'Ex: M. Dupont'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_company || 'Entreprise'}
            </label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
              placeholder={t?.placeholder_company || 'Ex: Menuiserie Martin'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_devis || 'Devis N°'}
            </label>
            <input type="text" value={devisNum} onChange={(e) => setDevisNum(e.target.value)}
              placeholder="DV-2026-XXXX"
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
          </div>
        </div>
      </section>

      {/* Panneau */}
      <section className="p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t?.section_panel || 'Panneau'}
        </h3>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            {t?.field_dimensions || 'Dimensions'} *
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {standardSizes.map((size, i) => (
              <button key={i} type="button" onClick={() => { setPanelW(size.w); setPanelH(size.h); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                  isStandardSize && panelW === size.w && panelH === size.h
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                }`}>
                {size.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                <button type="button" onClick={() => setPanelW((prev) => Math.round((prev + 0.1) * 10) / 10)} className="w-5 h-4 text-slate-500 hover:text-orange-400 text-xs">▲</button>
                <button type="button" onClick={() => setPanelW((prev) => Math.round((prev - 0.1) * 10) / 10)} className="w-5 h-4 text-slate-500 hover:text-orange-400 text-xs">▼</button>
              </div>
              <input type="number" inputMode="decimal" min="10" max="300" step={displayUnit === 'mm' ? 1 : 0.1}
                value={displayValue(panelW)} onChange={(e) => setPanelW(parseInput(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{displayUnit}</span>
            </div>
            <span className="text-slate-500">×</span>
            <div className="flex-1 relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                <button type="button" onClick={() => setPanelH((prev) => Math.round((prev + 0.1) * 10) / 10)} className="w-5 h-4 text-slate-500 hover:text-orange-400 text-xs">▲</button>
                <button type="button" onClick={() => setPanelH((prev) => Math.round((prev - 0.1) * 10) / 10)} className="w-5 h-4 text-slate-500 hover:text-orange-400 text-xs">▼</button>
              </div>
              <input type="number" inputMode="decimal" min="10" max="300" step={displayUnit === 'mm' ? 1 : 0.1}
                value={displayValue(panelH)} onChange={(e) => setPanelH(parseInput(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{displayUnit}</span>
            </div>
            <button type="button" onClick={() => setDisplayUnit((u) => (u === 'cm' ? 'mm' : 'cm'))}
              className="px-3 py-2 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
              {displayUnit.toUpperCase()}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {t?.helper_dimensions || "Stocké en cm pour le moteur d'optimisation"}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_thickness || 'Épaisseur'}
            </label>
            <select value={panelThickness} onChange={(e) => setPanelThickness(parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all">
              {thicknessOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_label || 'Type de matériau'}
            </label>
            <select value={panelLabel} onChange={(e) => setPanelLabel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all">
              {materialOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {panelLabel === 'Autre' && (
              <input type="text" value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Précisez..."
                className="w-full mt-2 px-3 py-2 bg-slate-800/50 border border-orange-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
            )}
          </div>
        </div>
      </section>

      {/* Finition */}
      <section className="p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t?.section_finish || 'Finition'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              {t?.field_grain || 'Sens du fil'}
            </label>
            <div className="flex flex-wrap gap-2">
              {grainOptions.map((opt) => (
                <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  grainDirection === opt.value
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-slate-800/50 border-white/10 text-slate-300 hover:border-white/30'
                }`}>
                  <input type="radio" name="grain" value={opt.value} checked={grainDirection === opt.value}
                    onChange={() => setGrainDirection(opt.value)} className="sr-only" />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_edge || 'Type de chant'}
            </label>
            <select value={edgeType} onChange={(e) => setEdgeType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all">
              {edgeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_supplier_ref || 'Référence fournisseur'}
            </label>
            <input type="text" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)}
              placeholder={t?.placeholder_supplier || 'Ex: EGGER W980 ST9, KRONOSPAN K001...'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono text-sm" />
          </div>
        </div>
      </section>

      {/* Paramètres & Prix */}
      <section className="p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t?.section_settings || 'Paramètres'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_kerf || 'Kerf (mm)'}
            </label>
            <input type="number" min="0" max="10" step="0.1" value={kerf}
              onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_tolerance || 'Tolérance (mm)'}
            </label>
            <input type="number" min="0" max="50" step="0.5" value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t?.field_price || 'Prix panneau (€)'}
            </label>
            <div className="flex items-center gap-3">
              <input type="number" min="0" step="0.1" value={pricePerPanel}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all" />
              <div className="text-right min-w-[80px]">
                <div className="text-xs text-slate-500">{t?.label_price_m2 || 'Prix/m²'}</div>
                <div className="text-sm font-bold text-emerald-400">{pricePerM2.toFixed(2)} €</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">💡 Le prix s'adapte automatiquement à la surface</p>
          </div>
        </div>
      </section>
    </div>
  );

  // ── Rendu ──
  if (showScanActions) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col">
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />

        {/* Header */}
        <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{t?.newProject || 'Nouveau projet'}</h2>
              <p className="text-sm text-slate-400 mt-1">{t?.formSubtitle || 'Définissez les paramètres avant de découper'}</p>
            </div>
            {onCancel && (
              <button onClick={onCancel} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
            )}
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex-1 overflow-y-auto px-4 py-6">{formSections}</div>

        {/* Barre d'actions scan */}
        <div className="sticky bottom-0 bg-[#0f1620]/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-white/10 p-4">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            {showCorrection && (
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-xs font-bold text-amber-300">🛠️ Décrivez la correction à apporter :</p>
                <textarea value={correctionText} onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Ex : Il n'y a que 2 colonnes — une de 120 cm et une de 58 cm. Supprime la 3e colonne."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900/80 border border-amber-500/30 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowCorrection(false); setCorrectionText(''); }}
                    className="px-4 py-2 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                    Annuler
                  </button>
                  <button onClick={handleCorrection} disabled={correcting || !correctionText.trim()}
                    className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5">
                    {correcting ? '⏳ Correction...' : '✅ Envoyer la correction'}
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {onCancel && (
                <button onClick={onCancel}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  ← {t?.btn_cancel || 'Annuler'}
                </button>
              )}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {lastScanResult && (
                  <button onClick={() => setShowCorrection((v) => !v)} disabled={correcting}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold bg-amber-700 hover:bg-amber-600 text-white rounded-xl transition-all shadow-lg shadow-amber-700/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                    🛠️ Rectifier le plan
                  </button>
                )}
                <button onClick={() => triggerFilePicker('dimensions_only')} disabled={isScanning || correcting}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-all shadow-lg shadow-teal-600/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                  {isScanning ? '⏳ Analyse...' : '📏 Scanner cotes uniquement'}
                </button>
                <button onClick={() => triggerFilePicker('full')} disabled={isScanning || correcting}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-600/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                  {isScanning ? '⏳ Analyse...' : '📷 Scanner plan + cotes'}
                </button>
                <button onClick={onGoManual} disabled={!isFormValid}
                  className={`flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    isFormValid
                      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 active:scale-[0.98]'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                  }`}>
                  ✏️ {t?.btn_manual || 'Saisie manuelle'} →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode simple (showScanActions=false) : affiche uniquement le bouton "Pièces →"
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{t?.newProject || 'Nouveau projet'}</h2>
            <p className="text-sm text-slate-400 mt-1">{t?.formSubtitle || 'Définissez les paramètres de votre panneau'}</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
          )}
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 overflow-y-auto px-4 py-6">{formSections}</div>

      {/* Boutons de navigation */}
      <div className="sticky bottom-0 bg-[#0f1620]/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
              ← {t?.btn_back || 'Retour'}
            </button>
          )}
          <button type="button" onClick={onNext} disabled={!isFormValid}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              isFormValid
                ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 hover:shadow-orange-500/30 active:scale-[0.98]'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }`}>
            {t?.btn_pieces || 'Pièces'} →
          </button>
        </div>
        {!isFormValid && (
          <p className="mt-3 text-xs text-center text-slate-500">
            {t?.helper_required || '* Champs requis : Nom, Dimensions, Épaisseur'}
          </p>
        )}
      </div>
    </div>
  );
}