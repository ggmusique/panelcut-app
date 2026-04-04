import { useRef, useState, useCallback, useEffect } from 'react';

// Définition des outils et des éléments sémantiques
const TOOLS = [
  { id: 'dim',    icon: '⇔',  label: 'Cote',    color: '#22d3ee' },
  { id: 'note',   icon: '💬', label: 'Note',    color: '#86efac' },
  { id: 'pencil', icon: '✏️', label: 'Crayon',  color: '#fb923c' },
  { id: 'erase',  icon: '🧹', label: 'Effacer', color: '#f87171' },
];

const SMART_ELEMENTS = [
  { type: 'drawer', label: 'Tiroir', color: '#a855f7', defaultW: 40, defaultH: 20 },
  { type: 'door',   label: 'Porte',  color: '#3b82f6', defaultW: 30, defaultH: 80 },
  { type: 'shelf',  label: 'Tablette', color: '#eab308', defaultW: 50, defaultH: 2 },
  { type: 'block',  label: 'Bloc',   color: '#ec4899', defaultW: 60, defaultH: 60 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function SketchEditor({ image, scanImage, initialResult, apiKey, onComplete, onCancel }) {
  const imgSrc = image || scanImage || null;

  const svgRef = useRef(null);
  const imgRef = useRef(null);

  // États
  const [tool, setTool] = useState('dim'); // Outil actif
  const [elements, setElements] = useState([]); // Éléments posés
  const [drawing, setDrawing] = useState(null); // Élément en cours de dessin
  const [resizingId, setResizingId] = useState(null); // ID de l'élément en redimensionnement
  const [editingId, setEditingId] = useState(null); // Édition de texte
  const [editText, setEditText] = useState('');
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chargement de l'image
  useEffect(() => {
    if (!imgSrc) return;
    const img = new window.Image();
    img.onload = () => {
      const maxW = Math.min(img.naturalWidth, 1200);
      const maxH = Math.min(img.naturalHeight, 900);
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      setImgSize({
        w: Math.round(img.naturalWidth * ratio),
        h: Math.round(img.naturalHeight * ratio),
      });
      setImgLoaded(true);
    };
    img.onerror = () => { setImgSize({ w: 800, h: 600 }); setImgLoaded(true); };
    img.src = imgSrc;
  }, [imgSrc]);

  // Coordonnées souris/touch dans le SVG
  const getSVGCoords = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    };
  }, [imgSize]);

  // Gestion début interaction (Click/Touch)
  const handlePointerDown = useCallback((e) => {
    if (tool === 'erase') return;
    
    // Si on clique sur une poignée de redimensionnement, on ne fait rien ici (géré par le composant enfant)
    if (e.target.getAttribute('data-resize-handle')) return;

    e.preventDefault();
    const { x, y } = getSVGCoords(e);

    // 1. Outils de dessin classiques
    if (['dim', 'pencil'].includes(tool)) {
      if (tool === 'dim') {
        setDrawing({ id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' });
      } else if (tool === 'pencil') {
        setDrawing({ id: uid(), type: 'pencil', points: [[x, y]] });
      }
    } 
    // 2. Outils Intelligents (Création immédiate avec taille par défaut)
    else if (SMART_ELEMENTS.some(el => el.type === tool)) {
      const smartDef = SMART_ELEMENTS.find(el => el.type === tool);
      const newEl = {
        id: uid(),
        type: 'smart',
        smartType: smartDef.type,
        label: smartDef.label,
        color: smartDef.color,
        x: x - smartDef.defaultW / 2, // Centrer sur le clic
        y: y - smartDef.defaultH / 2,
        w: smartDef.defaultW,
        h: smartDef.defaultH,
      };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id); // Passer immédiatement en mode redimensionnement
    }
    // 3. Note texte
    else if (tool === 'note') {
      const id = uid();
      setElements(els => [...els, { id, type: 'note', x, y, text: 'Note' }]);
      setEditingId(id);
      setEditText('Note');
    }
  }, [tool, getSVGCoords]);

  // Gestion mouvement (Drag/Resize)
  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getSVGCoords(e);

    // Redimensionnement d'un élément intelligent
    if (resizingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== resizingId) return el;
        const newW = Math.max(10, x - el.x);
        const newH = Math.max(10, y - el.y);
        return { ...el, w: newW, h: newH };
      }));
      return;
    }

    // Dessin classique (Cote ou Crayon)
    if (drawing) {
      if (drawing.type === 'dim') {
        setDrawing(d => ({ ...d, x2: x, y2: y }));
      } else if (drawing.type === 'pencil') {
        setDrawing(d => ({ ...d, points: [...d.points, [x, y]] }));
      }
    }
  }, [drawing, resizingId, getSVGCoords]);

  // Fin interaction
  const handlePointerUp = useCallback(() => {
    if (drawing) {
      if (drawing.type === 'dim') {
        const dx = drawing.x2 - drawing.x1, dy = drawing.y2 - drawing.y1;
        if (Math.sqrt(dx * dx + dy * dy) < 10) { setDrawing(null); return; }
        setElements(els => [...els, { ...drawing, label: '' }]);
        setEditingId(drawing.id);
        setEditText('');
      } else if (drawing.type === 'pencil') {
        if (drawing.points.length > 2) setElements(els => [...els, drawing]);
      }
      setDrawing(null);
    }
    setResizingId(null);
  }, [drawing]);

  // Confirmation texte
  const confirmLabel = () => {
    setElements(els => els.map(el =>
      el.id === editingId ? { ...el, label: editText, text: editText } : el
    ));
    setEditingId(null);
    setEditText('');
  };

  // Suppression
  const eraseElement = (id) => {
    if (tool !== 'erase') return;
    setElements(els => els.filter(el => el.id !== id));
  };

  const clearAll = () => setElements([]);

  // Génération du contexte texte pour l'IA basé sur les annotations
  const generateSmartContext = () => {
    const smartItems = elements.filter(el => el.type === 'smart');
    if (smartItems.length === 0) return "";

    let context = "ANNOTATIONS UTILISATEUR DÉTECTÉES SUR LE PLAN :\n";
    smartItems.forEach((item, idx) => {
      // Estimation grossière de l'échelle si on a des cotes, sinon on donne juste les proportions relatives
      context += `- Zone ${idx + 1}: ${item.label} (Position: x=${Math.round(item.x)}, y=${Math.round(item.y)}, Taille relative: ${Math.round(item.w)}x${Math.round(item.h)})\n`;
    });
    context += "Utilise ces zones pour identifier précisément le nombre et l'emplacement des tiroirs/portes/tablettes.";
    return context;
  };

  // RELANCER CLAUDE
  const handleRelancer = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    setLoading(true);
    setError(null);

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const canvas = document.createElement('canvas');
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = async () => {
      ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);
      URL.revokeObjectURL(url);
      const pngDataUrl = canvas.toDataURL('image/png');
      const base64 = pngDataUrl.split(',')[1];

      // Ajout du contexte généré au prompt
      const smartContext = generateSmartContext();
      const basePrompt = `Tu es un expert menuisier... (même prompt que avant)`; 
      // NOTE: Pour faire simple ici, on envoie l'image. Le serveur devrait idéalement recevoir le contexte texte séparément,
      // mais comme on ne modifie pas le serveur ici, l'IA verra les rectangles colorés sur l'image.
      // Les rectangles sont assez explicites visuellement pour qu'elle comprenne "C'est un tiroir".

      try {
        const res = await fetch('https://panelcut-server.vercel.app/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Erreur serveur (${res.status})`);
        }

        const data = await res.json();
        setLoading(false);
        if (onComplete) onComplete(data);

      } catch (err) {
        console.error('[SketchEditor] Relance échouée:', err);
        setError(err.message || 'Erreur de connexion');
        setLoading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Erreur export PNG');
      setLoading(false);
    };
    img.src = url;
  }, [imgSize, onComplete, elements]);

  // Rendu des éléments
  const renderElement = (el) => {
    // Mode Effacement : curseur main
    const isErasing = tool === 'erase';
    const opacity = isErasing ? 0.6 : 1;
    const cursor = isErasing ? 'pointer' : 'default';

    if (el.type === 'smart') {
      return (
        <g key={el.id} style={{ cursor, opacity }} onClick={() => eraseElement(el.id)}>
          {/* Rectangle de forme */}
          <rect
            x={el.x} y={el.y} width={el.w} height={el.h}
            fill={el.color} fillOpacity="0.25"
            stroke={el.color} strokeWidth="2" strokeDasharray="4 2"
            rx="4"
          />
          {/* Texte centré */}
          <text
            x={el.x + el.w / 2} y={el.y + el.h / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill={el.color} fontSize="14" fontWeight="bold"
            style={{ pointerEvents: 'none', textShadow: '0px 0px 3px rgba(0,0,0,0.8)' }}
          >
            {el.label}
          </text>
          
          {/* Poignée de redimensionnement (seulement si on n'est pas en mode effacer et si c'est l'élément actif ou survolé - simplifié ici: toujours visible si pas erase) */}
          {!isErasing && (
             <rect
               x={el.x + el.w - 10} y={el.y + el.h - 10} width="20" height="20"
               fill="#ef4444" stroke="white" strokeWidth="2"
               data-resize-handle="true"
               style={{ cursor: 'nwse-resize' }}
               onMouseDown={(e) => {
                 e.stopPropagation(); // Empêcher le drag du groupe
                 setResizingId(el.id);
               }}
             />
          )}
        </g>
      );
    }

    // Rendu des autres outils (Cote, Note, Crayon) - Inchangé
    if (el.type === 'dim') {
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2;
      const perp = len > 0 ? [-dy / len * 12, dx / len * 12] : [0, -12];
      return (
        <g key={el.id} onClick={() => eraseElement(el.id)} style={{ cursor }}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
          <line x1={el.x1} y1={el.y1} x2={el.x1 + perp[0]} y2={el.y1 + perp[1]} stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={el.x2} y1={el.y2} x2={el.x2 + perp[0]} y2={el.y2 + perp[1]} stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 2" />
          {el.label && (
            <>
              <rect x={mx - el.label.length * 4 - 4} y={my - 11} width={el.label.length * 8 + 8} height={16} rx="3" fill="#0f172a" fillOpacity="0.85" />
              <text x={mx} y={my + 3} textAnchor="middle" fontSize="12" fontFamily="monospace" fontWeight="bold" fill="#22d3ee">{el.label}</text>
            </>
          )}
        </g>
      );
    }
    if (el.type === 'note') {
      const txt = el.text || 'Note';
      const w = Math.max(60, txt.length * 7 + 16);
      return (
        <g key={el.id} onClick={() => eraseElement(el.id)} style={{ cursor }}>
          <rect x={el.x} y={el.y - 14} width={w} height={20} rx="4" fill="#14532d" stroke="#86efac" strokeWidth="1.5" fillOpacity="0.9" />
          <text x={el.x + 8} y={el.y + 2} fontSize="12" fontFamily="sans-serif" fill="#86efac">{txt}</text>
        </g>
      );
    }
    if (el.type === 'pencil') {
      const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
      return <path key={el.id} d={d} fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" onClick={() => eraseElement(el.id)} style={{ cursor }} />;
    }
    return null;
  };

  // Rendu de l'élément en cours de dessin
  const renderDrawing = () => {
    if (!drawing) return null;
    if (drawing.type === 'dim') {
      return <line x1={drawing.x1} y1={drawing.y1} x2={drawing.x2} y2={drawing.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 3" markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />;
    }
    if (drawing.type === 'pencil') {
      const d = drawing.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
      return <path d={d} fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0f1620] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">✕</button>
          <div>
            <h2 className="text-white font-bold text-sm">✏️ Éditeur de croquis</h2>
            <p className="text-[11px] text-slate-500">Dessinez des formes (tiroirs, portes) et étirez-les pour ajuster la taille.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400 font-bold max-w-xs truncate">⚠️ {error}</span>}
          <button onClick={clearAll} className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/40 rounded-lg transition-all">🗑 Tout effacer</button>
          <button onClick={loading ? undefined : handleRelancer} disabled={loading} className={'px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2 ' + (loading ? 'bg-orange-800 text-orange-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer')}>
            {loading ? (<><span className="w-3 h-3 border-2 border-orange-300/40 border-t-orange-300 rounded-full animate-spin inline-block" /> Analyse...</>) : (<><>🚀 Relancer Claude</></>)}
          </button>
        </div>
      </div>

      {/* TOOLBAR PRINCIPALE */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a] border-b border-white/5 flex-shrink-0 overflow-x-auto">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex-shrink-0 ' + (tool === t.id ? 'bg-white/10 border-white/30 text-white scale-105' : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5')} style={tool === t.id ? { borderColor: t.color + '80', color: t.color } : {}}>
            <span className="text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="w-px h-6 bg-white/10 mx-2"></div>
        {/* OUTILS INTELLIGENTS */}
        {SMART_ELEMENTS.map(t => (
          <button key={t.type} onClick={() => setTool(t.type)} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex-shrink-0 ' + (tool === t.type ? 'bg-white/10 border-white/30 text-white scale-105 shadow-lg shadow-' + t.color + '/20' : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5')} style={tool === t.type ? { borderColor: t.color, backgroundColor: t.color + '20', color: t.color } : {}}>
            <span className="text-base">▣</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* CANVAS */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#060b14]" onMouseUp={handlePointerUp} onTouchEnd={handlePointerUp}>
        <div className="relative" style={{ touchAction: 'none' }}>
          {!imgSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center z-10" style={{ width: imgSize.w, height: imgSize.h }}>
              <div className="text-4xl">🖼️</div>
              <p className="text-slate-400 text-sm font-bold">Aucune image reçue</p>
              <button onClick={onCancel} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white font-bold transition-colors">← Retour</button>
            </div>
          )}
          <svg ref={svgRef} width={imgSize.w} height={imgSize.h} viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} style={{ display: 'block', maxWidth: '100%', cursor: tool === 'erase' ? 'crosshair' : (SMART_ELEMENTS.some(t=>t.type===tool) ? 'crosshair' : 'crosshair'), borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: imgSrc ? 'transparent' : '#0a0a14' }} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}>
            <defs>
              <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22d3ee" /></marker>
              <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L8,3 z" fill="#22d3ee" /></marker>
            </defs>
            {imgSrc && <image ref={imgRef} href={imgSrc} x="0" y="0" width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet" />}
            {!imgSrc && <rect width={imgSize.w} height={imgSize.h} fill="#0a0a14" />}
            {elements.map(renderElement)}
            {renderDrawing()}
          </svg>

          {/* Édition de texte (Cotes/Notes) */}
          {editingId && (() => {
            const el = elements.find(e => e.id === editingId) || (drawing?.id === editingId ? drawing : null);
            const rect = svgRef.current?.getBoundingClientRect();
            if (!el || !rect) return null;
            const scaleX = rect.width / imgSize.w;
            const scaleY = rect.height / imgSize.h;
            const cx = el.type === 'note' ? el.x : (el.x1 + el.x2) / 2;
            const cy = el.type === 'note' ? el.y : (el.y1 + el.y2) / 2;
            return (
              <div style={{ position: 'absolute', left: cx * scaleX - 70, top: cy * scaleY - 42, zIndex: 100 }}>
                <div className="bg-[#0f1620] border border-cyan-500/50 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5">
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmLabel(); if (e.key === 'Escape') { setEditingId(null); setEditText(''); } }} placeholder="Texte..." className="w-36 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500" />
                  <div className="flex gap-1">
                    <button onClick={confirmLabel} className="flex-1 py-1 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors">✓</button>
                    <button onClick={() => { setEditingId(null); setEditText(''); }} className="flex-1 py-1 text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white rounded-md transition-colors">✕</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      
      {/* STATUS BAR */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#0a0f1a] border-t border-white/5 flex-shrink-0 text-[11px] font-mono">
        <span className="text-slate-500">{elements.length} éléments</span>
        <span className="text-purple-400">{elements.filter(e => e.type === 'smart').length} formes intelligentes</span>
        {!imgSrc && <span className="text-red-400 font-bold">⚠️ Image manquante</span>}
        {loading && <span className="text-orange-400 animate-pulse">⏳ Analyse...</span>}
      </div>
    </div>
  );
}
