/**
 * SketchEditor.js — Éditeur de croquis annoté
 *
 * Props :
 *   image (ou scanImage)  {string}  base64 ou URL de l'image source
 *   scanResult            {object}  résultat du premier scan Claude
 *   onExport              {fn}      (pngBase64, elements[]) => void — appelé après export PNG
 *   onCancel              {fn}      ferme l'éditeur
 *
 * NOTE : Ce composant N'inclut plus ClaudeRefinement en interne.
 *        C'est ScanWithEditor qui orchestre la relance Claude.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

const TOOLS = [
  { id: 'dim',    icon: '⇔',  label: 'Cote',    color: '#22d3ee' },
  { id: 'note',   icon: '💬', label: 'Note',    color: '#86efac' },
  { id: 'pencil', icon: '✏️', label: 'Crayon',  color: '#fb923c' },
  { id: 'erase',  icon: '🧹', label: 'Effacer', color: '#f87171' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function SketchEditor({ image, scanImage, scanResult, onExport, onCancel }) {
  // Accepte indifféremment image= ou scanImage= pour robustesse
  const imgSrc = image || scanImage || null;

  const svgRef      = useRef(null);
  const imgRef      = useRef(null);
  const [tool, setTool]             = useState('dim');
  const [elements,  setElements]    = useState([]);
  const [drawing,   setDrawing]     = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editText,  setEditText]    = useState('');
  const [imgSize,   setImgSize]     = useState({ w: 800, h: 600 });
  const [imgLoaded, setImgLoaded]   = useState(false);

  // Calcule la taille du SVG selon l'image source
  useEffect(() => {
    if (!imgSrc) return;
    const img = new window.Image();
    img.onload = () => {
      const maxW = Math.min(img.naturalWidth,  1200);
      const maxH = Math.min(img.naturalHeight, 900);
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      setImgSize({
        w: Math.round(img.naturalWidth  * ratio),
        h: Math.round(img.naturalHeight * ratio),
      });
      setImgLoaded(true);
    };
    img.onerror = () => {
      // Image non chargeable → taille fixe par défaut
      setImgSize({ w: 800, h: 600 });
      setImgLoaded(true);
    };
    img.src = imgSrc;
  }, [imgSrc]);

  // Coordonnées SVG depuis événement souris/touch
  const getSVGCoords = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect   = svg.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top)  * scaleY),
    };
  }, [imgSize]);

  // ─ POINTER DOWN
  const handlePointerDown = useCallback((e) => {
    if (tool === 'erase') return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (tool === 'dim') {
      setDrawing({ id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' });
    } else if (tool === 'note') {
      const id = uid();
      setElements(els => [...els, { id, type: 'note', x, y, text: 'Note' }]);
      setEditingId(id);
      setEditText('Note');
    } else if (tool === 'pencil') {
      setDrawing({ id: uid(), type: 'pencil', points: [[x, y]] });
    }
  }, [tool, getSVGCoords]);

  // ─ POINTER MOVE
  const handlePointerMove = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (drawing.type === 'dim') {
      setDrawing(d => ({ ...d, x2: x, y2: y }));
    } else if (drawing.type === 'pencil') {
      setDrawing(d => ({ ...d, points: [...d.points, [x, y]] }));
    }
  }, [drawing, getSVGCoords]);

  // ─ POINTER UP
  const handlePointerUp = useCallback(() => {
    if (!drawing) return;
    if (drawing.type === 'dim') {
      const dx = drawing.x2 - drawing.x1;
      const dy = drawing.y2 - drawing.y1;
      if (Math.sqrt(dx * dx + dy * dy) < 10) { setDrawing(null); return; }
      const id = drawing.id;
      setElements(els => [...els, { ...drawing, label: '' }]);
      setEditingId(id);
      setEditText('');
    } else if (drawing.type === 'pencil') {
      if (drawing.points.length > 2) setElements(els => [...els, drawing]);
    }
    setDrawing(null);
  }, [drawing]);

  const confirmLabel = () => {
    setElements(els => els.map(el =>
      el.id === editingId ? { ...el, label: editText, text: editText } : el
    ));
    setEditingId(null);
    setEditText('');
  };

  const eraseElement = (id) => {
    if (tool !== 'erase') return;
    setElements(els => els.filter(el => el.id !== id));
  };

  const clearAll = () => setElements([]);

  // ─ EXPORT PNG → appelle onExport(png, elements)
  const handleExport = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr  = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url     = URL.createObjectURL(svgBlob);
    const canvas  = document.createElement('canvas');
    canvas.width  = imgSize.w;
    canvas.height = imgSize.h;
    const ctx     = canvas.getContext('2d');
    const svgImg  = new window.Image();
    svgImg.onload = () => {
      ctx.drawImage(svgImg, 0, 0, imgSize.w, imgSize.h);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL('image/png');
      if (onExport) onExport(png, elements);
    };
    svgImg.src = url;
  }, [imgSize, elements, onExport]);

  // ─ RENDU ÉLÉMENT SVG
  const renderElement = (el) => {
    switch (el.type) {
      case 'dim': {
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
        const perp = len > 0 ? [-dy / len * 12, dx / len * 12] : [0, -12];
        return (
          <g key={el.id} onClick={() => eraseElement(el.id)}
            style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }}>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
              stroke="#22d3ee" strokeWidth="2"
              markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
            <line x1={el.x1} y1={el.y1} x2={el.x1 + perp[0]} y2={el.y1 + perp[1]}
              stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 2" />
            <line x1={el.x2} y1={el.y2} x2={el.x2 + perp[0]} y2={el.y2 + perp[1]}
              stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 2" />
            {el.label && (
              <>
                <rect x={mx - el.label.length * 4 - 4} y={my - 11}
                  width={el.label.length * 8 + 8} height={16}
                  rx="3" fill="#0f172a" fillOpacity="0.85" />
                <text x={mx} y={my + 3} textAnchor="middle"
                  fontSize="12" fontFamily="monospace" fontWeight="bold" fill="#22d3ee">
                  {el.label}
                </text>
              </>
            )}
          </g>
        );
      }
      case 'note': {
        const txt = el.text || 'Note';
        const w = Math.max(60, txt.length * 7 + 16);
        return (
          <g key={el.id} onClick={() => eraseElement(el.id)}
            style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }}>
            <rect x={el.x} y={el.y - 14} width={w} height={20}
              rx="4" fill="#14532d" stroke="#86efac" strokeWidth="1.5" fillOpacity="0.9" />
            <text x={el.x + 8} y={el.y + 2}
              fontSize="12" fontFamily="sans-serif" fill="#86efac">{txt}</text>
          </g>
        );
      }
      case 'pencil': {
        const d = el.points.map((p, i) =>
          `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`
        ).join(' ');
        return (
          <path key={el.id} d={d} fill="none" stroke="#fb923c"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            onClick={() => eraseElement(el.id)}
            style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }} />
        );
      }
      default: return null;
    }
  };

  const renderDrawing = () => {
    if (!drawing) return null;
    if (drawing.type === 'dim') {
      return (
        <line x1={drawing.x1} y1={drawing.y1} x2={drawing.x2} y2={drawing.y2}
          stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 3"
          markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
      );
    }
    if (drawing.type === 'pencil') {
      const d = drawing.points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`
      ).join(' ');
      return <path d={d} fill="none" stroke="#fb923c" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0f1620] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            ✕
          </button>
          <div>
            <h2 className="text-white font-bold text-sm">✏️ Éditeur de croquis</h2>
            <p className="text-[11px] text-slate-500">Annotez puis relancez Claude pour affiner le scan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearAll}
            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/40 rounded-lg transition-all">
            🗑 Tout effacer
          </button>
          {/* Toujours actif : on peut relancer même sans annotation */}
          <button
            onClick={handleExport}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
          >
            🚀 Relancer Claude
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a] border-b border-white/5 flex-shrink-0 overflow-x-auto">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            className={
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex-shrink-0 ' +
              (tool === t.id
                ? 'bg-white/10 border-white/30 text-white scale-105'
                : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5')
            }
            style={tool === t.id ? { borderColor: t.color + '80', color: t.color } : {}}>
            <span className="text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 flex-shrink-0">
          <span className="hidden md:inline">💡</span>
          <span className="hidden md:inline">
            {tool === 'dim'    && 'Cliquez-glissez pour tracer une cote'}
            {tool === 'note'   && 'Cliquez pour placer une note'}
            {tool === 'pencil' && 'Dessinez librement sur le croquis'}
            {tool === 'erase'  && 'Cliquez sur un élément pour le supprimer'}
          </span>
        </div>
      </div>

      {/* CANVAS */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#060b14]">
        <div className="relative" style={{ touchAction: 'none' }}>

          {/* Message si pas d'image */}
          {!imgSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center z-10"
              style={{ width: imgSize.w, height: imgSize.h }}>
              <div className="text-4xl">🖼️</div>
              <p className="text-slate-400 text-sm font-bold">Aucune image reçue</p>
              <p className="text-slate-600 text-xs max-w-xs">
                L'image du scan n'a pas été transmise à l'éditeur.<br/>
                Retournez au scan et réessayez.
              </p>
              <button onClick={onCancel}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white font-bold transition-colors">
                ← Retour au scan
              </button>
            </div>
          )}

          <svg
            ref={svgRef}
            width={imgSize.w}
            height={imgSize.h}
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            style={{
              display: 'block',
              maxWidth: '100%',
              cursor: tool === 'erase' ? 'crosshair' : tool === 'note' ? 'cell' : 'crosshair',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: imgSrc ? 'transparent' : '#0a0a14',
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <defs>
              <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#22d3ee" />
              </marker>
              <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
                <path d="M0,0 L0,6 L8,3 z" fill="#22d3ee" />
              </marker>
            </defs>

            {/* Image de fond du croquis */}
            {imgSrc && (
              <image
                ref={imgRef}
                href={imgSrc}
                x="0" y="0"
                width={imgSize.w}
                height={imgSize.h}
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* Grille légère si pas d'image */}
            {!imgSrc && (
              <>
                <defs>
                  <pattern id="grid-bg" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width={imgSize.w} height={imgSize.h} fill="url(#grid-bg)" />
                <text x={imgSize.w/2} y={imgSize.h/2 - 20} textAnchor="middle"
                  fontSize="14" fill="rgba(255,255,255,0.15)" fontFamily="sans-serif">
                  Image du croquis non disponible
                </text>
              </>
            )}

            {/* Calque annotations */}
            {elements.map(renderElement)}
            {renderDrawing()}
          </svg>

          {/* Input label flottant pour cotes/notes */}
          {editingId && (() => {
            const el  = elements.find(e => e.id === editingId) ||
                        (drawing?.id === editingId ? drawing : null);
            const rect = svgRef.current?.getBoundingClientRect();
            if (!el || !rect) return null;
            const scaleX = rect.width  / imgSize.w;
            const scaleY = rect.height / imgSize.h;
            const cx = el.type === 'note' ? el.x : (el.x1 + el.x2) / 2;
            const cy = el.type === 'note' ? el.y : (el.y1 + el.y2) / 2;
            return (
              <div style={{
                position: 'absolute',
                left: cx * scaleX - 70,
                top:  cy * scaleY - 42,
                zIndex: 100,
              }}>
                <div className="bg-[#0f1620] border border-cyan-500/50 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5">
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  confirmLabel();
                      if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                    }}
                    placeholder={el.type === 'dim' ? 'Ex: 120 cm' : 'Texte...'}
                    className="w-36 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-1">
                    <button onClick={confirmLabel}
                      className="flex-1 py-1 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors">
                      ✓ OK
                    </button>
                    <button onClick={() => { setEditingId(null); setEditText(''); }}
                      className="flex-1 py-1 text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white rounded-md transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#0a0f1a] border-t border-white/5 flex-shrink-0 text-[11px] font-mono">
        <span className="text-slate-500">{elements.length} annotation{elements.length !== 1 ? 's' : ''}</span>
        <span className="text-cyan-500">{elements.filter(e => e.type === 'dim').length} cote{elements.filter(e => e.type === 'dim').length !== 1 ? 's' : ''}</span>
        <span className="text-green-500">{elements.filter(e => e.type === 'note').length} note{elements.filter(e => e.type === 'note').length !== 1 ? 's' : ''}</span>
        <span className="text-orange-500">{elements.filter(e => e.type === 'pencil').length} trait{elements.filter(e => e.type === 'pencil').length !== 1 ? 's' : ''}</span>
        {!imgSrc && (
          <span className="text-red-400 font-bold">⚠️ Image manquante — vérifiez Scanner.js → scanImage prop</span>
        )}
        {imgSrc && elements.length === 0 && (
          <span className="text-slate-600 italic">Ajoutez des cotes ou notes, ou relancez directement</span>
        )}
      </div>
    </div>
  );
}
