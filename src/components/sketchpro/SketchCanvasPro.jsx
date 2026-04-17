import React, { useMemo, useRef, useState } from 'react';
import FacadeSvgView from './FacadeSvgView';
import { TOOL_IDS, toPercentY } from './utils';

const OBJECT_TO_COLLECTION = {
  [TOOL_IDS.SHELF]: 'shelves',
  [TOOL_IDS.DRAWER]: 'drawers',
  [TOOL_IDS.ROD]: 'rods',
  [TOOL_IDS.DOOR]: 'doors',
  [TOOL_IDS.SLIDING]: 'slidingDoors',
};

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
}) {
  const wrapRef = useRef(null);
  const facadeRef = useRef(null);
  const [drawStart, setDrawStart] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const svgSize = useMemo(() => ({ w: 1100, h: 700 }), []);

  const getPoint = (e) => {
    const rect = facadeRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleMouseDown = (e) => {
    const p = getPoint(e);
    setMouse({ x: p.x, y: p.y });

    if (tool === TOOL_IDS.SELECT) {
      setIsPanning(true);
      return;
    }
    if (tool === TOOL_IDS.DIM || tool === TOOL_IDS.ARROW) {
      setDrawStart(p);
      return;
    }
    if (tool === TOOL_IDS.NOTE) {
      const label = window.prompt('Texte de la note', 'Note') || 'Note';
      addFacadeAnnotation('note', p.x, p.y, p.x, p.y, label);
      return;
    }
    if (tool === TOOL_IDS.ERASE) {
      if (selectedAnnotationId) removeFacadeAnnotation(selectedAnnotationId);
      return;
    }
    if (selectedModuleId && OBJECT_TO_COLLECTION[tool]) {
      const yPercent = toPercentY(p.y, svgSize.h, 58, svgSize.h - 118);
      addModuleObject(selectedModuleId, tool, yPercent);
    }
  };

  const handleMouseMove = (e) => {
    const p = getPoint(e);
    setMouse({ x: p.x, y: p.y });
    if (isPanning && e.buttons === 1) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = (e) => {
    if (drawStart) {
      const p = getPoint(e);
      const type = tool === TOOL_IDS.DIM ? 'dim' : 'arrow';
      const defaultLabel = type === 'dim' ? 'cote' : 'rep\u00e8re';
      addFacadeAnnotation(type, drawStart.x, drawStart.y, p.x, p.y, defaultLabel);
      setDrawStart(null);
      return;
    }
    setIsPanning(false);
  };

  const cursor = tool === TOOL_IDS.SELECT ? 'grab'
    : tool === TOOL_IDS.DIM || tool === TOOL_IDS.ARROW ? 'crosshair'
    : tool === TOOL_IDS.NOTE ? 'text'
    : tool === TOOL_IDS.ERASE ? 'not-allowed'
    : 'cell';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden h-full flex flex-col" ref={wrapRef}>

      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Vue Scan ── visible en mode scan et split */}
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

        {/* ── Vue Fa\u00e7ade SVG ── visible en mode facade et split */}
        {(viewMode === 'facade' || viewMode === 'split') && (
          <div
            ref={facadeRef}
            className={`relative overflow-auto bg-slate-950/30 ${
              viewMode === 'split' ? 'w-1/2' : 'w-full'
            }`}
            style={{ cursor }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={() => {
              if (!selectedAnnotationId) return;
              const ann = draftState.facadeItems.find((a) => a.id === selectedAnnotationId);
              if (!ann) return;
              const label = window.prompt('Modifier le label', ann.label || '') ?? ann.label;
              updateFacadeAnnotation(ann.id, { label });
            }}
          >
            <div className="absolute top-2 left-3 text-[10px] text-slate-500 z-10 bg-slate-900/80 px-2 py-0.5 rounded pointer-events-none select-none">
              FA\u00c7ADE M\u00c9TIER
            </div>
            <div
              className="relative origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'top left',
                width: svgSize.w,
                height: svgSize.h,
              }}
            >
              <FacadeSvgView
                width={svgSize.w}
                height={svgSize.h}
                draftState={draftState}
                selectedModuleId={selectedModuleId}
                selectedAnnotationId={selectedAnnotationId}
                onSelectModule={setSelectedModuleId}
                onSelectAnnotation={setSelectedAnnotationId}
              />
              {drawStart && (
                <svg width={svgSize.w} height={svgSize.h} className="absolute inset-0 pointer-events-none">
                  <line
                    x1={drawStart.x} y1={drawStart.y}
                    x2={mouse.x} y2={mouse.y}
                    stroke="#f97316" strokeWidth="2" strokeDasharray="5 3"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Barre de statut ── */}
      <div className="px-3 py-2 border-t border-slate-800 text-xs text-slate-400 flex gap-4 shrink-0">
        <span>Outil: <span className="text-slate-200">{tool}</span></span>
        <span>Zoom: <span className="text-slate-200">{Math.round(zoom * 100)}%</span></span>
        <span>Coord: <span className="text-slate-200">{Math.round(mouse.x)}, {Math.round(mouse.y)}</span></span>
      </div>

    </div>
  );
}
