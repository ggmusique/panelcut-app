import { useRef, useState, useCallback, useEffect } from 'react';
import CabinetElevationFront from './CabinetElevationFront';
import { captureFacadeToImage } from '../utils/captureFacadeToImage';

// Outils disponibles
const TOOLS = [
  { id: 'drawer', icon: '🗄️', label: 'Tiroirs', color: '#fbbf24' }, // Amber
  { id: 'door',   icon: '🚪', label: 'Porte',   color: '#60a5fa' }, // Blue
  { id: 'shelf',  icon: '📦', label: 'Tablette',color: '#34d399' }, // Emerald
  { id: 'rod',    icon: '👔', label: 'Tringle',  color: '#f472b6' }, // Pink
  { id: 'dim',    icon: '📏', label: 'Cote',    color: '#22d3ee' }, // Cyan
  { id: 'note',   icon: '📝', label: 'Note',    color: '#fb923c' }, // Orange
  { id: 'erase',  icon: '🧹', label: 'Effacer', color: '#f87171' }, // Red
];

const LS_SKETCH_KEY = 'pc_sketch_editor';
const FACADE_CAPTURE_WIDTH = 980; // Largeur du conteneur hors-écran pour la capture SVG→PNG

const uid = () => Math.random().toString(36).slice(2, 9);
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const normalizeModulesFromResult = (result, width = 0) => {
  const cabinet = result?.cabinet || {};
  const raw = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);
  if (detailed.length > 0) {
    return detailed.map((m, i) => ({
      id: i + 1,
      width: Math.max(1, toNum(m.width ?? m.w ?? m.largeur, 1)),
      shelves: Math.max(0, parseInt(m.shelves ?? m.nb_shelves ?? 0, 10) || 0),
      drawers: Math.max(0, parseInt(m.drawers ?? m.nb_drawers ?? 0, 10) || 0),
      doors: Math.max(0, parseInt(m.doors ?? m.nb_doors ?? 0, 10) || 0),
      rod: Boolean(m.rod ?? m.tringle ?? m.hanging ?? m.penderie ?? false),
    }));
  }
  const n = Math.max(1, parseInt(cabinet.nb_dividers ?? 4, 10) + 1);
  const mw = width > 0 ? width / n : 50;
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, width: mw, shelves: 0, drawers: 0, doors: 1, rod: false
  }));
};

export default function SketchEditor({ image, scanImage, initialResult, apiKey, onComplete, onCancel }) {
  const rawImg = image || scanImage || null;
  const svgRef = useRef(null);
  const facadeContainerRef = useRef(null);
  const drag = useRef({ on: false, startX: 0, startY: 0, elStartX: 0, elStartY: 0 });

  const [facadePng, setFacadePng] = useState(null);

  // imgSrc: façade PNG en priorité, sinon photo brute du scan
  const imgSrc = facadePng || rawImg;
  const initialCab = initialResult?.cabinet || {};

  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);
  
  // Chargement de l'état persisté
  const savedState = (() => {
    try {
      const raw = localStorage.getItem(LS_SKETCH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  // États
  const [tool, setTool] = useState('drawer');
  const [baseView, setBaseView] = useState(imgSrc ? 'photo' : 'facade');
  const [elements, setElements] = useState(savedState?.elements || []);
  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generalNotes, setGeneralNotes] = useState(savedState?.generalNotes || '');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingDimId, setEditingDimId] = useState(null);
  const [cabinetDims, setCabinetDims] = useState(
    savedState?.cabinetDims || {
      width: toNum(initialCab.width, 200),
      height: toNum(initialCab.height, 240),
      plinth: toNum(initialCab.plinth, 0),
    }
  );
  const [moduleWidths, setModuleWidths] = useState(
    () => savedState?.moduleWidths || normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200)).map(m => m.width.toFixed(2))
  );

  // Persistance automatique
  useEffect(() => {
    const state = { elements, cabinetDims, moduleWidths, generalNotes };
    localStorage.setItem(LS_SKETCH_KEY, JSON.stringify(state));
  }, [elements, cabinetDims, moduleWidths, generalNotes]);

  // Capture de la façade SVG → PNG après le rendu du conteneur caché.
  // Le délai de 150 ms laisse le temps à React de monter CabinetElevationFront
  // dans le DOM hors-écran avant que captureFacadeToImage ne lise le SVG.
  useEffect(() => {
    const cabinet = initialResult?.cabinet;
    if (!cabinet?.width || !cabinet?.height) return;
    const timer = setTimeout(async () => {
      const png = await captureFacadeToImage(facadeContainerRef);
      if (png) {
        setFacadePng(png);
        setBaseView('photo');
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [initialResult]);

  // Chargement de l'image pour déterminer la taille du canvas
  useEffect(() => {
    if (baseView === 'facade') {
      setImgSize({ w: 1200, h: 760 });
      return;
    }
    if (!imgSrc) return;
    const img = new window.Image();
    img.onload = () => {
      // On limite la taille d'affichage mais on garde les proportions
      const maxW = 1200;
      const ratio = Math.min(maxW / img.naturalWidth, 1);
      setImgSize({
        w: Math.round(img.naturalWidth * ratio),
        h: Math.round(img.naturalHeight * ratio),
      });
    };
    img.src = imgSrc;
  }, [imgSrc, baseView]);

  // Coordonnées souris/touch relatives au SVG
  const getSVGCoords = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(imgSize.w, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(imgSize.h, (clientY - rect.top) * scaleY)),
    };
  }, [imgSize]);

  // Gestion du clic (début création ou sélection)
  const handlePointerDown = useCallback((e) => {
    if (tool === 'erase') return;
    // Si on clique sur une poignée de redimensionnement, on active le resize sur l'élément parent
    if (e.target.dataset.handle === 'true') {
      let target = e.target;
      while (target && !target.dataset.id) {
        target = target.parentElement;
      }
      if (target && target.dataset.id) {
        setResizingId(target.dataset.id);
      }
      return;
    }
    
    e.preventDefault();
    const { x, y } = getSVGCoords(e);

    if (['drawer', 'door', 'shelf'].includes(tool)) {
      // Création d'une forme extensible
      const newEl = {
        id: uid(),
        type: tool,
        x, y, w: 40, h: 40, // Taille initiale
        label: tool === 'drawer' ? 'Tiroir' : tool === 'door' ? 'Porte' : 'Tablette',
        count: 1
      };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id); // On passe directement en mode redimensionnement
    } else if (tool === 'rod') {
      // Tringle : ligne horizontale (penderie)
      const newEl = { id: uid(), type: 'rod', x1: x, y1: y, x2: x, y2: y, label: 'Tringle' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'dim') {
      // Mode cote (simple ligne)
      const newEl = { id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id); // On redimensionne la ligne
    } else if (tool === 'note') {
      // Note : petite zone avec texte
      const text = prompt('Texte de la note :');
      if (text) {
        const newEl = { id: uid(), type: 'note', x, y, text };
        setElements(prev => [...prev, newEl]);
      }
    }
  }, [tool, getSVGCoords]);

  // Gestion du déplacement (création ou move)
  const handlePointerMove = useCallback((e) => {
    if (!resizingId && !draggingId) return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);

    if (resizingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== resizingId) return el;
        if (el.type === 'dim' || el.type === 'rod') {
          return { ...el, x2: x, y2: el.type === 'rod' ? el.y1 : y }; // rod stays horizontal
        } else {
          // Forme rectangulaire : on ajuste w et h
          return { 
            ...el, 
            w: Math.max(10, x - el.x), 
            h: Math.max(10, y - el.y) 
          };
        }
      }));
    } else if (draggingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== draggingId) return el;
        const dx = x - drag.current.startX;
        const dy = y - drag.current.startY;
        return { ...el, x: drag.current.elStartX + dx, y: drag.current.elStartY + dy };
      }));
    }
  }, [resizingId, draggingId, getSVGCoords]);

  const handlePointerUp = useCallback(() => {
    // After drawing a dim line, prompt for value
    if (resizingId) {
      const el = elements.find(e => e.id === resizingId);
      if (el && el.type === 'dim') {
        // Check the line has meaningful length
        const dx = (el.x2 - el.x1);
        const dy = (el.y2 - el.y1);
        if (Math.sqrt(dx*dx + dy*dy) > 15) {
          setEditingDimId(resizingId);
        }
      }
    }
    setResizingId(null);
    setDraggingId(null);
  }, [resizingId, elements]);

  // Supprimer un élément
  const eraseElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
  };

  // --- GÉNÉRATION DU CONTEXTE POUR CLAUDE ---
  const buildContextPrompt = () => {
    const shapes = elements.filter(e => ['drawer', 'door', 'shelf'].includes(e.type));
    const dims = elements.filter(e => e.type === 'dim');
    const rods = elements.filter(e => e.type === 'rod');
    const notes = elements.filter(e => e.type === 'note');

    let context = "ANNOTATIONS UTILISATEUR SUR LE PLAN :\n";

    if (dimensionsFromWizard && cabinetDims.width > 0) {
      context = `DIMENSIONS IMPOSÉES PAR L'UTILISATEUR (ne pas modifier) :\n` +
                `  width: ${cabinetDims.width} cm\n` +
                `  height: ${cabinetDims.height} cm\n` +
                `  plinth: ${cabinetDims.plinth} cm\n\n` +
                context;
    }
    
    if (shapes.length === 0 && dims.length === 0 && rods.length === 0 && notes.length === 0 && !generalNotes) {
      return "Aucune annotation. Analyse le plan brut.";
    }

    if (shapes.length > 0) {
      context += "- ÉLÉMENTS IDENTIFIÉS MANUELLEMENT :\n";
      shapes.forEach((s, i) => {
        // Calcul approximatif de la position relative (0-100%)
        const posX = Math.round((s.x / imgSize.w) * 100);
        const posY = Math.round((s.y / imgSize.h) * 100);
        const sizeW = Math.round((s.w / imgSize.w) * 100);
        const sizeH = Math.round((s.h / imgSize.h) * 100);
        
        context += `  ${i+1}. ${s.label} (Position: ${posX}% gauche, ${posY}% haut. Taille relative: ${sizeW}% x ${sizeH}%)\n`;
      });
    }

    if (rods.length > 0) {
      context += "- TRINGLES (penderie/vêtements) — IMPORTANT, mettre rod: true pour ces modules :\n";
      rods.forEach((r, i) => {
        const posX = Math.round(((r.x1 + r.x2) / 2 / imgSize.w) * 100);
        const posY = Math.round((r.y1 / imgSize.h) * 100);
        // Estimate which module number based on horizontal position
        const moduleIdx = Math.min(moduleWidths.length, Math.max(1, Math.ceil(posX / (100 / moduleWidths.length))));
        context += `  ${i+1}. Tringle dans le module ~${moduleIdx} (position: ${posX}% gauche, ${posY}% haut)\n`;
      });
    }

    if (dims.length > 0) {
      context += "- COTES INDICATIVES :\n";
      dims.forEach(d => {
        if(d.label) context += `  - ${d.label} cm\n`;
      });
    }

    if (notes.length > 0) {
      context += "- NOTES SUR LE PLAN :\n";
      notes.forEach((n, i) => {
        const posX = Math.round((n.x / imgSize.w) * 100);
        const posY = Math.round((n.y / imgSize.h) * 100);
        context += `  ${i+1}. "${n.text}" (à ${posX}% gauche, ${posY}% haut)\n`;
      });
    }

    if (generalNotes.trim()) {
      context += `- NOTES GÉNÉRALES DE L'UTILISATEUR :\n  ${generalNotes.trim()}\n`;
    }

    context += `- COTES MEUBLE CONFIRMÉES AVANT RELANCE : largeur ${cabinetDims.width} cm, hauteur ${cabinetDims.height} cm, plinthe ${cabinetDims.plinth} cm.\n`;
    context += `- LARGEURS MODULES CONFIRMÉES : ${moduleWidths.join(' / ')} cm.\n`;

    context += "\nINSTRUCTION : Utilise ces zones pour déduire le nombre exact de tiroirs/portes et leurs dimensions réelles en fonction des dimensions totales du meuble que tu dois estimer.";
    return context;
  };

  // --- RELANCE CLAUDE ---
  const handleRelancer = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Export SVG en PNG propre (avec les formes vectorielles nettes)
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const canvas = document.createElement('canvas');
      canvas.width = imgSize.w * 2; // Haute résolution
      canvas.height = imgSize.h * 2;
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = async () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const pngDataUrl = canvas.toDataURL('image/png');
        const base64 = pngDataUrl.split(',')[1];

        // 2. Construction du prompt enrichi
        const userContext = buildContextPrompt();
        const fullPrompt = `Tu es un expert menuisier-agenceur. Analyse ce plan/croquis de meuble avec MES ANNOTATIONS VISUELLES.

LÉGENDE DES ANNOTATIONS COLORÉES SUR L'IMAGE :
- JAUNE (rectangles) = Tiroirs — chaque rectangle jaune = 1 tiroir
- BLEU (rectangles) = Portes
- VERT (rectangles) = Tablettes / Étagères fixes
- ROSE (lignes horizontales) = Tringles de penderie (rod/hanging bar)
- ORANGE (étiquettes texte) = Notes de l'utilisateur — LIS-LES ATTENTIVEMENT
- CYAN (lignes pointillées) = Cotes / dimensions en cm

INSTRUCTIONS PRIORITAIRES :
1. Les annotations sont EXACTES — elles ont priorité sur ton analyse visuelle
2. Si tu vois une LIGNE ROSE = il y a obligatoirement un rod/tringle dans ce module (rod: true)
3. Si tu vois un RECTANGLE VERT = tablette fixe dans ce module (ajouter +1 au nb_shelves)
4. Si tu vois un RECTANGLE JAUNE = tiroir (ajouter +1 au nb_drawers) 
5. Les NOTES ORANGE contiennent des instructions précises — respecte-les
6. Chaque module doit avoir rod: true/false selon qu'une tringle rose est visible dedans

${userContext}

Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "pieces": [...],
  "cabinet": {
    "width": number, "height": number, "depth": number,
    "thickness": number, "plinth": number,
    "nb_dividers": number,
    "modules": [
      { "width": number, "shelves": number, "drawers": number, "doors": number, "rod": boolean },
      ...
    ]
  }
}`;

        // 3. Appel API — utilise /api/refine pour envoyer le prompt enrichi avec les annotations
        const SERVER_URL = 'https://panelcut-server.vercel.app';
        let res = await fetch(`${SERVER_URL}/api/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64, 
            mediaType: 'image/png',
            userNotes: buildContextPrompt(),
          }),
        });

        // Fallback sur /api/scan si /api/refine n'existe pas
        if (res.status === 404 || res.status === 405) {
          res = await fetch(`${SERVER_URL}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
          });
        }

        if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
        const data = await res.json();
        
        if (onComplete) onComplete(data);
        setLoading(false);
      };
      
      img.src = url;

    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  }, [imgSize, onComplete, elements, cabinetDims, moduleWidths, generalNotes, initialResult]); // Dépend de elements pour le contexte

  const updateModuleWidth = (idx, value) => {
    setModuleWidths(prev => prev.map((v, i) => i === idx ? value : v));
  };

  const facadeModules = moduleWidths
    .map((w, i) => ({ id: i + 1, width: Math.max(1, toNum(w, 1)) }))
    .filter(m => m.width > 0);

  const normalizedFacadeModules = (() => {
    const sum = facadeModules.reduce((a, m) => a + m.width, 0);
    const target = Math.max(1, cabinetDims.width || sum || 1);
    if (sum <= 0) return facadeModules;
    return facadeModules.map(m => ({ ...m, drawWidth: (m.width / sum) * target }));
  })();

  // Rendu des éléments
  const renderElement = (el) => {
    const isEditing = resizingId === el.id;
    const commonProps = {
      key: el.id,
      'data-id': el.id,
      onClick: (e) => {
        e.stopPropagation();
        if (tool === 'erase') {
          eraseElement(el.id);
        } else {
          const { x, y } = getSVGCoords(e);
          drag.current = { on: true, startX: x, startY: y, elStartX: el.x ?? 0, elStartY: el.y ?? 0 };
          setDraggingId(el.id);
        }
      },
      style: { cursor: tool === 'erase' ? 'pointer' : tool === 'dim' ? 'crosshair' : 'move' },
      opacity: 0.6
    };

    if (['drawer', 'door', 'shelf'].includes(el.type)) {
      const colors = { drawer: '#fbbf24', door: '#60a5fa', shelf: '#34d399' };
      return (
        <g {...commonProps}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={colors[el.type]} stroke="white" strokeWidth="2" rx="4" />
          <text x={el.x + el.w/2} y={el.y + el.h/2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">
            {el.label} {el.count > 1 ? `x${el.count}` : ''}
          </text>
          {/* Poignée de redimensionnement visible seulement si actif */}
          {isEditing && (
             <circle cx={el.x + el.w} cy={el.y + el.h} r="6" fill="white" stroke="black" className="cursor-nwse-resize" data-handle="true" />
          )}
        </g>
      );
    }
    
    if (el.type === 'rod') {
      return (
        <g {...commonProps}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />
          <circle cx={el.x1} cy={el.y1} r="4" fill="#f472b6" />
          <circle cx={el.x2} cy={el.y2} r="4" fill="#f472b6" />
          <text x={(el.x1+el.x2)/2} y={el.y1 - 8} textAnchor="middle" fill="#f472b6" fontSize="11" fontWeight="bold" pointerEvents="none">👔 Tringle</text>
        </g>
      );
    }

    if (el.type === 'dim') {
      return (
        <g {...commonProps}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4" />
          {/* Flèches aux extrémités */}
          <circle cx={el.x1} cy={el.y1} r="3" fill="#22d3ee" />
          <circle cx={el.x2} cy={el.y2} r="3" fill="#22d3ee" />
          {/* Label (valeur) */}
          <rect 
            x={(el.x1+el.x2)/2 - 24} y={(el.y1+el.y2)/2 - 14} width="48" height="18" rx="3"
            fill={el.label ? '#0e7490' : '#164e63'} stroke="#22d3ee" strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setEditingDimId(el.id); }}
          />
          <text 
            x={(el.x1+el.x2)/2} y={(el.y1+el.y2)/2 - 2} 
            textAnchor="middle" fill="#22d3ee" fontSize="11" fontWeight="bold" pointerEvents="none"
          >
            {el.label ? `${el.label} cm` : '? cm'}
          </text>
        </g>
      );
    }

    if (el.type === 'note') {
      return (
        <g key={el.id} onClick={(e) => { e.stopPropagation(); if(tool==='erase') eraseElement(el.id); else setEditingNoteId(el.id); }} style={{ cursor: tool === 'erase' ? 'pointer' : 'pointer' }}>
          <rect x={el.x - 2} y={el.y - 14} width={Math.max(60, el.text.length * 7 + 12)} height="20" rx="3" fill="#fb923c" opacity="0.85" />
          <text x={el.x + 4} y={el.y} fill="white" fontSize="11" fontWeight="bold" pointerEvents="none">📝 {el.text}</text>
        </g>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">

      {/* Conteneur caché pour capturer CabinetElevationFront en PNG */}
      {initialResult?.cabinet?.width && initialResult?.cabinet?.height && (
        <div
          ref={facadeContainerRef}
          style={{ position: 'absolute', left: '-9999px', top: 0, width: `${FACADE_CAPTURE_WIDTH}px`, visibility: 'hidden', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <CabinetElevationFront cabinet={initialResult.cabinet} name={initialResult.name || 'Meuble'} />
        </div>
      )}
      {/* HEADER */}
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700">
        <h2 className="text-white font-bold">✏️ Éditeur Intelligent</h2>
        <div className="flex gap-2">
           {error && <span className="text-red-400 text-sm self-center mr-2">{error}</span>}
           <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded">Annuler</button>
           <button 
             onClick={handleRelancer} 
             disabled={loading}
             className={`px-4 py-1 rounded font-bold text-white ${loading ? 'bg-orange-800' : 'bg-orange-600 hover:bg-orange-500'}`}
           >
             {loading ? 'Analyse...' : '🚀 Relancer Claude'}
           </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex gap-2 p-2 bg-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1 mr-2">
          <button onClick={() => setBaseView('photo')} className={`px-3 py-1 rounded text-xs font-bold ${baseView === 'photo' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{facadePng ? 'Façade SVG' : 'Photo'}</button>
          <button onClick={() => setBaseView('facade')} className={`px-3 py-1 rounded text-xs font-bold ${baseView === 'facade' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Plan façade</button>
        </div>
        {dimensionsFromWizard && (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-600/40">
            ✓ Cotes du projet
          </span>
        )}
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition ${
              tool === t.id ? 'bg-slate-600 text-white ring-2 ring-offset-1 ring-offset-slate-800' : 'text-slate-400 hover:bg-slate-700'
            }`}
            style={tool === t.id ? { borderColor: t.color, borderWidth: '2px' } : {}}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 self-center px-2">
          💡 Cliquez pour créer, glissez le coin pour redimensionner. Cote: cliquez la valeur pour la modifier.
        </div>
      </div>

      {/* DIMENSIONS ÉDITABLES */}
      <div className="bg-slate-900 border-y border-slate-700 p-2 flex flex-wrap gap-2 items-center text-xs">
        <span className="text-slate-400">Cotes:</span>
        <label className="text-slate-300">L <input value={cabinetDims.width} onChange={e => setCabinetDims(v => ({ ...v, width: toNum(e.target.value, 0) }))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded" /> cm</label>
        <label className="text-slate-300">H <input value={cabinetDims.height} onChange={e => setCabinetDims(v => ({ ...v, height: toNum(e.target.value, 0) }))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded" /> cm</label>
        <label className="text-slate-300">Plinthe <input value={cabinetDims.plinth} onChange={e => setCabinetDims(v => ({ ...v, plinth: toNum(e.target.value, 0) }))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded" /> cm</label>
        <span className="text-slate-500 ml-2">Modules:</span>
        {moduleWidths.map((w, i) => (
          <label key={i} className="text-slate-300">M{i + 1} <input value={w} onChange={e => updateModuleWidth(i, e.target.value)} className="w-16 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded" /></label>
        ))}
      </div>

      {/* CANVAS */}
      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
        <svg
          ref={svgRef}
          width={imgSize.w}
          height={imgSize.h}
          className="shadow-2xl bg-slate-900"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {baseView === 'photo' && imgSrc && (
            <image href={imgSrc} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet" />
          )}

          {baseView === 'facade' && (
            <g>
              <rect x={40} y={60} width={imgSize.w - 80} height={imgSize.h - 160} fill="#e5e7eb" stroke="#64748b" strokeWidth="2" />
              {(() => {
                const fullW = imgSize.w - 80;
                const fullH = imgSize.h - 160;
                const originX = 40;
                const originY = 60;
                const pl = Math.max(0, cabinetDims.plinth);
                const plPx = fullH * (pl / Math.max(1, cabinetDims.height));
                let xCursor = originX;
                return normalizedFacadeModules.map((m, i) => {
                  const wPx = fullW * (m.drawWidth / Math.max(1, cabinetDims.width));
                  const g = (
                    <g key={i}>
                      <rect x={xCursor} y={originY} width={wPx} height={fullH} fill="none" stroke="#475569" />
                      <circle cx={xCursor + wPx / 2} cy={originY + fullH * 0.5} r="16" fill="none" stroke="#b91c1c" />
                      <text x={xCursor + wPx / 2} y={originY + fullH * 0.5 + 5} textAnchor="middle" fill="#b91c1c" fontWeight="700">{i + 1}</text>
                      <text x={xCursor + wPx / 2} y={originY + fullH + 24} textAnchor="middle" fill="#b45309" fontWeight="700">{m.width.toFixed(2)} cm</text>
                      {plPx > 2 && <line x1={xCursor} y1={originY + fullH - plPx} x2={xCursor + wPx} y2={originY + fullH - plPx} stroke="#7e22ce" />}
                    </g>
                  );
                  xCursor += wPx;
                  return g;
                });
              })()}
              <text x={imgSize.w / 2} y={30} textAnchor="middle" fill="#f59e0b" fontWeight="700">{cabinetDims.width} cm</text>
              <text x={imgSize.w - 12} y={imgSize.h / 2} transform={`rotate(90 ${imgSize.w - 12} ${imgSize.h / 2})`} textAnchor="middle" fill="#f59e0b" fontWeight="700">{cabinetDims.height} cm</text>
            </g>
          )}

          {elements.map(renderElement)}
        </svg>
      </div>

      {/* NOTES GÉNÉRALES */}
      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea
          value={generalNotes}
          onChange={e => setGeneralNotes(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none"
        />
      </div>

      {/* MODAL : saisie valeur de cote */}
      {editingDimId && (() => {
        const dim = elements.find(e => e.id === editingDimId);
        if (!dim) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={() => setEditingDimId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[260px]" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📏 Valeur de la cote (cm)</h3>
              <input
                autoFocus
                type="number"
                defaultValue={dim.label || ''}
                placeholder="ex: 120"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white text-lg"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    setElements(prev => prev.map(el => el.id === editingDimId ? { ...el, label: val } : el));
                    setEditingDimId(null);
                  }
                  if (e.key === 'Escape') setEditingDimId(null);
                }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  className="flex-1 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-bold text-sm"
                  onClick={e => {
                    const input = e.target.closest('div').parentElement.querySelector('input');
                    const val = input.value.trim();
                    setElements(prev => prev.map(el => el.id === editingDimId ? { ...el, label: val } : el));
                    setEditingDimId(null);
                  }}
                >
                  ✓ Valider
                </button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={() => setEditingDimId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL : édition d'une note */}
      {editingNoteId && (() => {
        const note = elements.find(e => e.id === editingNoteId);
        if (!note) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={() => setEditingNoteId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[280px]" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📝 Modifier la note</h3>
              <input
                autoFocus
                type="text"
                defaultValue={note.text}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (val) {
                      setElements(prev => prev.map(el => el.id === editingNoteId ? { ...el, text: val } : el));
                    }
                    setEditingNoteId(null);
                  }
                  if (e.key === 'Escape') setEditingNoteId(null);
                }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm"
                  onClick={e => {
                    const input = e.target.closest('div').parentElement.querySelector('input');
                    const val = input.value.trim();
                    if (val) {
                      setElements(prev => prev.map(el => el.id === editingNoteId ? { ...el, text: val } : el));
                    }
                    setEditingNoteId(null);
                  }}
                >
                  ✓ Valider
                </button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={() => setEditingNoteId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
