import { useRef, useState, useCallback, useEffect } from 'react';
import CabinetElevationFront from './CabinetElevationFront';
import { captureFacadeToImage } from '../utils/captureFacadeToImage';

const TOOLS = [
  { id: 'drawer', icon: '🗄️', label: 'Tiroirs',  color: '#fbbf24' },
  { id: 'door',   icon: '🚪', label: 'Porte',    color: '#60a5fa' },
  { id: 'shelf',  icon: '📦', label: 'Tablette', color: '#34d399' },
  { id: 'rod',    icon: '👔', label: 'Tringle',  color: '#f472b6' },
  { id: 'dim',    icon: '📏', label: 'Cote',     color: '#22d3ee' },
  { id: 'note',   icon: '📝', label: 'Note',     color: '#fb923c' },
  { id: 'erase',  icon: '🧹', label: 'Effacer',  color: '#f87171' },
];

const LS_SKETCH_KEY      = 'pc_sketch_editor';
const FACADE_CAPTURE_WIDTH = 980;
const WOOD_FILL          = '#f5ede0';
const WOOD_STROKE        = '#8b6914';
const DIM_COLOR          = '#dc2626';
const DOUBLE_COLOR       = '#d97706';

const uid   = () => Math.random().toString(36).slice(2, 9);
const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

const normalizeModulesFromResult = (result, width = 0) => {
  const cabinet  = result?.cabinet || {};
  const raw      = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);
  if (detailed.length > 0) {
    return detailed.map((m, i) => ({
      id:      i + 1,
      width:   Math.max(1, toNum(m.width   ?? m.w       ?? m.largeur, 1)),
      shelves: Math.max(0, parseInt(m.shelves  ?? m.nb_shelves ?? 0, 10) || 0),
      drawers: Math.max(0, parseInt(m.drawers  ?? m.nb_drawers ?? 0, 10) || 0),
      doors:   Math.max(0, parseInt(m.doors    ?? m.nb_doors   ?? 0, 10) || 0),
      rod:     Boolean(m.rod ?? m.tringle ?? m.hanging ?? m.penderie ?? false),
    }));
  }
  const n  = Math.max(1, parseInt(cabinet.nb_dividers ?? 4, 10) + 1);
  const mw = width > 0 ? width / n : 50;
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, width: mw, shelves: 0, drawers: 0, doors: 1, rod: false,
  }));
};

const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;

// ────────────────────────────────────────────────────────────────────────────────
// Moteur de dessin bois réaliste (porté du prototype HTML)
// Retourne un fragment SVG JSX représentant la façade complète
// ────────────────────────────────────────────────────────────────────────────────
function FacadeRealisteSVG({
  svgW, svgH,
  cabW, cabH, plinth, thick,
  modulesData,   // [{ width, drawers, rod, shelves, doors }]
  joints,        // bool[]
  floatEls,      // elements depuis l'éditeur (rod, shelf, door, note, drawer)
  imgSize,
}) {
  const MARGIN = { l: 65, r: 52, t: 55, b: 65 };
  const drawW  = svgW - MARGIN.l - MARGIN.r;
  const drawH  = svgH - MARGIN.t  - MARGIN.b;
  const sY     = drawH / Math.max(1, cabH);
  const thPx   = thick * (drawW / Math.max(1, cabW));
  const plPx   = plinth * sY;
  const innerH = drawH - plPx;
  const mL     = MARGIN.l;
  const mT     = MARGIN.t;

  // Calcul positions X des modules (tenant compte des doubles montants)
  const totalSepPx = joints.reduce((acc, j) => acc + (j ? 2 * thPx : thPx), 0) + 2 * thPx;
  const avail      = drawW - totalSepPx;
  const totalModW  = modulesData.reduce((a, m) => a + m.width, 0);
  const modScaleX  = avail / Math.max(1, totalModW);

  let xCur = mL + thPx;
  const mRects = modulesData.map((m, i) => {
    const wPx = m.width * modScaleX;
    const r = {
      x: xCur, w: wPx, m, i,
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      intH:      innerH - 2 * thPx,
    };
    xCur += wPx;
    if (i < modulesData.length - 1) {
      xCur += joints[i] ? 2 * thPx : thPx;
    }
    return r;
  });

  // --- Dégradés (définis dans <defs>) ---
  const defs = (
    <defs>
      <linearGradient id="pcGW" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#dcc89a"/>
        <stop offset="45%"  stopColor="#f5ede0"/>
        <stop offset="100%" stopColor="#dcc89a"/>
      </linearGradient>
      <linearGradient id="pcGT" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#c4a87a"/>
        <stop offset="100%" stopColor="#e8d5b0"/>
      </linearGradient>
      <linearGradient id="pcGDoor" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#e8dcc8" stopOpacity="0.75"/>
        <stop offset="50%"  stopColor="#f8f0e4" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#ddd0ba" stopOpacity="0.75"/>
      </linearGradient>
      <linearGradient id="pcGDouble" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#dcc89a"/>
        <stop offset="48%"  stopColor="#e8d5b0"/>
        <stop offset="52%"  stopColor="#c9b068"/>
        <stop offset="100%" stopColor="#dcc89a"/>
      </linearGradient>
    </defs>
  );

  // --- Corps principal ---
  const corps = (
    <g>
      {/* Corps */}
      <rect x={mL} y={mT} width={drawW} height={drawH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="2.5"/>
      {/* Fond intérieur */}
      <rect x={mL+thPx} y={mT+thPx} width={drawW-2*thPx} height={innerH-thPx} fill="#ede4d3"/>
      {/* Socle plinthe */}
      {plPx > 2 && (
        <>
          <rect x={mL} y={mT+innerH} width={drawW} height={plPx} fill="#c8b07c" stroke={WOOD_STROKE} strokeWidth="1.5"/>
          <line x1={mL} y1={mT+innerH} x2={mL+drawW} y2={mT+innerH} stroke={WOOD_STROKE} strokeWidth="2"/>
        </>
      )}
      {/* Joue gauche */}
      <rect x={mL} y={mT} width={thPx} height={innerH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      {/* Joue droite */}
      <rect x={mL+drawW-thPx} y={mT} width={thPx} height={innerH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      {/* Toit */}
      <rect x={mL} y={mT} width={drawW} height={thPx} fill="url(#pcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      {/* Fond bas */}
      <rect x={mL} y={mT+innerH-thPx} width={drawW} height={thPx} fill="url(#pcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
    </g>
  );

  // --- Séparateurs ---
  const separateurs = mRects.map(({ x, w, i, intTop, intH: iH }) => {
    if (i >= modulesData.length - 1) return null;
    const isDouble = joints[i];
    const sepX     = x + w;
    if (isDouble) {
      return (
        <g key={`sep-${i}`}>
          <rect x={sepX}       y={mT} width={thPx} height={innerH} fill="url(#pcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
          <rect x={sepX+thPx} y={mT} width={thPx} height={innerH} fill="url(#pcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
          <line
            x1={sepX+thPx} y1={mT+2} x2={sepX+thPx} y2={mT+innerH-2}
            stroke={DOUBLE_COLOR} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9"
          />
          <text x={sepX+thPx} y={mT+innerH+36}
            textAnchor="middle" fill={DOUBLE_COLOR} fontSize="9" fontWeight="700">⬛⬛</text>
        </g>
      );
    }
    return (
      <rect key={`sep-${i}`} x={sepX} y={mT} width={thPx} height={innerH}
        fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1"/>
    );
  });

  // --- Modules : fond + tiroirs + éléments ---
  const modules = mRects.map(({ x, w, m, i, intTop, intBottom, intH: iH }) => {
    const nbD     = m.drawers || 0;
    const drawerH = Math.min(iH * 0.15, 46);
    const drawPx  = nbD * drawerH;

    // Tiroirs
    const tiroirs = Array.from({ length: nbD }, (_, di) => {
      const dy = intBottom - drawPx + di * drawerH;
      return (
        <g key={`dr-${i}-${di}`}>
          <rect x={x+2} y={dy+1} width={w-4} height={drawerH-2}
            fill="#e8d9bc" stroke={WOOD_STROKE} strokeWidth="1" rx="1"/>
          <line x1={x+2} y1={dy+1} x2={x+w-2} y2={dy+1} stroke={WOOD_STROKE} strokeWidth="0.5"/>
          {/* Poignée */}
          <rect x={x+w/2-14} y={dy+drawerH/2-3.5} width="28" height="7"
            fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" rx="3"/>
          <ellipse cx={x+w/2} cy={dy+drawerH/2} rx="3.5" ry="2.5" fill="#6b7280"/>
        </g>
      );
    });

    // Tablettes (depuis m.shelves)
    const nbSh    = m.shelves || 0;
    const tablettes = Array.from({ length: nbSh }, (_, si) => {
      const sy = intTop + ((si + 1) / (nbSh + 1)) * iH;
      return (
        <g key={`sh-${i}-${si}`}>
          <rect x={x} y={sy-3.5} width={w} height={6.5} fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1"/>
          <circle cx={x+9}   cy={sy} r="2.5" fill={WOOD_STROKE}/>
          <circle cx={x+w-9} cy={sy} r="2.5" fill={WOOD_STROKE}/>
        </g>
      );
    });

    // Tringle (depuis m.rod)
    const tringle = m.rod ? (() => {
      const ry = intTop + iH * 0.35;
      return (
        <g key={`rod-${i}`}>
          <rect x={x+8}    y={ry-10} width="7"  height="18" fill="#6b7280" rx="2"/>
          <rect x={x+w-15} y={ry-10} width="7"  height="18" fill="#6b7280" rx="2"/>
          <line x1={x+16} y1={ry} x2={x+w-15} y2={ry} stroke="#4b5563" strokeWidth="6" strokeLinecap="round"/>
          <line x1={x+16} y1={ry-2} x2={x+w-15} y2={ry-2} stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
        </g>
      );
    })() : null;

    // Portes (depuis m.doors)
    const nbDoors = m.doors || 0;
    const portes  = Array.from({ length: Math.min(nbDoors, 2) }, (_, di) => {
      const nd = Math.min(nbDoors, 2);
      const dw = nd === 2 ? w / 2 : w;
      const dx = nd === 2 && di === 1 ? x + w / 2 : x;
      const pad = Math.max(8, dw * 0.08);
      const hx2 = di === 0 ? dx + dw - 14 : dx + 10;
      return (
        <g key={`door-${i}-${di}`}>
          <rect x={dx+2} y={intTop+2} width={dw-4} height={iH-4}
            fill="url(#pcGDoor)" stroke={WOOD_STROKE} strokeWidth="1.5" rx="1"/>
          <rect x={dx+pad} y={intTop+pad} width={dw-2*pad} height={iH-2*pad}
            fill="none" stroke={WOOD_STROKE} strokeWidth="0.8" opacity="0.5"/>
          <rect x={hx2-4} y={intTop+iH/2-10} width="8" height="20"
            fill="#a0a0a0" stroke="#666" strokeWidth="0.8" rx="3"/>
        </g>
      );
    });

    // Numéro module
    const usedH = drawPx;
    const numY  = intTop + Math.max(30, (iH - usedH) * 0.45);

    return (
      <g key={`mod-${i}`}>
        {/* Fond module */}
        <rect x={x} y={intTop} width={w} height={iH} fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth="0.7"/>
        {tringle}
        {tablettes}
        {tiroirs}
        {portes}
        {/* Numéro */}
        <circle cx={x+w/2} cy={numY} r="20" fill="none" stroke={DIM_COLOR} strokeWidth="2"/>
        <text x={x+w/2} y={numY+6} textAnchor="middle" fill={DIM_COLOR} fontWeight="700" fontSize="17">{i+1}</text>
        {/* Cote largeur module */}
        <line x1={x}   y1={mT+drawH+10} x2={x+w} y2={mT+drawH+10} stroke="#b45309" strokeWidth="1"/>
        <line x1={x}   y1={mT+drawH+6}  x2={x}   y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
        <line x1={x+w} y1={mT+drawH+6}  x2={x+w} y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
        <text x={x+w/2} y={mT+drawH+26} textAnchor="middle" fill="#b45309" fontWeight="700" fontSize="11">
          {m.width.toFixed(2)} cm
        </text>
      </g>
    );
  });

  // --- Éléments flottants (depuis elements[] de l'éditeur) ---
  const floats = (floatEls || []).map(el => {
    const mr = mRects[el.modIdx ?? -1];
    if (!mr) return null;
    const { x, w, intTop, intH: iH } = mr;
    const ey = intTop + (el.yRatio ?? 0.5) * iH;

    if (el.type === 'rod') {
      return (
        <g key={el.id}>
          <rect x={x+8}    y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
          <rect x={x+w-15} y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
          <line x1={x+16} y1={ey} x2={x+w-15} y2={ey} stroke="#4b5563" strokeWidth="6" strokeLinecap="round"/>
          <line x1={x+16} y1={ey-2} x2={x+w-15} y2={ey-2} stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
          <circle cx={x+w/2} cy={ey} r="6" fill="#f472b6" stroke="#fff" strokeWidth="1.5"/>
        </g>
      );
    }
    if (el.type === 'shelf') {
      return (
        <g key={el.id}>
          <rect x={x} y={ey-3.5} width={w} height={6.5} fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1"/>
          <circle cx={x+9}   cy={ey} r="2.5" fill={WOOD_STROKE}/>
          <circle cx={x+w-9} cy={ey} r="2.5" fill={WOOD_STROKE}/>
          <circle cx={x+w/2} cy={ey} r="6" fill="#34d399" stroke="#fff" strokeWidth="1.5"/>
        </g>
      );
    }
    if (el.type === 'note' && el.text) {
      return (
        <g key={el.id}>
          <rect x={x+4} y={ey-14} width={Math.max(50, el.text.length*7+14)} height="18"
            rx="3" fill="#fb923c" opacity="0.9"/>
          <text x={x+10} y={ey} fill="white" fontSize="11" fontWeight="700">{el.text}</text>
        </g>
      );
    }
    return null;
  });

  // --- Cotes générales ---
  const cotes = (
    <g>
      {/* Largeur totale */}
      <line x1={mL} y1={mT-26} x2={mL+drawW} y2={mT-26} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL}       y1={mT-32} x2={mL}       y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW} y1={mT-32} x2={mL+drawW} y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <text x={mL+drawW/2} y={mT-30} textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700">
        {cabW} cm
      </text>
      {/* Hauteur */}
      <line x1={mL+drawW+24} y1={mT} x2={mL+drawW+24} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW+18} y1={mT}       x2={mL+drawW+30} y2={mT}       stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW+18} y1={mT+drawH} x2={mL+drawW+30} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <text
        x={mL+drawW+40} y={mT+drawH/2}
        textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700"
        transform={`rotate(90 ${mL+drawW+40} ${mT+drawH/2})`}>
        {cabH} cm
      </text>
    </g>
  );

  return (
    <g>
      {defs}
      {corps}
      {separateurs}
      {modules}
      {floats}
      {cotes}
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
export default function SketchEditor({ image, scanImage, initialResult, apiKey, onComplete, onCancel }) {
  const rawImg             = image || scanImage || null;
  const svgRef             = useRef(null);
  const facadeContainerRef = useRef(null);
  const drag               = useRef({ on: false, startX: 0, startY: 0, elStartX: 0, elStartY: 0 });

  const [facadePng, setFacadePng] = useState(null);
  const imgSrc               = facadePng || rawImg;
  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);

  const savedState = (() => {
    try { const r = localStorage.getItem(LS_SKETCH_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  })();

  const [tool,          setTool]          = useState('drawer');
  const [baseView,      setBaseView]      = useState(imgSrc ? 'photo' : 'facade');
  const [elements,      setElements]      = useState(savedState?.elements || []);
  const [draggingId,    setDraggingId]    = useState(null);
  const [resizingId,    setResizingId]    = useState(null);
  const [imgSize,       setImgSize]       = useState({ w: 800, h: 600 });
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [generalNotes,  setGeneralNotes]  = useState(savedState?.generalNotes || '');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingDimId,  setEditingDimId]  = useState(null);
  const [cabinetDims,   setCabinetDims]   = useState(
    savedState?.cabinetDims || {
      width:  toNum(initialCab.width,  200),
      height: toNum(initialCab.height, 240),
      plinth: toNum(initialCab.plinth,   0),
    }
  );
  const [moduleWidths, setModuleWidths] = useState(
    () => savedState?.moduleWidths ||
      normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200)).map(m => m.width.toFixed(2))
  );

  // ─── Joints ────────────────────────────────────────────────────────────────────
  const nbJoints = Math.max(0, moduleWidths.length - 1);
  const [joints, setJoints] = useState(
    () => savedState?.joints || Array(nbJoints).fill(true)
  );
  useEffect(() => {
    setJoints(prev => {
      const n = Math.max(0, moduleWidths.length - 1);
      if (prev.length === n) return prev;
      const next = Array(n).fill(true);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }, [moduleWidths.length]);
  const toggleJoint = (i) => setJoints(prev => prev.map((v, idx) => idx === i ? !v : v));

  const thickness          = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth   = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(1, toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth);

  // ─── Persistance ────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(LS_SKETCH_KEY, JSON.stringify({
      elements, cabinetDims, moduleWidths, generalNotes, joints,
    }));
  }, [elements, cabinetDims, moduleWidths, generalNotes, joints]);

  // ─── Capture façade SVG → PNG ─────────────────────────────────────────────
  useEffect(() => {
    const cabinet = initialResult?.cabinet;
    if (!cabinet?.width || !cabinet?.height) return;
    const timer = setTimeout(async () => {
      const png = await captureFacadeToImage(facadeContainerRef);
      if (png) { setFacadePng(png); setBaseView('photo'); }
    }, 150);
    return () => clearTimeout(timer);
  }, [initialResult]);

  // ─── Taille canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    if (baseView === 'facade') { setImgSize({ w: 1140, h: 700 }); return; }
    if (!imgSrc) return;
    const img = new window.Image();
    img.onload = () => {
      const maxW  = 1200;
      const ratio = Math.min(maxW / img.naturalWidth, 1);
      setImgSize({ w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) });
    };
    img.src = imgSrc;
  }, [imgSrc, baseView]);

  // ─── Coordonnées SVG ───────────────────────────────────────────────────
  const getSVGCoords = useCallback((e) => {
    const svg    = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect   = svg.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(imgSize.w, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(imgSize.h, (clientY - rect.top)  * scaleY)),
    };
  }, [imgSize]);

  // ─── Pointeur down ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (tool === 'erase') return;
    if (e.target.dataset.handle === 'true') {
      let target = e.target;
      while (target && !target.dataset.id) target = target.parentElement;
      if (target?.dataset.id) setResizingId(target.dataset.id);
      return;
    }
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (['drawer', 'door', 'shelf'].includes(tool)) {
      const newEl = {
        id: uid(), type: tool, x, y, w: 40, h: 40,
        label: tool === 'drawer' ? 'Tiroir' : tool === 'door' ? 'Porte' : 'Tablette', count: 1,
      };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'rod') {
      const newEl = { id: uid(), type: 'rod', x1: x, y1: y, x2: x, y2: y, label: 'Tringle' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'dim') {
      const newEl = { id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'note') {
      const text = prompt('Texte de la note :');
      if (text) setElements(prev => [...prev, { id: uid(), type: 'note', x, y, text }]);
    }
  }, [tool, getSVGCoords]);

  // ─── Pointeur move ─────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    if (!resizingId && !draggingId) return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (resizingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== resizingId) return el;
        if (el.type === 'dim' || el.type === 'rod')
          return { ...el, x2: x, y2: el.type === 'rod' ? el.y1 : y };
        return { ...el, w: Math.max(10, x - el.x), h: Math.max(10, y - el.y) };
      }));
    } else if (draggingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== draggingId) return el;
        return {
          ...el,
          x: drag.current.elStartX + (x - drag.current.startX),
          y: drag.current.elStartY + (y - drag.current.startY),
        };
      }));
    }
  }, [resizingId, draggingId, getSVGCoords]);

  // ─── Pointeur up ───────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(() => {
    if (resizingId) {
      const el = elements.find(e => e.id === resizingId);
      if (el?.type === 'dim') {
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        if (Math.sqrt(dx * dx + dy * dy) > 15) setEditingDimId(resizingId);
      }
    }
    setResizingId(null);
    setDraggingId(null);
  }, [resizingId, elements]);

  const eraseElement      = (id)         => setElements(prev => prev.filter(el => el.id !== id));
  const updateModuleWidth = (idx, val)   => setModuleWidths(prev => prev.map((v, i) => i === idx ? val : v));

  // ─── Modules data (pour FacadeRealisteSVG) ────────────────────────────────
  // On réutilise initialResult pour les propriétés (rod, shelves, doors, drawers)
  // On écrase la largeur par moduleWidths (saisie utilisateur)
  const baseModules = normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200));
  const modulesData = moduleWidths.map((w, i) => ({
    ...(baseModules[i] || { shelves: 0, drawers: 0, doors: 0, rod: false }),
    width: Math.max(1, toNum(w, 1)),
  }));

  // ─── floatEls : convertit les elements[] de type rod/shelf/note positionnels
  // vers le format { modIdx, yRatio } attendu par FacadeRealisteSVG
  const floatElsForFacade = elements
    .filter(el => ['rod', 'shelf', 'note'].includes(el.type))
    .map(el => {
      // Localise le module par position X du centre de l'élément
      const cx = el.type === 'rod'
        ? (el.x1 + el.x2) / 2
        : (el.x ?? 0);
      const cy = el.type === 'rod' ? el.y1 : (el.y ?? 0);
      const modIdx = Math.max(0, Math.min(
        moduleWidths.length - 1,
        Math.floor((cx / imgSize.w) * moduleWidths.length)
      ));
      const yRatio = Math.max(0.03, Math.min(0.97, cy / imgSize.h));
      return { id: el.id, type: el.type, modIdx, yRatio, text: el.text };
    });

  // ─── Prompt contextuel v3 ─────────────────────────────────────────────────
  const buildContextPrompt = () => {
    const shapes = elements.filter(e => ['drawer', 'door', 'shelf'].includes(e.type));
    const dims   = elements.filter(e => e.type === 'dim');
    const rods   = elements.filter(e => e.type === 'rod');
    const notes  = elements.filter(e => e.type === 'note');
    let ctx = '';
    if (dimensionsFromWizard && cabinetDims.width > 0) {
      ctx += `DIMENSIONS IMPOSÉES :\n  width:${cabinetDims.width} cm  height:${cabinetDims.height} cm  plinth:${cabinetDims.plinth} cm\n\n`;
    }
    ctx += `MONTANTS (ép. panneau=${thickness} cm) :\n`;
    joints.forEach((d, i) => {
      ctx += `  M${i+1}|M${i+2}: ${d?'⬛⬛ DOUBLE':'▪️ simple'} → ${jointThickness(d,thickness).toFixed(1)} cm\n`;
    });
    const nD = joints.filter(Boolean).length;
    ctx += `  Total joints=${totalJointsWidth.toFixed(1)} cm (${nD} double, ${joints.length-nD} simple)  Net=${totalInteriorWidth.toFixed(1)} cm\n\n`;
    ctx += 'ANNOTATIONS :\n';
    if (!shapes.length && !dims.length && !rods.length && !notes.length && !generalNotes) {
      ctx += 'Aucune.\n';
    } else {
      shapes.forEach((s,i) => {
        ctx += `  ${i+1}. ${s.label} pos(${Math.round(s.x/imgSize.w*100)}%,${Math.round(s.y/imgSize.h*100)}%) taille(${Math.round(s.w/imgSize.w*100)}%x${Math.round(s.h/imgSize.h*100)}%)\n`;
      });
      rods.forEach((r,i) => {
        const px = Math.round(((r.x1+r.x2)/2/imgSize.w)*100);
        const mi = Math.min(moduleWidths.length, Math.max(1, Math.ceil(px/(100/moduleWidths.length))));
        ctx += `  Tringle M~${mi} (${px}% gauche)\n`;
      });
      dims.forEach(d => { if(d.label) ctx += `  Cote: ${d.label} cm\n`; });
      notes.forEach((n,i) => ctx += `  Note${i+1}: "${n.text}"\n`);
      if (generalNotes.trim()) ctx += `  Général: ${generalNotes.trim()}\n`;
    }
    ctx += `\nCOTES: L=${cabinetDims.width} H=${cabinetDims.height} plinthe=${cabinetDims.plinth} cm\n`;
    ctx += `MODULES: ${moduleWidths.join(' / ')} cm\n`;
    ctx += `INSTRUCTION: Tiens compte des doubles montants pour les largeurs nettes.`;
    return ctx;
  };

  // ─── Relance Claude ────────────────────────────────────────────────────────
  const handleRelancer = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setLoading(true); setError(null);
    try {
      const svgStr  = new XMLSerializer().serializeToString(svg);
      const url     = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
      const canvas  = document.createElement('canvas');
      canvas.width  = imgSize.w * 2;
      canvas.height = imgSize.h * 2;
      const ctx = canvas.getContext('2d');
      const img = new window.Image();
      img.onload = async () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const SERVER  = 'https://panelcut-server.vercel.app';
        let res = await fetch(`${SERVER}/api/refine`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: 'image/png', userNotes: buildContextPrompt() }),
        });
        if (res.status === 404 || res.status === 405)
          res = await fetch(`${SERVER}/api/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
          });
        if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
        const data = await res.json();
        if (onComplete) onComplete(data);
        setLoading(false);
      };
      img.src = url;
    } catch (err) { console.error(err); setError(err.message); setLoading(false); }
  }, [imgSize, onComplete, elements, cabinetDims, moduleWidths, generalNotes, joints, initialResult]);

  // ─── Rendu éléments SVG (mode photo) ───────────────────────────────────────
  const renderElement = (el) => {
    const isEditing = resizingId === el.id;
    const commonProps = {
      key: el.id, 'data-id': el.id,
      onClick: (e) => {
        e.stopPropagation();
        if (tool === 'erase') { eraseElement(el.id); return; }
        const { x, y } = getSVGCoords(e);
        drag.current = { on: true, startX: x, startY: y, elStartX: el.x ?? 0, elStartY: el.y ?? 0 };
        setDraggingId(el.id);
      },
      style:   { cursor: tool === 'erase' ? 'pointer' : tool === 'dim' ? 'crosshair' : 'move' },
      opacity: 0.75,
    };
    if (['drawer', 'door', 'shelf'].includes(el.type)) {
      const colors = { drawer: '#fbbf24', door: '#60a5fa', shelf: '#34d399' };
      return (
        <g {...commonProps}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h}
            fill={colors[el.type]} stroke="white" strokeWidth="2" rx="4"/>
          <text x={el.x+el.w/2} y={el.y+el.h/2}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">
            {el.label}{el.count > 1 ? ` x${el.count}` : ''}
          </text>
          {isEditing && <circle cx={el.x+el.w} cy={el.y+el.h} r="6"
            fill="white" stroke="black" className="cursor-nwse-resize" data-handle="true"/>}
        </g>
      );
    }
    if (el.type === 'rod') return (
      <g {...commonProps}>
        <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#f472b6" strokeWidth="4" strokeLinecap="round"/>
        <circle cx={el.x1} cy={el.y1} r="4" fill="#f472b6"/>
        <circle cx={el.x2} cy={el.y2} r="4" fill="#f472b6"/>
        <text x={(el.x1+el.x2)/2} y={el.y1-8} textAnchor="middle" fill="#f472b6" fontSize="11" fontWeight="bold" pointerEvents="none">👔 Tringle</text>
      </g>
    );
    if (el.type === 'dim') return (
      <g {...commonProps}>
        <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4"/>
        <circle cx={el.x1} cy={el.y1} r="3" fill="#22d3ee"/>
        <circle cx={el.x2} cy={el.y2} r="3" fill="#22d3ee"/>
        <rect x={(el.x1+el.x2)/2-24} y={(el.y1+el.y2)/2-14} width="48" height="18" rx="3"
          fill={el.label?'#0e7490':'#164e63'} stroke="#22d3ee" strokeWidth="1"
          style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();setEditingDimId(el.id);}}/>
        <text x={(el.x1+el.x2)/2} y={(el.y1+el.y2)/2-2} textAnchor="middle" fill="#22d3ee" fontSize="11" fontWeight="bold" pointerEvents="none">
          {el.label ? `${el.label} cm` : '? cm'}
        </text>
      </g>
    );
    if (el.type === 'note') return (
      <g key={el.id} onClick={e=>{e.stopPropagation();tool==='erase'?eraseElement(el.id):setEditingNoteId(el.id);}} style={{cursor:'pointer'}}>
        <rect x={el.x-2} y={el.y-14} width={Math.max(60,el.text.length*7+12)} height="20" rx="3" fill="#fb923c" opacity="0.85"/>
        <text x={el.x+4} y={el.y} fill="white" fontSize="11" fontWeight="bold" pointerEvents="none">📝 {el.text}</text>
      </g>
    );
    return null;
  };

  // ─── JSX principal ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">

      {initialResult?.cabinet?.width && initialResult?.cabinet?.height && (
        <div ref={facadeContainerRef}
          style={{position:'absolute',left:'-9999px',top:0,width:`${FACADE_CAPTURE_WIDTH}px`,visibility:'hidden',pointerEvents:'none'}}
          aria-hidden="true">
          <CabinetElevationFront cabinet={initialResult.cabinet} name={initialResult.name||'Meuble'}/>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold">✏️ Éditeur Intelligent</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">v3</span>
        </div>
        <div className="flex gap-2">
          {error && <span className="text-red-400 text-sm self-center mr-2">{error}</span>}
          <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded">Annuler</button>
          <button onClick={handleRelancer} disabled={loading}
            className={`px-4 py-1 rounded font-bold text-white ${loading?'bg-orange-800':'bg-orange-600 hover:bg-orange-500'}`}>
            {loading ? 'Analyse...' : '🚀 Relancer Claude'}
          </button>
        </div>
      </div>

      {/* BARRE JOINTS */}
      {joints.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-amber-900/30 overflow-x-auto">
          <span className="text-xs font-bold text-amber-400 whitespace-nowrap shrink-0">🔩 Joints entre caissons :</span>
          {joints.map((isDouble, i) => (
            <button key={i} onClick={() => toggleJoint(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
                isDouble
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30'
                  : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
              }`}>
              {isDouble ? '⬛⬛' : '▪️'} M{i+1}|M{i+2}
              <span className="opacity-60 text-[10px]">({isDouble?(thickness*2).toFixed(1):thickness.toFixed(1)} cm)</span>
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap shrink-0 pl-3">
            Joints : <span className="text-amber-400 font-bold">{totalJointsWidth.toFixed(1)} cm</span>
            {' · '}Net : <span className="text-green-400 font-bold">{totalInteriorWidth.toFixed(1)} cm</span>
          </span>
        </div>
      )}

      {/* TOOLBAR OUTILS */}
      <div className="flex gap-2 p-2 bg-slate-800 overflow-x-auto border-b border-slate-700">
        <div className="flex items-center gap-1 mr-2">
          <button onClick={()=>setBaseView('photo')}
            className={`px-3 py-1 rounded text-xs font-bold ${baseView==='photo'?'bg-blue-600 text-white':'bg-slate-700 text-slate-300'}`}>
            {facadePng ? 'Façade SVG' : 'Photo'}
          </button>
          <button onClick={()=>setBaseView('facade')}
            className={`px-3 py-1 rounded text-xs font-bold ${baseView==='facade'?'bg-blue-600 text-white':'bg-slate-700 text-slate-300'}`}>
            Plan façade
          </button>
        </div>
        {dimensionsFromWizard && (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-600/40">✓ Cotes du projet</span>
        )}
        {TOOLS.map(t => (
          <button key={t.id} onClick={()=>setTool(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition ${
              tool===t.id?'bg-slate-600 text-white ring-2 ring-offset-1 ring-offset-slate-800':'text-slate-400 hover:bg-slate-700'
            }`}
            style={tool===t.id?{borderColor:t.color,borderWidth:'2px'}:{}}>
            {t.icon} {t.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 self-center px-2">💡 Cliquez pour créer · glissez pour redimensionner</div>
      </div>

      {/* DIMS ÉDITABLES */}
      <div className="bg-slate-900 border-b border-slate-700 p-2 flex flex-wrap gap-2 items-center text-xs">
        <span className="text-slate-400">Cotes :</span>
        <label className="text-slate-300">L <input value={cabinetDims.width} onChange={e=>setCabinetDims(v=>({...v,width:toNum(e.target.value,0)}))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">H <input value={cabinetDims.height} onChange={e=>setCabinetDims(v=>({...v,height:toNum(e.target.value,0)}))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">Plinthe <input value={cabinetDims.plinth} onChange={e=>setCabinetDims(v=>({...v,plinth:toNum(e.target.value,0)}))}
          className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <span className="text-slate-500 ml-2">Modules :</span>
        {moduleWidths.map((w,i) => (
          <label key={i} className="text-slate-300">M{i+1} <input value={w} onChange={e=>updateModuleWidth(i,e.target.value)}
            className="w-16 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/></label>
        ))}
      </div>

      {/* CANVAS SVG */}
      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
        <svg ref={svgRef} width={imgSize.w} height={imgSize.h}
          className="shadow-2xl"
          style={{ background: baseView === 'facade' ? '#f8fafc' : '#1e293b' }}
          onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}     onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}>

          {/* Vue PHOTO */}
          {baseView === 'photo' && imgSrc && (
            <image href={imgSrc} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet"/>
          )}

          {/* Vue PLAN FAÇADE — moteur bois réaliste */}
          {baseView === 'facade' && (
            <FacadeRealisteSVG
              svgW={imgSize.w}
              svgH={imgSize.h}
              cabW={cabinetDims.width}
              cabH={cabinetDims.height}
              plinth={cabinetDims.plinth}
              thick={thickness}
              modulesData={modulesData}
              joints={joints}
              floatEls={floatElsForFacade}
              imgSize={imgSize}
            />
          )}

          {/* Annotations utilisateur (mode photo uniquement — en mode façade elles sont rendu via floatEls) */}
          {baseView === 'photo' && elements.map(renderElement)}
          {baseView === 'facade' && elements
            .filter(el => ['dim','note'].includes(el.type))
            .map(renderElement)}
        </svg>
      </div>

      {/* NOTES GÉNÉRALES */}
      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea value={generalNotes} onChange={e=>setGeneralNotes(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none"/>
      </div>

      {/* MODAL cote */}
      {editingDimId && (() => {
        const dim = elements.find(e=>e.id===editingDimId);
        if (!dim) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={()=>setEditingDimId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[260px]" onClick={e=>e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📏 Valeur de la cote (cm)</h3>
              <input autoFocus type="number" defaultValue={dim.label||''} placeholder="ex: 120"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white text-lg"
                onKeyDown={e=>{
                  if(e.key==='Enter'){setElements(prev=>prev.map(el=>el.id===editingDimId?{...el,label:e.target.value.trim()}:el));setEditingDimId(null);}
                  if(e.key==='Escape') setEditingDimId(null);
                }}/>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-bold text-sm"
                  onClick={e=>{
                    const input=e.target.closest('div').parentElement.querySelector('input');
                    setElements(prev=>prev.map(el=>el.id===editingDimId?{...el,label:input.value.trim()}:el));
                    setEditingDimId(null);
                  }}>✓ Valider</button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={()=>setEditingDimId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL note */}
      {editingNoteId && (() => {
        const note = elements.find(e=>e.id===editingNoteId);
        if (!note) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center" onClick={()=>setEditingNoteId(null)}>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 shadow-xl min-w-[280px]" onClick={e=>e.stopPropagation()}>
              <h3 className="text-white font-bold mb-3">📝 Modifier la note</h3>
              <input autoFocus type="text" defaultValue={note.text}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-500 rounded text-white"
                onKeyDown={e=>{
                  if(e.key==='Enter'){const v=e.target.value.trim();if(v)setElements(prev=>prev.map(el=>el.id===editingNoteId?{...el,text:v}:el));setEditingNoteId(null);}
                  if(e.key==='Escape') setEditingNoteId(null);
                }}/>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-sm"
                  onClick={e=>{
                    const input=e.target.closest('div').parentElement.querySelector('input');
                    const v=input.value.trim();
                    if(v) setElements(prev=>prev.map(el=>el.id===editingNoteId?{...el,text:v}:el));
                    setEditingNoteId(null);
                  }}>✓ Valider</button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm" onClick={()=>setEditingNoteId(null)}>Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
