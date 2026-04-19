import { forwardRef } from 'react';
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
    // Notes générales
    generalNotes,
    onGeneralNotesChange,
  },
  konvaEditorRef
) {
  return (
    <>
      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
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
