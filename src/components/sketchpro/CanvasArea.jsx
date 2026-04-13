import React, { useRef, useState } from 'react';
import AnnotationLayer from './AnnotationLayer';
import ObjectConfigPopover from './ObjectConfigPopover';

const objectTools = ['shelf', 'drawer', 'rod', 'door', 'sliding_door'];

export default function CanvasArea({
  image,
  tool,
  annotations,
  selectedId,
  setSelectedId,
  addAnnotation,
  removeAnnotation,
  updateAnnotation,
  openObjectPopover,
  objectPopover,
  confirmObjectPopover,
  setObjectPopover,
  zoom,
  pan,
  setPan,
  setMousePos,
}) {
  const wrapRef = useRef(null);
  const [draftLine, setDraftLine] = useState(null);
  const [dragging, setDragging] = useState(false);

  const getPoint = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const onMouseDown = (e) => {
    const p = getPoint(e);
    if (tool === 'dim' || tool === 'arrow') {
      setDraftLine({ type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (tool === 'note') {
      const label = window.prompt('Texte de la note', 'Note') || 'Note';
      addAnnotation({ type: 'note', x1: p.x, y1: p.y, x2: p.x, y2: p.y, label });
      return;
    }
    if (objectTools.includes(tool)) {
      openObjectPopover({ x: p.x, y: p.y }, tool);
      return;
    }
    if (tool === 'erase') {
      const id = e.target?.dataset?.id;
      if (id) removeAnnotation(id);
      return;
    }
    if (tool === 'select') {
      setDragging(true);
    }
  };

  const onMouseMove = (e) => {
    const p = getPoint(e);
    setMousePos({ x: Math.round(p.x), y: Math.round(p.y) });
    if (draftLine) setDraftLine((line) => ({ ...line, x2: p.x, y2: p.y }));
    if (dragging && e.buttons === 1) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const onMouseUp = () => {
    if (draftLine) {
      addAnnotation({ ...draftLine, label: draftLine.type === 'dim' ? 'cote' : 'flèche' });
      setDraftLine(null);
    }
    setDragging(false);
  };

  const onDoubleClickLabel = (ann) => {
    const label = window.prompt('Modifier le label', ann.label || '') || ann.label;
    updateAnnotation(ann.id, { label });
  };

  const cursor = tool === 'dim' || tool === 'arrow' ? 'crosshair'
    : tool === 'note' ? 'text'
    : tool === 'select' ? 'pointer'
    : objectTools.includes(tool) ? 'cell'
    : tool === 'erase' ? 'not-allowed'
    : 'default';

  return (
    <div className="relative h-full w-full overflow-auto rounded-2xl border border-slate-800 bg-[#0f1620]" ref={wrapRef}>
      <div
        className="relative origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {image ? (
          <img src={image} alt="scan" className="max-w-none select-none" draggable={false} style={{ cursor }} />
        ) : (
          <div className="w-[1100px] h-[700px] bg-slate-900 grid place-items-center text-slate-500">Aucune image</div>
        )}
        <svg className="absolute inset-0 w-full h-full" style={{ cursor }}>
          <AnnotationLayer
            annotations={annotations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDoubleClickLabel={onDoubleClickLabel}
          />
          {draftLine && <line x1={draftLine.x1} y1={draftLine.y1} x2={draftLine.x2} y2={draftLine.y2} stroke="#f97316" strokeWidth="2" />}
          {annotations.map((a) => (
            <rect
              key={`hit-${a.id}`}
              data-id={a.id}
              x={(a.x1 || 0) - 14}
              y={(a.y1 || 0) - 14}
              width="28"
              height="28"
              fill="transparent"
            />
          ))}
        </svg>
      </div>
      <ObjectConfigPopover popover={objectPopover} onConfirm={confirmObjectPopover} onClose={() => setObjectPopover(null)} />
    </div>
  );
}
