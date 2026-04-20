import { useState, useRef, useCallback } from 'react';
import { defaultDrawerParts } from '../utils/sketchEditorConstants';

// ── SVG icons (inline, no external lib) ──────────────────────────────────────

const IconSelect = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 2 L3 14 L7 11 L9 16 L11 15 L9 10 L14 10 Z" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
);

const IconDrawer = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="3" width="14" height="12" rx="1"/>
    <line x1="2" y1="7" x2="16" y2="7"/>
    <line x1="2" y1="11" x2="16" y2="11"/>
    <circle cx="9" cy="5" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="9" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="13" r="0.8" fill="currentColor" stroke="none"/>
  </svg>
);

const IconShelf = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="7" width="14" height="4" rx="1"/>
  </svg>
);

const IconRod = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="3" y1="9" x2="15" y2="9" strokeWidth="2"/>
    <circle cx="3" cy="9" r="2" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="9" r="2" fill="currentColor" stroke="none"/>
  </svg>
);

const IconDoor = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="2" width="12" height="14" rx="1"/>
    <circle cx="12.5" cy="9" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const IconSliding = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="3" width="9" height="12" rx="1"/>
    <rect x="7" y="3" width="9" height="12" rx="1"/>
  </svg>
);

const IconDim = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="2" y1="9" x2="16" y2="9"/>
    <polyline points="5,6 2,9 5,12"/>
    <polyline points="13,6 16,9 13,12"/>
    <line x1="2" y1="5" x2="2" y2="13" strokeWidth="1"/>
    <line x1="16" y1="5" x2="16" y2="13" strokeWidth="1"/>
  </svg>
);

const IconNote = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 2 H13 L15 4 V16 H3 Z"/>
    <polyline points="13,2 13,5 15,5" strokeWidth="1.2"/>
    <line x1="6" y1="8" x2="12" y2="8" strokeWidth="1.2"/>
    <line x1="6" y1="11" x2="12" y2="11" strokeWidth="1.2"/>
  </svg>
);

const IconUndo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 9 A6 6 0 1 1 9 15" strokeLinecap="round"/>
    <polyline points="3,5 3,9 7,9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconRedo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M15 9 A6 6 0 1 0 9 15" strokeLinecap="round"/>
    <polyline points="15,5 15,9 11,9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2" y="2" width="14" height="14" rx="1"/>
    <line x1="2" y1="7" x2="16" y2="7"/>
    <line x1="2" y1="12" x2="16" y2="12"/>
    <line x1="7" y1="2" x2="7" y2="16"/>
    <line x1="12" y1="2" x2="12" y2="16"/>
  </svg>
);

const IconZoomIn = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="8" cy="8" r="5"/>
    <line x1="12" y1="12" x2="16" y2="16" strokeLinecap="round"/>
    <line x1="6" y1="8" x2="10" y2="8"/>
    <line x1="8" y1="6" x2="8" y2="10"/>
  </svg>
);

const IconZoomOut = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="8" cy="8" r="5"/>
    <line x1="12" y1="12" x2="16" y2="16" strokeLinecap="round"/>
    <line x1="6" y1="8" x2="10" y2="8"/>
  </svg>
);

// ── Tool groups definition ────────────────────────────────────────────────────

const TOOL_GROUPS = [
  [
    { id: 'erase',   label: 'Sélection',   shortcut: 'Esc', icon: <IconSelect /> },
  ],
  [
    { id: 'drawer',  label: 'Tiroir',      shortcut: 'T',   icon: <IconDrawer /> },
    { id: 'shelf',   label: 'Tablette',    shortcut: 'S',   icon: <IconShelf /> },
    { id: 'rod',     label: 'Tringle',     shortcut: 'R',   icon: <IconRod /> },
    { id: 'door',    label: 'Porte',       shortcut: 'P',   icon: <IconDoor /> },
    { id: 'sliding', label: 'Coulissante', shortcut: null,  icon: <IconSliding /> },
  ],
  [
    { id: 'dim',     label: 'Cote',        shortcut: 'C',   icon: <IconDim /> },
    { id: 'note',    label: 'Note',        shortcut: 'N',   icon: <IconNote /> },
  ],
];

// ── Tooltip-aware tool button ─────────────────────────────────────────────────

function ToolBtn({ tool, isActive, onClick }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={onClick}
        title={tool.label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px 7px',
          background: 'none',
          border: 'none',
          borderBottom: isActive ? '2px solid #EA580C' : '2px solid transparent',
          borderRadius: 0,
          cursor: 'pointer',
          color: isActive ? '#EA580C' : '#94a3b8',
          transition: 'color 0.15s',
        }}
      >
        {tool.icon}
      </button>
      {visible && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 4,
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11,
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          {tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}
        </div>
      )}
    </div>
  );
}

// ── Action button (undo/redo/zoom) ────────────────────────────────────────────

function ActionBtn({ icon, label, shortcut, onClick, disabled, active }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={onClick}
        disabled={disabled}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px 7px',
          background: 'none',
          border: 'none',
          borderBottom: active ? '2px solid #EA580C' : '2px solid transparent',
          borderRadius: 0,
          cursor: disabled ? 'default' : 'pointer',
          color: active ? '#EA580C' : disabled ? '#475569' : '#94a3b8',
          transition: 'color 0.15s',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {icon}
      </button>
      {visible && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 4,
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11,
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          {label}{shortcut ? ` (${shortcut})` : ''}
        </div>
      )}
    </div>
  );
}

// ── Vertical separator ────────────────────────────────────────────────────────

const Sep = () => (
  <div style={{ width: 1, background: '#334155', margin: '4px 4px', alignSelf: 'stretch' }} />
);

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/**
 * Barre d'outils complète de l'éditeur : outils, vues, dimensions meuble,
 * largeurs des modules, coulissantes globales, détails menuiserie et FAB mobile.
 */
export default function SketchToolbar({
  // Outils
  activeTool,
  onToolChange,
  // Undo / Redo
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  // Zoom
  onZoomIn,
  onZoomOut,
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
  // Grille
  showGrid,
  onToggleGrid,
}) {
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);
  return (
    <>
      {/* ── Barre outils ── */}
      <div className="flex items-center gap-0 p-1 bg-slate-800 overflow-x-auto border-b border-slate-700" style={{ minHeight: 40 }}>
        {dimensionsFromWizard && (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-600/40 mr-2">✓ Cotes</span>
        )}

        {/* Tool groups */}
        {TOOL_GROUPS.map((group, gi) => (
          <div key={gi} style={{ display: 'flex', alignItems: 'center' }}>
            {gi > 0 && <Sep />}
            {group.map(tool => (
              <ToolBtn
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => onToolChange(tool.id)}
              />
            ))}
          </div>
        ))}

        {/* Undo / Redo */}
        <Sep />
        <ActionBtn icon={<IconUndo />} label="Annuler" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo} />
        <ActionBtn icon={<IconRedo />} label="Rétablir" shortcut="Ctrl+Y" onClick={onRedo} disabled={!canRedo} />

        {/* Zoom */}
        <Sep />
        <ActionBtn icon={<IconZoomIn />}  label="Zoom +"  onClick={onZoomIn} />
        <ActionBtn icon={<IconZoomOut />} label="Zoom −"  onClick={onZoomOut} />

        {/* Grille */}
        <Sep />
        <ActionBtn
          icon={<IconGrid />}
          label={showGrid ? 'Masquer grille' : 'Afficher grille'}
          onClick={onToggleGrid}
          active={showGrid}
        />

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
