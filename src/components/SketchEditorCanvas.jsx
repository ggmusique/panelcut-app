import { forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';
import SketchPropertiesPanel from './SketchPropertiesPanel';
import ProfessionalRealisticViewer from '../visualization/ProfessionalRealisticViewer';
import { useDebounce } from '../hooks/useDebounce';

const FACADE_W = 1140;
const FACADE_H = 700;

/**
 * Zone de dessin : canvas Konva + zone de notes générales.
 * Aucune logique métier — rendu uniquement.
 */
const SketchEditorCanvas = forwardRef(function SketchEditorCanvas(
  {
    // Dimensions du cabinet
    cabW,
    cabH,
    plinth,
    thick,
    // Données façade
    facadeModules,
    moduleDetails,
    cabinetModules,
    facadeItems,
    joints,
    globalSliding,
    elements,
    // Callbacks
    onFacadePointerDown,
    onItemMove,
    onItemErase,
    onModuleClick,
    onModuleErase,
    onElementAdd,
    onElementUpdate,
    onElementRemove,
    activeTool,
    // Keyboard shortcuts callbacks
    onUndo,
    onRedo,
    onToolChange,
    // History state sync
    onHistoryChange,
    // Callbacks undo/redo state sync
    onModuleChange,
    onItemChange,
    onModuleDetailsChange,
    // Undo/redo state for panel
    canUndo,
    canRedo,
    // Notes générales
    generalNotes,
    onGeneralNotesChange,
    onDrawerResize,
    // Grille
    showGrid,
    // 3D preview
    currentCabinet,
  },
  konvaEditorRef
) {
  const [selectedModule, setSelectedModule] = useState(null); // { modIdx, x, y } | null
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [show3D, setShow3D] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const show3DUserOverride = useRef(false);
  const wrapperRef = useRef(null);

  // Auto-hide on mobile resize, unless the user explicitly toggled
  useEffect(() => {
    const onResize = () => {
      if (!show3DUserOverride.current) {
        setShow3D(window.innerWidth >= 768);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const debouncedCabinet = useDebounce(currentCabinet, 800);

  // Adapter: panel calls onModuleChange(idx, changes);
  // canvas receives setFacadeModules which accepts a React functional-update.
  const handleModuleChangeForPanel = useCallback((idx, changes) => {
    if (typeof onModuleChange !== 'function') return;
    onModuleChange(prev =>
      Array.isArray(prev)
        ? prev.map((m, i) => i === idx ? { ...m, ...changes } : m)
        : prev
    );
  }, [onModuleChange]);

  // Adapter for bulk module replacement (alignment operations in panel)
  const handleModulesChangeForPanel = useCallback((newModules) => {
    if (typeof onModuleChange !== 'function') return;
    onModuleChange(() => newModules);
  }, [onModuleChange]);

  // ── Keyboard shortcuts: tool selection + undo/redo ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        onRedo?.();
        return;
      }
      // Tool shortcuts (no modifier)
      // T=Tiroir(drawer), S=Tablette(shelf), R=Tringle(rod), P=Porte(door),
      // C=Cote(dim), N=Note, Esc=Sélection(erase)
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      switch (e.key) {
        case 't': case 'T': onToolChange?.('drawer');  break;
        case 's': case 'S': onToolChange?.('shelf');   break;
        case 'r': case 'R': onToolChange?.('rod');     break;
        case 'p': case 'P': onToolChange?.('door');    break;
        case 'c': case 'C': onToolChange?.('dim');     break;
        case 'n': case 'N': onToolChange?.('note');    break;
        case 'Escape':      onToolChange?.('erase');   break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndo, onRedo, onToolChange]);

  const handleModuleSelect = useCallback((modIdx, screenX, screenY) => {
    if (modIdx === null) {
      setSelectedModule(null);
      return;
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedModule({ modIdx, x: screenX - rect.left, y: screenY - rect.top });
  }, []);

  const handleSelectionChange = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
          <div ref={wrapperRef} style={{ position: 'relative', overflow: 'visible', width: '100%' }}>
            <FacadeKonvaEditor
              ref={konvaEditorRef}
              svgW={FACADE_W} svgH={FACADE_H}
              cabW={cabW} cabH={cabH}
              plinth={plinth} thick={thick}
              facadeModules={facadeModules}
              cabinetModules={cabinetModules}
              facadeItems={facadeItems}
              joints={joints}
              globalSliding={globalSliding}
              elements={elements}
              onFacadePointerDown={onFacadePointerDown}
              onItemMove={onItemMove}
              onItemErase={onItemErase}
              onModuleClick={onModuleClick}
              onModuleErase={onModuleErase}
              onElementAdd={onElementAdd}
              onElementUpdate={onElementUpdate}
              onElementRemove={onElementRemove}
              activeTool={activeTool}
              onModuleChange={onModuleChange}
              onItemChange={onItemChange}
              onDrawerResize={onDrawerResize}
              onModuleSelect={handleModuleSelect}
              onSelectionChange={handleSelectionChange}
              onHistoryChange={onHistoryChange}
              showGrid={showGrid}
            />

            {selectedModule !== null && (() => {
              const mod = facadeModules[selectedModule.modIdx];
              if (!mod) return null;
              const containerWidth = wrapperRef.current?.offsetWidth ?? 800;
              const top  = selectedModule.y - 60;
              const left = Math.max(8, Math.min(selectedModule.x - 90, containerWidth - 188));
              return (
                <div style={{
                  position: 'absolute',
                  top,
                  left,
                  background: 'var(--bg-card)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                  zIndex: 30,
                  minWidth: 180,
                  color: 'var(--text1)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Module {selectedModule.modIdx + 1}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{mod.width.toFixed(1)} cm</div>
                  <hr style={{ margin: '6px 0', borderColor: 'var(--border)', border: 'none', borderTop: '1px solid var(--border)' }} />
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 12 }}
                      onClick={() => {
                        onModuleErase(selectedModule.modIdx);
                        setSelectedModule(null);
                      }}
                    >
                      × Supprimer module
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--text1)', cursor: 'pointer', padding: 0, fontSize: 12 }}
                      onClick={() => {
                        const { modIdx } = selectedModule;
                        onModuleChange(prev => {
                          const copy = [...prev];
                          copy.splice(modIdx + 1, 0, { ...prev[modIdx] });
                          return copy;
                        });
                        setSelectedModule(null);
                      }}
                    >
                      ⧉ Dupliquer
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ── 3D Floating overlay — présentation mode au-dessus du calque ── */}
            {show3D && debouncedCabinet && (
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 260,
                zIndex: 20,
                borderRadius: 10,
                overflow: 'hidden',
                background: '#0f172a',
                boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                // Let pointer events pass through to the Konva canvas when using
                // tools that require canvas interaction (dim drawing, note placement)
                pointerEvents: (activeTool === 'dim' || activeTool === 'note') ? 'none' : 'auto',
              }}>
                <ProfessionalRealisticViewer
                  cabinet={debouncedCabinet}
                  fullScreen={false}
                  presentationMode={true}
                  miniMode={true}
                  height={200}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: 280, minWidth: 280, overflow: 'hidden', background: 'var(--bg-panel, #1e293b)', borderLeft: '1px solid var(--border, #334155)' }}>
          {/* Header of right panel with 3D toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 8px', borderBottom: '1px solid var(--border, #334155)' }}>
            <button
              onClick={() => { show3DUserOverride.current = true; setShow3D(v => !v); }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--border, #475569)',
                background: show3D ? 'rgba(234,88,12,0.15)' : 'transparent',
                color: show3D ? '#fb923c' : 'var(--text2, #94a3b8)',
                cursor: 'pointer',
              }}
              title={show3D ? 'Masquer l\'aperçu 3D' : 'Afficher l\'aperçu 3D'}
            >
              {show3D ? '🎲 Aperçu 3D ▲' : '🎲 Aperçu 3D ▼'}
            </button>
          </div>

          {/* Properties panel — takes remaining space */}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <SketchPropertiesPanel
              selectedModuleIdx={selectedModule?.modIdx ?? null}
              selectedIds={selectedIds}
              facadeModules={facadeModules}
              moduleDetails={moduleDetails}
              cabinetDims={{ width: cabW, height: cabH, plinth: plinth || 0 }}
              onModuleChange={handleModuleChangeForPanel}
              onModulesChange={handleModulesChangeForPanel}
              onModuleDetailsChange={onModuleDetailsChange}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo}
              onRedo={onRedo}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea
          value={generalNotes}
          onChange={e => onGeneralNotesChange(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none"
        />
      </div>
    </>
  );
});

SketchEditorCanvas.displayName = 'SketchEditorCanvas';

export default SketchEditorCanvas;
