import { useState } from 'react';
import { exportPDF } from '../pdfExport';
import { Download, Scissors, RotateCw, Layers, ChevronLeft, ChevronRight, Maximize2, BarChart2, Map, List, Box } from 'lucide-react';
import CabinetPlan2D from './CabinetPlan2D';
import CabinetPlan3D from './CabinetPlan3D';
import CabinetElevationFront from './CabinetElevationFront';
import BoardList from './BoardList';
import ProfessionalRealisticViewer from '../visualization/ProfessionalRealisticViewer';
import { isRodPiece } from '../utils/isRodPiece';

const PIECE_COLORS = [
  { fill: 'rgba(245,158,11,0.25)',  stroke: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  { fill: 'rgba(59,130,246,0.25)',  stroke: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  { fill: 'rgba(16,185,129,0.25)', stroke: '#10b981', glow: 'rgba(16,185,129,0.4)' },
  { fill: 'rgba(168,85,247,0.25)', stroke: '#a855f7', glow: 'rgba(168,85,247,0.4)' },
  { fill: 'rgba(239,68,68,0.25)',  stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  { fill: 'rgba(20,184,166,0.25)', stroke: '#14b8a6', glow: 'rgba(20,184,166,0.4)' },
  { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  { fill: 'rgba(99,102,241,0.25)', stroke: '#6366f1', glow: 'rgba(99,102,241,0.4)' },
];

function getColor(name, colorMap) {
  if (!colorMap[name]) {
    const idx = Object.keys(colorMap).length % PIECE_COLORS.length;
    colorMap[name] = PIECE_COLORS[idx];
  }
  return colorMap[name];
}

function fmtCm(tenthsMm) {
  const cm = tenthsMm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
}

function computeWasteZones(placed, panelW, panelH, kerf) {
  const zones = [];
  const bands = {};
  for (const p of placed) {
    const key = p.bandY;
    if (!bands[key]) bands[key] = { bandY: p.bandY, bandH: p.h, pieces: [] };
    bands[key].pieces.push(p);
    bands[key].bandH = Math.max(bands[key].bandH, p.h);
  }
  const sortedBands = Object.values(bands).sort((a, b) => a.bandY - b.bandY);
  for (const band of sortedBands) {
    const lastPiece = [...band.pieces].sort((a, b) => (a.x || 0) - (b.x || 0)).pop();
    const usedW  = (lastPiece.x || 0) + lastPiece.l + kerf;
    const wasteW = panelW - usedW;
    if (wasteW > 5) zones.push({ x: usedW, y: band.bandY, w: wasteW, h: band.bandH, wCm: fmtCm(wasteW), hCm: fmtCm(band.bandH), type: 'lateral' });
  }
  const lastBand = sortedBands[sortedBands.length - 1];
  if (lastBand) {
    const usedH  = lastBand.bandY + lastBand.bandH + kerf;
    const wasteH = panelH - usedH;
    if (wasteH > 5) zones.push({ x: 0, y: usedH, w: panelW, h: wasteH, wCm: fmtCm(panelW), hCm: fmtCm(wasteH), type: 'bottom' });
  }
  return zones;
}

function PanelSVG({ panel, panelW, panelH, kerf, colorMap }) {
  const MARGIN_R = 52;
  const SVG_W    = 500;
  const SVG_H    = Math.round(SVG_W * panelH / panelW);
  const sx = SVG_W / panelW;
  const sy = SVG_H / panelH;
  const wasteZones = computeWasteZones(panel.placed, panelW, panelH, kerf);

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 blur transition duration-500" />
      <svg
        viewBox={`0 0 ${SVG_W + MARGIN_R} ${SVG_H}`}
        className="relative w-full h-auto bg-[#0a0a0a] rounded-xl border border-white/10 shadow-2xl"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(239,68,68,0.25)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#grid)" />
        {wasteZones.map((z, i) => {
          const zx = z.x * sx, zy = z.y * sy, zw = z.w * sx, zh = z.h * sy;
          const cx = zx + zw / 2, cy = zy + zh / 2;
          return (
            <g key={`waste-${i}`}>
              <rect x={zx.toFixed(1)} y={zy.toFixed(1)} width={zw.toFixed(1)} height={zh.toFixed(1)} fill="url(#hatch)" stroke="rgba(239,68,68,0.4)" strokeWidth="1" rx="2" />
              {zw > 30 && zh > 16 && (<><text x={cx.toFixed(1)} y={(cy-4).toFixed(1)} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ef4444" fontFamily="monospace">{z.wCm}×{z.hCm}cm</text><text x={cx.toFixed(1)} y={(cy+8).toFixed(1)} textAnchor="middle" fontSize="7" fill="rgba(239,68,68,0.7)" fontFamily="sans-serif">CHUTE</text></>)}
            </g>
          );
        })}
        {panel.placed.map((p, i) => {
          const c  = getColor(p.name, colorMap);
          const px = (p.x || 0) * sx, py = (p.bandY || 0) * sy;
          const pw = p.l * sx - 1, ph = p.h * sy - 1;
          return (
            <g key={i}>
              <rect x={(px+1).toFixed(1)} y={(py+1).toFixed(1)} width={Math.max(pw-2,0).toFixed(1)} height={Math.max(ph-2,0).toFixed(1)} fill={c.glow} filter="blur(4px)" opacity="0.5" />
              <rect x={px.toFixed(1)} y={py.toFixed(1)} width={Math.max(pw,1).toFixed(1)} height={Math.max(ph,1).toFixed(1)} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" rx="2" />
              {pw > 40 && ph > 20 && (<g><text x={(px+pw/2).toFixed(1)} y={(py+ph/2+4).toFixed(1)} textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff" fontFamily="monospace">{fmtCm(p.l)}×{fmtCm(p.h)}</text><text x={(px+pw/2).toFixed(1)} y={(py+ph/2+14).toFixed(1)} textAnchor="middle" fontSize="8" fill="#cbd5e1" fontFamily="sans-serif">{p.name.substring(0,10)}{p.name.length>10?'...':''}</text></g>)}
            </g>
          );
        })}
        {(() => {
          const allBands = panel.cuts.filter(c => c.type === 'bande');
          const hBands = allBands.filter(c => c.orientation === 'horizontal').sort((a,b) => (a.pos||0)-(b.pos||0));
          let num = 1; const items = [];
          for (const h of hBands) {
            const cy = h.pos * sy, n = num++;
            items.push(<g key={`h-${n}`}><line x1={0} y1={cy.toFixed(1)} x2={SVG_W} y2={cy.toFixed(1)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,3" /><line x1={SVG_W+2} y1={cy.toFixed(1)} x2={SVG_W+10} y2={cy.toFixed(1)} stroke="#f59e0b" strokeWidth="1" /><text x={SVG_W+14} y={(cy+4).toFixed(1)} fontSize="9" fontWeight="bold" fill="#f59e0b" fontFamily="monospace">{h.posCm}</text><rect x={0} y={(cy-9).toFixed(1)} width="18" height="14" rx="3" fill="#f59e0b" /><text x="9" y={(cy+3).toFixed(1)} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#000">{n}</text></g>);
            for (const v of allBands.filter(c => c.orientation === 'vertical' && c.bandKey === h.bandKey).sort((a,b) => (a.pos||0)-(b.pos||0))) {
              const cx = v.pos * sx, top = (v.bandY||0)*sy, nv = num++;
              items.push(<g key={`v-${nv}`}><line x1={cx.toFixed(1)} y1={top.toFixed(1)} x2={cx.toFixed(1)} y2={(top+(v.bandH||0)*sy).toFixed(1)} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8" /><rect x={(cx-9).toFixed(1)} y={top.toFixed(1)} width="18" height="14" rx="3" fill="#3b82f6" /><text x={cx.toFixed(1)} y={(top+10).toFixed(1)} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">{nv}</text></g>);
            }
          }
          return items;
        })()}
        <text x={SVG_W/2} y={SVG_H-4} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="bold">{panelW/10} cm</text>
        <text x="8" y={SVG_H/2} transform={`rotate(-90 8 ${SVG_H/2})`} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="bold">{panelH/10} cm</text>
      </svg>
    </div>
  );
}

function CutList({ panel }) {
  const bandCuts = panel.cuts.filter(c => c.type === 'bande');
  const hCuts = bandCuts.filter(c => c.orientation === 'horizontal').sort((a, b) => (a.pos||0)-(b.pos||0));
  const allCuts = []; let num = 1;
  for (const h of hCuts) {
    const hPieces = panel.cuts.filter(pc => pc.type === 'piece' && pc.bandKey === h.bandKey);
    allCuts.push({ num: num++, type: 'horizontal', posCm: h.posCm, depth: h.depth||0, pieces: hPieces });
    for (const v of bandCuts.filter(c => c.orientation === 'vertical' && c.bandKey === h.bandKey).sort((a,b)=>(a.pos||0)-(b.pos||0))) {
      allCuts.push({ num: num++, type: 'vertical', posCm: v.posCm, depth: v.depth||0, pieces: panel.cuts.filter(pc => pc.type==='piece' && pc.bandKey===v.bandKey && (pc.x||0)>=(v.pos||0)) });
    }
  }
  return (
    <div className="space-y-2 mt-4">
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ordre des coupes</div>
      {allCuts.map((cut) => {
        const isH = cut.type === 'horizontal';
        const accent = isH ? '#f59e0b' : '#3b82f6';
        return (
          <div key={cut.num} style={{ display:'flex', alignItems:'flex-start', gap:10, background: isH?'rgba(245,158,11,0.08)':'rgba(59,130,246,0.08)', border:`1px solid ${isH?'rgba(245,158,11,0.2)':'rgba(59,130,246,0.2)'}`, borderRadius:8, padding:'8px 10px' }}>
            <div style={{ width:24,height:24,borderRadius:'50%',background:accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:isH?'#000':'#fff',flexShrink:0 }}>{cut.num}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:cut.pieces.length?4:0 }}>
                <span style={{ color:accent, fontWeight:700, fontSize:12 }}>{isH?'→':'↓'} Coupe {isH?'horizontale':'verticale'} à <strong style={{color:'#fff'}}>{cut.posCm} cm</strong></span>
                {cut.depth>0 && <span style={{fontSize:10,color:'#475569',background:'rgba(255,255,255,0.05)',padding:'1px 6px',borderRadius:4}}>chute niv.{cut.depth}</span>}
              </div>
              {cut.pieces.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {cut.pieces.map((pc, pi) => <span key={pi} style={{fontSize:10,color:'#94a3b8',background:'rgba(255,255,255,0.05)',padding:'2px 6px',borderRadius:4,fontFamily:'monospace'}}>{pc.name} {pc.lCm}×{pc.hCm}cm{pc.rotated?' ↺':''}</span>)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanSubTabs({ active, onChange }) {
  return (
    <div className="flex bg-[#0a0a0a] border border-white/5 rounded-lg p-0.5 gap-0.5 mb-4 overflow-x-auto">
      {[
        { id: 'facade',   label: '🧱 Façade — style croquis' },
        { id: '2d',       label: '📐 Vue 2D — 3 vues ortho' },
        { id: '3d',       label: '📦 Vue 3D — Isométrique' },
        { id: 'realistic', label: '🌟 Vue Réaliste Client' },   // ← NOUVEL ONGLET
      ].map(t => (
        <button 
          key={t.id} 
          onClick={() => onChange(t.id)}
          className={'flex-1 py-2.5 px-4 rounded-md text-xs font-bold transition-all whitespace-nowrap ' +
            (active === t.id 
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white hover:bg-white/5')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── TabBar : Plans visible seulement si cabinet disponible
function TabBar({ active, onChange, hasCabinet }) {
  const tabs = [
    { id: 'resume',  label: 'Résumé',   icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'visual',  label: 'Visuel',   icon: <Maximize2 className="w-4 h-4" /> },
    { id: 'cuts',    label: 'Coupes',   icon: <Scissors  className="w-4 h-4" /> },
    { id: 'boards',  label: 'Planches', icon: <List      className="w-4 h-4" /> },
    ...(hasCabinet ? [{ id: 'plans', label: 'Plans', icon: <Map className="w-4 h-4" /> }] : []),
  ];
  return (
    <div className="flex bg-[#111] border border-white/5 rounded-xl p-1 gap-1 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ' +
            (active === t.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30' : 'text-slate-400 hover:text-white')}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

export default function Results({ t, results, project }) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const [tab, setTab]       = useState('resume');
  const [planView, setPlanView] = useState('facade');
  const colorMap = {};

  // Tringles (rods) excluded from optimization
  const rodPieces = (project.pieces || []).filter(isRodPiece);

  // Coerce toutes les dimensions en Number pour éviter les problèmes de type string
  const rawCabinet = project.cabinet || null;
  const cabinet = rawCabinet ? {
    ...rawCabinet,
    width:     Number(rawCabinet.width)     || 0,
    height:    Number(rawCabinet.height)    || 0,
    depth:     Number(rawCabinet.depth)     || 60,
    thickness: Number(rawCabinet.thickness) || 1.8,
    plinth:    Number(rawCabinet.plinth)    || 0,
    panels:    Array.isArray(rawCabinet.panels)  ? rawCabinet.panels  : [],
    modules:   Array.isArray(rawCabinet.modules) ? rawCabinet.modules : [],
  } : null;

  // hasCabinet = true si on a des dimensions valides
  const hasCabinet = !!(cabinet && cabinet.width > 0 && cabinet.height > 0);

  const panel      = results.panels[currentPanel];
  const panelW     = Math.round(project.panel.w * 10);
  const panelH     = Math.round(project.panel.h * 10);
  const kerf       = Math.round((project.kerf ?? 3) * 1);
  const totalCost  = (results.summary.totalPanels * (project.pricePerPanel || 0)).toFixed(2);
  const utilization = panel.utilizationPct;

  const allNames = [...new Set(results.panels.flatMap(p => p.placed.map(pc => pc.name)))];
  allNames.forEach(n => getColor(n, colorMap));

  const nextPanel = () => setCurrentPanel(p => Math.min(results.panels.length - 1, p + 1));
  const prevPanel = () => setCurrentPanel(p => Math.max(0, p - 1));

  const PanelNav = () => (
    <div className="flex items-center justify-between bg-[#111] p-2 rounded-xl border border-white/5 mb-4">
      <button onClick={prevPanel} disabled={currentPanel===0} className="p-3 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
      <div className="text-center">
        <div className="text-sm font-bold text-white">Panneau {currentPanel+1} <span className="text-slate-500">/ {results.panels.length}</span></div>
        <div className={`text-xs font-bold ${utilization>=80?'text-green-400':utilization>=60?'text-yellow-400':'text-red-400'}`}>{utilization}% efficacité</div>
      </div>
      <button onClick={nextPanel} disabled={currentPanel===results.panels.length-1} className="p-3 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-32 font-sans">
      <div className="sticky top-16 z-20 bg-[#050505]/95 backdrop-blur-xl pt-3 pb-2 px-4">
        <TabBar active={tab} onChange={setTab} hasCabinet={hasCabinet} />
      </div>

      <div className="px-4 py-4 max-w-7xl mx-auto">

        {/* ── RÉSUMÉ */}
        {tab === 'resume' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-orange-500" /> Résultats</h2>
              <button onClick={() => exportPDF(results, project)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/30">
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">Panneaux</div>
                <div className="text-3xl font-black text-white">{results.summary.totalPanels}</div>
                <div className="text-[10px] text-orange-400 mt-1">Nécessaires</div>
              </div>
              <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">Utilisation</div>
                <div className={`text-3xl font-black ${utilization>=80?'text-green-400':utilization>=60?'text-yellow-400':'text-red-400'}`}>{utilization}%</div>
                <div className="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${utilization>=80?'bg-green-500':utilization>=60?'bg-yellow-500':'bg-red-500'}`} style={{width:`${utilization}%`}} />
                </div>
              </div>
              <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">Chutes</div>
                <div className="text-3xl font-black text-red-400">{results.summary.wastePct}%</div>
                <div className="text-[10px] text-slate-500 mt-1">Perdues</div>
              </div>
              <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex flex-col items-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">Coût</div>
                <div className="text-2xl font-black text-blue-400">{totalCost}€</div>
                <div className="text-[10px] text-slate-500 mt-1">Matière</div>
              </div>
            </div>
            <div className="bg-[#111] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Pièces bois optimisées</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colorMap).map(([name, c]) => (
                  <div key={name} className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-white/5">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background:c.fill, border:`1px solid ${c.stroke}`, boxShadow:`0 0 6px ${c.glow}` }} />
                    <span className="text-sm text-slate-300 font-medium">{name}</span>
                  </div>
                ))}
              </div>
            </div>
            {rodPieces.length > 0 && (
              <div className="bg-[#111] border border-pink-500/20 rounded-xl p-4">
                <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  🔩 Tringles — hors optimisation bois
                </h3>
                <div className="flex flex-col gap-2">
                  {rodPieces.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0a0a0a] px-3 py-2 rounded-lg border border-pink-500/10">
                      <span className="text-sm text-slate-300 font-medium">{p.name}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono text-slate-400">{p.length}×{p.height} cm</span>
                        <span className="bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded border border-pink-500/20 font-bold">×{p.qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasCabinet && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                <Box className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-300">Plans 2D + 3D disponibles</p>
                  <p className="text-xs text-slate-400">{cabinet.width}×{cabinet.height}×{cabinet.depth} cm</p>
                </div>
                <button onClick={() => setTab('plans')} className="ml-auto text-xs font-bold text-blue-400 hover:text-blue-300 whitespace-nowrap">Voir →</button>
              </div>
            )}
            <button onClick={() => setTab('visual')} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 flex items-center justify-center gap-2 transition-colors">
              <Maximize2 className="w-4 h-4" /> Voir le visuel du panneau →
            </button>
            <button onClick={() => setTab('boards')} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 flex items-center justify-center gap-2 transition-colors">
              <List className="w-4 h-4" /> Voir la liste des planches →
            </button>
            <button onClick={() => setTab('cuts')} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 flex items-center justify-center gap-2 transition-colors">
              <Scissors className="w-4 h-4" /> Voir la séquence de coupes →
            </button>
          </div>
        )}

        {/* ── VISUEL */}
        {tab === 'visual' && (
          <div className="space-y-4">
            <PanelNav />
            <PanelSVG panel={panel} panelW={panelW} panelH={panelH} kerf={kerf} colorMap={colorMap} />
            <CutList panel={panel} />
            <div className="flex justify-center gap-2">
              {results.panels.map((_, i) => (
                <button key={i} onClick={() => setCurrentPanel(i)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${i===currentPanel?'bg-orange-500 scale-125 shadow-[0_0_10px_rgba(249,115,22,0.6)]':'bg-[#333] hover:bg-slate-500'}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── COUPES */}
        {tab === 'cuts' && (
          <div className="space-y-4">
            <PanelNav />
            <div className="bg-[#111] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Scissors className="w-4 h-4 text-orange-500" /> Séquence de découpe</h3>
              <div className="space-y-2">
                {panel.cuts.filter(c => c.type==='bande').map((band, bi) => {
                  const piecesInBand = panel.cuts.filter(c => c.type==='piece' && c.bandKey===band.bandKey && c.panelId===band.panelId);
                  return (
                    <div key={bi} className="border-l-2 border-orange-500/30 pl-3 py-2">
                      <div className="flex items-center gap-2 text-slate-300 mb-2">
                        <span className="text-orange-500 font-bold">✂</span>
                        <span className="text-sm">{band.orientation==='vertical'?'Verticale':'Horizontale'} à <strong className="text-white">{band.posCm}cm</strong>{band.depth>0&&<span className="text-xs text-slate-500 ml-1">(Niv.{band.depth})</span>}</span>
                      </div>
                      {piecesInBand.length>0&&(<div className="space-y-1">{piecesInBand.map((pc,pi)=>(<div key={pi} className="flex items-center justify-between bg-[#0a0a0a] p-2 rounded border border-white/5 text-sm"><div className="flex items-center gap-2"><span className="text-slate-500">→</span><span className="text-white font-medium">{pc.name}</span></div><div className="flex items-center gap-2"><span className="font-mono text-slate-400 text-xs">{pc.lCm}×{pc.hCm}cm</span>{pc.rotated&&<span className="flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20"><RotateCw className="w-2.5 h-2.5" />↺</span>}</div></div>))}</div>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PLANCHES */}
        {tab === 'boards' && <BoardList results={results} project={project} />}

        {/* ── PLANS 2D / 3D */}
        {tab === 'plans' && (
          <div className="space-y-4">
            {hasCabinet ? (
  <>
    <PlanSubTabs active={planView} onChange={setPlanView} />

    {/* Vue façade (existante) */}
    <div style={planView !== 'facade' ? { display: 'none' } : {}}>
      <CabinetElevationFront cabinet={cabinet} name={project.name} />
    </div>

    {/* Vue 2D (existante) */}
    <div style={planView !== '2d' ? { display: 'none' } : {}}>
      <CabinetPlan2D cabinet={cabinet} name={project.name} />
      {/* ta légende existante */}
    </div>

    {/* Vue 3D (existante) */}
    <div style={planView !== '3d' ? { display: 'none' } : {}}>
      <CabinetPlan3D cabinet={cabinet} name={project.name} />
    </div>

    {/* === NOUVELLE VUE RÉALISTE === */}
    <div style={planView !== 'realistic' ? { display: 'none' } : {}}>
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1 mb-3">
        <span className="text-amber-400">🌟</span>
        <span>Vue photoréaliste 3D — tournable et zoomable pour présentation client</span>
      </div>
      
      <ProfessionalRealisticViewer cabinet={cabinet} name={project.name} />
    </div>
  </>
) : (
              /* ─ Pas de cabinet : inviter à faire un scan */
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="text-5xl">📐</div>
                <p className="text-white font-bold text-lg">Plans non disponibles</p>
                <p className="text-sm text-slate-400 max-w-xs">
                  Les plans 2D et 3D sont générés automatiquement depuis un scan IA.
                  Lancez un nouveau projet avec Scan IA pour obtenir les vues industrielles.
                </p>
                <div className="bg-[#111] border border-white/10 rounded-xl p-4 text-left text-xs text-slate-500 max-w-sm">
                  <p className="text-slate-400 font-bold mb-2">💡 Debug info</p>
                  <p>project.cabinet = {JSON.stringify(project.cabinet)?.slice(0, 80) || 'null'}</p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
