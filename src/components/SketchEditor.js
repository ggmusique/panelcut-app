import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Disc, Layers3, PencilRuler, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import SketchToolbar from './SketchToolbar';
import SketchEditorCanvas from './SketchEditorCanvas';
import ProfessionalRealisticViewer from '../visualization/ProfessionalRealisticViewer';
import { useSketchPersistence } from '../hooks/useSketchPersistence';
import { useSketchState } from '../hooks/useSketchState';
import { LS_SKETCH_KEY, uid } from '../utils/sketchEditorConstants';
import { generatePiecesFromCabinet } from '../utils/generatePiecesFromCabinet';

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;

export default function SketchEditor({ image, scanImage, initialResult, draft, onDraftChange, onComplete, onCancel, onSave }) {
  const konvaEditorRef = useRef(null);

  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);

  const [tool,             setTool]             = useState('drawer');
  const [isCompactMobile,  setIsCompactMobile]  = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);

  // Refs for local-mode optimisation (skip server when only positions changed)
  const lastScannedStructuralRef = useRef(null);
  const lastScanResultRef        = useRef(null);
  const structuralFingerprintRef = useRef(null);

  // Wrap onComplete so we can track the last scan result and structural fingerprint.
  // When the hook calls onComplete for a local recalculation it passes {pieces, cabinet};
  // merging with the previous server result preserves all server-specific fields.
  const wrappedOnComplete = useCallback((result) => {
    const merged = lastScanResultRef.current
      ? { ...lastScanResultRef.current, ...result }
      : result;
    lastScannedStructuralRef.current = structuralFingerprintRef.current;
    lastScanResultRef.current        = merged;
    if (onComplete) onComplete(merged);
  }, [onComplete]);

  const {
    cabinetDims,   setCabinetDims,
    facadeModules, setFacadeModules,
    facadeItems,   setFacadeItems,
    moduleDetails, setModuleDetails,
    globalSliding, setGlobalSliding,
    joints,
    generalNotes,  setGeneralNotes,
    elements,
    widthInputs,   setWidthInputs,
    loading,
    error,
    infoMessage,
    capturing,
    currentCabinet,
    sketchFingerprint,
    structuralFingerprint,
    commitWidth,
    toggleJoint,
    handleModuleClick,
    handleModuleErase,
    handleItemErase,
    handleItemMove,
    handleDrawerResize,
    handleRelancer,
    handleElementAdd,
    handleElementUpdate,
    handleElementRemove,
    handleMoveModule,
  } = useSketchState({ initialResult, draft, konvaEditorRef, onComplete: wrappedOnComplete });

  // Keep the ref in sync so wrappedOnComplete always captures the current fingerprint
  structuralFingerprintRef.current = structuralFingerprint;

  // True when the current structure has already been scanned → local recalculation is enough
  const isLocalMode = lastScannedStructuralRef.current !== null &&
                      lastScannedStructuralRef.current === structuralFingerprint;

  useEffect(() => {
    setSelectedModuleIdx((idx) => Math.max(0, Math.min(idx, Math.max(0, facadeModules.length - 1))));
  }, [facadeModules.length]);

  const thickness          = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth   = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(1, toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth);

  const handleGenerateLocal = useCallback(() => {
    if (!currentCabinet) return;
    // depth is not tracked in the canvas editor; fall back to the original scan value or default 60 cm
    const depth   = toNum(initialCab.depth, 60);
    const cabinet = { ...currentCabinet, depth, thickness };
    const pieces  = generatePiecesFromCabinet(cabinet, thickness);
    if (onComplete) onComplete({ pieces, cabinet: currentCabinet });
  }, [currentCabinet, initialCab, thickness, onComplete]);

  const { triggerRemoteSave } = useSketchPersistence({
    elements, cabinetDims, facadeModules, facadeItems,
    moduleDetails, generalNotes, joints, globalSliding,
    sketchFingerprint, onSave, onDraftChange, currentCabinet,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsCompactMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleFacadePointerDown = useCallback((e, modIdx) => {
    if (e._konvaYRatio === undefined) return;
    const yRatio  = e._konvaYRatio;
    const newItem = { id: uid(), type: tool, modIdx, yRatio };
    setFacadeItems(prev => {
      const next = [...prev, newItem];
      setTimeout(() => {
        localStorage.setItem(LS_SKETCH_KEY, JSON.stringify({
          fingerprint: sketchFingerprint,
          state: { elements, cabinetDims, facadeModules, facadeItems: next, moduleDetails, generalNotes, joints, globalSliding },
        }));
      }, 0);
      return next;
    });
  }, [tool, sketchFingerprint, elements, cabinetDims, facadeModules, moduleDetails, generalNotes, joints, globalSliding, setFacadeItems]);

  const hint =
      tool === 'erase'   ? '🧹 Clic sur un élément pour le supprimer'
    : tool === 'shelf'   ? '📦 Clic dans un module pour placer · glisser pour déplacer'
    : tool === 'rod'     ? '👔 Clic dans un module pour placer · glisser pour déplacer'
    : tool === 'drawer'  ? '🗄️ Clic dans un module pour ajouter un tiroir'
    : tool === 'door'    ? '🚪 Clic dans un module pour ajouter une porte'
    : tool === 'sliding' ? '🚪↔️ Clic dans un module pour poser 2 portes coulissantes'
    : '💡 Dim/Note : tracez sur la façade';

  const isIPhone = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent || '');
  const showRotateHint =
    isIPhone &&
    typeof window !== 'undefined' &&
    window.innerHeight > window.innerWidth &&
    (typeof screen === 'undefined' || screen.orientation?.type !== 'landscape-primary');

  const selectedModule = facadeModules[selectedModuleIdx] || null;
  const selectedDetails = moduleDetails[selectedModuleIdx] || {};
  const selectedTypeLabel = useMemo(() => {
    if (!selectedModule) return 'Aucune sélection';
    if (selectedDetails.slidingDoors > 0 || selectedModule.slidingDoors > 0) return 'Portes coulissantes';
    if ((selectedModule.drawers || 0) > 0 && (selectedModule.doors || 0) > 0) return 'Mixte tiroirs + porte';
    if ((selectedModule.drawers || 0) > 0) return 'Bloc tiroirs';
    if ((selectedModule.doors || 0) > 0) return 'Module porte';
    const shelves = facadeItems.filter(it => Number(it.modIdx) === selectedModuleIdx && it.type === 'shelf').length;
    if (shelves > 0) return 'Étagères ouvertes';
    return 'Module ouvert';
  }, [selectedModule, selectedDetails.slidingDoors, facadeItems, selectedModuleIdx]);

  const selectedSummary = useMemo(() => {
    if (!selectedModule) return [];
    const shelves = facadeItems.filter(it => Number(it.modIdx) === selectedModuleIdx && it.type === 'shelf').length;
    const rods = facadeItems.filter(it => Number(it.modIdx) === selectedModuleIdx && it.type === 'rod').length;
    return [
      { label: 'Dimensions', value: `${selectedModule.width?.toFixed?.(1) ?? selectedModule.width} × ${cabinetDims.height} cm` },
      { label: 'Tiroirs', value: String(selectedModule.drawers || 0) },
      { label: 'Portes', value: String(selectedModule.doors || 0) },
      { label: 'Étagères', value: String(shelves) },
      { label: 'Tringles', value: String(rods) },
      { label: 'Fond', value: selectedDetails.hasBack ?? true ? 'Oui' : 'Non' },
    ];
  }, [selectedModule, facadeItems, selectedModuleIdx, cabinetDims.height, selectedDetails.hasBack]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[radial-gradient(circle_at_top,#1a2743_0%,#0b1020_42%,#060911_100%)]"
      style={{
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {showRotateHint && (
        <div className="px-3 py-2 bg-amber-600/20 border-b border-amber-400/30 text-amber-200 text-xs text-center font-semibold">
          📱 Conseil iPhone : passe en paysage pour éditer plus confortablement.
        </div>
      )}

      <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(14,22,38,0.96),rgba(10,16,29,0.92))] px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-amber-300">
              <PencilRuler className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[1.7rem] font-semibold tracking-tight text-white">Éditeur Intelligent</h2>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">v4.0</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-400">
                <span>Propulsé par Konva.js</span>
                <span className="text-slate-600">|</span>
                <span>Configuration intelligente des modules</span>
                {isLocalMode && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-300">Mode recalcul local</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {capturing && <span className="self-center text-sm text-amber-300 animate-pulse">Capture en cours...</span>}
            {infoMessage && <span className="self-center text-sm text-emerald-400">{infoMessage}</span>}
            {error && <span className="self-center text-sm text-red-400">{error}</span>}
            <button onClick={onCancel} className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/[0.09]">Annuler</button>
            <button
              onClick={() => { void triggerRemoteSave(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
              title="Enregistrer"
              aria-label="Enregistrer"
            >
              <Disc className="h-4 w-4" />
              Sauvegarder le projet
            </button>
            <button
              onClick={handleGenerateLocal}
              disabled={!currentCabinet}
              className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#f6b84a,#ff8c2e)] px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_rgba(251,146,60,0.28)] transition hover:brightness-105 disabled:opacity-40"
              title="Calcule les pièces localement sans appel serveur"
            >
              <Sparkles className="h-4 w-4" />
              Générer les pièces
            </button>
            <button
              onClick={handleRelancer}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                loading
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-200'
                  : isLocalMode
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                    : 'border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              {loading ? 'Analyse...' : isLocalMode ? 'Recalculer (local)' : 'Relancer Claude'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="min-w-[180px] rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Largeur nette utile</div>
            <div className="mt-1 text-lg font-semibold text-white">{totalInteriorWidth.toFixed(1)} cm</div>
          </div>
          <div className="min-w-[180px] rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Joints cumulés</div>
            <div className="mt-1 text-lg font-semibold text-white">{totalJointsWidth.toFixed(1)} cm</div>
          </div>
          <div className="min-w-[160px] rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Modules actifs</div>
            <div className="mt-1 text-lg font-semibold text-white">{facadeModules.length}</div>
          </div>
        </div>
      </div>

      {joints.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-amber-900/30 overflow-x-auto">
          <span className="text-xs font-bold text-amber-400 whitespace-nowrap shrink-0">🔩 Joints :</span>
          {joints.map((isDouble, i) => (
            <button key={i} onClick={() => toggleJoint(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
                isDouble ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30'
                          : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
              }`}>
              {isDouble ? '⬛⬛' : '▪️'} M{i+1}|M{i+2}
              <span className="opacity-60 text-[10px]">({isDouble?(thickness*2).toFixed(1):thickness.toFixed(1)} cm)</span>
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap shrink-0 pl-3">
            Joints : <span className="text-amber-400 font-bold">{totalJointsWidth.toFixed(1)} cm</span>
            {' · '}Net : <span className="text-green-400 font-bold">{totalInteriorWidth.toFixed(1)} cm</span>
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SketchToolbar
            activeTool={tool}
            onToolChange={setTool}
            isCompactMobile={isCompactMobile}
            hint={hint}
            dimensionsFromWizard={dimensionsFromWizard}
            cabinetDims={cabinetDims}
            onCabinetDimsChange={setCabinetDims}
            facadeModules={facadeModules}
            widthInputs={widthInputs}
            onWidthInputChange={(i, val) => setWidthInputs(prev => prev.map((v, idx) => idx === i ? val : v))}
            onCommitWidth={commitWidth}
            globalSliding={globalSliding}
            onGlobalSlidingChange={setGlobalSliding}
            selectedModuleIdx={selectedModuleIdx}
            onSelectModuleIdx={setSelectedModuleIdx}
            moduleDetails={moduleDetails}
            onModuleDetailsChange={setModuleDetails}
            onSave={() => { void triggerRemoteSave(); }}
            onMoveModule={(fromIdx, toIdx) => { handleMoveModule(fromIdx, toIdx); setSelectedModuleIdx(toIdx); }}
          />

          <SketchEditorCanvas
            ref={konvaEditorRef}
            cabW={cabinetDims.width}
            cabH={cabinetDims.height}
            plinth={cabinetDims.plinth}
            thick={thickness}
            facadeModules={facadeModules}
            cabinetModules={currentCabinet?.modules || []}
            facadeItems={facadeItems}
            joints={joints}
            globalSliding={globalSliding}
            elements={elements}
            onFacadePointerDown={handleFacadePointerDown}
            onItemMove={handleItemMove}
            onItemErase={handleItemErase}
            onModuleClick={handleModuleClick}
            onModuleErase={handleModuleErase}
            onElementAdd={handleElementAdd}
            onElementUpdate={handleElementUpdate}
            onElementRemove={handleElementRemove}
            activeTool={tool}
            onModuleChange={setFacadeModules}
            onItemChange={setFacadeItems}
            onDrawerResize={handleDrawerResize}
            generalNotes={generalNotes}
            onGeneralNotesChange={setGeneralNotes}
          />
        </div>

        <aside className="hidden w-[332px] shrink-0 border-l border-white/10 bg-[linear-gradient(180deg,#10192d,#0a1120)] xl:flex xl:flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ScanSearch className="h-4 w-4 text-sky-300" />
              Aperçu 3D client
            </div>
            <div className="mt-2 text-[13px] text-slate-300">
              Le rendu client se met à jour à partir de la structure actuelle du meuble.
            </div>
          </div>

          <div className="px-3 pt-3">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <ProfessionalRealisticViewer
                cabinet={currentCabinet}
                name="Aperçu meuble"
                presentationMode
                embedded
                viewerHeight={340}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3.5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Layers3 className="h-4 w-4 text-amber-300" />
                Propriétés
              </div>
              <div className="mb-3 rounded-2xl border border-white/8 bg-[#111a2e] p-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Sélection</div>
                <div className="mt-1 text-[15px] font-semibold text-white">
                  {selectedModule ? `Module ${selectedModuleIdx + 1}` : 'Aucun module'}
                </div>
                <div className="mt-1 text-[13px] text-slate-400">{selectedTypeLabel}</div>
              </div>

              <div className="space-y-2">
                {selectedSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#111a2e] px-3 py-2">
                    <span className="text-[13px] text-slate-400">{item.label}</span>
                    <span className="text-[13px] font-medium text-slate-100">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-white/8 bg-[#111a2e] p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">Configuration globale</div>
                <div className="space-y-2 text-[13px] text-slate-300">
                  <div className="flex justify-between"><span>Largeur</span><span>{cabinetDims.width} cm</span></div>
                  <div className="flex justify-between"><span>Hauteur</span><span>{cabinetDims.height} cm</span></div>
                  <div className="flex justify-between"><span>Plinthe</span><span>{cabinetDims.plinth} cm</span></div>
                  <div className="flex justify-between"><span>Joints doubles</span><span>{joints.filter(Boolean).length}</span></div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

SketchEditor.displayName = 'SketchEditor';
