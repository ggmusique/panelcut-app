/**
 * SketchEditor.js — Éditeur SVG interactif pour corriger les croquis scannés
 *
 * Outils :
 *  ✏️  Stylo libre (dessin à main levée)
 *  ↔️  Cote       (ligne + flèches + texte de dimension)
 *  💬  Annotation  (bulle de texte)
 *  🗑️  Effacer tout
 *  📤  Exporter en PNG pour relance Claude
 *
 * Aucune dépendance externe — SVG + Canvas natif uniquement.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const TOOLS = {
  PEN:    'pen',
  DIM:    'dim',
  NOTE:   'note',
  SELECT: 'select',
};

const COLORS = {
  pen:  '#f97316',   // orange
  dim:  '#38bdf8',   // bleu cyan
  note: '#4ade80',   // vert
};

export default function SketchEditor({ scanImage, scanResult, onExport, onCancel }) {
  const svgRef     = useRef(null);
  const canvasRef  = useRef(null);
  const [tool,     setTool]     = useState(TOOLS.DIM);
  const [elements, setElements] = useState([]);
  const [drawing,  setDrawing]  = useState(null); // élément en cours de dessin
  const [penPath,  setPenPath]  = useState(null);
  const [imgSize,  setImgSize]  = useState({ w: 800, h: 600 });
  const [noteEdit, setNoteEdit] = useState(null); // { x, y } pour saisie texte
  const [noteText, setNoteText] = useState('');
  const inputRef   = useRef(null);

  const SVG_W = imgSize.w;
  const SVG_H = imgSize.h;

  // Charger les dimensions de l'image de fond
  useEffect(() => {
    if (!scanImage) return;
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(img.width,  900);
      const maxH = Math.min(img.height, 700);
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      setImgSize({ w: Math.round(img.width * ratio), h: Math.round(img.height * ratio) });
    };
    img.src = scanImage;
  }, [scanImage]);

  useEffect(() => {
    if (noteEdit && inputRef.current) inputRef.current.focus();
  }, [noteEdit]);

  // ─── Coords relatives au SVG ─────────────────────────────────────────────
  const getSVGPoint = useCallback((e) => {
    const svg  = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }, [SVG_W, SVG_H]);

  // ─── Handlers souris / touch ──────────────────────────────────────────────
  const onDown = useCallback((e) => {
    e.preventDefault();
    const p = getSVGPoint(e);

    if (tool === TOOLS.PEN) {
      setPenPath({ points: [p], color: COLORS.pen });
      return;
    }
    if (tool === TOOLS.DIM) {
      setDrawing({ type: 'dim', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (tool === TOOLS.NOTE) {
      setNoteEdit({ x: p.x, y: p.y });
      setNoteText('');
      return;
    }
  }, [tool, getSVGPoint]);

  const onMove = useCallback((e) => {
    e.preventDefault();
    const p = getSVGPoint(e);

    if (tool === TOOLS.PEN && penPath) {
      setPenPath(prev => ({ ...prev, points: [...prev.points, p] }));
      return;
    }
    if (tool === TOOLS.DIM && drawing) {
      setDrawing(prev => ({ ...prev, x2: p.x, y2: p.y }));
      return;
    }
  }, [tool, penPath, drawing, getSVGPoint]);

  const onUp = useCallback((e) => {
    if (tool === TOOLS.PEN && penPath && penPath.points.length > 1) {
      setElements(prev => [...prev, { type: 'pen', ...penPath, id: Date.now() }]);
      setPenPath(null);
      return;
    }
    if (tool === TOOLS.DIM && drawing) {
      const dx = drawing.x2 - drawing.x1;
      const dy = drawing.y2 - drawing.y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 15) {
        const label = prompt('Dimension ? (ex: 120 cm, H=85cm)') || '';
        setElements(prev => [...prev, { ...drawing, label, id: Date.now() }]);
      }
      setDrawing(null);
      return;
    }
  }, [tool, penPath, drawing]);

  const confirmNote = useCallback(() => {
    if (noteEdit && noteText.trim()) {
      setElements(prev => [...prev, {
        type: 'note', x: noteEdit.x, y: noteEdit.y,
        text: noteText.trim(), id: Date.now()
      }]);
    }
    setNoteEdit(null);
    setNoteText('');
  }, [noteEdit, noteText]);

  const deleteEl = (id) => setElements(prev => prev.filter(e => e.id !== id));
  const clearAll = () => { setElements([]); setPenPath(null); setDrawing(null); };

  // ─── Export PNG aplati ────────────────────────────────────────────────────
  const exportPNG = useCallback(async () => {
    const svg    = svgRef.current;
    if (!svg) return;
    const serial = new XMLSerializer();
    const svgStr = serial.serializeToString(svg);
    const blob   = new Blob([svgStr], { type: 'image/svg+xml' });
    const url    = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas  = canvasRef.current;
      canvas.width  = SVG_W;
      canvas.height = SVG_H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL('image/png');
      onExport(png, elements);
    };
    img.src = url;
  }, [SVG_W, SVG_H, elements, onExport]);

  // ─── SVG helpers ──────────────────────────────────────────────────────────
  const pointsToPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  function DimArrow({ x1, y1, x2, y2, label, color = COLORS.dim, onDelete, id }) {
    const dx   = x2 - x1, dy = y2 - y1;
    const len  = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const ux   = dx / len, uy = dy / len;
    const mx   = (x1 + x2) / 2, my = (y1 + y2) / 2;
    // Flèches
    const aLen = 10;
    const a1x  = x1 + ux * aLen - uy * 5, a1y = y1 + uy * aLen + ux * 5;
    const a1x2 = x1 + ux * aLen + uy * 5, a1y2 = y1 + uy * aLen - ux * 5;
    const a2x  = x2 - ux * aLen - uy * 5, a2y = y2 - uy * aLen + ux * 5;
    const a2x2 = x2 - ux * aLen + uy * 5, a2y2 = y2 - uy * aLen - ux * 5;
    // Angle texte
    let angle  = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    // Offset texte perpendiculaire
    const tox  = -uy * 14, toy = ux * 14;

    return (
      <g style={{ cursor: 'pointer' }} onClick={() => onDelete && onDelete(id)}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5"
          strokeDasharray="none" markerStart={`url(#arrow-${color.slice(1)})`}
          markerEnd={`url(#arrow-${color.slice(1)})`} />
        {/* Flèche manuelle */}
        <polyline points={`${a1x},${a1y} ${x1},${y1} ${a1x2},${a1y2}`}
          fill="none" stroke={color} strokeWidth="1.5" />
        <polyline points={`${a2x},${a2y} ${x2},${y2} ${a2x2},${a2y2}`}
          fill="none" stroke={color} strokeWidth="1.5" />
        {label && (
          <text
            x={mx + tox} y={my + toy}
            fill={color} fontSize="13" fontWeight="bold" fontFamily="monospace"
            textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(${angle}, ${mx + tox}, ${my + toy})`}
            style={{ paintOrder: 'stroke', strokeWidth: '3px', stroke: '#00000088' }}
          >
            {label}
          </text>
        )}
        {/* Zone de clic pour supprimer */}
        <circle cx={mx} cy={my} r="8" fill="transparent" />
      </g>
    );
  }

  function NoteEl({ x, y, text, onDelete, id }) {
    const lines  = text.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length));
    const bw     = Math.max(80, maxLen * 7.5 + 16);
    const bh     = lines.length * 17 + 12;
    return (
      <g style={{ cursor: 'pointer' }} onClick={() => onDelete && onDelete(id)}>
        <rect x={x} y={y - bh - 4} width={bw} height={bh}
          rx="6" fill="#14532d" stroke={COLORS.note} strokeWidth="1.2" opacity="0.95" />
        <polygon points={`${x + 16},${y - 4} ${x + 8},${y + 4} ${x + 24},${y - 4}`}
          fill="#14532d" stroke={COLORS.note} strokeWidth="1" />
        {lines.map((l, i) => (
          <text key={i} x={x + 8} y={y - bh + 14 + i * 17}
            fill={COLORS.note} fontSize="12" fontFamily="monospace" fontWeight="600"
            style={{ paintOrder: 'stroke', strokeWidth: '2px', stroke: '#00000066' }}
          >{l}</text>
        ))}
      </g>
    );
  }

  // ─── Indicateurs du résultat initial ─────────────────────────────────────
  const initDims = scanResult?.cabinet
    ? `${scanResult.cabinet.width}×${scanResult.cabinet.height}×${scanResult.cabinet.depth ?? '?'} cm`
    : null;

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* En-tête */}
      <div className="bg-[#0f1620] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              ✏️ Éditeur de croquis
            </h2>
            <p className="text-slate-400 text-sm">
              Ajoutez des cotes et annotations, puis relancez l'analyse IA.
            </p>
          </div>
          {initDims && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1.5">
              <p className="text-[11px] text-orange-400 font-mono font-bold">Scan initial</p>
              <p className="text-orange-300 text-sm font-bold">{initDims}</p>
            </div>
          )}
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: TOOLS.DIM,    icon: '↔️',  label: 'Cote',       hint: 'Tracer une ligne de cote' },
          { id: TOOLS.NOTE,   icon: '💬',  label: 'Annotation', hint: 'Ajouter une note texte' },
          { id: TOOLS.PEN,    icon: '✏️',  label: 'Stylo',      hint: 'Dessin libre' },
          { id: TOOLS.SELECT, icon: '👆',  label: 'Supprimer',  hint: 'Cliquer un élément pour le supprimer' },
        ].map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            title={t.hint}
            className={
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border ' +
              (tool === t.id
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10')
            }>
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={clearAll}
          className="px-3 py-2 rounded-lg text-sm font-bold bg-white/5 text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
          🗑️ <span className="hidden sm:inline">Tout effacer</span>
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 rounded-lg text-sm font-bold bg-white/5 text-slate-400 border border-white/10 hover:text-white transition-all">
          ✕ Annuler
        </button>
        <button onClick={exportPNG}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/50 shadow transition-all">
          🚀 Relancer l'IA
        </button>
      </div>

      {/* Aide outil actif */}
      <div className="text-[11px] text-slate-500 px-1">
        {tool === TOOLS.DIM    && '↔️  Cliquez-glissez pour tracer une cote, entrez la valeur dans la popup'}
        {tool === TOOLS.NOTE   && '💬  Cliquez pour placer une annotation texte'}
        {tool === TOOLS.PEN    && '✏️  Dessinez librement par-dessus le croquis'}
        {tool === TOOLS.SELECT && '👆  Cliquez sur un élément pour le supprimer'}
      </div>

      {/* Zone SVG */}
      <div
        className="relative border border-white/10 rounded-xl overflow-hidden shadow-xl"
        style={{ background: '#111827', touchAction: 'none' }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          style={{ display: 'block', cursor:
            tool === TOOLS.SELECT ? 'crosshair' :
            tool === TOOLS.PEN    ? 'crosshair' :
            tool === TOOLS.DIM    ? 'crosshair' :
            'default'
          }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        >
          {/* Image de fond */}
          {scanImage && (
            <image
              href={scanImage}
              x="0" y="0"
              width={SVG_W} height={SVG_H}
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {/* Overlay semi-transparent pour lisibilité des annotations */}
          <rect width={SVG_W} height={SVG_H} fill="rgba(0,0,0,0.18)" />

          {/* Éléments existants */}
          {elements.map(el => {
            if (el.type === 'pen') {
              return (
                <path key={el.id} d={pointsToPath(el.points)}
                  fill="none" stroke={el.color} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ cursor: tool === TOOLS.SELECT ? 'pointer' : 'inherit' }}
                  onClick={tool === TOOLS.SELECT ? () => deleteEl(el.id) : undefined}
                />
              );
            }
            if (el.type === 'dim') {
              return (
                <DimArrow key={el.id} {...el}
                  onDelete={tool === TOOLS.SELECT ? deleteEl : null} />
              );
            }
            if (el.type === 'note') {
              return (
                <NoteEl key={el.id} {...el}
                  onDelete={tool === TOOLS.SELECT ? deleteEl : null} />
              );
            }
            return null;
          })}

          {/* Élément en cours de dessin */}
          {drawing && drawing.type === 'dim' && (
            <DimArrow {...drawing} label="…" />
          )}
          {penPath && (
            <path d={pointsToPath(penPath.points)}
              fill="none" stroke={COLORS.pen} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}

          {/* Indicateur de placement d'annotation */}
          {noteEdit && (
            <>
              <circle cx={noteEdit.x} cy={noteEdit.y} r="5"
                fill={COLORS.note} opacity="0.8" />
              <text x={noteEdit.x + 10} y={noteEdit.y}
                fill={COLORS.note} fontSize="12" fontFamily="monospace">⬅ Saisie en bas</text>
            </>
          )}
        </svg>

        {/* Saisie annotation (flottante sous le canvas) */}
        {noteEdit && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#0f1620]/95 backdrop-blur border-t border-green-500/30 p-3 flex gap-2">
            <input
              ref={inputRef}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmNote(); if (e.key === 'Escape') { setNoteEdit(null); setNoteText(''); } }}
              placeholder="Ex: H=220cm, 3 tablettes, tiroirs=15cm …"
              className="flex-1 bg-white/5 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-green-400"
            />
            <button onClick={confirmNote}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold">OK</button>
            <button onClick={() => { setNoteEdit(null); setNoteText(''); }}
              className="px-3 py-2 bg-white/5 text-slate-400 rounded-lg text-sm">✕</button>
          </div>
        )}
      </div>

      {/* Canvas caché pour export PNG */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Légende */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        {[
          { color: COLORS.dim,  label: 'Cote → Claude lira la valeur exacte' },
          { color: COLORS.note, label: 'Annotation → correction libre' },
          { color: COLORS.pen,  label: 'Stylo → préciser une forme' },
          { color: '#94a3b8',   label: 'Cliquer un élément (mode 👆) pour supprimer' },
        ].map((l, i) => (
          <div key={i} className="flex items-center gap-2 bg-white/3 rounded-lg p-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            <span className="text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
