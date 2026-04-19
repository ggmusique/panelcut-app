import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Disc } from 'lucide-react';
import SketchToolbar from './SketchToolbar';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';
import { useSketchPersistence } from '../hooks/useSketchPersistence';
import {
  normalizeModulesFromResult,
  normalizeItemsFromResult,
  buildSketchContextPrompt,
} from '../utils/sketchEditorHelpers';
import { LS_SKETCH_KEY, defaultDrawerParts } from '../utils/sketchEditorConstants';

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;
const defaultModuleDetail = (drawerCount = 0) => ({
  hasBack: true,
  slidingDoors: 0,
  drawerHeights: Array(Math.max(0, drawerCount)).fill(18),
  drawerParts: defaultDrawerParts(),
});


export default function SketchEditor({ image, scanImage, initialResult, draft, onDraftChange, onComplete, onCancel, onSave }) {
  const konvaEditorRef     = useRef(null);

  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);
  const sketchFingerprint = useMemo(() => {
    const cab = initialResult?.cabinet || {};
    const mods = Array.isArray(cab.modules)
      ? cab.modules.map((m) => ({
          w: Number(m?.width ?? m?.w ?? 0),
          d: Number(m?.drawers ?? m?.nb_drawers ?? 0),
        }))
      : [];
    return JSON.stringify({
      w: Number(cab.width ?? 0),
      h: Number(cab.height ?? 0),
      p: Number(cab.plinth ?? 0),
      m: mods,
    });
  }, [initialResult]);

  // ─── Cache intelligent : restaurer uniquement le brouillon du même scan ─────
  const savedState = (() => {
    try {
      if (draft?.state && Object.keys(draft.state).length > 0) return draft.state;
      const r = localStorage.getItem(LS_SKETCH_KEY);
      if (!r) return null;
      const parsed = JSON.parse(r);
      return parsed?.state || parsed || null;
    } catch { return null; }
  })();

  const [tool,          setTool]          = useState('drawer');
  const [elements,      setElements]      = useState(savedState?.elements || []);
  const [isCompactMobile, setIsCompactMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [generalNotes,  setGeneralNotes]  = useState(savedState?.generalNotes || '');
  const [cabinetDims,   setCabinetDims]   = useState(
    savedState?.cabinetDims || {
      width:  toNum(initialCab.width,  200),
      height: toNum(initialCab.height, 240),
      plinth: toNum(initialCab.plinth,   0),
    }
  );

  const [facadeModules, setFacadeModules] = useState(() => {
    if (savedState?.facadeModules && savedState.facadeModules.length > 0)
      return savedState.facadeModules;
    if (draft?.state?.facadeModules && draft.state.facadeModules.length > 0)
      return draft.state.facadeModules;
    return normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200));
  });
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [moduleDetails, setModuleDetails] = useState(() => savedState?.moduleDetails || []);
  const [globalSliding, setGlobalSliding] = useState(() => savedState?.globalSliding || {
    enabled: false,
    count: 2,
    heightCm: Math.max(80, toNum(initialCab.height, 240) - toNum(initialCab.plinth, 0)),
  });
  const [widthInputs, setWidthInputs] = useState(
    () => (savedState?.facadeModules || normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200)))
      .map(m => String(m.width))
  );

  useEffect(() => {
    setWidthInputs(facadeModules.map(m => String(m.width)));
  }, [facadeModules]);
  useEffect(() => {
    setSelectedModuleIdx((idx) => Math.max(0, Math.min(idx, Math.max(0, facadeModules.length - 1))));
    setModuleDetails((prev) => {
      return facadeModules.map((_, i) => ({
        ...defaultModuleDetail(facadeModules[i]?.drawers || 0),
        hasBack: prev[i]?.hasBack ?? true,
        slidingDoors: prev[i]?.slidingDoors ?? 0,
        drawerHeights: (() => {
          const count = Math.max(0, facadeModules[i]?.drawers || 0);
          const base = Array.isArray(prev[i]?.drawerHeights) ? prev[i].drawerHeights : [];
          return Array.from({ length: count }, (_, di) => Math.max(5, toNum(base[di], 18)));
        })(),
        drawerParts: {
          ...defaultDrawerParts(),
          ...(prev[i]?.drawerParts || {}),
        },
      }));
    });
  }, [facadeModules]);

  const commitWidth = (idx) => {
    const n = Math.max(1, toNum(widthInputs[idx], 1));
    setFacadeModules(prev => prev.map((m, i) => i === idx ? { ...m, width: n } : m));
    setWidthInputs(prev => prev.map((v, i) => i === idx ? String(n) : v));
  };

  const [facadeItems, setFacadeItems] = useState(() => {
    if (savedState?.facadeItems && savedState.facadeItems.length > 0)
      return savedState.facadeItems;
    if (draft?.state?.facadeItems && draft.state.facadeItems.length > 0)
      return draft.state.facadeItems;
    return normalizeItemsFromResult(initialResult);
  });

  const nbJoints = Math.max(0, facadeModules.length - 1);
  const [joints, setJoints] = useState(
    () => savedState?.joints || Array(nbJoints).fill(true)
  );
  useEffect(() => {
    setJoints(prev => {
      const n = Math.max(0, facadeModules.length - 1);
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

  // ─── FIX v3.6 : Re-synchronise tous les états quand initialResult change ─────
  const prevResultRef = useRef(initialResult);
  useEffect(() => {
    if (prevResultRef.current === initialResult) return;
    prevResultRef.current = initialResult;
    const cab = initialResult?.cabinet || {};
    setCabinetDims({
      width:  toNum(cab.width,  200),
      height: toNum(cab.height, 240),
      plinth: toNum(cab.plinth,   0),
    });
    const newModules = normalizeModulesFromResult(initialResult, toNum(cab.width, 200));
    setFacadeModules(newModules);
    setModuleDetails(newModules.map((m) => defaultModuleDetail(m.drawers || 0)));
    setGlobalSliding({
      enabled: false,
      count: 2,
      heightCm: Math.max(80, toNum(cab.height, 240) - toNum(cab.plinth, 0)),
    });
    setFacadeItems(normalizeItemsFromResult(initialResult));
    setJoints(Array(Math.max(0, newModules.length - 1)).fill(true));
  }, [initialResult]);

  const currentCabinet = useMemo(() => {
    const w = cabinetDims.width;
    const h = cabinetDims.height;
    const pl = cabinetDims.plinth;
    if (!w || !h) return null;
    const interiorH = Math.max(1, h - pl);
    return {
      width: w, height: h, plinth: pl,
      globalSlidingDoors: globalSliding.enabled
        ? {
            count: Math.max(2, Math.min(4, parseInt(globalSliding.count, 10) || 2)),
            heightCm: Math.max(40, toNum(globalSliding.heightCm, h - pl)),
          }
        : null,
      modules: facadeModules.map((m, i) => {
        const details = {
          ...defaultModuleDetail(m.drawers || 0),
          ...(moduleDetails[i] || {}),
          drawerParts: {
            ...defaultDrawerParts(),
            ...(moduleDetails[i]?.drawerParts || {}),
          },
        };
        const drawerHeights = Array.isArray(details.drawerHeights)
          ? details.drawerHeights.map((v) => Math.max(5, toNum(v, 18)))
          : [];
        let drawerY = 0;
        const drawerItems = drawerHeights.map((heightCm) => {
          const item = { y: drawerY, height: heightCm };
          drawerY += heightCm;
          return item;
        });
        return {
          id: i + 1,
          width: m.width,
          drawers: m.drawers,
          drawerItems,
          doors: m.doors,
          slidingDoors: details.slidingDoors || 0,
          hasBack: details.hasBack ?? true,
          drawerParts: details.drawerParts,
          rods: facadeItems
            .filter(it => it.type === 'rod' && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
          shelves: facadeItems
            .filter(it => it.type === 'shelf' && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
        };
      }),
    };
  }, [cabinetDims, facadeModules, facadeItems, moduleDetails, globalSliding]);

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

  const FACADE_W = 1140;
  const FACADE_H = 700;

  const handleFacadePointerDown = useCallback((e, modIdx) => {
    if (e._konvaYRatio === undefined) return;
    const yRatio = e._konvaYRatio;
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

  const handleItemPointerDown = useCallback(() => {}, []);

  const handleModuleClick = useCallback((modIdx, activeTool) => {
    setFacadeModules(prev => {
      const next = prev.map((m, i) => {
        if (i !== modIdx) return m;
        if (activeTool === 'drawer') return { ...m, drawers: m.drawers + 1 };
        if (activeTool === 'door')   return { ...m, doors: Math.min(m.doors + 1, 2), slidingDoors: 0 };
        if (activeTool === 'sliding') return { ...m, slidingDoors: 2, doors: 0 };
        return m;
      });
      setTimeout(() => {
        localStorage.setItem(LS_SKETCH_KEY, JSON.stringify({
          fingerprint: sketchFingerprint,
          state: {
            elements,
            cabinetDims,
            facadeModules: next,
            facadeItems,
            moduleDetails,
            generalNotes,
            joints,
            globalSliding,
          },
        }));
      }, 0);
      return next;
    });
  }, [sketchFingerprint, elements, cabinetDims, facadeItems,
      moduleDetails, generalNotes, joints, globalSliding]);

  const handleModuleErase = useCallback((modIdx, type) => {
    setFacadeModules(prev => prev.map((m, i) => {
      if (i !== modIdx) return m;
      if (type === 'drawer') return { ...m, drawers: Math.max(0, m.drawers - 1) };
      if (type === 'door')   return { ...m, doors:   Math.max(0, m.doors   - 1) };
      if (type === 'sliding') return { ...m, slidingDoors: 0 };
      return m;
    }));
  }, []);

  const handleItemErase = useCallback((itemId) => {
    setFacadeItems(prev => prev.filter(it => it.id !== itemId));
  }, []);

  const handleItemMove = useCallback((itemId, newYRatio) => {
    setFacadeItems(prev => prev.map(it => it.id === itemId ? { ...it, yRatio: newYRatio } : it));
  }, []);

  const handleElementAdd    = useCallback((el) => setElements(prev => [...prev, el]), []);
  const handleElementUpdate = useCallback((el) => setElements(prev => prev.map(e => e.id === el.id ? el : e)), []);
  const handleElementRemove = useCallback((id) => setElements(prev => prev.filter(e => e.id !== id)), []);

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
      const dataUrl = konvaEditorRef.current?.exportDataUrl();
      if (!dataUrl) throw new Error('Éditeur Konva non initialisé');
      const base64 = dataUrl.split(',')[1];
      console.log('🚀 RELANCER DATA:', {
        hasImage: !!base64,
        piecesCount: currentCabinet?.modules?.length,
        hasCabinet: !!currentCabinet
      });
      const SERVER = 'https://panelcut-server.vercel.app';
      const prompt = getContextPrompt();
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
      const data = await res.json();
      const parsed = data.result || data;

      // Fusionner avec le cabinet édité localement (currentCabinet contient
      // les modules avec positions exactes de tringles/tablettes)
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

      if (onComplete) onComplete(enrichedResult);
    } catch (err) {
      console.error('💥 RELANCER FULL ERROR:', err.response?.data || err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onComplete, elements, cabinetDims, facadeModules, facadeItems, generalNotes, joints, getContextPrompt, currentCabinet]);

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

      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
        <FacadeKonvaEditor
          ref={konvaEditorRef}
          svgW={FACADE_W} svgH={FACADE_H}
          cabW={cabinetDims.width} cabH={cabinetDims.height}
          plinth={cabinetDims.plinth} thick={thickness}
          facadeModules={facadeModules}
          cabinetModules={currentCabinet?.modules || []}
          facadeItems={facadeItems}
          joints={joints}
          globalSliding={globalSliding}
          elements={elements}
          onFacadePointerDown={handleFacadePointerDown}
          onItemPointerDown={handleItemPointerDown}
          onItemMove={handleItemMove}
          onItemErase={handleItemErase}
          onModuleClick={handleModuleClick}
          onModuleErase={handleModuleErase}
          onElementAdd={handleElementAdd}
          onElementUpdate={handleElementUpdate}
          onElementRemove={handleElementRemove}
          activeTool={tool}
        />
      </div>

      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea value={generalNotes} onChange={e=>setGeneralNotes(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none"/>
      </div>
    </div>
  );
}
