import { useState, useRef } from 'react';
import { defaultDrawerParts } from '../utils/sketchEditorConstants';

const TOOLS = [
  { id: 'drawer', icon: '🗄️', label: 'Tiroir',       color: '#fbbf24' },
  { id: 'shelf',  icon: '📦', label: 'Tablette',     color: '#34d399' },
  { id: 'rod',    icon: '👔', label: 'Tringle',      color: '#f472b6' },
  { id: 'door',   icon: '🚪', label: 'Porte',        color: '#60a5fa' },
  { id: 'sliding',icon: '🚪↔️', label: 'Coulissante', color: '#93c5fd' },
  { id: 'dim',    icon: '📏', label: 'Cote',         color: '#22d3ee' },
  { id: 'note',   icon: '📝', label: 'Note',         color: '#fb923c' },
];

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/**
 * Barre d'outils complète de l'éditeur : outils, vues, dimensions meuble,
 * largeurs des modules, coulissantes globales, détails menuiserie et FAB mobile.
 */
export default function SketchToolbar({
  // Outils
  activeTool,
  onToolChange,
  // Affichage compact
  isCompactMobile,
  hint,
  dimensionsFromWizard,
  // Dimensions du meuble
  cabinetDims,
  onCabinetDimsChange,
  // Modules façade
  facadeModules,
  widthInputs,
  onWidthInputChange,
  onCommitWidth,
  // Coulissantes globales
  globalSliding,
  onGlobalSlidingChange,
  // Détails menuiserie par module
  selectedModuleIdx,
  onSelectModuleIdx,
  moduleDetails,
  onModuleDetailsChange,
  // Sauvegarde
  onSave,
  // Réordonnancement des modules
  onMoveModule,
}) {
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);
  return (
    <>
      {/* ── Barre outils ── */}
      <div className="flex gap-2 p-2 bg-slate-800 overflow-x-auto border-b border-slate-700">
        {dimensionsFromWizard && (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-600/40">✓ Cotes</span>
        )}
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => onToolChange(t.id)}
            className={`flex items-center gap-1.5 ${isCompactMobile ? 'px-2 py-2' : 'px-3 py-2'} rounded text-sm font-medium transition ${
              activeTool === t.id ? 'bg-slate-600 text-white ring-2 ring-offset-1 ring-offset-slate-800' : 'text-slate-400 hover:bg-slate-700'
            }`}
            style={activeTool === t.id ? { borderColor: t.color, borderWidth: '2px' } : {}}>
            <span>{t.icon}</span>
            {!isCompactMobile && <span>{t.label}</span>}
          </button>
        ))}
        {!isCompactMobile && <div className="ml-auto text-xs text-slate-400 self-center px-2 whitespace-nowrap">{hint}</div>}
      </div>

      {/* ── Dimensions meuble + largeurs modules ── */}
      <div className="bg-slate-900 border-b border-slate-700 p-2 flex flex-wrap gap-2 items-center text-xs">
        <span className="text-slate-400">Cotes :</span>
        <label className="text-slate-300">L <input value={cabinetDims.width}
          onChange={e => onCabinetDimsChange(v => ({ ...v, width: toNum(e.target.value, 0) }))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">H <input value={cabinetDims.height}
          onChange={e => onCabinetDimsChange(v => ({ ...v, height: toNum(e.target.value, 0) }))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">Plinthe <input value={cabinetDims.plinth}
          onChange={e => onCabinetDimsChange(v => ({ ...v, plinth: toNum(e.target.value, 0) }))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <span className="text-slate-500 ml-2">Modules :</span>
        {facadeModules.map((m, i) => (
          <label key={m.id || i} className="text-slate-300">M{i + 1}
            <input
              value={widthInputs[i] ?? ''}
              onChange={e => onWidthInputChange(i, e.target.value)}
              onBlur={() => onCommitWidth(i)}
              onKeyDown={e => { if (e.key === 'Enter') { onCommitWidth(i); e.target.blur(); } }}
              className="w-16 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
            />
          </label>
        ))}
      </div>

      {/* ── Coulissantes globales + détails menuiserie ── */}
      {facadeModules.length > 0 && (
        <div className="bg-slate-900/95 border-b border-slate-700 px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-cyan-300 font-bold">🚪↔️ Coulissantes meuble:</span>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={globalSliding.enabled}
              onChange={(e) => onGlobalSlidingChange(v => ({ ...v, enabled: e.target.checked }))}
            />
            Activer
          </label>
          {globalSliding.enabled && (
            <>
              <label className="text-slate-300">Vantaux
                <input
                  type="number" min="2" max="4"
                  value={globalSliding.count}
                  onChange={(e) => onGlobalSlidingChange(v => ({ ...v, count: Math.max(2, Math.min(4, toNum(e.target.value, 2))) }))}
                  className="w-12 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                />
              </label>
              <label className="text-slate-300">H(cm)
                <input
                  type="number" min="40"
                  value={globalSliding.heightCm}
                  onChange={(e) => onGlobalSlidingChange(v => ({ ...v, heightCm: Math.max(40, toNum(e.target.value, 180)) }))}
                  className="w-14 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                />
              </label>
            </>
          )}

          <span className="text-amber-300 font-bold">🧩 Détail menuiserie:</span>
          <div className="flex items-center gap-1">
            {facadeModules.map((_, i) => (
              <button
                key={`md-${i}`}
                draggable="true"
                onDragStart={(e) => {
                  dragSrcIdx.current = i;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIdx(i);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIdx(null);
                }}
                onDragEnd={() => { setDragOverIdx(null); dragSrcIdx.current = null; }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIdx(null);
                  const from = dragSrcIdx.current;
                  dragSrcIdx.current = null;
                  if (from !== null && from !== i) onMoveModule?.(from, i);
                }}
                onClick={() => onSelectModuleIdx(i)}
                className={`px-2 py-1 rounded border ${selectedModuleIdx === i ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-300'} ${dragOverIdx === i ? 'border-l-[2px] border-l-blue-500' : ''}`}
              >
                M{i + 1}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={moduleDetails[selectedModuleIdx]?.hasBack ?? true}
              onChange={(e) => onModuleDetailsChange(prev => prev.map((d, i) => i === selectedModuleIdx ? { ...d, hasBack: e.target.checked } : d))}
            />
            Fond module
          </label>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={(moduleDetails[selectedModuleIdx]?.slidingDoors || 0) > 0}
              onChange={(e) => onModuleDetailsChange(prev => prev.map((d, i) => {
                if (i !== selectedModuleIdx) return d;
                return { ...d, slidingDoors: e.target.checked ? 2 : 0 };
              }))}
            />
            Portes coulissantes
          </label>
          <span className="text-slate-500">Tiroir :</span>
          {[
            ['front', 'Façade'],
            ['back', 'Arrière'],
            ['left', 'Côté G'],
            ['right', 'Côté D'],
            ['bottom', 'Fond'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-slate-200">
              <input
                type="checkbox"
                checked={moduleDetails[selectedModuleIdx]?.drawerParts?.[key] ?? true}
                onChange={(e) => onModuleDetailsChange(prev => prev.map((d, i) => {
                  if (i !== selectedModuleIdx) return d;
                  return {
                    ...d,
                    drawerParts: {
                      ...defaultDrawerParts(),
                      ...(d?.drawerParts || {}),
                      [key]: e.target.checked,
                    },
                  };
                }))}
              />
              {label}
            </label>
          ))}
          {(facadeModules[selectedModuleIdx]?.drawers || 0) > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Hauteurs (cm):</span>
              {Array.from({ length: facadeModules[selectedModuleIdx]?.drawers || 0 }, (_, di) => (
                <label key={`dh-${di}`} className="text-slate-300">
                  #{di + 1}
                  <input
                    type="number" min="5" step="0.5"
                    value={moduleDetails[selectedModuleIdx]?.drawerHeights?.[di] ?? 18}
                    onChange={(e) => onModuleDetailsChange(prev => prev.map((d, i) => {
                      if (i !== selectedModuleIdx) return d;
                      const curr = Array.isArray(d.drawerHeights) ? d.drawerHeights : [];
                      const next = Array.from(
                        { length: facadeModules[selectedModuleIdx]?.drawers || 0 },
                        (_, idx) => Math.max(5, toNum(curr[idx], 18))
                      );
                      next[di] = toNum(e.target.value, next[di] ?? 18);
                      return { ...d, drawerHeights: next };
                    }))}
                    className="w-14 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FAB mobile (fixe en bas à droite) ── */}
      {isCompactMobile && (
        <div className="fixed bottom-4 right-3 z-[60] flex flex-col gap-2">
          <button
            onClick={onSave}
            className="w-11 h-11 rounded-full border border-green-300/30 bg-green-700 text-white shadow-xl text-lg"
            title="Sauvegarder"
          >
            💾
          </button>
        </div>
      )}
    </>
  );
}
