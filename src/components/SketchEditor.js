import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import CabinetElevationFront from './CabinetElevationFront';
import { captureFacadeToImage } from '../utils/captureFacadeToImage';

const TOOLS = [
  { id: 'drawer', icon: '🗄️', label: 'Tiroir',   color: '#fbbf24' },
  { id: 'shelf',  icon: '📦', label: 'Tablette', color: '#34d399' },
  { id: 'rod',    icon: '👔', label: 'Tringle',  color: '#f472b6' },
  { id: 'door',   icon: '🚪', label: 'Porte',    color: '#60a5fa' },
  { id: 'sliding',icon: '🚪↔️', label: 'Coulissante', color: '#93c5fd' },
  { id: 'dim',    icon: '📏', label: 'Cote',     color: '#22d3ee' },
  { id: 'note',   icon: '📝', label: 'Note',     color: '#fb923c' },
  { id: 'erase',  icon: '🧹', label: 'Effacer',  color: '#f87171' },
];

const LS_SKETCH_KEY               = 'pc_sketch_editor';
const FACADE_CAPTURE_WIDTH        = 980;
const FACADE_CAPTURE_INITIAL_DELAY_MS = 150;
const FACADE_CAPTURE_DEBOUNCE_MS  = 400;
const WOOD_FILL            = '#f5ede0';
const WOOD_STROKE          = '#8b6914';
const DIM_COLOR            = '#dc2626';
const DOUBLE_COLOR         = '#d97706';
const MARGIN               = { l: 65, r: 52, t: 55, b: 65 };

const uid   = () => Math.random().toString(36).slice(2, 9);
const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const defaultDrawerParts = () => ({ front: true, back: true, left: true, right: true, bottom: true });
const defaultModuleDetail = (drawerCount = 0) => ({
  hasBack: true,
  slidingDoors: 0,
  drawerHeights: Array(Math.max(0, drawerCount)).fill(18),
  drawerParts: defaultDrawerParts(),
});

const normalizeModulesFromResult = (result, width = 0) => {
  const cabinet  = result?.cabinet || {};
  const raw      = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  const detailed = raw.filter(m => typeof m === 'object' && m !== null);
  if (detailed.length > 0) {
    return detailed.map((m) => ({
      id:      uid(),
      width:   Math.max(1, toNum(m.width ?? m.w ?? m.largeur, 1)),
      drawers: Math.max(0, parseInt(m.drawers ?? m.nb_drawers ?? 0, 10) || 0),
      doors:   Math.max(0, parseInt(m.doors   ?? m.nb_doors   ?? 0, 10) || 0),
      slidingDoors: Math.max(0, parseInt(m.slidingDoors ?? m.nb_sliding_doors ?? 0, 10) || 0),
    }));
  }
  const n  = Math.max(1, parseInt(cabinet.nb_dividers ?? 4, 10) + 1);
  const mw = width > 0 ? width / n : 50;
  return Array.from({ length: n }, () => ({
    id: uid(), width: mw, drawers: 0, doors: 0, slidingDoors: 0,
  }));
};

const normalizeItemsFromResult = (result) => {
  const cabinet = result?.cabinet || {};
  const raw     = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  const items   = [];
  raw.forEach((m, modIdx) => {
    if (!m || typeof m !== 'object') return;
    if (Array.isArray(m.shelves) && m.shelves.length > 0) {
      const shelfYs = m.shelves
        .map(s => (typeof s === 'object' && s !== null ? toNum(s.y, null) : toNum(s, null)))
        .filter(y => y !== null && y >= 0);
      const interiorH = Math.max(1, toNum(cabinet.height, 240) - toNum(cabinet.plinth, 0));
      shelfYs.forEach((y) => {
        items.push({ id: uid(), type: 'shelf', modIdx, yRatio: clamp(1 - (y / interiorH), 0.02, 0.98) });
      });
    } else {
      const nbSh = parseInt(m.shelves ?? m.nb_shelves ?? 0, 10) || 0;
      for (let si = 0; si < nbSh; si++) {
        items.push({ id: uid(), type: 'shelf', modIdx, yRatio: (si + 1) / (nbSh + 1) });
      }
    }

    if (Array.isArray(m.rods) && m.rods.length > 0) {
      const rodYs = m.rods
        .map(r => (typeof r === 'object' && r !== null ? toNum(r.y, null) : toNum(r, null)))
        .filter(y => y !== null && y >= 0);
      const interiorH = Math.max(1, toNum(cabinet.height, 240) - toNum(cabinet.plinth, 0));
      rodYs.forEach((y) => {
        items.push({ id: uid(), type: 'rod', modIdx, yRatio: clamp(1 - (y / interiorH), 0.02, 0.98) });
      });
    } else {
      const hasRod = Boolean(m.rod ?? m.tringle ?? m.hanging ?? m.penderie ?? false);
      if (hasRod) items.push({ id: uid(), type: 'rod', modIdx, yRatio: 0.32 });
    }
  });
  return items;
};

const jointThickness = (isDouble, t) => isDouble ? t * 2 : t;

function computeMRects(facadeModules, joints, thPx, drawW, drawH, mL, mT, plPx) {
  const innerH     = drawH - plPx;
  const totalSepPx = joints.reduce((acc, j) => acc + (j ? 2 * thPx : thPx), 0) + 2 * thPx;
  const avail      = drawW - totalSepPx;
  const totalModW  = facadeModules.reduce((a, m) => a + m.width, 0);
  const scale      = avail / Math.max(1, totalModW);
  let xCur = mL + thPx;
  return facadeModules.map((m, i) => {
    const wPx = m.width * scale;
    const r = {
      x: xCur, w: wPx, m, i,
      intTop:    mT + thPx,
      intBottom: mT + innerH - thPx,
      intH:      innerH - 2 * thPx,
      innerH,
    };
    xCur += wPx + (i < facadeModules.length - 1 ? (joints[i] ? 2 * thPx : thPx) : 0);
    return r;
  });
}

function FacadeRealisteSVG({
  svgW, svgH, cabW, cabH, plinth, thick,
  facadeModules, facadeItems, joints, moduleDetails,
  globalSliding,
  onFacadePointerDown,
  onItemPointerDown,
  onItemErase,
  onModuleClick,
  onModuleErase,
  activeTool,
}) {
  const drawW  = svgW - MARGIN.l - MARGIN.r;
  const drawH  = svgH - MARGIN.t  - MARGIN.b;
  const thPx   = thick * (drawW / Math.max(1, cabW));
  const plPx   = plinth * (drawH / Math.max(1, cabH));
  const innerH = drawH - plPx;
  const mL     = MARGIN.l;
  const mT     = MARGIN.t;
  const mRects = computeMRects(facadeModules, joints, thPx, drawW, drawH, mL, mT, plPx);

  const isErase   = activeTool === 'erase';
  const isPlace   = ['shelf','rod'].includes(activeTool);
  const isAdd     = ['drawer','door','sliding'].includes(activeTool);

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

  return (
    <g>
      {defs}
      <rect x={mL} y={mT} width={drawW} height={drawH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="2.5"/>
      <rect x={mL+thPx} y={mT+thPx} width={drawW-2*thPx} height={innerH-thPx} fill="#ede4d3"/>
      {plPx > 2 && (
        <g>
          <rect x={mL} y={mT+innerH} width={drawW} height={plPx} fill="#c8b07c" stroke={WOOD_STROKE} strokeWidth="1.5"/>
          <line x1={mL} y1={mT+innerH} x2={mL+drawW} y2={mT+innerH} stroke={WOOD_STROKE} strokeWidth="2"/>
        </g>
      )}
      <rect x={mL}             y={mT} width={thPx}  height={innerH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      <rect x={mL+drawW-thPx}  y={mT} width={thPx}  height={innerH} fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      <rect x={mL} y={mT}              width={drawW}  height={thPx}  fill="url(#pcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>
      <rect x={mL} y={mT+innerH-thPx}  width={drawW}  height={thPx}  fill="url(#pcGT)" stroke={WOOD_STROKE} strokeWidth="1.5"/>

      {mRects.map(({ x, w, i }) => {
        if (i >= facadeModules.length - 1) return null;
        const isDouble = joints[i];
        const sepX = x + w;
        return isDouble ? (
          <g key={`sep-${i}`}>
            <rect x={sepX}      y={mT} width={thPx} height={innerH} fill="url(#pcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
            <rect x={sepX+thPx} y={mT} width={thPx} height={innerH} fill="url(#pcGDouble)" stroke={WOOD_STROKE} strokeWidth="1"/>
            <line x1={sepX+thPx} y1={mT+2} x2={sepX+thPx} y2={mT+innerH-2}
              stroke={DOUBLE_COLOR} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9"/>
            <text x={sepX+thPx} y={mT+innerH+36} textAnchor="middle" fill={DOUBLE_COLOR} fontSize="9" fontWeight="700">⬛⬛</text>
          </g>
        ) : (
          <rect key={`sep-${i}`} x={sepX} y={mT} width={thPx} height={innerH}
            fill="url(#pcGW)" stroke={WOOD_STROKE} strokeWidth="1"/>
        );
      })}

      {mRects.map(({ x, w, m, i, intTop, intBottom, intH: iH }) => {
        const nbD     = m.drawers || 0;
        const customHeights = Array.isArray(moduleDetails?.[i]?.drawerHeights)
          ? moduleDetails[i].drawerHeights.slice(0, nbD).map(v => Math.max(5, toNum(v, 18)))
          : [];
        const interiorCm = Math.max(1, cabH - plinth);
        const cmToPx = iH / interiorCm;
        const customHeightsPx = customHeights.map(h => h * cmToPx);
        const fallbackDrawerH = Math.min(iH * 0.12, 34);
        const drawHeightsPx = customHeightsPx.length === nbD
          ? customHeightsPx
          : Array.from({ length: nbD }, () => fallbackDrawerH);
        const drawPx  = drawHeightsPx.reduce((a, b) => a + b, 0);
        const nbDoors = m.doors || 0;
        const nbSliding = m.slidingDoors || 0;

        let accDrawer = 0;
        const tiroirs = Array.from({ length: nbD }, (_, di) => {
          const hPx = drawHeightsPx[di] || fallbackDrawerH;
          const dy = intBottom - drawPx + accDrawer;
          accDrawer += hPx;
          return (
            <g key={`dr-${i}-${di}`}
              onClick={e => { e.stopPropagation(); if (isErase) onModuleErase(i, 'drawer'); }}
              style={{ cursor: isErase ? 'pointer' : 'default' }}>
              <rect x={x+2} y={dy+1} width={w-4} height={Math.max(hPx-2, 8)} fill="#f8f5ee" stroke={WOOD_STROKE} strokeWidth="1" rx="1"/>
              <line x1={x+2} y1={dy+1} x2={x+w-2} y2={dy+1} stroke={WOOD_STROKE} strokeWidth="0.5"/>
              <rect x={x+w/2-14} y={dy+hPx/2-3.5} width="28" height="7" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" rx="3"/>
              <ellipse cx={x+w/2} cy={dy+hPx/2} rx="3.5" ry="2.5" fill="#6b7280"/>
              {isErase && <rect x={x+2} y={dy+1} width={w-4} height={Math.max(hPx-2,8)} fill="red" opacity="0.18" rx="1"/>}
            </g>
          );
        });

        const nd     = Math.min(nbDoors, 2);
        const portes = Array.from({ length: nd }, (_, di) => {
          const dw  = nd === 2 ? w / 2 : w;
          const dx  = nd === 2 && di === 1 ? x + w / 2 : x;
          const pad = Math.max(8, dw * 0.08);
          const hx2 = di === 0 ? dx + dw - 14 : dx + 10;
          return (
            <g key={`door-${i}-${di}`}
              onClick={e => { e.stopPropagation(); if (isErase) onModuleErase(i, 'door'); }}
              style={{ cursor: isErase ? 'pointer' : 'default' }}>
              <rect x={dx+2} y={intTop+2} width={dw-4} height={iH-4} fill="url(#pcGDoor)" stroke={WOOD_STROKE} strokeWidth="1.5" rx="1"/>
              <rect x={dx+pad} y={intTop+pad} width={dw-2*pad} height={iH-2*pad} fill="none" stroke={WOOD_STROKE} strokeWidth="0.8" opacity="0.5"/>
              <rect x={hx2-4} y={intTop+iH/2-10} width="8" height="20" fill="#a0a0a0" stroke="#666" strokeWidth="0.8" rx="3"/>
              {isErase && <rect x={dx+2} y={intTop+2} width={dw-4} height={iH-4} fill="red" opacity="0.15" rx="1"/>}
            </g>
          );
        });

        const sliding = nbSliding > 0 ? (
          <g
            onClick={e => { e.stopPropagation(); if (isErase) onModuleErase(i, 'sliding'); }}
            style={{ cursor: isErase ? 'pointer' : 'default' }}
          >
            <rect x={x+3} y={intTop+3} width={w-6} height={iH-6} fill="none" stroke="#60a5fa" strokeWidth="1.3" rx="1" />
            <line x1={x+6} y1={intTop+8} x2={x+w-6} y2={intTop+8} stroke="#60a5fa" strokeWidth="1.5" />
            <line x1={x+6} y1={intTop+iH-8} x2={x+w-6} y2={intTop+iH-8} stroke="#60a5fa" strokeWidth="1.5" />
            <rect x={x+6} y={intTop+12} width={w*0.52} height={iH-24} fill="rgba(147,197,253,0.15)" stroke="#60a5fa" strokeWidth="1" />
            <rect x={x+w*0.42-6} y={intTop+12} width={w*0.52} height={iH-24} fill="rgba(147,197,253,0.22)" stroke="#3b82f6" strokeWidth="1" />
          </g>
        ) : null;

        const numY = intTop + Math.max(30, (iH - drawPx) * 0.45);
        const hitZone = (isPlace || isAdd) ? (
          <rect key={`hit-${i}`} x={x} y={intTop} width={w} height={iH}
            fill="transparent" style={{ cursor: 'cell' }}
            onMouseDown={e => {
              e.stopPropagation();
              if (isPlace) { onFacadePointerDown(e, i); }
              else { onModuleClick(i, activeTool); }
            }}/>
        ) : null;

        return (
          <g key={`mod-${i}`}>
            <rect x={x} y={intTop} width={w} height={iH} fill="#faf5ed" stroke={WOOD_STROKE} strokeWidth="0.7"/>
            {tiroirs}
            {portes}
            {sliding}
            <circle cx={x+w/2} cy={numY} r="20" fill="none" stroke={DIM_COLOR} strokeWidth="2"/>
            <text x={x+w/2} y={numY+6} textAnchor="middle" fill={DIM_COLOR} fontWeight="700" fontSize="17">{i+1}</text>
            <line x1={x}   y1={mT+drawH+10} x2={x+w} y2={mT+drawH+10} stroke="#b45309" strokeWidth="1"/>
            <line x1={x}   y1={mT+drawH+6}  x2={x}   y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
            <line x1={x+w} y1={mT+drawH+6}  x2={x+w} y2={mT+drawH+14} stroke="#b45309" strokeWidth="1"/>
            <text x={x+w/2} y={mT+drawH+26} textAnchor="middle" fill="#b45309" fontWeight="700" fontSize="11">{m.width.toFixed(2)} cm</text>
            {hitZone}
          </g>
        );
      })}

      {facadeItems.map(item => {
        const mr = mRects[item.modIdx];
        if (!mr) return null;
        const { x, w, intTop, intH: iH } = mr;
        const ey = intTop + item.yRatio * iH;
        if (item.type === 'shelf') {
          return (
            <g key={item.id}
              style={{ cursor: isErase ? 'pointer' : 'grab' }}
              onMouseDown={e => { e.stopPropagation(); if (!isErase) onItemPointerDown(e, item.id); }}
              onClick={e => { e.stopPropagation(); if (isErase) onItemErase(item.id); }}>
              <rect x={x} y={ey-3.5} width={w} height={6.5} fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1"/>
              <circle cx={x+9}   cy={ey} r="2.5" fill={WOOD_STROKE}/>
              <circle cx={x+w-9} cy={ey} r="2.5" fill={WOOD_STROKE}/>
              <rect x={x} y={ey-10} width={w} height="20" fill="transparent"/>
              {isErase && <rect x={x} y={ey-8} width={w} height="16" fill="red" opacity="0.2"/>}
            </g>
          );
        }
        if (item.type === 'rod') {
          return (
            <g key={item.id}
              style={{ cursor: isErase ? 'pointer' : 'grab' }}
              onMouseDown={e => { e.stopPropagation(); if (!isErase) onItemPointerDown(e, item.id); }}
              onClick={e => { e.stopPropagation(); if (isErase) onItemErase(item.id); }}>
              <rect x={x+8}    y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
              <rect x={x+w-15} y={ey-10} width="7"  height="18" fill="#6b7280" rx="2"/>
              <line x1={x+16} y1={ey} x2={x+w-15} y2={ey} stroke="#4b5563" strokeWidth="6" strokeLinecap="round"/>
              <line x1={x+16} y1={ey-2} x2={x+w-15} y2={ey-2} stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
              <rect x={x+8} y={ey-12} width={w-20} height="24" fill="transparent"/>
              {isErase && <rect x={x+8} y={ey-12} width={w-20} height="24" fill="red" opacity="0.18" rx="4"/>}
            </g>
          );
        }
        return null;
      })}

      <line x1={mL} y1={mT-26} x2={mL+drawW} y2={mT-26} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL}       y1={mT-32} x2={mL}       y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW} y1={mT-32} x2={mL+drawW} y2={mT-20} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <text x={mL+drawW/2} y={mT-30} textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700">{cabW} cm</text>
      <line x1={mL+drawW+24} y1={mT}       x2={mL+drawW+24} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW+18} y1={mT}       x2={mL+drawW+30} y2={mT}       stroke={DIM_COLOR} strokeWidth="1.5"/>
      <line x1={mL+drawW+18} y1={mT+drawH} x2={mL+drawW+30} y2={mT+drawH} stroke={DIM_COLOR} strokeWidth="1.5"/>
      <text x={mL+drawW+40} y={mT+drawH/2} textAnchor="middle" fill={DIM_COLOR} fontSize="13" fontWeight="700"
        transform={`rotate(90 ${mL+drawW+40} ${mT+drawH/2})`}>{cabH} cm</text>

      {globalSliding?.enabled && (
        <g>
          <line x1={mL+4} y1={mT+10} x2={mL+drawW-4} y2={mT+10} stroke="#38bdf8" strokeWidth="2" />
          <line x1={mL+4} y1={mT+innerH-10} x2={mL+drawW-4} y2={mT+innerH-10} stroke="#38bdf8" strokeWidth="2" />
          <text x={mL + drawW/2} y={mT + 24} textAnchor="middle" fill="#0ea5e9" fontSize="11" fontWeight="700">
            {globalSliding.count} vantaux coulissants · H {globalSliding.heightCm} cm
          </text>
        </g>
      )}
    </g>
  );
}

export default function SketchEditor({ image, scanImage, initialResult, apiKey, draft, onDraftChange, onComplete, onCancel }) {
  const rawImg             = image || scanImage || null;
  const svgRef             = useRef(null);
  const facadeSvgRef       = useRef(null);
  const facadeContainerRef = useRef(null);
  const onDraftChangeRef   = useRef(onDraftChange);
  const drag               = useRef({ on: false, startX: 0, startY: 0, elStartX: 0, elStartY: 0 });
  const facadeDrag         = useRef({ active: false, itemId: null, startY: 0, startYRatio: 0, modIdx: -1 });
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);

  const [facadePng, setFacadePng] = useState(null);
  const imgSrc               = facadePng || rawImg;
  const initialCab           = initialResult?.cabinet || {};
  const dimensionsFromWizard = Boolean(initialResult?._dimensionsFromWizard);
  const sketchFingerprint = useMemo(() => {
    const cab = initialResult?.cabinet || {};
    const mods = Array.isArray(cab.modules)
      ? cab.modules.map((m) => ({
          w: Number(m?.width ?? m?.w ?? 0),
          d: Number(m?.drawers ?? m?.nb_drawers ?? 0),
          s: Array.isArray(m?.shelves) ? m.shelves.length : Number(m?.shelves ?? m?.nb_shelves ?? 0),
          r: Array.isArray(m?.rods) ? m.rods.length : Number(Boolean(m?.rod ?? m?.rods ?? m?.tringle)),
        }))
      : [];
    return JSON.stringify({
      w: Number(cab.width ?? 0),
      h: Number(cab.height ?? 0),
      p: Number(cab.plinth ?? 0),
      m: mods,
      pieces: Array.isArray(initialResult?.pieces) ? initialResult.pieces.length : 0,
    });
  }, [initialResult]);

  // ─── Cache intelligent : restaurer uniquement le brouillon du même scan ─────
  const hasFreshScanResult = Boolean(
    initialResult && (
      initialResult.cabinet ||
      (Array.isArray(initialResult.pieces) && initialResult.pieces.length > 0)
    )
  );
  const savedState = (() => {
    try {
      const draftFingerprint = draft?.fingerprint || null;
      const draftState = draft?.state || draft || null;
      if (draftFingerprint && draftFingerprint === sketchFingerprint && draftState) return draftState;

      const r = localStorage.getItem(LS_SKETCH_KEY);
      if (!r) return null;
      const parsed = JSON.parse(r);
      const state = parsed?.state || parsed;
      const savedFingerprint = parsed?.fingerprint || null;
      if (!savedFingerprint) return hasFreshScanResult ? null : state;
      return savedFingerprint === sketchFingerprint ? state : null;
    } catch { return null; }
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

  const [facadeModules, setFacadeModules] = useState(() => {
    if (savedState?.facadeModules) return savedState.facadeModules;
    return normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200));
  });
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [moduleDetails, setModuleDetails] = useState(() => savedState?.moduleDetails || []);
  const [globalSliding, setGlobalSliding] = useState(() => savedState?.globalSliding || {
    enabled: false,
    count: 2,
    heightCm: Math.max(80, toNum(initialCab.height, 240) - toNum(initialCab.plinth, 0)),
  });

  const [widthInputs, setWidthInputs] = useState(
    () => (savedState?.facadeModules || normalizeModulesFromResult(initialResult, toNum(initialCab.width, 200)))
      .map(m => String(m.width))
  );

  useEffect(() => {
    setWidthInputs(facadeModules.map(m => String(m.width)));
  }, [facadeModules.length]);
  useEffect(() => {
    setSelectedModuleIdx((idx) => Math.max(0, Math.min(idx, Math.max(0, facadeModules.length - 1))));
    setModuleDetails((prev) => {
      return facadeModules.map((_, i) => ({
        ...defaultModuleDetail(facadeModules[i]?.drawers || 0),
        hasBack: prev[i]?.hasBack ?? true,
        slidingDoors: prev[i]?.slidingDoors ?? 0,
        drawerHeights: (() => {
          const count = Math.max(0, facadeModules[i]?.drawers || 0);
          const base = Array.isArray(prev[i]?.drawerHeights) ? prev[i].drawerHeights : [];
          return Array.from({ length: count }, (_, di) => Math.max(5, toNum(base[di], 18)));
        })(),
        drawerParts: {
          ...defaultDrawerParts(),
          ...(prev[i]?.drawerParts || {}),
        },
      }));
    });
  }, [facadeModules.length]);

  const commitWidth = (idx) => {
    const n = Math.max(1, toNum(widthInputs[idx], 1));
    setFacadeModules(prev => prev.map((m, i) => i === idx ? { ...m, width: n } : m));
    setWidthInputs(prev => prev.map((v, i) => i === idx ? String(n) : v));
  };

  const [facadeItems, setFacadeItems] = useState(() => {
    if (savedState?.facadeItems) return savedState.facadeItems;
    return normalizeItemsFromResult(initialResult);
  });

  const nbJoints = Math.max(0, facadeModules.length - 1);
  const [joints, setJoints] = useState(
    () => savedState?.joints || Array(nbJoints).fill(true)
  );
  useEffect(() => {
    setJoints(prev => {
      const n = Math.max(0, facadeModules.length - 1);
      if (prev.length === n) return prev;
      const next = Array(n).fill(true);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }, [facadeModules.length]);
  const toggleJoint = (i) => setJoints(prev => prev.map((v, idx) => idx === i ? !v : v));

  const thickness          = toNum(initialCab.thickness ?? initialCab.panel_thickness, 1.8);
  const totalJointsWidth   = joints.reduce((s, d) => s + jointThickness(d, thickness), 0);
  const totalInteriorWidth = Math.max(1, toNum(cabinetDims.width, 200) - thickness * 2 - totalJointsWidth);

  // ─── FIX v3.6 : Re-synchronise tous les états quand initialResult change ─────
  const prevResultRef = useRef(initialResult);
  useEffect(() => {
    if (prevResultRef.current === initialResult) return;
    prevResultRef.current = initialResult;
    const cab = initialResult?.cabinet || {};
    setCabinetDims({
      width:  toNum(cab.width,  200),
      height: toNum(cab.height, 240),
      plinth: toNum(cab.plinth,   0),
    });
    const newModules = normalizeModulesFromResult(initialResult, toNum(cab.width, 200));
    setFacadeModules(newModules);
    setModuleDetails(newModules.map((m) => defaultModuleDetail(m.drawers || 0)));
    setGlobalSliding({
      enabled: false,
      count: 2,
      heightCm: Math.max(80, toNum(cab.height, 240) - toNum(cab.plinth, 0)),
    });
    setFacadeItems(normalizeItemsFromResult(initialResult));
    setJoints(Array(Math.max(0, newModules.length - 1)).fill(true));
    didAutoSwitchRef.current = false;
  }, [initialResult]);

  const currentCabinet = useMemo(() => {
    const w = cabinetDims.width;
    const h = cabinetDims.height;
    const pl = cabinetDims.plinth;
    if (!w || !h) return null;
    const interiorH = Math.max(1, h - pl);
    return {
      width: w, height: h, plinth: pl,
      globalSlidingDoors: globalSliding.enabled
        ? {
            count: Math.max(2, Math.min(4, parseInt(globalSliding.count, 10) || 2)),
            heightCm: Math.max(40, toNum(globalSliding.heightCm, h - pl)),
          }
        : null,
      modules: facadeModules.map((m, i) => {
        const details = {
          ...defaultModuleDetail(m.drawers || 0),
          ...(moduleDetails[i] || {}),
          drawerParts: {
            ...defaultDrawerParts(),
            ...(moduleDetails[i]?.drawerParts || {}),
          },
        };
        const drawerHeights = Array.isArray(details.drawerHeights)
          ? details.drawerHeights.map((v) => Math.max(5, toNum(v, 18)))
          : [];
        let drawerY = 0;
        const drawerItems = drawerHeights.map((heightCm) => {
          const item = { y: drawerY, height: heightCm };
          drawerY += heightCm;
          return item;
        });
        return {
          id: i + 1,
          width: m.width,
          drawers: m.drawers,
          drawerItems,
          doors: m.doors,
          slidingDoors: details.slidingDoors || 0,
          hasBack: details.hasBack ?? true,
          drawerParts: details.drawerParts,
          rods: facadeItems
            .filter(it => it.type === 'rod' && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
          shelves: facadeItems
            .filter(it => it.type === 'shelf' && Number(it.modIdx) === i)
            .map(it => ({ y: (1 - it.yRatio) * interiorH })),
        };
      }),
    };
  }, [cabinetDims, facadeModules, facadeItems, moduleDetails, globalSliding]);

  const saveToStorage = useCallback(() => {
    const payload = {
      fingerprint: sketchFingerprint,
      state: {
        elements, cabinetDims, facadeModules, facadeItems, moduleDetails, generalNotes, joints,
        globalSliding,
      },
    };
    localStorage.setItem(LS_SKETCH_KEY, JSON.stringify(payload));
    if (onDraftChangeRef.current) onDraftChangeRef.current(payload);
  }, [elements, cabinetDims, facadeModules, facadeItems, moduleDetails, generalNotes, joints, globalSliding, sketchFingerprint]);

  useEffect(() => { saveToStorage(); }, [saveToStorage]);
  const handleSave = saveToStorage;

  const didAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (!currentCabinet) return;
    const isFirst = !didAutoSwitchRef.current;
    const delay   = isFirst ? FACADE_CAPTURE_INITIAL_DELAY_MS : FACADE_CAPTURE_DEBOUNCE_MS;
    const timer = setTimeout(async () => {
      const png = await captureFacadeToImage(facadeContainerRef);
      if (png) {
        setFacadePng(png);
        if (isFirst) { setBaseView('photo'); didAutoSwitchRef.current = true; }
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [currentCabinet]);

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

  const FACADE_W = 1140;
  const FACADE_H = 700;

  const getFacadeGeometry = useCallback(() => {
    const drawW = imgSize.w - MARGIN.l - MARGIN.r;
    const drawH = imgSize.h - MARGIN.t  - MARGIN.b;
    const thPx  = thickness * (drawW / Math.max(1, cabinetDims.width));
    const plPx  = cabinetDims.plinth * (drawH / Math.max(1, cabinetDims.height));
    return computeMRects(facadeModules, joints, thPx, drawW, drawH, MARGIN.l, MARGIN.t, plPx);
  }, [imgSize, thickness, cabinetDims, facadeModules, joints]);

  const getSVGCoords = useCallback((e) => {
    const svg = svgRef.current;
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

  const handleFacadePointerDown = useCallback((e, modIdx) => {
    e.stopPropagation();
    const { y } = getSVGCoords(e);
    const mRects = getFacadeGeometry();
    const mr     = mRects[modIdx];
    if (!mr) return;
    const yRatio = clamp((y - mr.intTop) / mr.intH, 0.02, 0.98);
    const newItem = { id: uid(), type: tool, modIdx, yRatio };
    setFacadeItems(prev => [...prev, newItem]);
    facadeDrag.current = { active: true, itemId: newItem.id, startY: y, startYRatio: yRatio, modIdx, intTop: mr.intTop, intH: mr.intH };
  }, [tool, getSVGCoords, getFacadeGeometry]);

  const handleItemPointerDown = useCallback((e, itemId) => {
    e.stopPropagation();
    const { y } = getSVGCoords(e);
    const item   = facadeItems.find(it => it.id === itemId);
    if (!item) return;
    const mRects = getFacadeGeometry();
    const mr     = mRects[item.modIdx];
    if (!mr) return;
    facadeDrag.current = { active: true, itemId, startY: y, startYRatio: item.yRatio, modIdx: item.modIdx, intTop: mr.intTop, intH: mr.intH };
  }, [getSVGCoords, getFacadeGeometry, facadeItems]);

  const handleModuleClick = useCallback((modIdx, activeTool) => {
    setFacadeModules(prev => prev.map((m, i) => {
      if (i !== modIdx) return m;
      if (activeTool === 'drawer') return { ...m, drawers: m.drawers + 1 };
      if (activeTool === 'door')   return { ...m, doors: Math.min(m.doors + 1, 2), slidingDoors: 0 };
      if (activeTool === 'sliding') return { ...m, slidingDoors: 2, doors: 0 };
      return m;
    }));
  }, []);

  const handleModuleErase = useCallback((modIdx, type) => {
    setFacadeModules(prev => prev.map((m, i) => {
      if (i !== modIdx) return m;
      if (type === 'drawer') return { ...m, drawers: Math.max(0, m.drawers - 1) };
      if (type === 'door')   return { ...m, doors:   Math.max(0, m.doors   - 1) };
      if (type === 'sliding') return { ...m, slidingDoors: 0 };
      return m;
    }));
  }, []);

  const handleItemErase = useCallback((itemId) => {
    setFacadeItems(prev => prev.filter(it => it.id !== itemId));
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (facadeDrag.current.active) {
      const { y } = getSVGCoords(e);
      const { itemId, intTop, intH } = facadeDrag.current;
      const yRatio = clamp((y - intTop) / intH, 0.02, 0.98);
      setFacadeItems(prev => prev.map(it => it.id === itemId ? { ...it, yRatio } : it));
      return;
    }
    if (!resizingId && !draggingId) return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (resizingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== resizingId) return el;
        if (el.type === 'dim') return { ...el, x2: x, y2: y };
        return { ...el, w: Math.max(10, x - el.x), h: Math.max(10, y - el.y) };
      }));
    } else if (draggingId) {
      setElements(prev => prev.map(el => {
        if (el.id !== draggingId) return el;
        return { ...el, x: drag.current.elStartX + (x - drag.current.startX), y: drag.current.elStartY + (y - drag.current.startY) };
      }));
    }
  }, [resizingId, draggingId, getSVGCoords]);

  const handlePointerUp = useCallback(() => {
    facadeDrag.current.active = false;
    if (resizingId) {
      const el = elements.find(e => e.id === resizingId);
      if (el?.type === 'dim') {
        const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
        if (Math.sqrt(dx * dx + dy * dy) > 15) setEditingDimId(resizingId);
      }
    }
    setResizingId(null); setDraggingId(null);
  }, [resizingId, elements]);

  const handlePointerDown = useCallback((e) => {
    if (baseView === 'facade' && ['shelf','rod','drawer','door','sliding','erase'].includes(tool)) return;
    if (tool === 'erase') return;
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    if (tool === 'dim') {
      const newEl = { id: uid(), type: 'dim', x1: x, y1: y, x2: x, y2: y, label: '' };
      setElements(prev => [...prev, newEl]);
      setResizingId(newEl.id);
    } else if (tool === 'note') {
      const text = prompt('Texte de la note :');
      if (text) setElements(prev => [...prev, { id: uid(), type: 'note', x, y, text }]);
    }
  }, [tool, getSVGCoords, baseView]);

  const eraseElement = (id) => setElements(prev => prev.filter(el => el.id !== id));

  const buildContextPrompt = useCallback(() => {
    const dims  = elements.filter(e => e.type === 'dim');
    const notes = elements.filter(e => e.type === 'note');
    let ctx = '';
    if (dimensionsFromWizard && cabinetDims.width > 0)
      ctx += `DIMENSIONS IMPOSÉES :\n  width:${cabinetDims.width} cm  height:${cabinetDims.height} cm  plinth:${cabinetDims.plinth} cm\n\n`;
    ctx += `MONTANTS (ép. panneau=${thickness} cm) :\n`;
    joints.forEach((d, i) => ctx += `  M${i+1}|M${i+2}: ${d?'⬛⬛ DOUBLE':'▪️ simple'} → ${jointThickness(d,thickness).toFixed(1)} cm\n`);
    const nD = joints.filter(Boolean).length;
    ctx += `  Total joints=${totalJointsWidth.toFixed(1)} cm (${nD} double, ${joints.length-nD} simple)  Net=${totalInteriorWidth.toFixed(1)} cm\n\n`;
    ctx += 'MODULES (façade éditée par l\'utilisateur) :\n';
    facadeModules.forEach((m, i) => {
      const items    = facadeItems.filter(it => Number(it.modIdx) === i);
      const nbShelf  = items.filter(it => it.type === 'shelf').length;
      const nbRod    = items.filter(it => it.type === 'rod').length;
      const nbDrawers = typeof m.drawers === 'number' ? m.drawers : 0;
      const nbDoors   = typeof m.doors   === 'number' ? m.doors   : 0;
      const det = moduleDetails[i] || { hasBack: true, drawerParts: defaultDrawerParts() };
      const dp = { ...defaultDrawerParts(), ...(det.drawerParts || {}) };
      ctx += `  M${i+1}: L=${m.width.toFixed(2)}cm  tiroirs=${nbDrawers}  tablettes=${nbShelf}  tringles=${nbRod}  portes=${nbDoors}  coulissantes=${det.slidingDoors || 0}  fond=${det.hasBack ? 'oui' : 'non'}\n`;
      if (nbDrawers > 0) {
        const hList = Array.isArray(det.drawerHeights) ? det.drawerHeights.map(v => Math.max(5, toNum(v, 18))) : [];
        ctx += `      hauteurs_tiroirs_cm=${hList.join(',') || 'auto'}\n`;
        ctx += `      tiroir: facade=${dp.front ? 'oui' : 'non'} arriere=${dp.back ? 'oui' : 'non'} coteG=${dp.left ? 'oui' : 'non'} coteD=${dp.right ? 'oui' : 'non'} fond=${dp.bottom ? 'oui' : 'non'}\n`;
      }
    });
    if (dims.length > 0) { ctx += 'COTES :\n'; dims.forEach(d => { if(d.label) ctx += `  ${d.label} cm\n`; }); }
    if (notes.length > 0) { ctx += 'NOTES :\n'; notes.forEach((n,i) => ctx += `  ${i+1}. "${n.text}"\n`); }
    if (generalNotes.trim()) ctx += `NOTES GÉNÉRALES : ${generalNotes.trim()}\n`;
    if (globalSliding.enabled) {
      ctx += `PORTES COULISSANTES GLOBALES: oui (vantaux=${globalSliding.count}, hauteur=${globalSliding.heightCm} cm)\n`;
    }
    ctx += `\nCOTES MEUBLE: L=${cabinetDims.width} H=${cabinetDims.height} plinthe=${cabinetDims.plinth} cm\n`;
    ctx += `INSTRUCTION: Tiens compte des doubles montants pour les largeurs nettes.`;
    return ctx;
  }, [elements, dimensionsFromWizard, cabinetDims, thickness, joints, totalJointsWidth, totalInteriorWidth, facadeModules, facadeItems, moduleDetails, generalNotes, globalSliding]);

  const handleRelancer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const facadeSvg = facadeSvgRef.current;
      if (!facadeSvg) throw new Error('SVG façade hors-écran introuvable');
      const clone = facadeSvg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width',  FACADE_W);
      clone.setAttribute('height', FACADE_H);
      const svgStr  = new XMLSerializer().serializeToString(clone);
      const b64svg  = btoa(unescape(encodeURIComponent(svgStr)));
      const dataUrl = 'data:image/svg+xml;base64,' + b64svg;
      const canvas = document.createElement('canvas');
      canvas.width  = FACADE_W * 2;
      canvas.height = FACADE_H * 2;
      const ctx2d = canvas.getContext('2d');
      await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          ctx2d.fillStyle = '#f8fafc';
          ctx2d.fillRect(0, 0, canvas.width, canvas.height);
          ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const SERVER = 'https://panelcut-server.vercel.app';
      let res = await fetch(`${SERVER}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/png', userNotes: buildContextPrompt(), prompt: buildContextPrompt() }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${SERVER}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: 'image/png' }),
        });
      }
      if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
      const data = await res.json();
      const parsed = data.result || data;

      // Fusionner avec le cabinet édité localement (currentCabinet contient
      // les modules avec positions exactes de tringles/tablettes)
      const enrichedResult = {
        ...parsed,
        cabinet: {
          ...(parsed.cabinet || {}),
          width:     parsed.cabinet?.width     || currentCabinet?.width,
          height:    parsed.cabinet?.height    || currentCabinet?.height,
          depth:     parsed.cabinet?.depth     || 60,
          plinth:    parsed.cabinet?.plinth    || currentCabinet?.plinth,
          thickness: parsed.cabinet?.thickness || 1.8,
          modules:   currentCabinet?.modules   || parsed.cabinet?.modules || [],
        },
      };

      if (onComplete) onComplete(enrichedResult);
    } catch (err) {
      console.error('handleRelancer error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onComplete, imgSize, elements, cabinetDims, facadeModules, facadeItems, generalNotes, joints, buildContextPrompt, currentCabinet]);

  const renderElement = (el) => {
    if (el.type === 'dim') return (
      <g key={el.id} data-id={el.id}
        onClick={e => { e.stopPropagation(); if (tool === 'erase') { eraseElement(el.id); return; } }}
        style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }} opacity={0.85}>
        <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4"/>
        <circle cx={el.x1} cy={el.y1} r="3" fill="#22d3ee"/>
        <circle cx={el.x2} cy={el.y2} r="3" fill="#22d3ee"/>
        <rect x={(el.x1+el.x2)/2-24} y={(el.y1+el.y2)/2-14} width="48" height="18" rx="3"
          fill={el.label?'#0e7490':'#164e63'} stroke="#22d3ee" strokeWidth="1"
          style={{cursor:'pointer'}}
          onClick={e=>{
            e.stopPropagation();
            if (tool === 'erase') { eraseElement(el.id); return; }
            setEditingDimId(el.id);
          }}/>
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

  const hint = baseView === 'facade'
    ? tool === 'erase'   ? '🧹 Clic sur un élément pour le supprimer'
    : tool === 'shelf'   ? '📦 Clic dans un module pour placer · glisser pour déplacer'
    : tool === 'rod'     ? '👔 Clic dans un module pour placer · glisser pour déplacer'
    : tool === 'drawer'  ? '🗄️ Clic dans un module pour ajouter un tiroir'
    : tool === 'door'    ? '🚪 Clic dans un module pour ajouter une porte'
    : tool === 'sliding' ? '🚪↔️ Clic dans un module pour poser 2 portes coulissantes'
    : '💡 Dim/Note : tracez sur la façade'
    : '💡 Cliquez pour créer · glissez pour déplacer';

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">

      <svg
        ref={facadeSvgRef}
        xmlns="http://www.w3.org/2000/svg"
        width={FACADE_W}
        height={FACADE_H}
        style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <rect width={FACADE_W} height={FACADE_H} fill="#f8fafc"/>
        <FacadeRealisteSVG
          svgW={FACADE_W} svgH={FACADE_H}
          cabW={cabinetDims.width} cabH={cabinetDims.height}
          plinth={cabinetDims.plinth} thick={thickness}
          facadeModules={facadeModules}
          facadeItems={facadeItems}
          joints={joints}
          moduleDetails={moduleDetails}
          globalSliding={globalSliding}
          onFacadePointerDown={() => {}}
          onItemPointerDown={() => {}}
          onItemErase={() => {}}
          onModuleClick={() => {}}
          onModuleErase={() => {}}
          activeTool="none"
        />
        {elements.filter(el => ['dim','note'].includes(el.type)).map(renderElement)}
      </svg>

      {currentCabinet && (
        <div ref={facadeContainerRef}
          style={{position:'absolute',left:'-9999px',top:0,width:`${FACADE_CAPTURE_WIDTH}px`,visibility:'hidden',pointerEvents:'none'}}
          aria-hidden="true">
          <CabinetElevationFront cabinet={currentCabinet} name={initialResult?.name||'Meuble'}/>
        </div>
      )}

      <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold">✏️ Éditeur Intelligent</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">v3.7</span>
        </div>
        <div className="flex gap-2">
          {error && <span className="text-red-400 text-sm self-center mr-2">{error}</span>}
          <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded">Annuler</button>
          <button onClick={handleSave} className="px-4 py-1 rounded font-bold text-white bg-green-600 hover:bg-green-500">
            💾 Enregistrer
          </button>
          <button onClick={handleRelancer} disabled={loading}
            className={`px-4 py-1 rounded font-bold text-white ${loading?'bg-orange-800':'bg-orange-600 hover:bg-orange-500'}`}>
            {loading ? 'Analyse...' : '🚀 Relancer Claude'}
          </button>
        </div>
      </div>

      {joints.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-amber-900/30 overflow-x-auto">
          <span className="text-xs font-bold text-amber-400 whitespace-nowrap shrink-0">🔩 Joints :</span>
          {joints.map((isDouble, i) => (
            <button key={i} onClick={() => toggleJoint(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
                isDouble ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30'
                          : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
              }`}>
              {isDouble ? '⬛⬛' : '▪️'} M{i+1}|M{i+2}
              <span className="opacity-60 text-[10px]">({isDouble?(thickness*2).toFixed(1):thickness.toFixed(1)} cm)</span>
            </button>
          ))}
          <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap shrink-0 pl-3">
            Joints : <span className="text-amber-400 font-bold">{totalJointsWidth.toFixed(1)} cm</span>
            {' · '}Net : <span className="text-green-400 font-bold">{totalInteriorWidth.toFixed(1)} cm</span>
          </span>
        </div>
      )}

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
          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-700/30 text-green-400 border border-green-600/40">✓ Cotes</span>
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
        <div className="ml-auto text-xs text-slate-400 self-center px-2 whitespace-nowrap">{hint}</div>
      </div>

      <div className="bg-slate-900 border-b border-slate-700 p-2 flex flex-wrap gap-2 items-center text-xs">
        <span className="text-slate-400">Cotes :</span>
        <label className="text-slate-300">L <input value={cabinetDims.width} onChange={e=>setCabinetDims(v=>({...v,width:toNum(e.target.value,0)}))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">H <input value={cabinetDims.height} onChange={e=>setCabinetDims(v=>({...v,height:toNum(e.target.value,0)}))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <label className="text-slate-300">Plinthe <input value={cabinetDims.plinth} onChange={e=>setCabinetDims(v=>({...v,plinth:toNum(e.target.value,0)}))} className="w-20 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"/> cm</label>
        <span className="text-slate-500 ml-2">Modules :</span>
        {facadeModules.map((m, i) => (
          <label key={m.id || i} className="text-slate-300">M{i+1}
            <input
              value={widthInputs[i] ?? ''}
              onChange={e => setWidthInputs(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
              onBlur={() => commitWidth(i)}
              onKeyDown={e => { if (e.key === 'Enter') { commitWidth(i); e.target.blur(); } }}
              className="w-16 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
            />
          </label>
        ))}
      </div>

      {facadeModules.length > 0 && (
        <div className="bg-slate-900/95 border-b border-slate-700 px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-cyan-300 font-bold">🚪↔️ Coulissantes meuble:</span>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={globalSliding.enabled}
              onChange={(e) => setGlobalSliding((v) => ({ ...v, enabled: e.target.checked }))}
            />
            Activer
          </label>
          {globalSliding.enabled && (
            <>
              <label className="text-slate-300">Vantaux
                <input
                  type="number"
                  min="2"
                  max="4"
                  value={globalSliding.count}
                  onChange={(e) => setGlobalSliding((v) => ({ ...v, count: Math.max(2, Math.min(4, toNum(e.target.value, 2))) }))}
                  className="w-12 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                />
              </label>
              <label className="text-slate-300">H(cm)
                <input
                  type="number"
                  min="40"
                  value={globalSliding.heightCm}
                  onChange={(e) => setGlobalSliding((v) => ({ ...v, heightCm: Math.max(40, toNum(e.target.value, 180)) }))}
                  className="w-14 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                />
              </label>
            </>
          )}

          <span className="text-amber-300 font-bold">🧩 Détail menuiserie:</span>
          <div className="flex items-center gap-1">
            {facadeModules.map((_, i) => (
              <button
                key={`md-${i}`}
                onClick={() => setSelectedModuleIdx(i)}
                className={`px-2 py-1 rounded border ${selectedModuleIdx === i ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
              >
                M{i + 1}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={moduleDetails[selectedModuleIdx]?.hasBack ?? true}
              onChange={(e) => setModuleDetails(prev => prev.map((d, i) => i === selectedModuleIdx ? { ...d, hasBack: e.target.checked } : d))}
            />
            Fond module
          </label>
          <label className="flex items-center gap-1 text-slate-200">
            <input
              type="checkbox"
              checked={(moduleDetails[selectedModuleIdx]?.slidingDoors || 0) > 0}
              onChange={(e) => setModuleDetails(prev => prev.map((d, i) => {
                if (i !== selectedModuleIdx) return d;
                return { ...d, slidingDoors: e.target.checked ? 2 : 0 };
              }))}
            />
            Portes coulissantes
          </label>
          <span className="text-slate-500">Tiroir :</span>
          {[
            ['front', 'Façade'],
            ['back', 'Arrière'],
            ['left', 'Côté G'],
            ['right', 'Côté D'],
            ['bottom', 'Fond'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-slate-200">
              <input
                type="checkbox"
                checked={moduleDetails[selectedModuleIdx]?.drawerParts?.[key] ?? true}
                onChange={(e) => setModuleDetails(prev => prev.map((d, i) => {
                  if (i !== selectedModuleIdx) return d;
                  return {
                    ...d,
                    drawerParts: {
                      ...defaultDrawerParts(),
                      ...(d?.drawerParts || {}),
                      [key]: e.target.checked,
                    },
                  };
                }))}
              />
              {label}
            </label>
          ))}
          {(facadeModules[selectedModuleIdx]?.drawers || 0) > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Hauteurs (cm):</span>
              {Array.from({ length: facadeModules[selectedModuleIdx]?.drawers || 0 }, (_, di) => (
                <label key={`dh-${di}`} className="text-slate-300">
                  #{di + 1}
                  <input
                    type="number"
                    min="5"
                    step="0.5"
                    value={moduleDetails[selectedModuleIdx]?.drawerHeights?.[di] ?? 18}
                    onChange={(e) => setModuleDetails(prev => prev.map((d, i) => {
                      if (i !== selectedModuleIdx) return d;
                      const curr = Array.isArray(d.drawerHeights) ? d.drawerHeights : [];
                      const next = Array.from({ length: facadeModules[selectedModuleIdx]?.drawers || 0 }, (_, idx) => Math.max(5, toNum(curr[idx], 18)));
                      next[di] = toNum(e.target.value, next[di] ?? 18);
                      return { ...d, drawerHeights: next };
                    }))}
                    className="w-14 ml-1 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-950 flex justify-center p-4">
        <svg ref={svgRef} width={imgSize.w} height={imgSize.h}
          className="shadow-2xl"
          style={{ background: baseView === 'facade' ? '#f8fafc' : '#1e293b' }}
          onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}     onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}>
          {baseView === 'photo' && imgSrc && (
            <image href={imgSrc} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet"/>
          )}
          {baseView === 'facade' && (
            <FacadeRealisteSVG
              svgW={imgSize.w} svgH={imgSize.h}
              cabW={cabinetDims.width} cabH={cabinetDims.height}
              plinth={cabinetDims.plinth} thick={thickness}
              facadeModules={facadeModules}
              facadeItems={facadeItems}
              joints={joints}
              moduleDetails={moduleDetails}
              globalSliding={globalSliding}
              onFacadePointerDown={handleFacadePointerDown}
              onItemPointerDown={handleItemPointerDown}
              onItemErase={handleItemErase}
              onModuleClick={handleModuleClick}
              onModuleErase={handleModuleErase}
              activeTool={tool}
            />
          )}
          {elements.filter(el => ['dim','note'].includes(el.type)).map(renderElement)}
        </svg>
      </div>

      <div className="bg-slate-900 border-t border-slate-700 p-2">
        <textarea value={generalNotes} onChange={e=>setGeneralNotes(e.target.value)}
          placeholder="📝 Notes pour Claude (ex: 2 tiroirs en bas du module 3, porte vitrée à gauche...)"
          className="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 resize-none"/>
      </div>

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
