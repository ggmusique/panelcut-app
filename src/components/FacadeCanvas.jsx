const WOOD_FILL    = '#f5ede0';
const WOOD_STROKE  = '#8b6914';
const DIM_COLOR    = '#dc2626';
const DOUBLE_COLOR = '#d97706';
export const MARGIN = { l: 65, r: 52, t: 55, b: 65 };

const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function computeMRects(facadeModules, joints, thPx, drawW, drawH, mL, mT, plPx) {
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
  facadeModules, facadeItems, joints,
  cabinetModules = [],
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
        const moduleData = cabinetModules[i] || m;
        const interiorCm = Math.max(1, cabH - plinth);
        const cmToPx = iH / interiorCm;
        const nbDoors = moduleData.doors || 0;
        const nbSliding = moduleData.slidingDoors || 0;

        const shelfHeightsCm = Array.isArray(moduleData?.shelves)
          ? moduleData.shelves
              .map((s) => (typeof s === 'object' && s !== null ? toNum(s.y, NaN) : toNum(s, NaN)))
              .filter((v) => Number.isFinite(v))
              .sort((a, b) => a - b)
          : [];

        const sourceDrawerItems = Array.isArray(moduleData?.drawerItems) && moduleData.drawerItems.length > 0
          ? moduleData.drawerItems
          : [];

        const resolvedDrawerItems = sourceDrawerItems.length > 0
          ? sourceDrawerItems
          : Array.from({ length: m.drawers || 0 }, (_, di) => ({ y: di * 18, height: 18 }));

        const safeDrawerItems = [];
        for (const dr of resolvedDrawerItems) {
          const drawerBottomCm = Math.max(0, toNum(dr.y, 0));
          const drawerHeightCm = Math.max(5, toNum(dr.height ?? dr.h, 18));
          const drawerTopCm = drawerBottomCm + drawerHeightCm;
          const hitShelf = shelfHeightsCm.some((shelfCm) => shelfCm > drawerBottomCm && shelfCm < drawerTopCm);
          if (hitShelf) break;
          safeDrawerItems.push({ y: drawerBottomCm, height: drawerHeightCm });
        }

        const tiroirs = safeDrawerItems.map((dr, di) => {
          const drawerH = Math.max(10, dr.height * cmToPx);
          const dy = intBottom - (dr.y + dr.height) * cmToPx;
          return (
            <g key={`dr-${i}-${di}`}
              onClick={e => { e.stopPropagation(); if (isErase) onModuleErase(i, 'drawer'); }}
              style={{ cursor: isErase ? 'pointer' : 'default' }}>
              <rect x={x+2} y={dy+1} width={w-4} height={drawerH-2} fill={WOOD_FILL} stroke={WOOD_STROKE} strokeWidth="1" rx="1"/>
              <line x1={x+2} y1={dy+1} x2={x+w-2} y2={dy+1} stroke={WOOD_STROKE} strokeWidth="0.5"/>
              <rect x={x+w/2-14} y={dy+drawerH/2-3.5} width="28" height="7" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" rx="3"/>
              <ellipse cx={x+w/2} cy={dy+drawerH/2} rx="3.5" ry="2.5" fill="#6b7280"/>
              {isErase && <rect x={x+2} y={dy+1} width={w-4} height={drawerH-2} fill="red" opacity="0.18" rx="1"/>}
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

        const usedDrawerHeightPx = safeDrawerItems.reduce((acc, dr) => acc + Math.max(10, dr.height * cmToPx), 0);
        const numY = intTop + Math.max(30, (iH - usedDrawerHeightPx) * 0.45);
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

export default FacadeRealisteSVG;
