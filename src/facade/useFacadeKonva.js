import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { uid } from '../utils/sketchEditorConstants';
import { SNAP_THRESHOLD } from './konvaTheme';

// Valeurs de snap magnétique (cm)
const SNAP_VALUES_CM = [30, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120];
const MAX_HISTORY = 30;

// ─── Géométrie pure ──────────────────────────────────────────────────────────

/**
 * Calcule les positions px de chaque module dans le canvas Konva.
 * @returns {Array<{modIdx, x, y, w, h, intX, intY, intW, intH, widthCm}>}
 */
function calcModuleRects({ cabinetDims, facadeModules, joints, thickness, stageWidth, stageHeight }) {
  const { width: cabW = 0, height: cabH = 0, plinth = 0 } = cabinetDims || {};
  if (!cabW || !cabH || !facadeModules.length) return [];

  const scale     = stageWidth / cabW;
  const thickPx   = thickness * scale;
  const moduleH   = (cabH - plinth) * scale;
  const moduleY   = 0; // le module commence en haut du canvas

  let curX = thickPx; // départ après le panneau gauche
  return facadeModules.map((mod, i) => {
    const w = mod.width * scale;
    const rect = {
      modIdx: i,
      x: curX,
      y: moduleY,
      w,
      h: moduleH,
      intX: curX,
      intY: moduleY,
      intW: w,
      intH: moduleH,
      widthCm: mod.width,
    };
    curX += w;
    if (i < facadeModules.length - 1) {
      const jointPx = (joints[i] ? 2 : 1) * thickPx;
      curX += jointPx;
    }
    return rect;
  });
}

/**
 * Snap a width (cm) to the nearest standard value if within the threshold
 * (in cm). Returns { value: snapped width, snapped: boolean }.
 */
function applySnap(widthCm, thresholdCm) {
  for (const snap of SNAP_VALUES_CM) {
    if (Math.abs(widthCm - snap) <= thresholdCm) {
      return { value: snap, snapped: true };
    }
  }
  return { value: widthCm, snapped: false };
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useFacadeKonva({
  cabinetDims,
  facadeModules: initialModules,
  facadeItems: initialItems,
  joints: propJoints,
  moduleDetails,
  globalSliding,
  thickness = 1.8,
  stageWidth = 800,
  stageHeight = 600,
  onChange,
}) {
  // ── Historique (refs pour éviter les closures périmées) ───────────────────
  const historyRef      = useRef([{
    modules: initialModules || [],
    items:   initialItems   || [],
  }]);
  const historyIndexRef = useRef(0);

  // État réactif dérivé de l'historique
  const [historyIndex, setHistoryIndex] = useState(0);

  // État courant = tranche de l'historique pointée
  const currentSnapshot = historyRef.current[historyIndexRef.current] || {
    modules: initialModules || [],
    items:   initialItems   || [],
  };
  const modules = currentSnapshot.modules;
  const items   = currentSnapshot.items;

  useEffect(() => {
    const nextModules = initialModules || [];
    const nextItems   = initialItems || [];
    const modulesChangedExternally = currentSnapshot.modules !== nextModules;
    const itemsChangedExternally   = currentSnapshot.items !== nextItems;

    if (!modulesChangedExternally && !itemsChangedExternally) return;

    historyRef.current = [{ modules: nextModules, items: nextItems }];
    historyIndexRef.current = 0;
    setHistoryIndex(0);
  }, [initialModules, initialItems, currentSnapshot.modules, currentSnapshot.items]);

  // ── État de l'UI ──────────────────────────────────────────────────────────
  const [selectedId,        setSelectedId]        = useState(null);
  const [draggingModuleId,  setDraggingModuleId]  = useState(null);
  const [resizingModuleId,  setResizingModuleId]  = useState(null);
  const [snapActive,        setSnapActive]        = useState(false);
  const [snapX,             setSnapX]             = useState(null);

  // ── Géométrie réactive ────────────────────────────────────────────────────
  const moduleRects = useMemo(() => calcModuleRects({
    cabinetDims,
    facadeModules: modules,
    joints:        propJoints || [],
    thickness,
    stageWidth,
    stageHeight,
  }), [cabinetDims, modules, propJoints, thickness, stageWidth, stageHeight]);

  // ── Echelle px/cm pour le snap ────────────────────────────────────────────
  const scale           = stageWidth / (cabinetDims?.width || 1);
  const snapThresholdCm = SNAP_THRESHOLD / scale;

  // ── Commit : pousse dans l'historique, met à jour React et appelle onChange
  const commit = useCallback((newModules, newItems) => {
    // Tronque les entrées futures puis ajoute le nouveau snapshot
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    truncated.push({ modules: newModules, items: newItems });
    if (truncated.length > MAX_HISTORY) {
      truncated.splice(0, truncated.length - MAX_HISTORY);
    }
    historyRef.current      = truncated;
    historyIndexRef.current = truncated.length - 1;
    setHistoryIndex(historyIndexRef.current); // déclenche le re-render
    onChange?.(newModules, newItems);
  }, [onChange]);

  // ── Actions de sélection ──────────────────────────────────────────────────
  const selectModule   = useCallback((id) => setSelectedId(id), []);
  const selectItem     = useCallback((id) => setSelectedId(id), []);
  const clearSelection = useCallback(() => setSelectedId(null), []);

  // ── Ré-ordonnancement des modules (drag & drop) ───────────────────────────
  const moveModuleOrder = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newModules = [...modules];
    const [removed] = newModules.splice(fromIdx, 1);
    newModules.splice(toIdx, 0, removed);

    // Recalcule modIdx dans les items
    const newItems = items.map((it) => {
      const idx = Number(it.modIdx);
      let newIdx = idx;
      if (idx === fromIdx) {
        newIdx = toIdx;
      } else if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) {
        newIdx = idx - 1;
      } else if (fromIdx > toIdx && idx < fromIdx && idx >= toIdx) {
        newIdx = idx + 1;
      }
      return newIdx !== idx ? { ...it, modIdx: newIdx } : it;
    });

    commit(newModules, newItems);
  }, [modules, items, commit]);

  // ── Redimensionnement d'un module avec snap magnétique ────────────────────
  const resizeModule = useCallback((modIdx, newWidthCm) => {
    const { value: snappedW, snapped } = applySnap(newWidthCm, snapThresholdCm);
    setSnapActive(snapped);

    if (snapped) {
      const rect = moduleRects[modIdx];
      setSnapX(rect ? rect.x + snappedW * scale : null);
    } else {
      setSnapX(null);
    }

    const newModules = modules.map((m, i) =>
      i === modIdx ? { ...m, width: Math.max(10, snappedW) } : m
    );
    commit(newModules, items);
  }, [modules, items, commit, snapThresholdCm, scale, moduleRects]);

  // ── Tiroirs ───────────────────────────────────────────────────────────────
  const addDrawer = useCallback((modIdx) => {
    const newModules = modules.map((m, i) =>
      i === modIdx ? { ...m, drawers: (m.drawers || 0) + 1 } : m
    );
    commit(newModules, items);
  }, [modules, items, commit]);

  const removeDrawer = useCallback((modIdx) => {
    const newModules = modules.map((m, i) =>
      i === modIdx ? { ...m, drawers: Math.max(0, (m.drawers || 0) - 1) } : m
    );
    commit(newModules, items);
  }, [modules, items, commit]);

  // ── Portes ────────────────────────────────────────────────────────────────
  const addDoor = useCallback((modIdx) => {
    const newModules = modules.map((m, i) =>
      i === modIdx ? { ...m, doors: (m.doors || 0) + 1 } : m
    );
    commit(newModules, items);
  }, [modules, items, commit]);

  const removeDoor = useCallback((modIdx) => {
    const newModules = modules.map((m, i) =>
      i === modIdx ? { ...m, doors: Math.max(0, (m.doors || 0) - 1) } : m
    );
    commit(newModules, items);
  }, [modules, items, commit]);

  // ── Tablettes & items ─────────────────────────────────────────────────────
  const addShelf = useCallback((modIdx, yRatio = 0.5) => {
    const newItem  = { id: uid(), type: 'shelf', modIdx, yRatio };
    const newItems = [...items, newItem];
    commit(modules, newItems);
  }, [modules, items, commit]);

  const removeItem = useCallback((itemId) => {
    const newItems = items.filter((it) => it.id !== itemId);
    commit(modules, newItems);
  }, [modules, items, commit]);

  const moveItem = useCallback((itemId, newYRatio) => {
    const newItems = items.map((it) =>
      it.id === itemId
        ? { ...it, yRatio: Math.max(0, Math.min(1, newYRatio)) }
        : it
    );
    commit(modules, newItems);
  }, [modules, items, commit]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setHistoryIndex(historyIndexRef.current);
    onChange?.(snapshot.modules, snapshot.items);
  }, [onChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    setHistoryIndex(historyIndexRef.current);
    onChange?.(snapshot.modules, snapshot.items);
  }, [onChange]);

  // ─────────────────────────────────────────────────────────────────────────
  return {
    // État courant
    modules,
    items,
    moduleRects,

    // UI
    selectedId,
    draggingModuleId,
    resizingModuleId,
    snapActive,
    snapX,

    // Undo/redo
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,

    // Actions de sélection
    selectModule,
    selectItem,
    clearSelection,

    // Actions de modification
    moveModuleOrder,
    resizeModule,
    addDrawer,
    removeDrawer,
    addDoor,
    removeDoor,
    addShelf,
    removeItem,
    moveItem,

    // Historique
    undo,
    redo,

    // Setters UI exposés pour les composants Konva
    setDraggingModuleId,
    setResizingModuleId,
  };
}
