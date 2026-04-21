import { useState } from 'react';
import { normalizeCabinetModules } from '../utils/normalizeCabinetModules';

const VIEWS = [
  { id: 'face',     label: 'Face',   icon: '⬜' },
  { id: 'tq_left',  label: '3/4 G',  icon: '◱' },
  { id: 'tq_right', label: '3/4 D',  icon: '◲' },
  { id: 'side',     label: 'Côté',   icon: '▭' },
  { id: 'zoom',     label: 'Détail', icon: '⊕' },
];

function drawCabinetSVG(cabinet, modules, view, W, H) {
  if (!cabinet || !modules.length) return null;
  const cW = cabinet.width     || 200;
  const cH = cabinet.height    || 235;
  const cD = cabinet.depth     || 60;
  const pl = cabinet.plinth    || 0;
  const th = cabinet.thickness || 1.8;

  const pad = 20;
  let sc, cx, cy;

  if (view === 'face' || view === 'zoom') {
    const displayW = view === 'zoom' ? (modules[0]?.width || cW / modules.length) : cW;
    sc = Math.min((W - 2 * pad) / displayW, (H - 2 * pad) / cH);
    const fw = displayW * sc;
    const fh = cH * sc;
    cx = pad + (W - 2 * pad - fw) / 2;
    cy = pad + (H - 2 * pad - fh) / 2;

    const WOOD = '#c8a95e';
    const WOOD_DARK = '#8b6914';
    const INTERIOR = '#f5ede0';
    const SHELF_C = '#b09050';
    const ROD_C = '#888';

    const thp = th * sc;
    const plp = pl * sc;
    const innerH = fh - plp - 2 * thp;

    const totalModW = view === 'zoom'
      ? (modules[0]?.width || 1)
      : modules.reduce((s, m) => s + (m.width || 1), 0);
    const mSc = (displayW * sc - 2 * thp - (modules.length - 1) * thp) / Math.max(1, totalModW);

    const mods = view === 'zoom' ? [modules[0]] : modules;
    let elems = [];

    // Fond intérieur
    elems.push(`<rect x="${cx}" y="${cy}" width="${displayW * sc}" height="${fh - plp}"
      fill="${INTERIOR}" stroke="${WOOD_DARK}" stroke-width="0.5"/>`);

    // Plinthe
    if (plp > 1) elems.push(`<rect x="${cx}" y="${cy + fh - plp}" width="${displayW * sc}" height="${plp}"
      fill="#b09050" stroke="${WOOD_DARK}" stroke-width="0.5"/>`);

    // Traverse dessus (pleine largeur, sur les montants)
    elems.push(`<rect x="${cx}" y="${cy}" width="${displayW * sc}" height="${thp}"
      fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>`);

    // Traverse bas (pleine largeur, sur les montants)
    elems.push(`<rect x="${cx}" y="${cy + fh - plp - thp}" width="${displayW * sc}" height="${thp}"
      fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>`);

    // Montant gauche (entre les deux traverses)
    elems.push(`<rect x="${cx}" y="${cy + thp}" width="${thp}" height="${innerH}"
      fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>`);

    // Modules
    let mx = cx + thp;
    mods.forEach((m, i) => {
      const mw = (m.width || 1) * mSc;
      const innerTop = cy + thp;
      const innerBot = cy + fh - plp - thp;
      const innerH2 = innerBot - innerTop;

      // Tablettes
      const shelfList = m.shelfPositions?.length
        ? m.shelfPositions
        : Array.from({ length: m.shelves || 0 }, (_, si) => ({
            y: (m.height || cH) * (si + 1) / ((m.shelves || 1) + 1),
          }));
      shelfList.forEach(s => {
        const sy = innerTop + (1 - (s.y || 0) / Math.max(1, cH - pl)) * innerH2;
        if (sy > innerTop + 2 && sy < innerBot - 2) {
          elems.push(`<rect x="${mx + 2}" y="${sy - 2}" width="${mw - 4}" height="4"
            fill="${SHELF_C}" stroke="${WOOD_DARK}" stroke-width="0.5"/>`);
        }
      });

      // Tringles
      (m.rodYs || []).forEach(ry => {
        const ryPx = innerTop + (1 - ry / Math.max(1, cH - pl)) * innerH2;
        elems.push(`<line x1="${mx + 8}" y1="${ryPx}" x2="${mx + mw - 8}" y2="${ryPx}"
          stroke="${ROD_C}" stroke-width="5" stroke-linecap="round"/>`);
        elems.push(`<circle cx="${mx + 8}" cy="${ryPx}" r="4" fill="#666"/>`);
        elems.push(`<circle cx="${mx + mw - 8}" cy="${ryPx}" r="4" fill="#666"/>`);
      });

      // Tiroirs
      const drawerItems = m.drawerItems?.length
        ? m.drawerItems
        : Array.from({ length: m.drawers || 0 }, (_, di) => ({ y: di * 18, h: 16 }));
      drawerItems.forEach(d => {
        const dy = innerBot - (d.y + d.h) / Math.max(1, cH - pl) * innerH2;
        const dh = d.h / Math.max(1, cH - pl) * innerH2;
        if (dy > innerTop && dy + dh < innerBot + 1) {
          const dh2 = Math.max(dh - 2, 8);
          elems.push(`<rect x="${mx + 3}" y="${dy}" width="${mw - 6}" height="${dh2}"
            fill="#e8d5b0" stroke="${WOOD_DARK}" stroke-width="0.7" rx="1"/>`);
          const hcx = mx + mw / 2;
          const hcy = dy + dh2 / 2;
          elems.push(`<rect x="${hcx - 16}" y="${hcy - 3}" width="32" height="6"
            fill="none" stroke="#999" stroke-width="1.5" rx="3"/>`);
        }
      });

      // Séparateur droit (entre modules)
      if (i < mods.length - 1) {
        elems.push(`<rect x="${mx + mw}" y="${cy + thp}" width="${thp}" height="${innerH2}"
          fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>`);
      }

      mx += mw + thp;
    });

    // Montant droit
    elems.push(`<rect x="${cx + displayW * sc - thp}" y="${cy + thp}" width="${thp}" height="${innerH}"
      fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>`);

    // Cotes
    elems.push(`
      <line x1="${cx}" y1="${cy - 10}" x2="${cx + displayW * sc}" y2="${cy - 10}"
        stroke="#dc2626" stroke-width="1"/>
      <text x="${cx + displayW * sc / 2}" y="${cy - 14}" text-anchor="middle"
        font-size="10" font-weight="bold" fill="#dc2626">${cW} cm</text>
      <line x1="${cx + displayW * sc + 10}" y1="${cy}" x2="${cx + displayW * sc + 10}" y2="${cy + fh}"
        stroke="#dc2626" stroke-width="1"/>
      <text x="${cx + displayW * sc + 22}" y="${cy + fh / 2}" text-anchor="middle"
        font-size="10" font-weight="bold" fill="#dc2626"
        transform="rotate(90 ${cx + displayW * sc + 22} ${cy + fh / 2})">${cH} cm</text>
    `);

    return elems.join('\n');

  } else if (view === 'side') {
    sc = Math.min((W - 2 * pad) / cD, (H - 2 * pad) / cH);
    const dw = cD * sc;
    const fhS = cH * sc;
    cx = pad + (W - 2 * pad - dw) / 2;
    cy = pad + (H - 2 * pad - fhS) / 2;
    const plpS = pl * sc;
    const thpS = th * sc;
    const WOOD = '#c8a95e';
    const WOOD_DARK = '#8b6914';
    const INTERIOR = '#f5ede0';
    return `
      <rect x="${cx}" y="${cy}" width="${dw}" height="${fhS}" fill="${INTERIOR}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
      <rect x="${cx}" y="${cy + fhS - plpS}" width="${dw}" height="${plpS}" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
      <rect x="${cx}" y="${cy}" width="${dw}" height="${thpS}" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>
      <rect x="${cx}" y="${cy + fhS - plpS - thpS}" width="${dw}" height="${thpS}" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>
      <rect x="${cx}" y="${cy + thpS}" width="${thpS}" height="${fhS - plpS - 2 * thpS}" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>
      <rect x="${cx + dw - thpS}" y="${cy + thpS}" width="${thpS}" height="${fhS - plpS - 2 * thpS}" fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="1"/>
      <rect x="${cx + dw - thpS}" y="${cy + thpS}" width="${thpS * 0.4}" height="${fhS - plpS - 2 * thpS}" fill="#060e1c" stroke="#1e3a5f" stroke-width="0.5"/>
      <line x1="${cx}" y1="${cy - 10}" x2="${cx + dw}" y2="${cy - 10}" stroke="#dc2626" stroke-width="1"/>
      <text x="${cx + dw / 2}" y="${cy - 14}" text-anchor="middle" font-size="10" font-weight="bold" fill="#dc2626">${cD} cm</text>
    `;

  } else {
    // Vue 3/4 isométrique
    sc = Math.min((W * 0.55) / cW, (H * 0.7) / cH);
    const baseX = view === 'tq_right' ? W * 0.55 : W * 0.4;
    const baseY = H * 0.88;
    const isoX = (x, z) => x * sc - z * sc * 0.4;
    const isoY = (y, z) => -y * sc + z * sc * 0.25;
    const p = (x, y, z) => `${baseX + isoX(x, z)},${baseY + isoY(y, z)}`;
    const WOOD = '#c8a95e';
    const WOOD_DARK = '#8b6914';
    const INTERIOR = '#f5ede0';

    return `
      <polygon points="${p(0,0,0)} ${p(cW,0,0)} ${p(cW,cH,0)} ${p(0,cH,0)}"
        fill="${INTERIOR}" stroke="${WOOD_DARK}" stroke-width="0.8"/>
      <polygon points="${p(cW,0,0)} ${p(cW,0,cD)} ${p(cW,cH,cD)} ${p(cW,cH,0)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.8" opacity="0.8"/>
      <polygon points="${p(0,cH,0)} ${p(cW,cH,0)} ${p(cW,cH,cD)} ${p(0,cH,cD)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.8" opacity="0.9"/>
      <polygon points="${p(0,cH,0)} ${p(cW,cH,0)} ${p(cW,cH-th,0)} ${p(0,cH-th,0)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
      <polygon points="${p(0,pl+th,0)} ${p(cW,pl+th,0)} ${p(cW,pl,0)} ${p(0,pl,0)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
      <polygon points="${p(0,pl+th,0)} ${p(th,pl+th,0)} ${p(th,cH-th,0)} ${p(0,cH-th,0)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
      <polygon points="${p(cW-th,pl+th,0)} ${p(cW,pl+th,0)} ${p(cW,cH-th,0)} ${p(cW-th,cH-th,0)}"
        fill="${WOOD}" stroke="${WOOD_DARK}" stroke-width="0.5"/>
    `;
  }
}

export default function CabinetStaticViewer({ cabinet, currentCabinet }) {
  const cab = currentCabinet || cabinet;
  const modules = cab ? normalizeCabinetModules(cab) : [];
  const [activeView, setActiveView] = useState('face');
  const svgW = 260, svgH = 200;

  const content = cab ? drawCabinetSVG(cab, modules, activeView, svgW, svgH) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Boutons de vue */}
      <div style={{ display: 'flex', gap: 3 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            title={v.label}
            style={{
              flex: 1, height: 26,
              background: activeView === v.id ? '#1f6feb' : '#161b22',
              border: `1px solid ${activeView === v.id ? '#388bfd' : '#30363d'}`,
              borderRadius: 4, cursor: 'pointer',
              color: activeView === v.id ? '#fff' : '#8b949e',
              fontSize: 10, fontWeight: 600,
            }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* SVG viewer */}
      <div style={{
        background: '#f8f7f4', borderRadius: 6,
        border: '1px solid #30363d', overflow: 'hidden', height: svgH,
      }}>
        {content ? (
          <svg
            width={svgW} height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block', width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#484f58', fontSize: 11 }}>
            Aucun meuble
          </div>
        )}
      </div>

      {/* Stats */}
      {cab && (
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#484f58', lineHeight: 1.8 }}>
          {[
            ['L', `${cab.width} cm`],
            ['H', `${cab.height} cm`],
            ['P', `${cab.depth || 60} cm`],
            ['Modules', modules.length],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{k}</span><span style={{ color: '#e6edf3' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
