import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Disc } from 'lucide-react';
import FacadeSVG from './configurator/FacadeSVG';
import ModuleCard from './configurator/ModuleCard';
import CabinetPiecesList from './configurator/PiecesList';
import {
  normalizeResultToCabinetState,
  convertCabinetStateToPieces,
  computeAllPieces,
  validateCabinetFabrication,
} from '../utils/cabinetCalculator';
import { captureFacadeToImage } from '../utils/captureFacadeToImage';

const LS_KEY = 'pc_cabinet_configurator';
const AUTOSAVE_DELAY_MS = 30000;
const SERVER_URL = 'https://panelcut-server.vercel.app';

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_STATE = {
  totalWidth:  240,
  heightLeft:  220,
  heightRight: 220,
  depth:       58,
  plinth:      10,
  thickness:   1.8,
  modules: [
    {
      id: 'mod-default-1',
      width: 78,
      heightLeft:  220,
      heightRight: 220,
      hasFond: true,
      content: { shelves: [], drawers: [], rods: [], doors: [] },
    },
  ],
};

function fingerprint(state) {
  return JSON.stringify({
    w: state.totalWidth,
    h: state.heightLeft,
    n: (state.modules || []).length,
  });
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function totalWidthSummary(state) {
  const { modules = [], thickness: th = 1.8 } = state;
  const nb = modules.length;
  const exterior = 2 * th;
  const inter    = Math.max(0, nb - 1) * 2 * th;
  const net      = modules.reduce((s, m) => s + (m.width || 0), 0);
  return { exterior, inter, net, total: exterior + inter + net };
}

/**
 * CabinetConfigurator — replaces SketchEditor.
 * Same props interface: { image, scanImage, initialResult, apiKey, draft, onDraftChange, onComplete, onCancel, onSave }
 */
export default function CabinetConfigurator({
  image,
  scanImage,
  initialResult,
  apiKey,
  draft,
  onDraftChange,
  onComplete,
  onCancel,
  onSave,
  panelThickness = 1.8,
  panelW = 244,
  panelH = 122,
  edgeType = 'none',
}) {
  const facadeRef     = useRef(null);
  const onDraftRef    = useRef(onDraftChange);
  useEffect(() => { onDraftRef.current = onDraftChange; }, [onDraftChange]);

  // ── State initialization ────────────────────────────────────────────────
  const [cabinet, setCabinetRaw] = useState(() => {
    // 1. Try to restore draft if fingerprint matches
    if (draft?.state && Object.keys(draft.state).length > 0) {
      return {
        ...draft.state,
        thickness: Number(panelThickness) || Number(draft.state.thickness) || 1.8,
        panelThickness: Number(panelThickness) || Number(draft.state.panelThickness) || 1.8,
        panelW: Number(panelW) || Number(draft.state.panelW) || 244,
        panelH: Number(panelH) || Number(draft.state.panelH) || 122,
        edgeType: edgeType || draft.state.edgeType || 'none',
      };
    }
    const cached = lsGet(LS_KEY, null);
    if (cached?.state) {
      const fromResult = initialResult
        ? normalizeResultToCabinetState(initialResult)
        : null;
      if (fromResult && cached.fingerprint === fingerprint(fromResult)) {
        return {
          ...cached.state,
          thickness: Number(panelThickness) || Number(cached.state.thickness) || 1.8,
          panelThickness: Number(panelThickness) || Number(cached.state.panelThickness) || 1.8,
          panelW: Number(panelW) || Number(cached.state.panelW) || 244,
          panelH: Number(panelH) || Number(cached.state.panelH) || 122,
          edgeType: edgeType || cached.state.edgeType || 'none',
        };
      }
    }
    // 2. Normalize from scan result
    if (initialResult) {
      return {
        ...normalizeResultToCabinetState(initialResult),
        thickness: Number(panelThickness) || 1.8,
        panelThickness: Number(panelThickness) || 1.8,
        panelW: Number(panelW) || 244,
        panelH: Number(panelH) || 122,
        edgeType: edgeType || 'none',
      };
    }
    return {
      ...DEFAULT_STATE,
      thickness: Number(panelThickness) || 1.8,
      panelThickness: Number(panelThickness) || 1.8,
      panelW: Number(panelW) || 244,
      panelH: Number(panelH) || 122,
      edgeType: edgeType || 'none',
    };
  });

  const [activeTab, setActiveTab] = useState('facade'); // 'facade' | 'pieces'
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [quickModuleIdx, setQuickModuleIdx] = useState(0);
  const [quickTool, setQuickTool] = useState('drawer'); // drawer|shelf|rod|erase|move
  const [selectedItem, setSelectedItem] = useState(null); // { type, moduleIdx, itemIdx }

  // ── Cabinet updater + draft save ───────────────────────────────────────
  const setCabinet = useCallback((updater) => {
    setCabinetRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const payload = { fingerprint: fingerprint(next), state: next };
      try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); } catch {}
      if (onDraftRef.current) onDraftRef.current(payload);
      return next;
    });
  }, []);

  // ── Re-sync when initialResult changes ─────────────────────────────────
  const prevResultRef = useRef(initialResult);
  useEffect(() => {
    if (prevResultRef.current === initialResult) return;
    prevResultRef.current = initialResult;
    if (!initialResult) return;
    const normalized = normalizeResultToCabinetState(initialResult);
    setCabinet({
      ...normalized,
      thickness: Number(panelThickness) || Number(normalized.thickness) || 1.8,
      panelThickness: Number(panelThickness) || Number(normalized.panelThickness) || 1.8,
      panelW: Number(panelW) || 244,
      panelH: Number(panelH) || 122,
      edgeType: edgeType || normalized.edgeType || 'none',
    });
  }, [initialResult, setCabinet, panelThickness, panelW, panelH, edgeType]);

  useEffect(() => {
    setCabinet(prev => ({
      ...prev,
      thickness: Number(panelThickness) || prev.thickness || 1.8,
      panelThickness: Number(panelThickness) || prev.panelThickness || 1.8,
      panelW: Number(panelW) || prev.panelW || 244,
      panelH: Number(panelH) || prev.panelH || 122,
      edgeType: edgeType || prev.edgeType || 'none',
    }));
  }, [panelThickness, panelW, panelH, edgeType, setCabinet]);

  // ── Autosave to Supabase ────────────────────────────────────────────────
  const cabinetSnapshot = JSON.stringify(cabinet);
  const lastSavedRef    = useRef('');
  useEffect(() => {
    if (!onSave) return;
    if (cabinetSnapshot === lastSavedRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const { cabinet: cab } = convertCabinetStateToPieces(cabinet);
        await onSave(cab);
        lastSavedRef.current = cabinetSnapshot;
      } catch {}
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onSave, cabinet, cabinetSnapshot]);

  // ── Computed summary ────────────────────────────────────────────────────
  const summary = useMemo(() => totalWidthSummary(cabinet), [cabinet]);
  const allPieces = useMemo(() => computeAllPieces(cabinet), [cabinet]);
  const fabricationIssues = useMemo(() => validateCabinetFabrication(cabinet, allPieces), [cabinet, allPieces]);
  const errorIssues = fabricationIssues.filter(i => i.level === 'error');
  const warningIssues = fabricationIssues.filter(i => i.level === 'warning');
  const woodCount = allPieces.filter(p => !p.isRod).length;
  const panelArea = 244 * 122;
  const usedArea  = allPieces.filter(p => !p.isRod).reduce((s, p) => s + p.length * p.height * p.qty, 0);
  const nbPanels  = Math.ceil(usedArea / (panelArea * 0.8));
  const utilPct   = Math.min(100, Math.round(usedArea / (nbPanels * panelArea) * 100));

  // ── Module helpers ──────────────────────────────────────────────────────
  const addModule = () => {
    const newMod = {
      id: uid(),
      width: 60,
      heightLeft:  cabinet.heightLeft,
      heightRight: cabinet.heightRight,
      hasFond: true,
      content: { shelves: [], drawers: [], rods: [], doors: [] },
    };
    setCabinet(prev => ({ ...prev, modules: [...prev.modules, newMod] }));
  };

  const updateModule = (idx, updated) => {
    setCabinet(prev => ({
      ...prev,
      modules: prev.modules.map((m, i) => i === idx ? updated : m),
    }));
  };

  const deleteModule = (idx) => {
    setCabinet(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== idx),
    }));
  };

  useEffect(() => {
    setQuickModuleIdx(prev => {
      const maxIdx = Math.max(0, (cabinet.modules || []).length - 1);
      return Math.min(prev, maxIdx);
    });
  }, [cabinet.modules]);

  const quickAdd = useCallback((kind, yFromBottom = null) => {
    setCabinet(prev => {
      const mods = [...(prev.modules || [])];
      if (!mods[quickModuleIdx]) return prev;
      const mod = mods[quickModuleIdx];
      const content = mod.content || {};
      const drawers = content.drawers || [];
      const shelves = content.shelves || [];
      const rods = content.rods || [];
      const doors = content.doors || [];
      if (kind === 'drawer') {
        drawers.push({
          id: uid(),
          height: 18,
          yFromBottom: Math.max(0, yFromBottom ?? 0),
          slideType: 'side',
          slideClearance: 1.3,
          backClearance: 2,
          pieces: { face: true, avanCaisse: true, arriereCaisse: true, flancGauche: true, flancDroit: true, fond: true },
        });
      } else if (kind === 'shelf') {
        shelves.push({ id: uid(), yFromBottom: Math.max(0, yFromBottom ?? 45) });
      } else if (kind === 'rod') {
        rods.push({ id: uid(), yFromBottom: Math.max(0, yFromBottom ?? 160), diameter: 2.5 });
      } else if (kind === 'door') {
        doors.push({ id: uid(), type: 'swing', count: 1 });
      }
      mods[quickModuleIdx] = { ...mod, content: { ...content, drawers, shelves, rods, doors } };
      return { ...prev, modules: mods };
    });
  }, [quickModuleIdx, setCabinet]);

  const quickErase = useCallback(() => {
    setCabinet(prev => {
      const mods = [...(prev.modules || [])];
      if (!mods[quickModuleIdx]) return prev;
      const mod = mods[quickModuleIdx];
      const content = mod.content || {};
      const drawers = [...(content.drawers || [])];
      const shelves = [...(content.shelves || [])];
      const rods = [...(content.rods || [])];
      const doors = [...(content.doors || [])];
      if (drawers.length > 0) drawers.pop();
      else if (shelves.length > 0) shelves.pop();
      else if (rods.length > 0) rods.pop();
      else if (doors.length > 0) doors.pop();
      else return prev;
      mods[quickModuleIdx] = { ...mod, content: { ...content, drawers, shelves, rods, doors } };
      return { ...prev, modules: mods };
    });
  }, [quickModuleIdx, setCabinet]);

  const updateItemPosition = useCallback((payload, yFromBottom) => {
    if (!payload) return;
    const { type, moduleIdx, itemIdx } = payload;
    setCabinet(prev => {
      const mods = [...(prev.modules || [])];
      const mod = mods[moduleIdx];
      if (!mod) return prev;
      const content = mod.content || {};
      const y = Math.max(0, yFromBottom || 0);
      if (type === 'drawer') {
        const drawers = [...(content.drawers || [])];
        if (!drawers[itemIdx]) return prev;
        drawers[itemIdx] = { ...drawers[itemIdx], yFromBottom: y };
        mods[moduleIdx] = { ...mod, content: { ...content, drawers } };
      } else if (type === 'shelf') {
        const shelves = [...(content.shelves || [])];
        if (!shelves[itemIdx]) return prev;
        shelves[itemIdx] = { ...shelves[itemIdx], yFromBottom: y };
        mods[moduleIdx] = { ...mod, content: { ...content, shelves } };
      } else if (type === 'rod') {
        const rods = [...(content.rods || [])];
        if (!rods[itemIdx]) return prev;
        rods[itemIdx] = { ...rods[itemIdx], yFromBottom: y };
        mods[moduleIdx] = { ...mod, content: { ...content, rods } };
      } else {
        return prev;
      }
      return { ...prev, modules: mods };
    });
  }, [setCabinet]);

  const deleteItem = useCallback((payload) => {
    if (!payload) return;
    const { type, moduleIdx, itemIdx } = payload;
    setCabinet(prev => {
      const mods = [...(prev.modules || [])];
      const mod = mods[moduleIdx];
      if (!mod) return prev;
      const content = mod.content || {};
      if (type === 'drawer') {
        const drawers = (content.drawers || []).filter((_, idx) => idx !== itemIdx);
        mods[moduleIdx] = { ...mod, content: { ...content, drawers } };
      } else if (type === 'shelf') {
        const shelves = (content.shelves || []).filter((_, idx) => idx !== itemIdx);
        mods[moduleIdx] = { ...mod, content: { ...content, shelves } };
      } else if (type === 'rod') {
        const rods = (content.rods || []).filter((_, idx) => idx !== itemIdx);
        mods[moduleIdx] = { ...mod, content: { ...content, rods } };
      } else {
        return prev;
      }
      return { ...prev, modules: mods };
    });
  }, [setCabinet]);

  const handleFacadeModuleClick = useCallback((moduleIdx, yFromBottom) => {
    setQuickModuleIdx(moduleIdx);
    if (selectedItem && selectedItem.moduleIdx === moduleIdx && quickTool === 'move') {
      updateItemPosition(selectedItem, yFromBottom);
      setSelectedItem(null);
      return;
    }
    if (quickTool === 'drawer' || quickTool === 'shelf' || quickTool === 'rod') {
      setQuickModuleIdx(moduleIdx);
      quickAdd(quickTool, yFromBottom);
    }
  }, [quickTool, quickAdd, selectedItem, updateItemPosition]);

  const handleFacadeItemClick = useCallback((payload) => {
    setQuickModuleIdx(payload.moduleIdx);
    if (quickTool === 'erase') {
      deleteItem(payload);
      if (selectedItem && selectedItem.moduleIdx === payload.moduleIdx && selectedItem.itemIdx === payload.itemIdx && selectedItem.type === payload.type) {
        setSelectedItem(null);
      }
      return;
    }
    setSelectedItem(payload);
    setQuickTool('move');
  }, [quickTool, deleteItem, selectedItem]);

  // ── Claude Vision: Relancer ─────────────────────────────────────────────
  const buildContextPrompt = useCallback(() => {
    const { modules = [], totalWidth, heightLeft, heightRight, depth, plinth, thickness } = cabinet;
    let ctx = `DIMENSIONS MEUBLE: L=${totalWidth} HG=${heightLeft} HD=${heightRight} Prof=${depth} Plinthe=${plinth} cm\n`;
    ctx += `ÉPAISSEUR PANNEAU: ${thickness} cm\n\n`;
    ctx += 'MODULES:\n';
    modules.forEach((m, i) => {
      const c = m.content || {};
      ctx += `  M${i+1}: L=${m.width.toFixed(2)} cm`;
      ctx += `  HG=${m.heightLeft ?? heightLeft} HD=${m.heightRight ?? heightRight}`;
      ctx += `  fond=${m.hasFond ? 'oui' : 'non'}`;
      ctx += `  tablettes=${(c.shelves || []).length}`;
      ctx += `  tiroirs=${(c.drawers || []).length}`;
      ctx += `  tringles=${(c.rods || []).length}`;
      ctx += `  portes=${(c.doors || []).length}\n`;
      (c.drawers || []).forEach((d, di) => {
        ctx += `    tiroir#${di+1}: h=${d.height} cm pos=${d.yFromBottom} cm\n`;
      });
    });
    ctx += '\nINSTRUCTION: Tiens compte des doubles montants inter-modules (2×épaisseur) pour les largeurs nettes.';
    return ctx;
  }, [cabinet]);

  const handleRelancer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise(r => requestAnimationFrame(r));
      const png = await captureFacadeToImage(facadeRef);
      const base64 = png ? png.split(',')[1] : null;
      const prompt = buildContextPrompt();

      let res = await fetch(`${SERVER_URL}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image:     base64 || null,
          mediaType: 'image/png',
          userNotes: prompt,
          prompt,
        }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${SERVER_URL}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 || null, mediaType: 'image/png' }),
        });
      }
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
      const data   = await res.json();
      const parsed = data.result || data;

      // Preserve current module positions, only update dims from Claude
      const newState = normalizeResultToCabinetState({
        ...parsed,
        cabinet: {
          ...(parsed.cabinet || {}),
          thickness: Number(panelThickness) || cabinet.thickness || 1.8,
          edgeType: edgeType || cabinet.edgeType || 'none',
          modules: cabinet.modules, // keep user-edited modules
        },
      });
      setCabinet({
        ...newState,
        thickness: Number(panelThickness) || Number(newState.thickness) || 1.8,
        panelThickness: Number(panelThickness) || Number(newState.panelThickness) || 1.8,
        panelW: Number(panelW) || 244,
        panelH: Number(panelH) || 122,
        edgeType: edgeType || newState.edgeType || 'none',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildContextPrompt, cabinet, setCabinet, panelThickness, panelW, panelH, edgeType]);

  // ── Utiliser tel quel ───────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    if (!onComplete) return;
    const { pieces, cabinet: cab } = convertCabinetStateToPieces(cabinet);
    onComplete({ pieces, cabinet: cab });
  }, [cabinet, onComplete]);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const payload = { fingerprint: fingerprint(cabinet), state: cabinet };
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); } catch {}
    if (onDraftRef.current) onDraftRef.current(payload);
    if (onSave) {
      const { cabinet: cab } = convertCabinetStateToPieces(cabinet);
      try { await onSave(cab); } catch {}
    }
  }, [cabinet, onSave]);

  // ── Dim input helper ────────────────────────────────────────────────────
  const numInput = (label, field, min = 1, step = 1) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          step={step}
          value={cabinet[field] ?? 0}
          onChange={e => setCabinet(prev => ({ ...prev, [field]: Math.max(min, Number(e.target.value) || min) }))}
          className="w-20 px-2 py-1 bg-slate-800 border border-white/20 rounded text-slate-200 text-sm"
        />
        <span className="text-xs text-slate-500">cm</span>
      </div>
    </label>
  );

  const isBiais = Math.abs((cabinet.heightLeft ?? 220) - (cabinet.heightRight ?? 220)) > 0.1;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f1620] text-slate-200 flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-white/10 flex-shrink-0">
        <h2 className="font-bold text-white text-sm flex-1">⚙️ Configurateur de meuble</h2>
        {error && <span className="text-red-400 text-xs mr-2 truncate max-w-[200px]">{error}</span>}
        <button onClick={onCancel}  className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors">Annuler</button>
        <button onClick={handleSave} className="p-1.5 rounded-lg text-slate-300 hover:text-green-400 hover:bg-white/10 transition-colors" title="Enregistrer">
          <Disc className="w-4 h-4" />
        </button>
        <button
          onClick={handleRelancer}
          disabled={loading}
          className={`px-4 py-1.5 rounded font-bold text-white text-sm transition-colors ${loading ? 'bg-orange-800 cursor-wait' : 'bg-orange-600 hover:bg-orange-500'}`}
        >
          {loading ? '⏳ Analyse...' : '🚀 Relancer Claude'}
        </button>
        <button
          onClick={handleComplete}
          className="px-4 py-1.5 rounded font-bold text-white text-sm bg-green-700 hover:bg-green-600 transition-colors"
        >
          ✅ Utiliser tel quel
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-[300px] flex-shrink-0 border-r border-white/10 overflow-y-auto bg-[#131e2e] flex flex-col">
          <div className="p-3 space-y-4 flex-1">

            {/* Global dimensions */}
            <section>
              <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wide mb-2">Dimensions globales</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {numInput('Largeur totale', 'totalWidth', 10)}
                {numInput('Profondeur', 'depth', 10)}
                {numInput('Hauteur gauche', 'heightLeft', 10)}
                {numInput('Hauteur droite', 'heightRight', 10)}
                {numInput('Plinthe', 'plinth', 0)}
                {numInput('Épaisseur', 'thickness', 0.5, 0.1)}
              </div>
              {isBiais && (
                <p className="mt-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                  ⚠️ Meuble en biais (sous toit/escalier) : HG={cabinet.heightLeft} cm · HD={cabinet.heightRight} cm
                </p>
              )}
            </section>

            {/* Stile summary */}
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Résumé montants</h3>
              <div className="text-xs space-y-0.5 text-slate-400 bg-slate-800/40 rounded-lg p-2">
                <div className="flex justify-between">
                  <span>Montants extérieurs (×2)</span>
                  <span className="font-mono text-amber-300">{(cabinet.thickness * 2).toFixed(1)} cm</span>
                </div>
                <div className="flex justify-between">
                  <span>Montants inter-modules doubles (×{Math.max(0, (cabinet.modules || []).length - 1)})</span>
                  <span className="font-mono text-amber-300">{summary.inter.toFixed(1)} cm</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                  <span>Largeur nette modules</span>
                  <span className="font-mono text-green-400">{summary.net.toFixed(1)} cm</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total calculé</span>
                  <span className={`font-mono ${Math.abs(summary.total - cabinet.totalWidth) > 0.5 ? 'text-red-400' : 'text-white'}`}>
                    {summary.total.toFixed(1)} cm
                  </span>
                </div>
              {Math.abs(summary.total - cabinet.totalWidth) > 0.5 && (
                <p className="text-red-400 text-[10px]">
                  ⚠️ Écart de {Math.abs(summary.total - cabinet.totalWidth).toFixed(1)} cm vs largeur totale déclarée
                </p>
              )}
              {(errorIssues.length > 0 || warningIssues.length > 0) && (
                <div className="mt-2 border-t border-white/10 pt-2 text-[10px] space-y-1">
                  {errorIssues.length > 0 && (
                    <p className="text-red-400">❌ Fabrication bloquée: {errorIssues.length} erreur(s)</p>
                  )}
                  {warningIssues.length > 0 && (
                    <p className="text-amber-400">⚠️ Atelier: {warningIssues.length} avertissement(s)</p>
                  )}
                </div>
              )}
            </div>
          </section>

            {/* Modules */}
            <section>
              <div className="mb-2 p-2 rounded-lg border border-white/10 bg-slate-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Barre rapide</span>
                  <select
                    value={quickModuleIdx}
                    onChange={e => setQuickModuleIdx(Math.max(0, Number(e.target.value) || 0))}
                    className="ml-auto text-xs px-1.5 py-1 bg-slate-800 border border-white/20 rounded text-slate-200"
                  >
                    {(cabinet.modules || []).map((_, i) => (
                      <option key={i} value={i}>Module {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => setQuickTool('drawer')} className={`text-[11px] px-2 py-1 rounded border ${quickTool === 'drawer' ? 'bg-blue-500/35 border-blue-400 text-blue-100' : 'bg-blue-500/20 border-blue-500/30 text-blue-300'}`}>🗄️ Tiroir</button>
                  <button onClick={() => setQuickTool('shelf')} className={`text-[11px] px-2 py-1 rounded border ${quickTool === 'shelf' ? 'bg-green-500/35 border-green-400 text-green-100' : 'bg-green-500/20 border-green-500/30 text-green-300'}`}>📦 Tablette</button>
                  <button onClick={() => setQuickTool('rod')} className={`text-[11px] px-2 py-1 rounded border ${quickTool === 'rod' ? 'bg-pink-500/35 border-pink-400 text-pink-100' : 'bg-pink-500/20 border-pink-500/30 text-pink-300'}`}>👔 Tringle</button>
                  <button onClick={() => { setActiveTab('facade'); setQuickTool('move'); }} className={`text-[11px] px-2 py-1 rounded border ${quickTool === 'move' ? 'bg-cyan-500/35 border-cyan-400 text-cyan-100' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>📏 Déplacer</button>
                  <button onClick={() => quickAdd('door')} className="text-[11px] px-2 py-1 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300">🚪 Porte</button>
                  <button onClick={() => setQuickTool('erase')} className={`text-[11px] px-2 py-1 rounded border ${quickTool === 'erase' ? 'bg-red-500/35 border-red-400 text-red-100' : 'bg-red-500/20 border-red-500/30 text-red-300'}`}>🧹 Gomme</button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  En vue façade: clique dans le module pour placer. Clique un élément pour le sélectionner, puis clique ailleurs pour le déplacer.
                </p>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wide">Modules</h3>
                <span className="text-[10px] text-slate-500">({(cabinet.modules || []).length})</span>
              </div>
              <div className="space-y-2">
                {(cabinet.modules || []).map((mod, i) => (
                  <ModuleCard
                    key={mod.id || i}
                    module={mod}
                    index={i}
                    globalDepth={cabinet.depth}
                    globalThickness={cabinet.thickness}
                    globalHL={cabinet.heightLeft}
                    globalHR={cabinet.heightRight}
                    onChange={(updated) => updateModule(i, updated)}
                    onDelete={() => deleteModule(i)}
                  />
                ))}
                <button
                  onClick={addModule}
                  className="w-full py-2 rounded-xl border border-dashed border-orange-500/40 text-orange-400 text-xs font-bold hover:bg-orange-500/10 hover:border-orange-500/70 transition-colors"
                >
                  + Ajouter un module
                </button>
              </div>
            </section>
          </div>
        </aside>

        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-white/10 bg-[#0f1620] flex-shrink-0">
            <button
              onClick={() => setActiveTab('facade')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'facade'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              📐 Vue façade
            </button>
            <button
              onClick={() => setActiveTab('pieces')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'pieces'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              📋 Liste pièces
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'facade' && (
              <div ref={facadeRef} className="w-full">
                <FacadeSVG
                  cabinet={cabinet}
                  activeTool={quickTool}
                  selectedItem={selectedItem}
                  onModuleClick={handleFacadeModuleClick}
                  onItemClick={handleFacadeItemClick}
                />
              </div>
            )}
            {activeTab === 'pieces' && (
              <CabinetPiecesList cabinet={cabinet} />
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-white/10 bg-slate-900 px-4 py-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400">
              <span className="font-bold text-white">{allPieces.length}</span> pièces
              {' · '}
              <span className="font-bold text-white">{woodCount}</span> bois
            </span>
            <span className="text-slate-400">
              ≈ <span className="font-bold text-white">{nbPanels}</span> panneaux
            </span>
            <span className="text-slate-400">
              Utilisation : <span className={`font-bold ${utilPct >= 80 ? 'text-green-400' : utilPct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{utilPct}%</span>
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleRelancer}
                disabled={loading}
                className="px-3 py-1 rounded text-xs font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 transition-colors"
              >
                🚀 Relancer Claude
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 rounded text-xs font-bold bg-slate-700 text-slate-300 border border-white/10 hover:bg-slate-600 transition-colors"
              >
                💾 Enregistrer
              </button>
              <button
                onClick={handleComplete}
                className="px-3 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-500/30 hover:bg-green-700/50 transition-colors"
              >
                🔨 Optimiser la découpe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
