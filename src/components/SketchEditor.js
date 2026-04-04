import { useRef, useState, useCallback, useEffect } from 'react';

// Outils disponibles
const TOOLS = [
  { id: 'drawer', icon: '🗄️', label: 'Tiroirs', color: '#fbbf24' }, // Amber
  { id: 'door',   icon: '🚪', label: 'Porte',   color: '#60a5fa' }, // Blue
  { id: 'shelf',  icon: '📦', label: 'Tablette',color: '#34d399' }, // Emerald
  { id: 'dim',    icon: '📏', label: 'Cote',    color: '#22d3ee' }, // Cyan
  { id: 'erase',  icon: '🧹', label: 'Effacer', color: '#f87171' }, // Red
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function SketchEditor({ image, scanImage, initialResult, apiKey, onComplete, onCancel }) {
  const imgSrc = image || scanImage || null;
  const svgRef = useRef(null);
  
  // États
  const [tool, setTool] = useState('drawer');
  const [elements, setElements] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chargement de l'image pour déterminer la taille du canvas
  useEffect(() => {
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
  }, [imgSrc]);

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
    // Si on clique sur une poignée de redimensionnement, on gère ailleurs
    if (e.target.dataset.handle) return; 
    
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
    } else if (tool === 'dim') {
      // Mode cote (simple ligne)
      const newEl = { id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id); // On redimensionne la ligne
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
        if (el.type === 'dim') {
          return { ...el, x2: x, y2: y };
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
        // Calcul du delta serait plus propre, ici on simplifie pour l'exemple
        // Pour un drag parfait, il faudrait stocker le point de départ
        return { ...el, x: x - 20, y: y - 20 }; // Approximation centrée
      }));
    }
  }, [resizingId, draggingId, getSVGCoords]);

  const handlePointerUp = useCallback(() => {
    setResizingId(null);
    setDraggingId(null);
  }, []);

  // Supprimer un élément
  const eraseElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
  };

  // --- GÉNÉRATION DU CONTEXTE POUR CLAUDE ---
  const buildContextPrompt = () => {
    const shapes = elements.filter(e => ['drawer', 'door', 'shelf'].includes(e.type));
    const dims = elements.filter(e => e.type === 'dim');

    let context = "ANNOTATIONS UTILISATEUR SUR LE PLAN :\n";
    
    if (shapes.length === 0 && dims.length === 0) {
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

    if (dims.length > 0) {
      context += "- COTES INDICATIVES :\n";
      dims.forEach(d => {
        if(d.label) context += `  - ${d.label}\n`;
      });
    }

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
        const fullPrompt = `Tu es un expert menuisier.
Analyse ce plan de meuble.
J'ai ajouté des formes colorées par dessus pour t'aider :
- JAUNE = Tiroirs
- BLEU = Portes
- VERT = Tablettes/Cases

${userContext}

Retourne UNIQUEMENT un JSON valide avec la structure complète (pieces + cabinet) comme demandé précédemment.`;

        // 3. Appel API
        const res = await fetch('https://panelcut-server.vercel.app/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64, 
            mediaType: 'image/png',
            // Optionnel : on pourrait aussi envoyer le contexte texte séparément si le serveur le gère
            // Mais ici on compte sur le prompt système ou on modifie le serveur pour accepter un champ 'context'
          }),
        });

        if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
        const data = await res.json();
        
        // NOTE IMPORTANTE : Comme le serveur actuel n'accepte pas de champ 'context' supplémentaire dans le body,
        // le prompt personnalisé ci-dessus n'est PAS envoyé tel quel au serveur actuel.
        // Le serveur utilise son propre prompt codé en dur.
        // SOLUTION TEMPORAIRE : On renvoie juste l'image améliorée. 
        // Pour que le contexte texte fonctionne, il faudrait modifier api/scan.js pour accepter un champ 'userNotes'.
        
        // Pour l'instant, on renvoie le résultat tel quel basé sur l'image plus claire.
        if (onComplete) onComplete(data);
        setLoading(false);
      };
      
      img.src = url;

    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  }, [imgSize, onComplete, elements]); // Dépend de elements pour le contexte

  // Rendu des éléments
  const renderElement = (el) => {
    const isEditing = resizingId === el.id;
    const commonProps = {
      key: el.id,
      onClick: (e) => { e.stopPropagation(); if(tool==='erase') eraseElement(el.id); else setDraggingId(el.id); },
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
    
    if (el.type === 'dim') {
      return (
        <g {...commonProps}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4" />
          {el.label && (
            <text x={(el.x1+el.x2)/2} y={(el.y1+el.y2)/2 - 5} textAnchor="middle" fill="#22d3ee" fontSize="12" fontWeight="bold">{el.label}</text>
          )}
        </g>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
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
          💡 Astuce: Cliquez pour créer, glissez le coin blanc pour redimensionner.
        </div>
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
          <image href={imgSrc} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet" />
          {elements.map(renderElement)}
        </svg>
      </div>
    </div>
  );
}
