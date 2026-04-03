import React, { useState, useEffect } from 'react';

export default function ProjectForm({ t, project, onChange, onNext }) {
  // ── États locaux pour les inputs (sync avec project via useEffect) ──
  const [name, setName] = useState(project.name || '');
  const [client, setClient] = useState(project.client || '');
  const [company, setCompany] = useState(project.company || '');
  const [devisNum, setDevisNum] = useState(project.devisNum || '');
  
  const [panelW, setPanelW] = useState(project.panel?.w || 244);
  const [panelH, setPanelH] = useState(project.panel?.h || 122);
  const [panelThickness, setPanelThickness] = useState(project.panel?.thickness || 1.8);
  const [panelLabel, setPanelLabel] = useState(project.panel?.label || 'MDF 18mm');
  
  const [grainDirection, setGrainDirection] = useState(project.grainDirection || 'indifferent');
  const [edgeType, setEdgeType] = useState(project.edgeType || 'pvc_04');
  const [supplierRef, setSupplierRef] = useState(project.supplierRef || '');
  
  const [displayUnit, setDisplayUnit] = useState('cm'); // 'cm' or 'mm' for display only
  const [kerf, setKerf] = useState(project.kerf ?? 3);
  const [tolerance, setTolerance] = useState(project.tolerance ?? 10);
  const [pricePerPanel, setPricePerPanel] = useState(project.pricePerPanel ?? 39.8);

  // ── Sync local state → project object ──
  useEffect(() => {
    onChange({
      ...project,
      name, client, company, devisNum,
      panel: {
        w: panelW,
        h: panelH,
        thickness: panelThickness,
        label: panelLabel,
      },
      grainDirection,
      edgeType,
      supplierRef,
      kerf,
      tolerance,
      pricePerPanel,
    });
  }, [
    name, client, company, devisNum,
    panelW, panelH, panelThickness, panelLabel,
    grainDirection, edgeType, supplierRef,
    kerf, tolerance, pricePerPanel,
    onChange, project
  ]);

  // ── Calculs automatiques ──
  const panelAreaM2 = (panelW * panelH) / 10000; // cm² → m²
  const pricePerM2 = pricePerPanel / panelAreaM2;

  // ── Helpers d'affichage (conversion mm/cm) ──
  const displayValue = (valCm) => displayUnit === 'mm' ? Math.round(valCm * 10) : valCm;
  const parseInput = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return displayUnit === 'mm' ? 0 : 0;
    return displayUnit === 'mm' ? num / 10 : num; // convert to cm for storage
  };

  // ── Validation ──
  const isFormValid = name.trim().length > 0 && panelW > 0 && panelH > 0 && panelThickness > 0;

  // ── Options pour les selects ──
  const thicknessOptions = [
    { value: 0.8, label: '8 mm' },
    { value: 1.2, label: '12 mm' },
    { value: 1.8, label: '18 mm' },
    { value: 2.2, label: '22 mm' },
    { value: 2.5, label: '25 mm' },
    { value: 3.0, label: '30 mm' },
  ];

  const edgeOptions = [
    { value: 'none', label: t.edge_none || 'Aucun' },
    { value: 'pvc_04', label: 'PVC 0.4 mm' },
    { value: 'pvc_2', label: 'PVC 2 mm' },
    { value: 'abs_2', label: 'ABS 2 mm' },
    { value: 'veneer', label: t.edge_veneer || 'Placage bois' },
    { value: 'postform', label: 'Postform' },
  ];

  const grainOptions = [
    { value: 'horizontal', label: t.grain_horizontal || 'Horizontal →' },
    { value: 'vertical', label: t.grain_vertical || 'Vertical ↑' },
    { value: 'indifferent', label: t.grain_indifferent || 'Indifférent' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── En-tête du formulaire ── */}
      <div className="mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white mb-1">{t.newProject || 'Nouveau projet'}</h2>
        <p className="text-sm text-slate-400">{t.formSubtitle || 'Définissez les paramètres de votre panneau'}</p>
      </div>

      {/* ── Section: Informations projet ── */}
      <section className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t.section_project || 'Projet'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_name || 'Nom du projet'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.placeholder_project_name || 'Ex: Armoire cuisine Dupont'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_client || 'Client'}
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder={t.placeholder_client || 'Ex: M. Dupont'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_company || 'Entreprise'}
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t.placeholder_company || 'Ex: Menuiserie Martin'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_devis || 'Devis N°'}
            </label>
            <input
              type="text"
              value={devisNum}
              onChange={(e) => setDevisNum(e.target.value)}
              placeholder="DV-2026-XXXX"
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-mono"
            />
          </div>
        </div>
      </section>

      {/* ── Section: Panneau ── */}
      <section className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t.section_panel || 'Panneau'}
        </h3>
        
        {/* Dimensions */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            {t.field_dimensions || 'Dimensions'} *
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="300"
                  step={displayUnit === 'mm' ? 1 : 0.1}
                  value={displayValue(panelW)}
                  onChange={(e) => setPanelW(parseInput(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  {displayUnit}
                </span>
              </div>
            </div>
            <span className="text-slate-500">×</span>
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="300"
                  step={displayUnit === 'mm' ? 1 : 0.1}
                  value={displayValue(panelH)}
                  onChange={(e) => setPanelH(parseInput(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  {displayUnit}
                </span>
              </div>
            </div>
            
            {/* Toggle unités */}
            <button
              type="button"
              onClick={() => setDisplayUnit(u => u === 'cm' ? 'mm' : 'cm')}
              className="px-3 py-2 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              title={t.toggle_units || 'Basculer cm/mm'}
            >
              {displayUnit.toUpperCase()}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {t.helper_dimensions || 'Stocké en cm pour le moteur d\'optimisation'}
          </p>
        </div>

        {/* Épaisseur + Référence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_thickness || 'Épaisseur'}
            </label>
            <select
              value={panelThickness}
              onChange={(e) => setPanelThickness(parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            >
              {thicknessOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_label || 'Référence / Label'}
            </label>
            <input
              type="text"
              value={panelLabel}
              onChange={(e) => setPanelLabel(e.target.value)}
              placeholder={t.placeholder_label || 'Ex: EGGER W980 Premium'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>
        </div>
      </section>

      {/* ── Section: Finition ── */}
      <section className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t.section_finish || 'Finition'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sens du fil */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              {t.field_grain || 'Sens du fil'}
            </label>
            <div className="flex flex-wrap gap-2">
              {grainOptions.map(opt => (
                <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  grainDirection === opt.value
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-slate-800/50 border-white/10 text-slate-300 hover:border-white/30'
                }`}>
                  <input
                    type="radio"
                    name="grainDirection"
                    value={opt.value}
                    checked={grainDirection === opt.value}
                    onChange={(e) => setGrainDirection(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Type de chant */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_edge || 'Type de chant'}
            </label>
            <select
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            >
              {edgeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Référence fournisseur */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_supplier_ref || 'Référence fournisseur'}
            </label>
            <input
              type="text"
              value={supplierRef}
              onChange={(e) => setSupplierRef(e.target.value)}
              placeholder={t.placeholder_supplier || 'Ex: EGGER W980 ST9, KRONOSPAN K001...'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all font-mono text-sm"
            />
          </div>
        </div>
      </section>

      {/* ── Section: Paramètres & Prix ── */}
      <section className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">
          {t.section_settings || 'Paramètres'}
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_kerf || 'Kerf (mm)'}
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={kerf}
              onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_tolerance || 'Tolérance (mm)'}
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t.field_price || 'Prix panneau (€)'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.1"
                value={pricePerPanel}
                onChange={(e) => setPricePerPanel(parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              />
              <div className="text-right">
                <div className="text-xs text-slate-500">{t.label_price_m2 || 'Prix/m²'}</div>
                <div className="text-sm font-bold text-emerald-400">{pricePerM2.toFixed(2)} €</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Boutons de navigation ── */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
        >
          ← {t.btn_back || 'Retour'}
        </button>
        
        <button
          type="button"
          onClick={onNext}
          disabled={!isFormValid}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            isFormValid
              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 hover:shadow-orange-500/30 active:scale-[0.98]'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
          }`}
        >
          {t.btn_pieces || 'Pièces'} →
        </button>
      </div>

      {/* ── Message d'aide si champ requis manquant ── */}
      {!isFormValid && (
        <p className="mt-3 text-xs text-center text-slate-500">
          {t.helper_required || '* Champs requis : Nom, Dimensions, Épaisseur'}
        </p>
      )}
    </div>
  );
}