import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TOOL_IDS,
  buildPiecesFromCabinet,
  buildRefinePrompt,
  validateDraftState,
  updateModuleCount,
  createAnnotation,
  createModuleItem,
} from './utils';

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function normalizeYToCm(yPx, totalHeightPx, cabinetHeightCm) {
  const px = toNum(yPx, 0);
  const hPx = Math.max(1, toNum(totalHeightPx, 700));
  const hCm = Math.max(1, toNum(cabinetHeightCm, 220));
  return (px / hPx) * hCm;
}

function normalizeModuleDetailsFromInitial(modules, cabinetHeightCm) {
  const safeModules = Array.isArray(modules) ? modules : [];
  const rawYs = [];
  safeModules.forEach((m) => {
    (m?.shelves || []).forEach((s) => rawYs.push(toNum(typeof s === 'object' ? s?.y : s, 0)));
    (m?.rods || []).forEach((r) => rawYs.push(toNum(typeof r === 'object' ? r?.y : r, 0)));
    (m?.drawerItems || []).forEach((d) => rawYs.push(toNum(d?.y, 0), toNum(d?.height, 0)));
    if (Array.isArray(m?.drawers)) m.drawers.forEach((d) => rawYs.push(toNum(d?.y, 0), toNum(d?.height, 0)));
  });

  const maxRaw = rawYs.length ? Math.max(...rawYs) : 0;
  const usePx = maxRaw > Math.max(300, cabinetHeightCm * 1.5);
  const totalHeightPx = usePx ? maxRaw : 700;

  return safeModules.map((m, idx) => {
    const normalizeY = (v) => {
      const raw = toNum(v, 0);
      return usePx ? normalizeYToCm(raw, totalHeightPx, cabinetHeightCm) : raw;
    };

    const shelves = Array.isArray(m?.shelves)
      ? m.shelves.map((s) => ({ id: uid(), y: normalizeY(typeof s === 'object' ? s?.y : s) }))
      : [];

    const rods = Array.isArray(m?.rods)
      ? m.rods.map((r) => ({ id: uid(), y: normalizeY(typeof r === 'object' ? r?.y : r) }))
      : [];

    const drawerItems = Array.isArray(m?.drawerItems)
      ? m.drawerItems
      : (Array.isArray(m?.drawers) ? m.drawers : []);

    const drawers = drawerItems.map((d) => ({
      id: uid(),
      y: normalizeY(d?.y),
      height: usePx ? normalizeYToCm(d?.height, totalHeightPx, cabinetHeightCm) : toNum(d?.height, 18),
    }));

    const doorCount = Math.max(0, toNum(m?.doors, Array.isArray(m?.doors) ? m.doors.length : 0));
    const slidingDoorCount = Math.max(0, toNum(m?.slidingDoors, Array.isArray(m?.slidingDoors) ? m.slidingDoors.length : 0));

    return {
      moduleId: String(idx + 1),
      shelves,
      drawers,
      rods,
      doors: Array.from({ length: doorCount }, () => ({ id: uid(), kind: 'single' })),
      slidingDoors: Array.from({ length: slidingDoorCount }, () => ({ id: uid(), kind: 'single' })),
    };
  });
}

function buildInitialDraftState(initialResult, draft) {
  const draftState = draft?.state || {};
  const cabinet = initialResult?.cabinet || {};
  const sourceModules = Array.isArray(cabinet.modules) ? cabinet.modules : [];

  const cabinetDims = {
    width: toNum(draftState?.cabinetDims?.width, toNum(cabinet.width, 240)),
    height: toNum(draftState?.cabinetDims?.height, toNum(cabinet.height, 220)),
    depth: toNum(draftState?.cabinetDims?.depth, toNum(cabinet.depth, 60)),
    thickness: toNum(draftState?.cabinetDims?.thickness, toNum(cabinet.thickness ?? cabinet.panel_thickness, 1.8)),
  };

  const facadeModules = Array.isArray(draftState.facadeModules) && draftState.facadeModules.length
    ? draftState.facadeModules
    : sourceModules.map((m, i) => ({
        id: String(i + 1),
        x: 0,
        width: Math.max(1, toNum(m?.width, 40)),
        type: 'standard',
      }));

  if (!facadeModules.length) {
    const count = Math.max(1, toNum(cabinet.nb_dividers, 3) + 1);
    for (let i = 0; i < count; i++) {
      facadeModules.push({ id: String(i + 1), x: 0, width: 40, type: 'standard' });
    }
  }

  const totalW = facadeModules.reduce((acc, m) => acc + Math.max(1, toNum(m.width, 1)), 0);
  let cursor = 0;
  const modulesWithPos = facadeModules.map((m, idx) => {
    const w = Math.max(1, toNum(m.width, totalW / facadeModules.length));
    const normalized = { ...m, id: String(idx + 1), x: (cursor / totalW) * 100, width: w };
    cursor += w;
    return normalized;
  });

  const moduleDetails = Array.isArray(draftState.moduleDetails) && draftState.moduleDetails.length
    ? draftState.moduleDetails
    : normalizeModuleDetailsFromInitial(sourceModules, cabinetDims.height);

  const detailById = new Map((moduleDetails || []).map((d) => [String(d.moduleId), d]));
  const alignedDetails = modulesWithPos.map((m) => {
    const ex = detailById.get(String(m.id));
    if (ex) return { ...ex, moduleId: String(m.id) };
    return { moduleId: String(m.id), shelves: [], drawers: [], rods: [], doors: [], slidingDoors: [] };
  });

  return {
    cabinetDims,
    facadeModules: modulesWithPos,
    facadeItems: Array.isArray(draftState.facadeItems) ? draftState.facadeItems : [],
    moduleDetails: alignedDetails,
  };
}

export function buildCabinetFromDraft(draftState) {
  const dims = draftState?.cabinetDims || {};
  const modules = Array.isArray(draftState?.facadeModules) ? draftState.facadeModules : [];
  const details = Array.isArray(draftState?.moduleDetails) ? draftState.moduleDetails : [];

  const outputModules = modules.map((m, idx) => {
    const d = details.find((it) => String(it.moduleId) === String(m.id)) || {};
    const shelves = (d.shelves || []).map((s) => ({ y: toNum(s.y, 0) }));
    const drawers = (d.drawers || []).map((dr) => ({ y: toNum(dr.y, 0), height: toNum(dr.height, 18) }));
    const rods = (d.rods || []).map((r) => ({ y: toNum(r.y, 0) }));
    return {
      id: idx + 1,
      width: toNum(m.width, 1),
      shelves,
      shelfPositions: shelves.map((s) => s.y),
      drawers: drawers.length,
      drawerItems: drawers,
      rods,
      doors: Array.isArray(d.doors) ? d.doors.length : 0,
      slidingDoors: Array.isArray(d.slidingDoors) ? d.slidingDoors.length : 0,
    };
  });

  return {
    width: toNum(dims.width, 0),
    height: toNum(dims.height, 0),
    depth: toNum(dims.depth, 60),
    thickness: toNum(dims.thickness, 1.8),
    modules: outputModules,
  };
}

export default function useSketchState({ image, initialResult, draft, onDraftChange, onComplete, onSave }) {
  const [tool, setTool] = useState(TOOL_IDS.SELECT);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [extraNotes, setExtraNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [draftState, setDraftState] = useState({
    cabinetDims: { width: '', height: '', depth: '', thickness: 1.8 },
    facadeModules: [],
    facadeItems: [],
    moduleDetails: [],
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const normalized = buildInitialDraftState(initialResult, draft);
    setDraftState(normalized);
    setSelectedModuleId(normalized.facadeModules[0]?.id || null);
    setExtraNotes(draft?.state?.extraNotes || '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cabinetDims = draftState.cabinetDims;
  const setCabinetDims = useCallback((updater) => {
    setDraftState((prev) => ({
      ...prev,
      cabinetDims: typeof updater === 'function' ? updater(prev.cabinetDims) : updater,
    }));
  }, []);

  const facadeModules = draftState.facadeModules;
  const setFacadeModules = useCallback((updater) => {
    setDraftState((prev) => ({
      ...prev,
      facadeModules: typeof updater === 'function' ? updater(prev.facadeModules) : updater,
    }));
  }, []);

  const moduleDetails = draftState.moduleDetails;
  const setModuleDetails = useCallback((updater) => {
    setDraftState((prev) => ({
      ...prev,
      moduleDetails: typeof updater === 'function' ? updater(prev.moduleDetails) : updater,
    }));
  }, []);

  useEffect(() => {
    if (!onDraftChange) return;
    onDraftChange({
      state: {
        ...draftState,
        extraNotes,
      },
    });
  }, [draftState, extraNotes, onDraftChange]);

  const selectedModuleDetail = useMemo(
    () => draftState.moduleDetails.find((d) => String(d.moduleId) === String(selectedModuleId)) || null,
    [draftState.moduleDetails, selectedModuleId]
  );

  const alerts = useMemo(() => validateDraftState(draftState), [draftState]);
  const isReady = alerts.critical.length === 0;

  const cabinetPreview = useMemo(() => buildCabinetFromDraft(draftState), [draftState]);

  const jsonPreview = useMemo(() => ({
    cabinet: cabinetPreview,
    pieces: buildPiecesFromCabinet(cabinetPreview),
    annotations: draftState.facadeItems,
    extraNotes,
  }), [cabinetPreview, draftState.facadeItems, extraNotes]);

  const setCabinetField = useCallback((key, value) => {
    setDraftState((prev) => {
      const next = {
        ...prev,
        cabinetDims: { ...prev.cabinetDims, [key]: value },
      };
      if (key === 'modulesCount') return updateModuleCount(next, value);
      return next;
    });
  }, []);

  const setModuleWidth = useCallback((moduleId, width) => {
    setDraftState((prev) => ({
      ...prev,
      facadeModules: prev.facadeModules.map((m) => (String(m.id) === String(moduleId) ? { ...m, width: Number(width) } : m)),
    }));
  }, []);

  const addFacadeAnnotation = useCallback((type, x1, y1, x2, y2, label = '') => {
    const ann = createAnnotation(type, x1, y1, x2, y2, label);
    setDraftState((prev) => ({ ...prev, facadeItems: [...prev.facadeItems, ann] }));
    setSelectedAnnotationId(ann.id);
    return ann;
  }, []);

  const updateFacadeAnnotation = useCallback((id, patch) => {
    setDraftState((prev) => ({
      ...prev,
      facadeItems: prev.facadeItems.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeFacadeAnnotation = useCallback((id) => {
    setDraftState((prev) => ({ ...prev, facadeItems: prev.facadeItems.filter((a) => a.id !== id) }));
    setSelectedAnnotationId((curr) => (curr === id ? null : curr));
  }, []);

  const addModuleObject = useCallback((moduleId, type, y = 50) => {
    const item = createModuleItem(type, y);
    setDraftState((prev) => ({
      ...prev,
      moduleDetails: prev.moduleDetails.map((d) => {
        if (String(d.moduleId) !== String(moduleId)) return d;
        if (type === 'shelf') return { ...d, shelves: [...d.shelves, item] };
        if (type === 'drawer') return { ...d, drawers: [...d.drawers, item] };
        if (type === 'rod') return { ...d, rods: [...d.rods, item] };
        if (type === 'door') return { ...d, doors: [...d.doors, item] };
        if (type === 'sliding_door') return { ...d, slidingDoors: [...d.slidingDoors, item] };
        return d;
      }),
    }));
    setSelectedItemId(item.id);
  }, []);

  const updateModuleObject = useCallback((moduleId, collection, itemId, patch) => {
    setDraftState((prev) => ({
      ...prev,
      moduleDetails: prev.moduleDetails.map((d) => {
        if (String(d.moduleId) !== String(moduleId)) return d;
        return {
          ...d,
          [collection]: (d[collection] || []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        };
      }),
    }));
  }, []);

  const removeModuleObject = useCallback((moduleId, collection, itemId) => {
    setDraftState((prev) => ({
      ...prev,
      moduleDetails: prev.moduleDetails.map((d) => {
        if (String(d.moduleId) !== String(moduleId)) return d;
        return {
          ...d,
          [collection]: (d[collection] || []).filter((it) => it.id !== itemId),
        };
      }),
    }));
    setSelectedItemId((curr) => (curr === itemId ? null : curr));
  }, []);

  const saveCurrentCabinet = useCallback(async () => {
    if (!onSave) return;
    await onSave(cabinetPreview);
  }, [onSave, cabinetPreview]);

  const sendToClaude = useCallback(async () => {
    if (alerts.critical.length > 0 || isSending) return;
    setSendError('');
    setIsSending(true);
    try {
      const base64 = (image || '').includes(',') ? image.split(',').pop() : image;
      const prompt = buildRefinePrompt({ initialResult, draftState, extraNotes });
      const payload = {
        image: base64,
        mediaType: 'image/png',
        prompt,
        context: initialResult || null,
      };

      let res = await fetch('https://panelcut-server.vercel.app/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 404 || res.status === 405) {
        res = await fetch('https://panelcut-server.vercel.app/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error(`Erreur serveur ${res.status}`);

      const data = await res.json();
      const parsed = data?.result || data;
      if (!parsed || (!parsed.pieces && !parsed.cabinet)) {
        throw new Error('Réponse IA invalide');
      }
      onComplete?.(parsed);
    } catch (err) {
      setSendError(err.message || 'Erreur réseau');
    } finally {
      setIsSending(false);
    }
  }, [alerts.critical.length, isSending, image, initialResult, draftState, extraNotes, onComplete]);

  return {
    tool,
    setTool,
    cabinetDims,
    setCabinetDims,
    facadeModules,
    setFacadeModules,
    moduleDetails,
    setModuleDetails,
    selectedModuleId,
    setSelectedModuleId,
    selectedItemId,
    setSelectedItemId,
    selectedAnnotationId,
    setSelectedAnnotationId,
    zoom,
    setZoom,
    pan,
    setPan,
    extraNotes,
    setExtraNotes,
    draftState,
    setDraftState,
    selectedModuleDetail,
    alerts,
    isReady,
    cabinetPreview,
    jsonPreview,
    isSending,
    sendError,
    normalizeYToCm,
    buildCabinetFromDraft: () => buildCabinetFromDraft(draftState),
    setCabinetField,
    setModuleWidth,
    addFacadeAnnotation,
    updateFacadeAnnotation,
    removeFacadeAnnotation,
    addModuleObject,
    updateModuleObject,
    removeModuleObject,
    saveCurrentCabinet,
    sendToClaude,
  };
}
