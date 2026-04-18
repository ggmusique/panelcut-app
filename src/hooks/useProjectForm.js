import { useState, useEffect, useRef } from 'react';

/**
 * useProjectForm — encapsule toute la logique du formulaire de configuration de projet.
 * Utilisé par ProjectForm.js pour éviter la duplication de code.
 *
 * @param {object} project   - Le projet courant (props)
 * @param {function} onChange - Callback parent appelé à chaque changement
 * @param {object} t          - Objet de traductions i18n
 */
export function useProjectForm(project, onChange, t) {
  // Refs stables pour éviter les boucles infinies dans le useEffect de sync
  const projectRef = useRef(project);
  const onChangeRef = useRef(onChange);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ── États locaux ──
  const [name, setName] = useState(project.name || '');
  const [client, setClient] = useState(project.client || '');
  const [company, setCompany] = useState(project.company || '');
  const [devisNum, setDevisNum] = useState(project.devisNum || '');

  const [panelW, setPanelW] = useState(project.panel?.w || 244);
  const [panelH, setPanelH] = useState(project.panel?.h || 122);
  const [panelThickness, setPanelThickness] = useState(project.panel?.thickness || 1.8);
  const [panelLabel, setPanelLabel] = useState(project.panel?.label || '');
  const [customLabel, setCustomLabel] = useState(project.panel?.customLabel || '');

  const [grainDirection, setGrainDirection] = useState(project.grainDirection || 'indifferent');
  const [edgeType, setEdgeType] = useState(project.edgeType || 'pvc_04');
  const [supplierRef, setSupplierRef] = useState(project.supplierRef || '');

  const [displayUnit, setDisplayUnit] = useState('cm');
  const [kerf, setKerf] = useState(project.kerf ?? 3);
  const [tolerance, setTolerance] = useState(project.tolerance ?? 10);

  // ── Logique de prix dynamique ──
  const initialArea = ((project.panel?.w || 244) * (project.panel?.h || 122)) / 10000;
  const initialPriceM2 =
    project.pricePerPanel && initialArea > 0 ? project.pricePerPanel / initialArea : 13.5;
  const [pricePerPanel, setPricePerPanel] = useState(
    project.pricePerPanel ?? initialArea * initialPriceM2
  );
  const [pricePerM2, setPricePerM2] = useState(initialPriceM2);

  // ── Sync local state → parent (via refs stables) ──
  useEffect(() => {
    onChangeRef.current({
      ...projectRef.current,
      name,
      client,
      company,
      devisNum,
      panel: { w: panelW, h: panelH, thickness: panelThickness, label: panelLabel, customLabel },
      grainDirection,
      edgeType,
      supplierRef,
      kerf,
      tolerance,
      pricePerPanel,
    });
  }, [
    name, client, company, devisNum,
    panelW, panelH, panelThickness, panelLabel, customLabel,
    grainDirection, edgeType, supplierRef,
    kerf, tolerance, pricePerPanel,
  ]);

  // ── Recalcul automatique du prix au m² quand le format du panneau change ──
  useEffect(() => {
    if (pricePerM2 > 0) {
      const newArea = (panelW * panelH) / 10000;
      const newPrice = parseFloat((newArea * pricePerM2).toFixed(2));
      if (newPrice !== pricePerPanel) {
        setPricePerPanel(newPrice);
      }
    }
  }, [panelW, panelH, pricePerM2]); // pricePerPanel excluded intentionally to avoid infinite loop

  // ── Helpers d'affichage (conversion cm ↔ mm) ──
  const displayValue = (valCm) => (displayUnit === 'mm' ? Math.round(valCm * 10) : valCm);
  const parseInput = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : displayUnit === 'mm' ? num / 10 : num;
  };

  // ── Mise à jour du prix + recalcul prix/m² ──
  const handlePriceChange = (val) => {
    const p = parseFloat(val);
    if (isNaN(p)) return;
    setPricePerPanel(p);
    const area = (panelW * panelH) / 10000;
    if (area > 0 && p > 0) setPricePerM2(parseFloat((p / area).toFixed(2)));
  };

  // ── Validation ──
  const isFormValid =
    name.trim().length > 0 && panelW > 0 && panelH > 0 && panelThickness > 0;

  // ── Options statiques pour les selects ──
  const thicknessOptions = [
    { value: 0.8, label: '8 mm' },
    { value: 1.2, label: '12 mm' },
    { value: 1.8, label: '18 mm' },
    { value: 2.2, label: '22 mm' },
    { value: 2.5, label: '25 mm' },
    { value: 3.0, label: '30 mm' },
  ];

  const materialOptions = [
    { value: '', label: '-- Sélectionner un matériau --' },
    { value: 'MDF', label: 'MDF' },
    { value: 'MDF Hydro', label: 'MDF Hydro' },
    { value: 'Aggloméré', label: 'Aggloméré' },
    { value: 'Contreplaqué', label: 'Contreplaqué' },
    { value: 'CTB-Peuplier', label: 'CTB-Peuplier' },
    { value: 'OSB 3', label: 'OSB 3' },
    { value: 'Multiplex', label: 'Multiplex' },
    { value: 'Mélaminé blanc', label: 'Mélaminé blanc' },
    { value: 'Autre', label: '✏️ Autre' },
  ];

  const edgeOptions = [
    { value: 'none', label: t?.edge_none || 'Aucun' },
    { value: 'pvc_04', label: 'PVC 0.4 mm' },
    { value: 'pvc_2', label: 'PVC 2 mm' },
    { value: 'abs_2', label: 'ABS 2 mm' },
    { value: 'veneer', label: t?.edge_veneer || 'Placage bois' },
    { value: 'postform', label: 'Postform' },
  ];

  const grainOptions = [
    { value: 'horizontal', label: t?.grain_horizontal || 'Horizontal →' },
    { value: 'vertical', label: t?.grain_vertical || 'Vertical ↑' },
    { value: 'indifferent', label: t?.grain_indifferent || 'Indifférent' },
  ];

  const standardSizes = [
    { w: 244, h: 122, label: '244×122' },
    { w: 250, h: 125, label: '250×125' },
    { w: 275, h: 122, label: '275×122' },
    { w: 280, h: 207, label: '280×207' },
    { w: 255, h: 183, label: '255×183' },
    { w: 305, h: 152, label: '305×152' },
  ];

  return {
    // Infos projet
    name, setName,
    client, setClient,
    company, setCompany,
    devisNum, setDevisNum,
    // Panneau
    panelW, setPanelW,
    panelH, setPanelH,
    panelThickness, setPanelThickness,
    panelLabel, setPanelLabel,
    customLabel, setCustomLabel,
    // Finition
    grainDirection, setGrainDirection,
    edgeType, setEdgeType,
    supplierRef, setSupplierRef,
    // Unité d'affichage
    displayUnit, setDisplayUnit,
    // Paramètres
    kerf, setKerf,
    tolerance, setTolerance,
    pricePerPanel, pricePerM2,
    handlePriceChange,
    // Helpers
    displayValue,
    parseInput,
    isFormValid,
    // Options
    thicknessOptions,
    materialOptions,
    edgeOptions,
    grainOptions,
    standardSizes,
  };
}
