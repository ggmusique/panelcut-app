import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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

/**
 * Centralise tout l'état métier de l'éditeur de croquis :
 * useState, useEffect de synchronisation et handlers.
 *
 * @param {Object} params
 * @param {Object}   params.initialResult
 * @param {Object}   params.draft
 * @param {Object}   params.konvaEditorRef   – ref vers FacadeKonvaEditor (pour handleRelancer)
 * @param {Function} params.onComplete       – appelé après un re-scan réussi
 */
export function useSketchState({ initialResult, draft, konvaEditorRef, onComplete }) {
  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);

  const sketchFingerprint = useMemo(() => {
    const cab  = initialResult?.cabinet || {};
    const mods = Array.isArray(cab.modules)
      ? cab.modules.map((m) => ({
          w: Number(m?.width ?? m?.w ?? 0),
          d: Number(m?.drawers ?? m?.nb_drawers ?? 0),
        }))
      : [];
    return JSON.stringify({
      w: Number(cab.width  ?? 0),
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

  const [elements,      setElements]      = useState(savedState?.elements || []);
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
    setModuleDetails((prev) => {
      return facadeModules.map((_, i) => ({
        ...defaultModuleDetail(facadeModules[i]?.drawers || 0),
        hasBack: prev[i]?.hasBack ?? true,
        slidingDoors: prev[i]?.slidingDoors ?? 0,
        drawerHeights: (() => {
          const count = Math.max(0, facadeModules[i]?.drawers || 0);
          const base  = Array.isArray(prev[i]?.drawerHeights) ? prev[i].drawerHeights : [];
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

  const thickness        = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(
    1,
    toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth
  );

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
    const w  = cabinetDims.width;
    const h  = cabinetDims.height;
    const pl = cabinetDims.plinth;
    if (!w || !h) return null;
    const interiorH = Math.max(1, h - pl);
    return {
      width: w, height: h, plinth: pl,
      globalSlidingDoors: globalSliding.enabled
        ? {
            count:    Math.max(2, Math.min(4, parseInt(globalSliding.count, 10) || 2)),
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
          width:        m.width,
          drawers:      m.drawers,
          drawerItems,
          doors:        m.doors,
          slidingDoors: details.slidingDoors || 0,
          hasBack:      details.hasBack ?? true,
          drawerParts:  details.drawerParts,
          rods: facadeItems
            .filter(it => it.type === 'rod'   && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
          shelves: facadeItems
            .filter(it => it.type === 'shelf' && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
        };
      }),
    };
  }, [cabinetDims, facadeModules, facadeItems, moduleDetails, globalSliding]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleModuleClick = useCallback((modIdx, activeTool) => {
    setFacadeModules(prev => {
      const next = prev.map((m, i) => {
        if (i !== modIdx) return m;
        if (activeTool === 'drawer')  return { ...m, drawers: m.drawers + 1 };
        if (activeTool === 'door')    return { ...m, doors: Math.min(m.doors + 1, 2), slidingDoors: 0 };
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
      if (type === 'drawer')  return { ...m, drawers:      Math.max(0, m.drawers - 1) };
      if (type === 'door')    return { ...m, doors:         Math.max(0, m.doors   - 1) };
      if (type === 'sliding') return { ...m, slidingDoors:  0 };
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
        hasCabinet: !!currentCabinet,
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

      if (onComplete) onComplete(enrichedResult);
    } catch (err) {
      console.error('💥 RELANCER FULL ERROR:', err.response?.data || err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onComplete, elements, cabinetDims, facadeModules, facadeItems,
      generalNotes, joints, getContextPrompt, currentCabinet, konvaEditorRef]);

  return {
    // state
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
    // memos
    currentCabinet,
    sketchFingerprint,
    // handlers
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
  };
}
