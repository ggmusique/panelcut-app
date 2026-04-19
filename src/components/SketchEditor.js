import { useRef, useState, useCallback, useEffect } from 'react';
import { Disc } from 'lucide-react';
import SketchToolbar from './SketchToolbar';
import SketchEditorCanvas from './SketchEditorCanvas';
import { useSketchPersistence } from '../hooks/useSketchPersistence';
import { useSketchState } from '../hooks/useSketchState';
import { LS_SKETCH_KEY, uid } from '../utils/sketchEditorConstants';

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;

export default function SketchEditor({ image, scanImage, initialResult, draft, onDraftChange, onComplete, onCancel, onSave }) {
  const konvaEditorRef = useRef(null);

  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);

  const [tool,             setTool]             = useState('drawer');
  const [isCompactMobile,  setIsCompactMobile]  = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);

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
    currentCabinet,
    sketchFingerprint,
    commitWidth,
    toggleJoint,
    handleModuleClick,
    handleModuleErase,
    handleItemErase,
    handleItemMove,
    handleRelancer,
    handleElementAdd,
    handleElementUpdate,
    handleElementRemove,
  } = useSketchState({ initialResult, draft, konvaEditorRef, onComplete });

  useEffect(() => {
    setSelectedModuleIdx((idx) => Math.max(0, Math.min(idx, Math.max(0, facadeModules.length - 1))));
  }, [facadeModules.length]);

  const thickness          = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth   = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(1, toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
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

      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold">✏️ Éditeur Intelligent</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">v3.7</span>
        </div>
        <div className="flex gap-2">
          {error && <span className="text-red-400 text-sm self-center mr-2">{error}</span>}
          <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded">Annuler</button>
          <button
            onClick={() => { void triggerRemoteSave(); }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-green-400 hover:bg-white/10 transition-colors"
            title="Enregistrer"
            aria-label="Enregistrer"
          >
            <Disc className="w-4 h-4" />
          </button>
          <button onClick={handleRelancer} disabled={loading}
            className={`px-4 py-1 rounded font-bold text-white ${loading?'bg-orange-800':'bg-orange-600 hover:bg-orange-500'}`}>
            {loading ? 'Analyse...' : '🚀 Relancer Claude'}
          </button>
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
        generalNotes={generalNotes}
        onGeneralNotesChange={setGeneralNotes}
      />
    </div>
  );
}

SketchEditor.displayName = 'SketchEditor';
