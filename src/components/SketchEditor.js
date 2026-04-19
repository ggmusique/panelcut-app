import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Disc } from 'lucide-react';
import CabinetElevationFront from './CabinetElevationFront';
import SketchToolbar from './SketchToolbar';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';
import { captureFacadeToImage } from '../utils/captureFacadeToImage';
import { useSketchGestures } from '../hooks/useSketchGestures';
import { useSketchPersistence } from '../hooks/useSketchPersistence';
import {
  normalizeModulesFromResult,
  normalizeItemsFromResult,
  buildSketchContextPrompt,
} from '../utils/sketchEditorHelpers';
import { LS_SKETCH_KEY, defaultDrawerParts, uid } from '../utils/sketchEditorConstants';

const FACADE_CAPTURE_WIDTH            = 980;
const FACADE_CAPTURE_INITIAL_DELAY_MS = 150;
const FACADE_CAPTURE_DEBOUNCE_MS      = 400;
const MOBILE_BREAKPOINT_PX            = 768;

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;
const defaultModuleDetail = (drawerCount = 0) => ({
  hasBack: true,
  slidingDoors: 0,
  drawerHeights: Array(Math.max(0, drawerCount)).fill(18),
  drawerParts: defaultDrawerParts(),
});

export default function SketchEditor({
  image, scanImage, initialResult,
  draft, onDraftChange,
  onComplete, onCancel, onSave,
}) {
  const rawImg             = image || scanImage || null;
  const konvaEditorRef     = useRef(null);
  const facadeContainerRef = useRef(null);

  const [facadePng, setFacadePng] = useState(null);
  const imgSrc               = facadePng || rawImg;
  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);

  const sketchFingerprint = useMemo(() => {
    const cab  = initialResult?.cabinet || {};
    const mods = Array.isArray(cab.modules)
      ? cab.modules.map((m) => ({ w: Number(m?.width ?? 0), d: Number(m?.drawers ?? 0) }))
      : [];
    return JSON.stringify({ w: Number(cab.width ?? 0), h: Number(cab.height ?? 0), p: Number(cab.plinth ?? 0), m: mods });
  }, [initialResult]);

  // ── Restauration du brouillon ──────────────────────────────────────────────
  const savedState = (() => {
    try {
      if (draft?.state && Object.keys(draft.state).length > 0) return draft.state;
      const r = localStorage.getItem(LS_SKETCH_KEY);
      if (!r) return null;
      const parsed = JSON.parse(r);
      return parsed?.state || parsed || null;
    } catch { return null; }
  })();

  // ── États principaux ───────────────────────────────────────────────────────
  const [tool,            setTool]            = useState('drawer');
  const [baseView,        setBaseView]        = useState(imgSrc ? 'photo' : 'facade');
  const [elements,        setElements]        = useState(savedState?.elements || []);
  const [imgSize,         setImgSize]         = useState({ w: 800, h: 600 });
  const [isNavMode,       setIsNavMode]       = useState(() => typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT_PX : false);
  const [isCompactMobile, setIsCompactMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [generalNotes,    setGeneralNotes]    = useState(savedState?.generalNotes || '');
  const [editingNoteId,   setEditingNoteId]   = useState(null);
  const [editingDimId,    setEditingDimId]    = useState(null);

  const [cabinetDims, setCabinetDims] = useState(
    savedState?.cabinetDims || {
      width:  toNum(initialCab.width,  200),
      height: toNum(initialCab.height, 240),
      plinth: toNum(initialCab.plinth,   0),
    }
  );

  const [facadeModules, setFacadeModules] = useState(() => {
    if (savedState?.facadeModules?.length) return savedState.facadeModules;
    if (draft?.state?.facadeModules?.length) return draft.state.facadeModules;
    return normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200));
  });

  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [moduleDetails,     setModuleDetails]     = useState(() => savedState?.moduleDetails || []);
  const [globalSliding,     setGlobalSliding]     = useState(() => savedState?.globalSliding || {
    enabled: false, count: 2,
    heightCm: Math.max(80, toNum(initialCab.height, 240) - toNum(initialCab.plinth, 0)),
  });

  const [widthInputs, setWidthInputs] = useState(
    () => (savedState?.facadeModules || normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200)))
      .map(m => String(m.width))
  );

  // ── FacadeItems : tablettes et tringles ────────────────────────────────────
  const [facadeItems, setFacadeItems] = useState(() => {
    if (savedState?.facadeItems?.length)         return savedState.facadeItems;
    if (draft?.state?.facadeItems?.length)       return draft.state.facadeItems;
    return normalizeItemsFromResult(initialResult);
  });

  // ── Joints ────────────────────────────────────────────────────────────────
  const nbJoints = Math.max(0, facadeModules.length - 1);
  const [joints, setJoints] = useState(() => savedState?.joints || Array(nbJoints).fill(true));

  useEffect(() => {
    setJoints(prev => {
      const n    = Math.max(0, facadeModules.length - 1);
      if (prev.length === n) return prev;
      const next = Array(n).fill(true);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }, [facadeModules.length]);

  const toggleJoint = (i) => setJoints(prev => prev.map((v, idx) => idx === i ? !v : v));

  const thickness          = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth   = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(1, toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth);

  // ── Sync widthInputs ──────────────────────────────────────────────────────
  useEffect(() => { setWidthInputs(facadeModules.map(m => String(m.width))); }, [facadeModules]);

  // ── Sync moduleDetails quand facadeModules change ─────────────────────────
  useEffect(() => {
    setSelectedModuleIdx(idx => Math.max(0, Math.min(idx, Math.max(0, facadeModules.length - 1))));
    setModuleDetails(prev => facadeModules.map((_, i) => ({
      ...defaultModuleDetail(facadeModules[i]?.drawers || 0),
      hasBack:      prev[i]?.hasBack ?? true,
      slidingDoors: prev[i]?.slidingDoors ?? 0,
      drawerHeights: (() => {
        const count = Math.max(0, facadeModules[i]?.drawers || 0);
        const base  = Array.isArray(prev[i]?.drawerHeights) ? prev[i].drawerHeights : [];
        return Array.from({ length: count }, (_, di) => Math.max(5, toNum(base[di], 18)));
      })(),
      drawerParts: { ...defaultDrawerParts(), ...(prev[i]?.drawerParts || {}) },
    })));
  }, [facadeModules]);

  const commitWidth = (idx) => {
    const n = Math.max(1, toNum(widthInputs[idx], 1));
    setFacadeModules(prev => prev.map((m, i) => i === idx ? { ...m, width: n } : m));
    setWidthInputs(prev => prev.map((v, i) => i === idx ? String(n) : v));
  };

  // ── Re-sync quand initialResult change ────────────────────────────────────
  const prevResultRef = useRef(initialResult);
  const didAutoSwitchRef = useRef(false);

  useEffect(() => {
    if (prevResultRef.current === initialResult) return;
    prevResultRef.current = initialResult;
    const cab = initialResult?.cabinet || {};
    setCabinetDims({ width: toNum(cab.width, 200), height: toNum(cab.height, 240), plinth: toNum(cab.plinth, 0) });
    const newModules = normalizeModulesFromResult(initialResult, toNum(cab.width, 200));
    setFacadeModules(newModules);
    setModuleDetails(newModules.map(m => defaultModuleDetail(m.drawers || 0)));
    setGlobalSliding({ enabled: false, count: 2, heightCm: Math.max(80, toNum(cab.height, 240) - toNum(cab.plinth, 0)) });
    setFacadeItems(normalizeItemsFromResult(initialResult));
    setJoints(Array(Math.max(0, newModules.length - 1)).fill(true));
    didAutoSwitchRef.current = false;
  }, [initialResult]);

  // ── Cabinet courant (pour la sauvegarde et Claude) ────────────────────────
  const currentCabinet = useMemo(() => {
    const { width: w, height: h, plinth: pl } = cabinetDims;
    if (!w || !h) return null;
    const interiorH = Math.max(1, h - pl);
    return {
      width: w, height: h, plinth: pl,
      globalSlidingDoors: globalSliding.enabled ? {
        count:    Math.max(2, Math.min(4, parseInt(globalSliding.count, 10) || 2)),
        heightCm: Math.max(40, toNum(globalSliding.heightCm, h - pl)),
      } : null,
      modules: facadeModules.map((m, i) => {
        const details = { ...defaultModuleDetail(m.drawers || 0), ...(moduleDetails[i] || {}),
          drawerParts: { ...defaultDrawerParts(), ...(moduleDetails[i]?.drawerParts || {}) } };
        let drawerY   = 0;
        const drawerItems = (details.drawerHeights || [])
          .map(v => Math.max(5, toNum(v, 18)))
          .map(hCm => { const item = { y: drawerY, height: hCm }; drawerY += hCm; return item; });
        return {
          id: i + 1, width: m.width, drawers: m.drawers, drawerItems,
          doors: m.doors, slidingDoors: details.slidingDoors || 0,
          hasBack: details.hasBack ?? true, drawerParts: details.drawerParts,
          rods:    facadeItems.filter(it => it.type === 'rod'   && Number(it.modIdx) === i).map(it => ({ y: (1 - it.yRatio) * interiorH })),
          shelves: facadeItems.filter(it => it.type === 'shelf' && Number(it.modIdx) === i).map(it => ({ y: (1 - it.yRatio) * interiorH })),
        };
      }),
    };
  }, [cabinetDims, facadeModules, facadeItems, moduleDetails, globalSliding]);

  // ── Persistence ───────────────────────────────────────────────────────────
  const { triggerRemoteSave } = useSketchPersistence({
    elements, cabinetDims, facadeModules, facadeItems,
    moduleDetails, generalNotes, joints, globalSliding,
    sketchFingerprint, onSave, onDraftChange, currentCabinet,
  });

  // ── Capture automatique de la façade pour la vue photo ────────────────────
  useEffect(() => {
    if (!currentCabinet) return;
    const isFirst = !didAutoSwitchRef.current;
    const delay   = isFirst ? FACADE_CAPTURE_INITIAL_DELAY_MS : FACADE_CAPTURE_DEBOUNCE_MS;
    const timer = setTimeout(async () => {
      // Priorité : export Konva si disponible (plus propre)
      const konvaDataUrl = konvaEditorRef.current?.exportDataUrl?.();
      if (konvaDataUrl) {
        setFacadePng(konvaDataUrl);
        if (isFirst) { setBaseView('photo'); didAutoSwitchRef.current = true; }
        return;
      }
      // Fallback : capture du DOM SVG
      const png = await captureFacadeToImage(facadeContainerRef);
      if (png) {
        setFacadePng(png);
        if (isFirst) { setBaseView('photo'); didAutoSwitchRef.current = true; }
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [currentCabinet]);

  // ── imgSize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (baseView === 'facade') { setImgSize({ w: 1140, h: 700 }); return; }
    if (!imgSrc) return;
    const img = new window.Image();
    img.onload = () => {
      const maxW  = 1200;
      const ratio = Math.min(maxW / img.naturalWidth, 1);
      setImgSize({ w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) });
    };
    img.src = imgSrc;
  }, [imgSrc, baseView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsCompactMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Gestes SVG (vue photo) ────────────────────────────────────────────────
  const svgRef = useRef(null);
  const { viewport, setViewport, handlePointerDown, handlePointerMove, handlePointerUp,
          resetViewport, handleFacadePointerDown, handleItemPointerDown } = useSketchGestures({
    svgRef, imgSize, isNavMode, baseView, tool,
    elements, facadeItems, setElements, setFacadeItems,
    setEditingDimId, sketchFingerprint, cabinetDims,
    facadeModules, moduleDetails, generalNotes, joints,
    globalSliding, thickness,
  });

  useEffect(() => {
    setViewport({ x: 0, y: 0, w: imgSize.w, h: imgSize.h });
  }, [imgSize.w, imgSize.h, baseView, setViewport]);

  // ── Callbacks modules ─────────────────────────────────────────────────────
  const handleModuleClick = useCallback((modIdx, activeTool) => {
    setFacadeModules(prev => prev.map((m, i) => {
      if (i !== modIdx) return m;
      if (activeTool === 'drawer')  return { ...m, drawers: (m.drawers || 0) + 1 };
      if (activeTool === 'door')    return { ...m, doors: Math.min((m.doors || 0) + 1, 2), slidingDoors: 0 };
      if (activeTool === 'sliding') return { ...m, slidingDoors: 2, doors: 0 };
      return m;
    }));
  }, []);

  const handleModuleErase = useCallback((modIdx, type) => {
    setFacadeModules(prev => prev.map((m, i) => {
      if (i !== modIdx) return m;
      if (type === 'drawer')  return { ...m, drawers: Math.max(0, (m.drawers || 0) - 1) };
      if (type === 'door')    return { ...m, doors:   Math.max(0, (m.doors   || 0) - 1) };
      if (type === 'sliding') return { ...m, slidingDoors: 0 };
      return m;
    }));
  }, []);

  const handleItemErase = useCallback((itemId) => {
    setFacadeItems(prev => prev.filter(it => it.id !== itemId));
  }, []);

  // ── CORRECTION PRINCIPALE : handleItemMove branché sur setFacadeItems ─────
  const handleItemMove = useCallback((itemId, newYRatio) => {
    setFacadeItems(prev =>
      prev.map(it => it.id === itemId ? { ...it, yRatio: Math.max(0, Math.min(1, newYRatio)) } : it)
    );
  }, []);

  // ── Annotations (depuis la vue Konva) ─────────────────────────────────────
  const handleElementAdd = useCallback((el) => {
    setElements(prev => [...prev, el]);
  }, []);

  const handleElementUpdate = useCallback((el) => {
    setElements(prev => prev.map(e => e.id === el.id ? el : e));
  }, []);

  const handleElementRemove = useCallback((id) => {
    setElements(prev => prev.filter(e => e.id !== id));
  }, []);

  // ── Relancer Claude ───────────────────────────────────────────────────────
  const getContextPrompt = useCallback(() => buildSketchContextPrompt({
    elements, dimensionsFromWizard, cabinetDims, thickness, joints,
    totalJointsWidth, totalInteriorWidth, facadeModules, facadeItems,
    moduleDetails, generalNotes, globalSliding,
  }), [elements, dimensionsFromWizard, cabinetDims, thickness, joints,
       totalJointsWidth, totalInteriorWidth, facadeModules, facadeItems,
       moduleDetails, generalNotes, globalSliding]);

  const handleRelancer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Export haute résolution depuis Konva (PNG 3x)
      const dataUrl = konvaEditorRef.current?.exportDataUrl?.();
      if (!dataUrl) throw new Error('Éditeur Konva non initialisé — basculez en vue Façade d\'abord');

      const base64 = dataUrl.split(',')[1];
      const SERVER  = 'https://panelcut-server.vercel.app';
      const prompt  = getContextPrompt();

      let res = await fetch(`${SERVER}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/png', userNotes: prompt, prompt }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${SERVER}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
        });
      }
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);

      const data   = await res.json();
      const parsed = data.result || data;
      const enrichedResult = {
        ...parsed,
        cabinet: {
          ...(parsed.cabinet || {}),
          width:     parsed.cabinet?.width     || currentCabinet?.width,
          height:    parsed.cabinet?.height    || currentCabinet?.height,
          depth:     parsed.cabinet?.depth     || 60,
          plinth:    parsed.cabinet?.plinth    || currentCabinet?.plinth,
          thickness: parsed.cabinet?.thickness || 1.8,
          modules:   currentCabinet?.modules   || parsed.cabinet?.modules || [],
        },
      };
      onComplete?.(enrichedResult);
    } catch (err) {
      console.error('RELANCER ERROR:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onComplete, elements, cabinetDims, facadeModules, facadeItems, generalNotes, joints, getContextPrompt, currentCabinet]);

  // ── Rendu des annotations en vue SVG (photo) ──────────────────────────────
  const eraseElement = (id) => setElements(prev => prev.filter(el => el.id !== id));

  const renderSVGElement = (el) => {
    if (el.type === 'dim') return (
      <g key={el.id} onClick={e => { e.stopPropagation(); if (tool === 'erase') eraseElement(el.id); }}
        style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }} opacity={0.85}>
        <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4"/>
        <circle cx={el.x1} cy={el.y1} r="3" fill="#22d3ee"/>
        <circle cx={el.x2} cy={el.y2} r="3" fill="#22d3ee"/>
        <rect x={(el.x1+el.x2)/2-24} y={(el.y1+el.y2)/2-14} width="48" height="18" rx="3"
          fill={el.label?'#0e7490':'#164e63'} stroke="#22d3ee" strokeWidth="1"
          style={{cursor:'pointer'}}
          onClick={e => { e.stopPropagation(); if (tool === 'erase') { eraseElement(el.id); return; } setEditingDimId(el.id); }}/>
        <text x={(el.x1+el.x2)/2} y={(el.y1+el.y2)/2-2} textAnchor="middle" fill="#22d3ee" fontSize="11" fontWeight="bold" pointerEvents="none">
          {el.label ? `${el.label} cm` : '? cm'}
        </text>
      </g>
    );
    if (el.type === 'note') return (
      <g key={el.id} style={{cursor:'pointer'}}
        onClick={e => { e.stopPropagation(); tool==='erase' ? eraseElement(el.id) : setEditingNoteId(el.id); }}>
        <rect x={el.x-2} y={el.y-14} width={Math.max(60, el.text.length*7+12)} height="20" rx="3" fill="#fb923c" opacity="0.85"/>
        <text x={el.x+4} y={el.y} fill="white" fontSize="11" fontWeight="bold" pointerEvents="none">📝 {el.text}</text>
      </g>
    );
    return null;
  };

  const hint = baseView === 'facade'
    ? tool === 'erase'   ? '🧹 Clic pour supprimer'
    : tool === 'shelf'   ? '📦 Clic dans module · glisser pour déplacer'
    : tool === 'rod'     ? '👔 Clic dans module · glisser pour déplacer'
    : tool === 'drawer'  ? '🗄️ Clic dans module → tiroir'
    : tool === 'door'    ? '🚪 Clic dans module → porte'
    : tool === 'sliding' ? '🚪↔️ Clic dans module → coulissantes'
    : tool === 'dim'     ? '📏 Tracer une ligne de cote'
    : tool === 'note'    ? '📝 Clic pour poser une note'
    : '👆 Sélectionner · molette = zoom'
    : '💡 Cliquer pour annoter · glisser pour déplacer';

  const isIPhone = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent || '');
  const showRotateHint = isIPhone && typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {showRotateHint && (
        <div className="px-3 py-2 bg-amber-600/20 border-b border-amber-400/30 text-amber-200 text-xs text-center font-semibold">
          📱 Conseil iPhone : passe en paysage pour éditer plus confortablement.
        </div>
      )}

      {/* SVG hors-écran pour la capture façade (CabinetElevationFront) */}
      {currentCabinet && (
        <div ref={facadeContainerRef}
          style={{ position:'absolute', left:'-9999px', top:0, width:`${FACADE_CAPTURE_WIDTH}px`, visibility:'hidden', pointerEvents:'none' }}
          aria-hidden="true">
          <CabinetElevationFront cabinet={currentCabinet} name={initialResult?.name || 'Meuble'} />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold">✏️ Éditeur Façade</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">v4.0</span>
        </div>
        <div className="flex gap-2 items-center">
          {error && <span className="text-red-400 text-xs self-center max-w-[180px] truncate">{error}</span>}
          <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded text-sm">Annuler</button>
          <button onClick={() => void triggerRemoteSave()}
            className="p-1.5 rounded-lg text-slate-300 hover:text-green-400 hover:bg-white/10 transition-colors"
            title="Enregistrer">
            <Disc className="w-4 h-4" />
          </button>
          <button onClick={handleRelancer} disabled={loading}
            className={`px-4 py-1.5 rounded font-bold text-white text-sm ${loading ? 'bg-orange-800 cursor-wait' : 'bg-orange-600 hover:bg-orange-500'}`}>
            {loading ? '⏳ Analyse...' : '🚀 Relancer Claude'}
          </button>
        </div>
      </div>

      {/* Barre joints */}
      {joints.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-amber-900/30 overflow-x-auto">
          <span className="text-xs font-bold text-amber-400 whitespace-nowrap shrink-0">🔩 Joints :</span>
          {joints.map((isDouble, i) => (
            <button key={i} onClick={() => toggleJoint(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
                isDouble ? 'bg-amber-500/20 text-amber-300 border-amber-500/60' : 'bg-slate-700 text-slate-400 border-slate-600'
              }`}>
              {isDouble ? '⬛⬛' : '▪️'} M{i+1}|M{i+2}
              <span className="opacity-60 text-[10px]">({isDouble?(thickness*2).toFixed(1):thickness.toFixed(1)} cm)</span>
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap pl-3">
            Joints : <span className="text-amber-400 font-bold">{totalJointsWidth.toFixed(1)} cm</span>
            {' · '}Net : <span className="text-green-400 font-bold">{totalInteriorWidth.toFixed(1)} cm</span>
          </span>
        </div>
      )}

      {/* Toolbar */}
      <SketchToolbar
        activeTool={tool}              onToolChange={setTool}
        baseView={baseView}            onViewChange={setBaseView}
        facadePng={facadePng}
        isNavMode={isNavMode}          onNavModeChange={setIsNavMode}
        onResetViewport={resetViewport}
        isCompactMobile={isCompactMobile}
        hint={hint}
        dimensionsFromWizard={dimensionsFromWizard}
        cabinetDims={cabinetDims}      onCabinetDimsChange={setCabinetDims}
        facadeModules={facadeModules}
        widthInputs={widthInputs}
        onWidthInputChange={(i, val) => setWidthInputs(prev => prev.map((v, idx) => idx === i ? val : v))}
        onCommitWidth={commitWidth}
        globalSliding={globalSliding}  onGlobalSlidingChange={setGlobalSliding}
        selectedModuleIdx={selectedModuleIdx} onSelectModuleIdx={setSelectedModuleIdx}
        moduleDetails={moduleDetails}  onModuleDetailsChange={setModuleDetails}
        onSave={() => void triggerRemoteSave()}
      />

      {/* Canvas principal */}
      <div className="flex-1 overflow-hidden bg-slate-950 flex justify-center items-start p-2">
        {baseView === 'photo' ? (
          <svg ref={svgRef} width={imgSize.w} height={imgSize.h}
            viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
            className="shadow-2xl max-w-full"
            style={{ background: '#1e293b', touchAction: 'none' }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}     onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}>
            {imgSrc && (
              <image href={imgSrc} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet" />
            )}
            {elements.filter(el => ['dim','note'].includes(el.type)).map(renderSVGElement)}
          </svg>
        ) : (
          <div className="w-full h-full">
            <FacadeKonvaEditor
              ref={konvaEditorRef}
              svgW={imgSize.w}         svgH={imgSize.h}
              cabW={cabinetDims.width} cabH={cabinetDims.height}
              plinth={cabinetDims.plinth} thick={thickness}
              facadeModules={facadeModules}
              cabinetModules={currentCabinet?.modules || []}
              facadeItems={facadeItems}
              joints={joints}
              globalSliding={globalSliding}
              activeTool={tool}
              // Callbacks items
              onFacadePointerDown={handleFacadePointerDown}
              onItemPointerDown={handleItemPointerDown}
              onItemMove={handleItemMove}           // ← BRANCHÉ sur setFacadeItems
              onItemErase={handleItemErase}
              onModuleClick={handleModuleClick}
              onModuleErase={handleModuleErase}
              // Callbacks annotations
              elements={elements}
              onElementAdd={handleElementAdd}
              onElementUpdate={handleElementUpdate}
              onElementRemove={handleElementRemove}
            />
          </div>
        )}
      </div>

      {/* Notes générales */}
      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-14 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none" />
      </div>

      {/* Modal édition cote */}
      {editingDimId && (() => {
        const dim = elements.find(e => e.id === editingDimId);
        if (!dim) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={() => setEditingDimId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[260px]" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📏 Valeur de la cote (cm)</h3>
              <input autoFocus type="number" defaultValue={dim.label || ''} placeholder="ex: 120"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white text-lg"
                onKeyDown={e => {
                  if (e.key === 'Enter') { setElements(prev => prev.map(el => el.id === editingDimId ? { ...el, label: e.target.value.trim() } : el)); setEditingDimId(null); }
                  if (e.key === 'Escape') setEditingDimId(null);
                }} />
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-bold text-sm"
                  onClick={e => {
                    const v = e.target.closest('div').parentElement.querySelector('input').value.trim();
                    setElements(prev => prev.map(el => el.id === editingDimId ? { ...el, label: v } : el));
                    setEditingDimId(null);
                  }}>✓ Valider</button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={() => setEditingDimId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal édition note */}
      {editingNoteId && (() => {
        const note = elements.find(e => e.id === editingNoteId);
        if (!note) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={() => setEditingNoteId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[280px]" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📝 Modifier la note</h3>
              <input autoFocus type="text" defaultValue={note.text}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white"
                onKeyDown={e => {
                  if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) setElements(prev => prev.map(el => el.id === editingNoteId ? { ...el, text: v } : el)); setEditingNoteId(null); }
                  if (e.key === 'Escape') setEditingNoteId(null);
                }} />
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm"
                  onClick={e => {
                    const v = e.target.closest('div').parentElement.querySelector('input').value.trim();
                    if (v) setElements(prev => prev.map(el => el.id === editingNoteId ? { ...el, text: v } : el));
                    setEditingNoteId(null);
                  }}>✓ Valider</button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={() => setEditingNoteId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
