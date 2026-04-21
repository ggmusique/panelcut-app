import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Disc, Layers3, PencilRuler, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
  const { user } = useAuth();

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
    assemblyType,  setAssemblyType,
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
  const [jointsOpen, setJointsOpen] = useState(false);
  const [snapshotCabinet, setSnapshotCabinet] = useState(null);
  // Initialise le snapshot au premier currentCabinet disponible
  useEffect(() => {
    if (currentCabinet && !snapshotCabinet) setSnapshotCabinet(currentCabinet);
  }, [currentCabinet]); // eslint-disable-line

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

  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

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
        overflow: 'hidden',
      }}
    >
      {showRotateHint && (
        <div className="px-3 py-2 bg-amber-600/20 border-b border-amber-400/30 text-amber-200 text-xs text-center font-semibold">
          📱 Conseil iPhone : passe en paysage pour éditer plus confortablement.
        </div>
      )}

      <div style={{
        height: 48, flexShrink: 0,
        background: '#0d1117',
        borderBottom: '1px solid #21262d',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px', gap: 12,
        zIndex: 20,
      }}>
        {/* Gauche : titre + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.02em' }}>
            Éditeur Intelligent
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
            color: '#f85149', background: 'rgba(248,81,73,0.15)',
            border: '1px solid rgba(248,81,73,0.3)',
            padding: '1px 5px', borderRadius: 3,
          }}>v4.0</span>
          <span style={{ fontSize: 11, color: '#484f58' }}>Propulsé par Konva.js</span>
        </div>

        {/* Droite : actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {capturing && (
            <span style={{ fontSize: 11, color: '#e3b341', animation: 'pulse 1s infinite' }}>
              ⏳ Capture...
            </span>
          )}
          {infoMessage && (
            <span style={{ fontSize: 11, color: '#3fb950' }}>{infoMessage}</span>
          )}
          {error && (
            <span style={{ fontSize: 11, color: '#f85149' }}>{error}</span>
          )}

          <button onClick={onCancel}
            style={{
              height: 30, padding: '0 12px',
              background: 'none', border: '1px solid #30363d',
              borderRadius: 5, cursor: 'pointer', color: '#8b949e',
              fontSize: 12,
            }}>Annuler</button>

          <button
            onClick={async () => {
              if (!onSave || !currentCabinet) return;
              setSaveStatus('saving');
              try { await onSave(currentCabinet); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
              catch { setSaveStatus('idle'); }
            }}
            disabled={!user || saveStatus === 'saving'}
            style={{
              height: 30, padding: '0 12px',
              background: saveStatus === 'saved' ? 'rgba(63,185,80,0.2)' : 'rgba(31,111,235,0.15)',
              border: `1px solid ${saveStatus === 'saved' ? 'rgba(63,185,80,0.4)' : 'rgba(31,111,235,0.4)'}`,
              borderRadius: 5, cursor: !user || saveStatus === 'saving' ? 'not-allowed' : 'pointer',
              color: saveStatus === 'saved' ? '#3fb950' : '#388bfd',
              fontSize: 12, fontWeight: 600,
              opacity: !user ? 0.4 : 1,
            }}>
            {saveStatus === 'saving' ? '...' : saveStatus === 'saved' ? '✓ Sauvegardé' : '💾 Sauvegarder'}
          </button>

          <button onClick={handleGenerateLocal} disabled={!currentCabinet}
            style={{
              height: 30, padding: '0 14px',
              background: 'rgba(227,179,65,0.15)',
              border: '1px solid rgba(227,179,65,0.3)',
              borderRadius: 5, cursor: !currentCabinet ? 'not-allowed' : 'pointer',
              color: '#e3b341', fontSize: 12, fontWeight: 600,
              opacity: !currentCabinet ? 0.4 : 1,
            }}>
            ⚡ Générer pièces
          </button>

          <button onClick={handleRelancer} disabled={loading}
            style={{
              height: 30, padding: '0 14px',
              background: loading ? 'rgba(31,111,235,0.1)' : isLocalMode
                ? 'rgba(63,185,80,0.15)' : '#1f6feb',
              border: `1px solid ${loading ? 'rgba(31,111,235,0.2)' : isLocalMode ? 'rgba(63,185,80,0.4)' : '#388bfd'}`,
              borderRadius: 5,
              cursor: loading ? 'wait' : 'pointer',
              color: loading ? '#388bfd' : isLocalMode ? '#3fb950' : '#fff',
              fontSize: 12, fontWeight: 600,
            }}>
            {loading ? '⏳ Analyse...' : isLocalMode ? '⚡ Recalculer' : '🚀 Relancer Claude'}
          </button>
        </div>
      </div>

      {joints.length > 0 && (
        <div style={{ background: '#161b22', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
          {/* Ligne résumé + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer' }}
            onClick={() => setJointsOpen(v => !v)}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#e3b341', whiteSpace: 'nowrap' }}>🔩 Jonctions caissons</span>
            <span style={{ fontSize: 10, color: '#484f58', marginLeft: 4 }}>
              {joints.filter(Boolean).length} doubles · Joints&nbsp;
              <span style={{ color: '#e3b341', fontWeight: 700 }}>{totalJointsWidth.toFixed(1)} cm</span>
              &nbsp;· Net&nbsp;
              <span style={{ color: '#3fb950', fontWeight: 700 }}>{totalInteriorWidth.toFixed(1)} cm</span>
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#484f58' }}>{jointsOpen ? '▲' : '▼'}</span>
          </div>
          {/* Détail des jonctions — visible seulement si ouvert */}
          {jointsOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px 8px', overflowX: 'auto' }}>
              {joints.map((isDouble, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); toggleJoint(i); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    border: `1px solid ${isDouble ? 'rgba(227,179,65,0.5)' : '#30363d'}`,
                    background: isDouble ? 'rgba(227,179,65,0.12)' : '#0d1117',
                    color: isDouble ? '#e3b341' : '#484f58',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {isDouble ? '⬛⬛' : '▪'} M{i+1}|M{i+2}
                  <span style={{ opacity: 0.6, fontSize: 9 }}>({isDouble?(thickness*2).toFixed(1):thickness.toFixed(1)} cm)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            assemblyType={assemblyType}
            onAssemblyTypeChange={setAssemblyType}
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
            assemblyType={assemblyType}
          />

        <aside className="hidden w-[332px] shrink-0 border-l border-white/10 bg-[linear-gradient(180deg,#10192d,#0a1120)] xl:flex xl:flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <ScanSearch className="h-4 w-4 text-sky-300" />
                Aperçu 3D client
              </div>
              <button
                onClick={() => setSnapshotCabinet(currentCabinet)}
                title="Mettre à jour l'aperçu 3D"
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(56,139,253,0.15)', border: '1px solid rgba(56,139,253,0.3)',
                  color: '#388bfd', fontWeight: 600,
                }}
              >
                ↺ Rafraîchir
              </button>
            </div>
          </div>

          <div className="px-3 pt-3">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <ProfessionalRealisticViewer
                cabinet={snapshotCabinet}
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
