import { forwardRef, useState, useRef, useCallback } from 'react';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';

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
    // Callbacks undo/redo state sync
    onModuleChange,
    onItemChange,
    // Notes générales
    generalNotes,
    onGeneralNotesChange,
    onDrawerResize,
  },
  konvaEditorRef
) {
  const [selectedModule, setSelectedModule] = useState(null); // { modIdx, x, y } | null
  const wrapperRef = useRef(null);

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
      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
        <div
          ref={wrapperRef}
          className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,#fffef9_0%,#f9f5ea_38%,#efe8d7_100%)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          style={{ position: 'relative', overflow: 'visible', width: '100%' }}
        >
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
                background: 'rgba(15, 23, 42, 0.94)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '12px 14px',
                boxShadow: '0 18px 48px rgba(15,23,42,.28)',
                zIndex: 30,
                minWidth: 180,
                color: '#f8fafc',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Module sélectionné</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Module {selectedModule.modIdx + 1}</div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>{mod.width.toFixed(1)} cm</div>
                <hr style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.08)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#fda4af', cursor: 'pointer', padding: 0, fontSize: 12 }}
                    onClick={() => {
                      onModuleErase(selectedModule.modIdx);
                      setSelectedModule(null);
                    }}
                  >
                    × Supprimer module
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', padding: 0, fontSize: 12 }}
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

      <div className="border-t border-white/10 bg-[#0c1322] p-3">
        <textarea
          value={generalNotes}
          onChange={e => onGeneralNotesChange(e.target.value)}
          placeholder="Notes du concepteur: 2 tiroirs en bas du module 3, porte vitrée à gauche, finition chêne clair..."
          className="h-20 w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#131c31,#0d1526)] px-4 py-3 text-sm text-slate-200 placeholder-slate-500 shadow-inner outline-none resize-none"
        />
      </div>
    </>
  );
});

SketchEditorCanvas.displayName = 'SketchEditorCanvas';

export default SketchEditorCanvas;
