import { forwardRef, useState, useRef, useCallback } from 'react';
import FacadeKonvaEditor from '../facade/FacadeKonvaEditor';

const FACADE_W = 1140;
const FACADE_H = 700;

/**
 * Zone de dessin : canvas Konva + barre de cotes + panneau 3D latéral.
 * Aucune logique métier — rendu uniquement.
 */
const SketchEditorCanvas = forwardRef(function SketchEditorCanvas(
  {
    // Dimensions du cabinet
    cabW,
    cabH,
    plinth,
    thick,
    cabinetDims,
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
    onHistoryChange,
    onSelectionChange,
    // Notes générales
    generalNotes,
    onGeneralNotesChange,
    onDrawerResize,
    // Affichage
    showGrid,
    currentCabinet,
    assemblyType,
  },
  konvaEditorRef
) {
  const [selectedModule, setSelectedModule] = useState(null);
  const wrapperRef = useRef(null);

  const handleModuleSelect = useCallback((modIdx, screenX, screenY) => {
    if (modIdx === null) { setSelectedModule(null); return; }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedModule({ modIdx, x: screenX - rect.left, y: screenY - rect.top });
  }, []);

  const handleSelectionChange = useCallback((sel) => {
    onSelectionChange?.(sel);
  }, [onSelectionChange]);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

      {/* ── CANVAS ZONE ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Barre de cotes live */}
        <div style={{
          height: 32, flexShrink: 0,
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 20,
          fontSize: 11, fontFamily: 'monospace',
          color: '#484f58',
        }}>
          <span style={{ color: '#8b949e' }}>L</span>
          <span style={{ color: '#3fb950' }}>{cabW} cm</span>
          <span style={{ color: '#8b949e', marginLeft: 4 }}>H</span>
          <span style={{ color: '#3fb950' }}>{cabH} cm</span>
          {cabinetDims?.depth > 0 && <>
            <span style={{ color: '#8b949e', marginLeft: 4 }}>P</span>
            <span style={{ color: '#3fb950' }}>{cabinetDims.depth} cm</span>
          </>}
          {plinth > 0 && <>
            <span style={{ color: '#8b949e', marginLeft: 4 }}>Plinthe</span>
            <span>{plinth} cm</span>
          </>}
          <span style={{ color: '#21262d' }}>|</span>
          {facadeModules.map((m, i) => (
            <span key={i} style={{ color: '#484f58' }}>
              M{i+1} <span style={{ color: '#e6edf3' }}>{m.width.toFixed(1)}</span>
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ color: '#388bfd' }}>
            {activeTool === 'dim' ? '↔ Tracez une cote' : activeTool === 'note' ? '✎ Cliquez pour noter' : ''}
          </span>
        </div>

        {/* Canvas Konva */}
        <div ref={wrapperRef} style={{ flex: 1, height: 0, minHeight: 0, overflow: 'hidden', background: '#161b22', position: 'relative' }}>
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
            currentCabinet={currentCabinet}
            assemblyType={assemblyType}
          />

          {/* Popup module sélectionné */}
          {selectedModule !== null && (() => {
            const mod = facadeModules[selectedModule.modIdx];
            if (!mod) return null;
            const containerWidth = wrapperRef.current?.offsetWidth ?? 800;
            const top  = selectedModule.y - 60;
            const left = Math.max(8, Math.min(selectedModule.x - 90, containerWidth - 188));
            return (
              <div style={{
                position: 'absolute', top, left, zIndex: 30,
                background: '#1c2128', border: '1px solid #30363d',
                borderRadius: 6, padding: '8px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                minWidth: 160, fontSize: 12,
              }}>
                <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 6 }}>Module {selectedModule.modIdx + 1}</div>
                <div style={{ color: '#8b949e', fontFamily: 'monospace', marginBottom: 8 }}>{mod.width.toFixed(1)} cm</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { onModuleErase(selectedModule.modIdx); setSelectedModule(null); }}
                    style={{ flex: 1, padding: '4px 0', background: 'rgba(248,81,73,0.15)',
                      border: '1px solid rgba(248,81,73,0.3)', borderRadius: 4,
                      color: '#f85149', cursor: 'pointer', fontSize: 11 }}>
                    Supprimer
                  </button>
                  <button
                    onClick={() => {
                      const { modIdx } = selectedModule;
                      onModuleChange(prev => {
                        const copy = [...prev];
                        copy.splice(modIdx + 1, 0, { ...prev[modIdx] });
                        return copy;
                      });
                      setSelectedModule(null);
                    }}
                    style={{ flex: 1, padding: '4px 0', background: 'rgba(31,111,235,0.15)',
                      border: '1px solid rgba(31,111,235,0.3)', borderRadius: 4,
                      color: '#388bfd', cursor: 'pointer', fontSize: 11 }}>
                    Dupliquer
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Barre de notes */}
        <div style={{
          height: 56, flexShrink: 0,
          background: '#0d1117', borderTop: '1px solid #21262d',
          padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#484f58', flexShrink: 0 }}>Notes :</span>
          <textarea
            value={generalNotes}
            onChange={e => onGeneralNotesChange(e.target.value)}
            placeholder="Notes pour Claude (ex: tiroir bas module 3, porte vitrée gauche...)"
            style={{
              flex: 1, height: 36, resize: 'none',
              background: '#161b22', border: '1px solid #21262d',
              borderRadius: 4, color: '#8b949e', fontSize: 11,
              padding: '6px 8px', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
    </div>
  );
});

SketchEditorCanvas.displayName = 'SketchEditorCanvas';

export default SketchEditorCanvas;
