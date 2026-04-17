import React, { useMemo, useRef, useState } from 'react';
import FacadeSvgView from './FacadeSvgView';

export default function SketchCanvasPro({
  viewMode = 'split',
  image,
  tool,
  zoom,
  pan,
  setPan,
  setZoom,
  draftState,
  selectedModuleId,
  setSelectedModuleId,
  selectedAnnotationId,
  setSelectedAnnotationId,
  addFacadeAnnotation,
  updateFacadeAnnotation,
  addModuleObject,
  removeFacadeAnnotation,
  removeModuleObject,
  updateModuleObject,
}) {
  const wrapRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // onMoveObject : déplace un objet en live pendant le drag
  const handleMoveObject = (moduleId, collection, itemId, newYcm) => {
    updateModuleObject(moduleId, collection, itemId, { y: Math.round(newYcm * 10) / 10 });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden h-full flex flex-col" ref={wrapRef}>

      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Vue Scan */}
        {(viewMode === 'scan' || viewMode === 'split') && (
          <div className={`relative overflow-hidden bg-slate-950 flex items-center justify-center ${
            viewMode === 'split' ? 'w-1/2 border-r border-slate-700' : 'w-full'
          }`}>
            <div className="absolute top-2 left-3 text-[10px] text-slate-500 z-10 bg-slate-900/80 px-2 py-0.5 rounded pointer-events-none select-none">
              SCAN ORIGINAL
            </div>
            {image
              ? <img src={image} alt="scan" className="w-full h-full object-contain" draggable={false} />
              : <div className="text-slate-500 text-sm">Aucune image de scan</div>
            }
          </div>
        )}

        {/* Vue Façade SVG */}
        {(viewMode === 'facade' || viewMode === 'split') && (
          <div
            className={`relative overflow-auto bg-slate-950/30 ${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            }`}
            onMouseMove={(e) => setMouse({ x: Math.round(e.clientX), y: Math.round(e.clientY) })}
            onDoubleClick={() => {
              if (!selectedAnnotationId) return;
              const ann = draftState.facadeItems?.find((a) => a.id === selectedAnnotationId);
              if (!ann) return;
              const label = window.prompt('Modifier le label', ann.label || '') ?? ann.label;
              updateFacadeAnnotation(ann.id, { label });
            }}
          >
            <div className="absolute top-2 left-3 text-[10px] text-slate-500 z-10 bg-slate-900/80 px-2 py-0.5 rounded pointer-events-none select-none">
              FAÇADE MÉTIER
            </div>
            <FacadeSvgView
              tool={tool}
              zoom={zoom}
              pan={pan}
              draftState={draftState}
              selectedModuleId={selectedModuleId}
              selectedAnnotationId={selectedAnnotationId}
              onModuleClick={setSelectedModuleId}
              onAnnotationClick={setSelectedAnnotationId}
              onAddObject={addModuleObject}
              onAddAnnotation={addFacadeAnnotation}
              onRemoveObject={removeModuleObject}
              onMoveObject={handleMoveObject}
            />
          </div>
        )}

      </div>

      {/* Barre de statut */}
      <div className="px-3 py-2 border-t border-slate-800 text-xs text-slate-400 flex gap-4 shrink-0">
        <span>Outil: <span className="text-slate-200">{tool}</span></span>
        <span>Zoom: <span className="text-slate-200">{Math.round(zoom * 100)}%</span></span>
        <span>Coord: <span className="text-slate-200">{mouse.x}, {mouse.y}</span></span>
      </div>

    </div>
  );
}
