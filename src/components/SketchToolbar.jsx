import { useState, useRef } from 'react';
import {
  BookOpenText,
  BetweenHorizonalStart,
  DoorClosed,
  Eraser,
  PanelsTopLeft,
  PencilRuler,
  Ruler,
  Rows3,
  SquareStack,
  ToggleLeft,
} from 'lucide-react';
import { defaultDrawerParts } from '../utils/sketchEditorConstants';

const TOOLS = [
  { id: 'drawer',  icon: Rows3,                label: 'Tiroir',       color: '#eab308' },
  { id: 'shelf',   icon: PanelsTopLeft,        label: 'Tablette',     color: '#10b981' },
  { id: 'rod',     icon: BetweenHorizonalStart,label: 'Tringle',      color: '#60a5fa' },
  { id: 'door',    icon: DoorClosed,           label: 'Porte',        color: '#f59e0b' },
  { id: 'sliding', icon: SquareStack,          label: 'Coulissante',  color: '#8b5cf6' },
  { id: 'dim',     icon: Ruler,                label: 'Cote',         color: '#06b6d4' },
  { id: 'note',    icon: PencilRuler,          label: 'Note',         color: '#fb923c' },
  { id: 'erase',   icon: Eraser,               label: 'Effacer',      color: '#f87171' },
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
      <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,30,49,0.95),rgba(11,18,33,0.92))]">
        <div className="flex flex-wrap items-center gap-3 px-3 py-1.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <ToggleLeft className="h-4 w-4 text-amber-300" />
            Outils d'édition
          </div>
          {dimensionsFromWizard && (
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              Dimensions importées
            </span>
          )}
          {!isCompactMobile && (
            <div className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              {hint}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onToolChange(t.id)}
                className={`group min-w-[64px] rounded-xl border px-2 py-1.5 text-left transition ${
                  active
                    ? 'border-white/20 bg-white/[0.08] text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)]'
                    : 'border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]'
                }`}
                style={active ? { boxShadow: `inset 0 0 0 1px ${t.color}55` } : {}}
              >
                <div
                  className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg border"
                  style={{
                    color: t.color,
                    borderColor: active ? `${t.color}55` : 'rgba(255,255,255,0.08)',
                    background: active ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-[11px] font-semibold">{t.label}</div>
                {!isCompactMobile && (
                  <div className="hidden">
                    {t.id === 'drawer' && 'Façade basse'}
                    {t.id === 'shelf' && 'Étagère intérieure'}
                    {t.id === 'rod' && 'Suspension'}
                    {t.id === 'door' && 'Battante'}
                    {t.id === 'sliding' && 'Portes frontales'}
                    {t.id === 'dim' && 'Cotation libre'}
                    {t.id === 'note' && 'Commentaire'}
                    {t.id === 'erase' && 'Supprimer'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-white/10 bg-[#0f1729] px-3 py-1.5">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <BookOpenText className="h-4 w-4 text-amber-300" />
              Dimensions Totales
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Largeur</span>
                <div className="flex h-8 items-center gap-2 rounded-lg border border-white/8 bg-[#121c31] px-2">
                  <input
                    value={cabinetDims.width}
                    onChange={e => onCabinetDimsChange(v => ({ ...v, width: toNum(e.target.value, 0) }))}
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-500">cm</span>
                </div>
              </label>
              <label className="text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Hauteur</span>
                <div className="flex h-8 items-center gap-2 rounded-lg border border-white/8 bg-[#121c31] px-2">
                  <input
                    value={cabinetDims.height}
                    onChange={e => onCabinetDimsChange(v => ({ ...v, height: toNum(e.target.value, 0) }))}
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-500">cm</span>
                </div>
              </label>
              <label className="text-slate-300">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">Plinthe</span>
                <div className="flex h-8 items-center gap-2 rounded-lg border border-white/8 bg-[#121c31] px-2">
                  <input
                    value={cabinetDims.plinth}
                    onChange={e => onCabinetDimsChange(v => ({ ...v, plinth: toNum(e.target.value, 0) }))}
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-500">cm</span>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <PanelsTopLeft className="h-4 w-4 text-sky-300" />
              Largeurs des Modules
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
              {facadeModules.map((m, i) => (
                <label key={m.id || i} className="text-slate-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-slate-500">M{i + 1}</span>
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-white/8 bg-[#121c31] px-2">
                    <input
                      value={widthInputs[i] ?? ''}
                      onChange={e => onWidthInputChange(i, e.target.value)}
                      onBlur={() => onCommitWidth(i)}
                      onKeyDown={e => { if (e.key === 'Enter') { onCommitWidth(i); e.target.blur(); } }}
                      className="w-full bg-transparent text-xs text-white outline-none"
                    />
                    <span className="text-[11px] text-slate-500">cm</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {facadeModules.length > 0 && (
        <div className="border-b border-white/10 bg-[#0b1221] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-300">Coulissantes meuble</span>
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

          <span className="ml-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">Détail menuiserie</span>
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
                className={`rounded-xl border px-2.5 py-1.5 ${selectedModuleIdx === i ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-300'} ${dragOverIdx === i ? 'border-l-[2px] border-l-blue-500' : ''}`}
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
        </div>
      )}

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
