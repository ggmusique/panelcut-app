import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TOOL_IDS,
  normalizeFromInitialResult,
  buildCabinetFromDraft,
  buildPiecesFromCabinet,
  buildRefinePrompt,
  validateDraftState,
  updateModuleCount,
  createAnnotation,
  createModuleItem,
} from './utils';

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

  useEffect(() => {
    const normalized = normalizeFromInitialResult(initialResult, draft);
    setDraftState(normalized);
    setSelectedModuleId(normalized.facadeModules[0]?.id || null);
    setExtraNotes(draft?.state?.extraNotes || '');
  }, [initialResult, draft]);

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
    cabinetPreview,
    jsonPreview,
    isSending,
    sendError,
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
