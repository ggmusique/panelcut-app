import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Disc } from 'lucide-react';
import FacadeSVG from './configurator/FacadeSVG';
import ModuleCard from './configurator/ModuleCard';
import CabinetPiecesList from './configurator/PiecesList';
import { normalizeResultToCabinetState, convertCabinetStateToPieces } from '../utils/cabinetCalculator';
import { computeAllPieces } from '../utils/cabinetCalculator';
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
}) {
  const facadeRef     = useRef(null);
  const onDraftRef    = useRef(onDraftChange);
  useEffect(() => { onDraftRef.current = onDraftChange; }, [onDraftChange]);

  // ── State initialization ────────────────────────────────────────────────
  const [cabinet, setCabinetRaw] = useState(() => {
    // 1. Try to restore draft if fingerprint matches
    if (draft?.state && Object.keys(draft.state).length > 0) {
      return draft.state;
    }
    const cached = lsGet(LS_KEY, null);
    if (cached?.state) {
      const fromResult = initialResult
        ? normalizeResultToCabinetState(initialResult)
        : null;
      if (fromResult && cached.fingerprint === fingerprint(fromResult)) {
        return cached.state;
      }
    }
    // 2. Normalize from scan result
    if (initialResult) {
      return normalizeResultToCabinetState(initialResult);
    }
    return { ...DEFAULT_STATE };
  });

  const [activeTab, setActiveTab] = useState('facade'); // 'facade' | 'pieces'
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

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
    setCabinet(normalizeResultToCabinetState(initialResult));
  }, [initialResult, setCabinet]);

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
          modules: cabinet.modules, // keep user-edited modules
        },
      });
      setCabinet(newState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildContextPrompt, cabinet, setCabinet]);

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
              </div>
            </section>

            {/* Modules */}
            <section>
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
                <FacadeSVG cabinet={cabinet} />
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
