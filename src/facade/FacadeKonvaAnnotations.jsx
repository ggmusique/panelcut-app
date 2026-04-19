import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Group, Line, Rect, Text, Circle, Arrow } from 'react-konva';
import { uid } from '../utils/sketchEditorConstants';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_STROKE       = '#22d3ee';
const DIM_BUBBLE_EDIT  = '#0e7490';
const DIM_BUBBLE_EMPTY = '#164e63';
const NOTE_FILL        = '#fb923c';
const BUBBLE_W         = 48;
const BUBBLE_H         = 20;

// ── HTML input overlay (portal) ───────────────────────────────────────────────

/**
 * Floating <input> rendered via portal into document.body.
 * Props: x, y (viewport px), value, onCommit, onCancel
 */
function OverlayInput({ x, y, value: initialValue, placeholder = '', onCommit, onCancel }) {
  const [val, setVal] = useState(initialValue ?? '');
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => onCommit(val.trim()), [onCommit, val]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }, [commit, onCancel]);

  return ReactDOM.createPortal(
    <input
      ref={ref}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={handleKey}
      onBlur={commit}
      style={{
        position:   'fixed',
        left:       x,
        top:        y,
        width:      90,
        padding:    '2px 6px',
        fontSize:   12,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color:      '#22d3ee',
        background: '#0c2d3a',
        border:     '1.5px solid #22d3ee',
        borderRadius: 4,
        outline:    'none',
        zIndex:     9999,
      }}
    />,
    document.body,
  );
}

// ── DimElement ────────────────────────────────────────────────────────────────

/**
 * Renders a single dimension annotation (type === 'dim').
 */
function DimElement({
  el,
  isErase,
  onUpdate,
  onRemove,
  stageRef,
}) {
  const [hovered,      setHovered]      = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [bubbleScreen, setBubbleScreen] = useState({ x: 0, y: 0 });

  const { x1, y1, x2, y2, id } = el;
  const midX  = (x1 + x2) / 2;
  const midY  = (y1 + y2) / 2;
  const dx    = x2 - x1;
  const dy    = y2 - y1;
  const len   = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular unit vector (for arrow offset)
  const perpX = -dy / len;
  const perpY =  dx / len;

  // Offset arrows slightly so they don't overlap the line endpoints
  const ARROW_OFFSET = 4;
  const ax1 = x1 + (dx / len) * ARROW_OFFSET;
  const ay1 = y1 + (dy / len) * ARROW_OFFSET;
  const ax2 = x2 - (dx / len) * ARROW_OFFSET;
  const ay2 = y2 - (dy / len) * ARROW_OFFSET;

  const labelText = el.label ? `${el.label} cm` : '? cm';
  const bubbleFill = el.label ? DIM_BUBBLE_EDIT : DIM_BUBBLE_EMPTY;

  // Open the inline input for editing the dim label
  const openEdit = useCallback((e) => {
    e.cancelBubble = true;
    const stage = stageRef?.current;
    if (!stage) return;
    const cr   = stage.container().getBoundingClientRect();
    const pos  = stage.getPointerPosition() || { x: midX, y: midY };
    setBubbleScreen({
      x: cr.left + pos.x - BUBBLE_W / 2,
      y: cr.top  + pos.y - BUBBLE_H / 2 - 4,
    });
    setEditingLabel(true);
  }, [stageRef, midX, midY]);

  const commitLabel = useCallback((val) => {
    setEditingLabel(false);
    onUpdate?.({ ...el, label: val });
  }, [el, onUpdate]);

  const cancelLabel = useCallback(() => setEditingLabel(false), []);

  // Drag of the whole group
  const handleGroupDragEnd = useCallback((e) => {
    const dx2 = e.target.x();
    const dy2 = e.target.y();
    e.target.x(0);
    e.target.y(0);
    onUpdate?.({ ...el, x1: x1 + dx2, y1: y1 + dy2, x2: x2 + dx2, y2: y2 + dy2 });
  }, [el, x1, y1, x2, y2, onUpdate]);

  // Drag of an individual endpoint
  const handleEndDrag = useCallback((which, e) => {
    const pos = e.target.position();
    e.target.position({ x: which === 1 ? x1 : x2, y: which === 1 ? y1 : y2 });
    onUpdate?.({
      ...el,
      x1: which === 1 ? pos.x : x1,
      y1: which === 1 ? pos.y : y1,
      x2: which === 1 ? x2 : pos.x,
      y2: which === 1 ? y2 : pos.y,
    });
  }, [el, x1, y1, x2, y2, onUpdate]);

  const showEraseOverlay = isErase && hovered;

  return (
    <>
      <Group
        draggable={!isErase}
        onDragEnd={handleGroupDragEnd}
        onClick={(e) => { if (isErase) { e.cancelBubble = true; onRemove?.(id); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Main dashed line */}
        <Line
          points={[x1, y1, x2, y2]}
          stroke={DIM_STROKE}
          strokeWidth={2}
          dash={[4, 3]}
          listening={false}
        />

        {/* Arrow from start → end */}
        <Arrow
          points={[ax1, ay1, ax2, ay2]}
          stroke={DIM_STROKE}
          fill={DIM_STROKE}
          strokeWidth={1.5}
          pointerWidth={8}
          pointerLength={6}
          listening={false}
        />

        {/* Arrow from end → start (reverse) */}
        <Arrow
          points={[ax2, ay2, ax1, ay1]}
          stroke={DIM_STROKE}
          fill={DIM_STROKE}
          strokeWidth={1.5}
          pointerWidth={8}
          pointerLength={6}
          listening={false}
        />

        {/* Tick at start */}
        <Line
          points={[
            x1 + perpX * 5, y1 + perpY * 5,
            x1 - perpX * 5, y1 - perpY * 5,
          ]}
          stroke={DIM_STROKE}
          strokeWidth={1.5}
          listening={false}
        />

        {/* Tick at end */}
        <Line
          points={[
            x2 + perpX * 5, y2 + perpY * 5,
            x2 - perpX * 5, y2 - perpY * 5,
          ]}
          stroke={DIM_STROKE}
          strokeWidth={1.5}
          listening={false}
        />

        {/* Label bubble */}
        <Rect
          x={midX - BUBBLE_W / 2}
          y={midY - BUBBLE_H / 2}
          width={BUBBLE_W}
          height={BUBBLE_H}
          fill={bubbleFill}
          stroke={DIM_STROKE}
          strokeWidth={1}
          cornerRadius={4}
          onClick={isErase ? undefined : openEdit}
          onMouseEnter={(e) => {
            if (!isErase) {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'text';
            }
          }}
          onMouseLeave={(e) => {
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = 'default';
          }}
        />
        <Text
          x={midX - BUBBLE_W / 2}
          y={midY - BUBBLE_H / 2}
          width={BUBBLE_W}
          height={BUBBLE_H}
          text={labelText}
          align="center"
          verticalAlign="middle"
          fontSize={11}
          fill={DIM_STROKE}
          fontStyle="bold"
          listening={false}
        />

        {/* Erase hover overlay */}
        {showEraseOverlay && (
          <Rect
            x={Math.min(x1, x2) - 6}
            y={Math.min(y1, y2) - 6}
            width={Math.abs(dx) + 12}
            height={Math.abs(dy) + 12}
            fill="red"
            opacity={0.18}
            cornerRadius={3}
            listening={false}
          />
        )}
      </Group>

      {/* Draggable endpoint handles (always on top, not part of draggable group) */}
      {!isErase && (
        <>
          <Circle
            x={x1} y={y1}
            radius={4}
            fill={DIM_STROKE}
            stroke="#0c2d3a"
            strokeWidth={1}
            draggable
            onDragEnd={(e) => handleEndDrag(1, e)}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'default';
            }}
          />
          <Circle
            x={x2} y={y2}
            radius={4}
            fill={DIM_STROKE}
            stroke="#0c2d3a"
            strokeWidth={1}
            draggable
            onDragEnd={(e) => handleEndDrag(2, e)}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'default';
            }}
          />
        </>
      )}

      {/* Inline input overlay for label */}
      {editingLabel && (
        <OverlayInput
          x={bubbleScreen.x}
          y={bubbleScreen.y}
          value={el.label ?? ''}
          placeholder="valeur"
          onCommit={commitLabel}
          onCancel={cancelLabel}
        />
      )}
    </>
  );
}

// ── NoteElement ───────────────────────────────────────────────────────────────

/**
 * Renders a single sticky note annotation (type === 'note').
 */
function NoteElement({ el, isErase, onUpdate, onRemove, stageRef }) {
  const [hovered,     setHovered]     = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [noteScreen,  setNoteScreen]  = useState({ x: 0, y: 0 });

  const { id, x, y, text } = el;

  // Measure text to size the bubble
  const displayText = `📝 ${text || ''}`;
  const approxW = Math.max(60, displayText.length * 6.5 + 16);
  const approxH = 26;

  const openEdit = useCallback((e) => {
    e.cancelBubble = true;
    const stage = stageRef?.current;
    if (!stage) return;
    const cr  = stage.container().getBoundingClientRect();
    const pos = stage.getPointerPosition() || { x, y };
    setNoteScreen({ x: cr.left + pos.x, y: cr.top + pos.y - 14 });
    setEditingText(true);
  }, [stageRef, x, y]);

  const commitText = useCallback((val) => {
    setEditingText(false);
    onUpdate?.({ ...el, text: val });
  }, [el, onUpdate]);

  const cancelText = useCallback(() => setEditingText(false), []);

  const handleDragEnd = useCallback((e) => {
    onUpdate?.({ ...el, x: e.target.x(), y: e.target.y() });
  }, [el, onUpdate]);

  const showEraseOverlay = isErase && hovered;

  return (
    <>
      <Group
        x={x}
        y={y}
        draggable={!isErase}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.cancelBubble = true;
          if (isErase) { onRemove?.(id); return; }
          openEdit(e);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Rect
          x={0}
          y={0}
          width={approxW}
          height={approxH}
          fill={NOTE_FILL}
          opacity={0.85}
          cornerRadius={5}
          stroke={showEraseOverlay ? 'red' : 'transparent'}
          strokeWidth={showEraseOverlay ? 2 : 0}
        />
        <Text
          x={0}
          y={0}
          width={approxW}
          height={approxH}
          text={displayText}
          align="center"
          verticalAlign="middle"
          fontSize={11}
          fill="white"
          fontStyle="bold"
          listening={false}
        />
        {/* Erase overlay */}
        {showEraseOverlay && (
          <Rect
            x={0} y={0}
            width={approxW}
            height={approxH}
            fill="red"
            opacity={0.2}
            cornerRadius={5}
            listening={false}
          />
        )}
      </Group>

      {editingText && (
        <OverlayInput
          x={noteScreen.x}
          y={noteScreen.y}
          value={el.text ?? ''}
          placeholder="note…"
          onCommit={commitText}
          onCancel={cancelText}
        />
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * FacadeKonvaAnnotations
 *
 * Manages dim (dimension) and note annotations on the Konva stage.
 *
 * Props:
 *   elements        — array of annotation objects
 *                     { id, type:'dim'|'note', x1,y1,x2,y2,label } for dim
 *                     { id, type:'note', x, y, text }               for note
 *   stageWidth      — number (px)
 *   stageHeight     — number (px)
 *   activeTool      — 'dim' | 'note' | 'erase' | 'select' | …
 *   onElementAdd    — (element) => void
 *   onElementUpdate — (element) => void
 *   onElementRemove — (id) => void
 *   isDrawingDim    — boolean (controlled from parent, optional)
 *   dimStart        — {x,y} (controlled from parent, optional)
 *   stageRef        — ref to the Konva Stage (for getBoundingClientRect)
 */
export default function FacadeKonvaAnnotations({
  elements = [],
  stageWidth  = 800,
  stageHeight = 600,
  activeTool  = 'select',
  onElementAdd,
  onElementUpdate,
  onElementRemove,
  stageRef,
}) {
  // ── Drawing state ──────────────────────────────────────────────────────────
  const [drawing,    setDrawing]    = useState(false);  // dim creation in progress
  const [dimStart,   setDimStart]   = useState(null);   // {x, y}
  const [dimPreview, setDimPreview] = useState(null);   // {x2, y2}

  // For the pending dim awaiting a label after mouseup
  const [pendingDim,     setPendingDim]     = useState(null); // element object
  const [pendingLabelPos, setPendingLabelPos] = useState(null); // {x, y} screen coords

  // For note creation
  const [noteInputPos, setNoteInputPos] = useState(null); // {x, y} screen coords
  const noteStagePos   = useRef(null);                    // stage coords when note input opened

  const isErase = activeTool === 'erase';
  const isDim   = activeTool === 'dim';
  const isNote  = activeTool === 'note';

  // ── Stage event handlers (called from the transparent overlay Rect) ────────

  const handleStageMouseDown = useCallback((e) => {
    if (!isDim) return;
    e.cancelBubble = true;
    const stage = e.target.getStage();
    // getRelativePointerPosition accounts for Stage scale/pan; fall back to
    // getPointerPosition when the method is not available (old Konva versions).
    const pos   = stage?.getRelativePointerPosition?.() ?? stage?.getPointerPosition();
    if (!pos) return;
    setDrawing(true);
    setDimStart(pos);
    setDimPreview(pos);
  }, [isDim]);

  const handleStageMouseMove = useCallback((e) => {
    if (!isDim || !drawing) return;
    const stage = e.target.getStage();
    const pos   = stage?.getRelativePointerPosition?.() ?? stage?.getPointerPosition();
    if (!pos) return;
    setDimPreview(pos);
  }, [isDim, drawing]);

  const handleStageMouseUp = useCallback((e) => {
    if (!isDim || !drawing) return;
    e.cancelBubble = true;
    setDrawing(false);

    const stage = e.target.getStage();
    const pos   = stage?.getRelativePointerPosition?.() ?? stage?.getPointerPosition();
    if (!pos || !dimStart) return;

    // Skip degenerate dims (same point)
    const dx = pos.x - dimStart.x;
    const dy = pos.y - dimStart.y;
    if (Math.sqrt(dx * dx + dy * dy) < 4) {
      setDimStart(null);
      setDimPreview(null);
      return;
    }

    const newDim = {
      id:    uid(),
      type:  'dim',
      x1:    dimStart.x,
      y1:    dimStart.y,
      x2:    pos.x,
      y2:    pos.y,
      label: '',
    };

    setDimStart(null);
    setDimPreview(null);

    // Open label input immediately
    const cr = stage?.container().getBoundingClientRect();
    const mx = (newDim.x1 + newDim.x2) / 2;
    const my = (newDim.y1 + newDim.y2) / 2;
    setPendingDim(newDim);
    setPendingLabelPos({
      x: (cr?.left ?? 0) + mx - BUBBLE_W / 2,
      y: (cr?.top  ?? 0) + my - BUBBLE_H / 2 - 4,
    });
  }, [isDim, drawing, dimStart]);

  const handleStageClick = useCallback((e) => {
    if (!isNote) return;
    e.cancelBubble = true;
    const stage = e.target.getStage();
    const pos   = stage?.getRelativePointerPosition?.() ?? stage?.getPointerPosition();
    if (!pos) return;
    const cr    = stage?.container().getBoundingClientRect();
    noteStagePos.current = pos;
    setNoteInputPos({
      x: (cr?.left ?? 0) + pos.x,
      y: (cr?.top  ?? 0) + pos.y - 14,
    });
  }, [isNote]);

  // ── Commit pending dim label ───────────────────────────────────────────────
  const commitPendingDim = useCallback((label) => {
    if (!pendingDim) return;
    const el = { ...pendingDim, label };
    setPendingDim(null);
    setPendingLabelPos(null);
    onElementAdd?.(el);
  }, [pendingDim, onElementAdd]);

  const cancelPendingDim = useCallback(() => {
    setPendingDim(null);
    setPendingLabelPos(null);
  }, []);

  // ── Commit pending note text ───────────────────────────────────────────────
  const commitNote = useCallback((text) => {
    setNoteInputPos(null);
    if (!text) return;
    const pos = noteStagePos.current;
    onElementAdd?.({
      id:   uid(),
      type: 'note',
      x:    pos?.x ?? 0,
      y:    pos?.y ?? 0,
      text,
    });
  }, [onElementAdd]);

  const cancelNote = useCallback(() => setNoteInputPos(null), []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Group>
      {/* ── Transparent overlay to capture stage events ──
           Utilise une taille généreuse pour couvrir n'importe quel niveau de zoom
           (à scale < 1 l'espace contenu est plus grand que stageWidth/stageHeight). */}
      {(isDim || isNote) && (
        <Rect
          x={-20000}
          y={-20000}
          width={40000}
          height={40000}
          fill="transparent"
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onClick={handleStageClick}
        />
      )}

      {/* ── Dim preview while drawing ── */}
      {drawing && dimStart && dimPreview && (
        <Line
          points={[dimStart.x, dimStart.y, dimPreview.x, dimPreview.y]}
          stroke={DIM_STROKE}
          strokeWidth={1.5}
          dash={[6, 4]}
          opacity={0.7}
          listening={false}
        />
      )}

      {/* ── Existing dim elements ── */}
      {elements
        .filter((el) => el.type === 'dim')
        .map((el) => (
          <DimElement
            key={el.id}
            el={el}
            isErase={isErase}
            onUpdate={onElementUpdate}
            onRemove={onElementRemove}
            stageRef={stageRef}
          />
        ))}

      {/* ── Existing note elements ── */}
      {elements
        .filter((el) => el.type === 'note')
        .map((el) => (
          <NoteElement
            key={el.id}
            el={el}
            isErase={isErase}
            onUpdate={onElementUpdate}
            onRemove={onElementRemove}
            stageRef={stageRef}
          />
        ))}

      {/* ── Pending dim label input ── */}
      {pendingDim && pendingLabelPos && (
        <OverlayInput
          x={pendingLabelPos.x}
          y={pendingLabelPos.y}
          value=""
          placeholder="valeur"
          onCommit={commitPendingDim}
          onCancel={cancelPendingDim}
        />
      )}

      {/* ── Note text input ── */}
      {noteInputPos && (
        <OverlayInput
          x={noteInputPos.x}
          y={noteInputPos.y}
          value=""
          placeholder="note…"
          onCommit={commitNote}
          onCancel={cancelNote}
        />
      )}
    </Group>
  );
}
