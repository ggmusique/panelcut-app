import { useCallback, useEffect, useMemo, useState } from 'react';

const uid = () => Math.random().toString(36).slice(2, 10);
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function normalizeCabinetFromResult(initialResult = {}) {
  const cabinet = initialResult?.cabinet || {};
  const modules = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  return {
    width: toNum(cabinet.width, ''),
    height: toNum(cabinet.height, ''),
    depth: toNum(cabinet.depth, 60),
    thickness: toNum(cabinet.thickness ?? cabinet.panel_thickness, 3),
    modulesCount: Math.max(1, modules.length || toNum(cabinet.nb_dividers, 3) + 1 || 4),
  };
}

function draftToAnnotations(draftState) {
  if (Array.isArray(draftState?.annotations)) return draftState.annotations;
  return [];
}

export default function useSketchState({ image, initialResult, draft, onDraftChange, onComplete, onSave }) {
  const [tool, setTool] = useState('select');
  const [annotations, setAnnotations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cabinetDims, setCabinetDims] = useState({ width: '', height: '', depth: '', thickness: 3, modulesCount: 4 });
  const [moduleIndex, setModuleIndex] = useState(1);
  const [extraNotes, setExtraNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [jsonPreview, setJsonPreview] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [objectPopover, setObjectPopover] = useState(null);

  useEffect(() => {
    const fallback = normalizeCabinetFromResult(initialResult);
    const state = draft?.state || {};
    setCabinetDims((prev) => ({
      ...prev,
      ...fallback,
      ...(state.cabinetDims || {}),
      modulesCount: Math.max(1, toNum(state?.cabinetDims?.modulesCount ?? fallback.modulesCount, 4)),
    }));
    setAnnotations(draftToAnnotations(state));
    setExtraNotes(state.extraNotes || '');
    setModuleIndex(Math.max(1, toNum(state.moduleIndex, 1)));
  }, [initialResult, draft]);

  useEffect(() => {
    if (!onDraftChange) return;
    onDraftChange({
      state: {
        cabinetDims,
        annotations,
        moduleIndex,
        extraNotes,
        facadeModules: [],
        facadeItems: [],
        moduleDetails: [],
      },
    });
  }, [cabinetDims, annotations, moduleIndex, extraNotes, onDraftChange]);

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedId) || null,
    [annotations, selectedId]
  );

  const moduleObjects = useMemo(() => {
    const current = String(moduleIndex);
    return annotations.filter((a) => ['shelf', 'drawer', 'rod', 'door', 'sliding_door'].includes(a.type) && String(a.moduleId || '1') === current);
  }, [annotations, moduleIndex]);

  const alerts = useMemo(() => {
    const critical = [];
    const warning = [];
    if (!toNum(cabinetDims.width, 0) || !toNum(cabinetDims.height, 0)) critical.push('Largeur ou hauteur absente');
    if (!annotations.some((a) => a.type === 'dim')) warning.push('Aucune cote');
    if (annotations.length === 0) warning.push('0 annotation');
    return { critical, warning, ok: critical.length === 0 && warning.length === 0 };
  }, [cabinetDims, annotations]);

  const updateAnnotation = useCallback((id, patch) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const removeAnnotation = useCallback((id) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const addAnnotation = useCallback((payload) => {
    const next = { id: uid(), label: '', ...payload };
    setAnnotations((prev) => [...prev, next]);
    setSelectedId(next.id);
    return next;
  }, []);

  const openObjectPopover = useCallback((point, objectType) => {
    setObjectPopover({
      id: uid(),
      x: point.x,
      y: point.y,
      type: objectType,
      moduleId: moduleIndex,
      config: { y: 50, height: 18, doorType: objectType === 'sliding_door' ? 'sliding' : 'hinge' },
    });
  }, [moduleIndex]);

  const confirmObjectPopover = useCallback((data) => {
    addAnnotation({
      type: data.type,
      x1: data.x,
      y1: data.y,
      x2: data.x,
      y2: data.y,
      moduleId: data.moduleId,
      label: data.label || data.type,
      config: data.config || {},
    });
    setObjectPopover(null);
  }, [addAnnotation]);

  const buildResultJson = useCallback(() => {
    const modulesCount = Math.max(1, toNum(cabinetDims.modulesCount, 1));
    const w = toNum(cabinetDims.width, 0);
    const h = toNum(cabinetDims.height, 0);
    const thickness = toNum(cabinetDims.thickness, 3);
    const depth = toNum(cabinetDims.depth, 60);
    const moduleWidth = modulesCount > 0 ? Math.max(1, (w - thickness * (modulesCount + 1)) / modulesCount) : 0;

    const modules = Array.from({ length: modulesCount }, (_, idx) => {
      const moduleId = String(idx + 1);
      const list = annotations.filter((a) => String(a.moduleId || '') === moduleId);
      return {
        id: idx + 1,
        width: Number(moduleWidth.toFixed(2)),
        shelves: list.filter((a) => a.type === 'shelf').map((a) => ({ y: toNum(a.config?.y, 50) })),
        drawers: list.filter((a) => a.type === 'drawer').map((a) => ({ y: toNum(a.config?.y, 40), height: toNum(a.config?.height, 18) })),
        rods: list.filter((a) => a.type === 'rod').map((a) => ({ y: toNum(a.config?.y, 60) })),
        doors: list.filter((a) => a.type === 'door').length,
        slidingDoors: list.filter((a) => a.type === 'sliding_door').length,
      };
    });

    const pieces = [];
    modules.forEach((m, i) => {
      m.shelves.forEach((s, idx) => pieces.push({ name: `Tablette M${i + 1}-${idx + 1}`, length: m.width, height: depth, qty: 1 }));
      m.drawers.forEach((d, idx) => pieces.push({ name: `Tiroir M${i + 1}-${idx + 1}`, length: m.width, height: d.height, qty: 1 }));
      m.rods.forEach((_, idx) => pieces.push({ name: `Tringle M${i + 1}-${idx + 1}`, length: m.width, height: 2, qty: 1, isRod: true }));
    });

    return {
      pieces,
      cabinet: {
        width: w,
        height: h,
        depth,
        thickness,
        modules,
      },
    };
  }, [annotations, cabinetDims]);

  const resultJson = useMemo(() => buildResultJson(), [buildResultJson]);

  const saveDraft = useCallback(async () => {
    if (!onSave) return;
    await onSave(resultJson.cabinet);
  }, [onSave, resultJson]);

  const buildPrompt = useCallback(() => {
    const initialCab = initialResult?.cabinet || {};
    const lines = annotations.map((a) => {
      if (a.type === 'dim') return `Cote: ${a.label || '?'} cm`;
      if (a.type === 'note') return `Note: ${a.label || ''}`;
      if (a.type === 'arrow') return `Flèche: ${a.label || ''}`;
      return `Objet ${a.type} module ${a.moduleId || '?'} (${a.label || ''})`;
    });

    return [
      'Résumé scan initial:',
      `- largeur=${initialCab.width || '?'} hauteur=${initialCab.height || '?'} modules=${Array.isArray(initialCab.modules) ? initialCab.modules.length : '?'}`,
      '',
      'Annotations utilisateur:',
      ...(lines.length ? lines : ['- aucune annotation']),
      '',
      `Notes supplémentaires: ${extraNotes || '(aucune)'}`,
      '',
      'INSTRUCTION: PRIORITÉ aux cotes et annotations — retourne le JSON complet pièces + cabinet.',
    ].join('\n');
  }, [annotations, extraNotes, initialResult]);

  const sendToClaude = useCallback(async () => {
    if (alerts.critical.length > 0 || isSending) return;
    setIsSending(true);
    try {
      const base64 = (image || '').includes(',') ? image.split(',').pop() : image;
      const payload = {
        image: base64,
        mediaType: 'image/png',
        prompt: buildPrompt(),
        context: initialResult || {},
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
      const parsed = data.result || data;
      if (onComplete) onComplete(parsed);
    } catch {
      if (onComplete) onComplete(resultJson);
    } finally {
      setIsSending(false);
    }
  }, [alerts.critical.length, isSending, image, buildPrompt, initialResult, onComplete, resultJson]);

  return {
    tool, setTool,
    annotations, setAnnotations,
    selectedId, setSelectedId,
    selectedAnnotation,
    zoom, setZoom,
    pan, setPan,
    cabinetDims, setCabinetDims,
    moduleIndex, setModuleIndex,
    extraNotes, setExtraNotes,
    isSending,
    jsonPreview, setJsonPreview,
    mousePos, setMousePos,
    objectPopover, setObjectPopover,
    moduleObjects,
    alerts,
    resultJson,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    openObjectPopover,
    confirmObjectPopover,
    saveDraft,
    sendToClaude,
  };
}
