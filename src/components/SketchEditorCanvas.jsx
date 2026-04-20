import { forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';
import SketchPropertiesPanel from './SketchPropertiesPanel';

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
  },
  konvaEditorRef
) {
  const [selectedModule, setSelectedModule] = useState(null); // { modIdx, x, y } | null
  const wrapperRef = useRef(null);

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
          </div>
        </div>

        <SketchPropertiesPanel
          selectedModuleIdx={selectedModule?.modIdx ?? null}
          facadeModules={facadeModules}
          moduleDetails={moduleDetails}
          cabinetDims={{ width: cabW, height: cabH, plinth: plinth || 0 }}
          onModuleChange={handleModuleChangeForPanel}
          onModuleDetailsChange={onModuleDetailsChange}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
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
