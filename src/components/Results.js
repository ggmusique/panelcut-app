import { useState } from 'react';
import { exportPDF } from '../pdfExport';
import { FileText, Maximize2, Scissors, RotateCw, Layers, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';

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

function PanelSVG({ panel, panelW, panelH, colorMap }) {
  const SVG_W = 500;
  const SVG_H = Math.round(SVG_W * panelH / panelW);
  const sx = SVG_W / panelW;
  const sy = SVG_H / panelH;

  const bandCuts = panel.cuts.filter(c => c.type === 'bande');
  const pieces   = panel.placed;

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="relative w-full h-auto bg-[#0a0a0a] rounded-xl border border-white/10 shadow-2xl"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#grid)" />

        {pieces.map((p, i) => {
          const c  = getColor(p.name, colorMap);
          const px = (p.x  || 0) * sx;
          const py = (p.bandY || 0) * sy;
          const pw = p.l * sx - 1;
          const ph = p.h * sy - 1;
          return (
            <g key={i}>
              <rect x={(px+1).toFixed(1)} y={(py+1).toFixed(1)} width={Math.max(pw-2, 0).toFixed(1)} height={Math.max(ph-2, 0).toFixed(1)} fill={c.glow} filter="blur(4px)" opacity="0.5" />
              <rect x={px.toFixed(1)} y={py.toFixed(1)} width={Math.max(pw, 1).toFixed(1)} height={Math.max(ph, 1).toFixed(1)} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" rx="2" />
              {pw > 40 && ph > 20 && (
                <g>
                  <text x={(px + pw / 2).toFixed(1)} y={(py + ph / 2 + 4).toFixed(1)} textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff" fontFamily="monospace">{(p.l/10).toFixed(0)}×{(p.h/10).toFixed(0)}</text>
                  <text x={(px + pw / 2).toFixed(1)} y={(py + ph / 2 + 14).toFixed(1)} textAnchor="middle" fontSize="8" fill="#cbd5e1" fontFamily="sans-serif">{p.name.substring(0, 10)}{p.name.length>10?'...':''}</text>
                </g>
              )}
            </g>
          );
        })}

        {bandCuts.map((c, i) => {
          const isVertical = c.orientation === 'vertical';
          if (isVertical) {
            const cx = c.pos * sx;
            return (
              <g key={i}>
                <line x1={cx.toFixed(1)} y1={0} x2={cx.toFixed(1)} y2={SVG_H} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6,3" />
                <rect x={(cx-15).toFixed(1)} y="4" width="30" height="14" rx="2" fill="#000" fillOpacity="0.9" stroke="#333" strokeWidth="0.5" />
                <text x={cx.toFixed(1)} y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ef4444">{c.posCm}cm</text>
              </g>
            );
          }
          const cy = c.pos * sy;
          return (
            <g key={i}>
              <line x1={0} y1={cy.toFixed(1)} x2={SVG_W} y2={cy.toFixed(1)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6,3" />
              <rect x={(SVG_W-35).toFixed(1)} y={(cy-7).toFixed(1)} width="30" height="14" rx="2" fill="#000" fillOpacity="0.9" stroke="#333" strokeWidth="0.5" />
              <text x={(SVG_W-20).toFixed(1)} y={cy.toFixed(1)} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ef4444">{c.posCm}</text>
            </g>
          );
        })}

        <g className="opacity-50">
          <text x={SVG_W/2} y={SVG_H - 8} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="bold">{panelW/10} cm</text>
          <text x="8" y={SVG_H/2} transform={`rotate(-90 8 ${SVG_H/2})`} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="bold">{panelH/10} cm</text>
        </g>
      </svg>
    </div>
  );
}

export default function Results({ t, results, project }) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const [view, setView]   = useState('visual');
  const colorMap = {};

  const panel    = results.panels[currentPanel];
  const panelW   = Math.round(project.panel.w * 10);
  const panelH   = Math.round(project.panel.h * 10);
  const totalCost = (results.summary.totalPanels * (project.pricePerPanel || 0)).toFixed(2);
  const utilization = panel.utilizationPct;

  const allNames = [...new Set(results.panels.flatMap(p => p.placed.map(pc => pc.name)))];
  allNames.forEach(n => getColor(n, colorMap));

  const nextPanel = () => setCurrentPanel(p => Math.min(results.panels.length - 1, p + 1));
  const prevPanel = () => setCurrentPanel(p => Math.max(0, p - 1));

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 pb-32 relative font-sans">

      {/* KPIs sticky */}
      <div className="sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 pt-6 pb-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-orange-500" />
              Résultats d'Optimisation
            </h2>
            <button
              onClick={() => exportPDF(results, project)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-white/10"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter PDF</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-[#111] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center h-20">
              <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight text-center mb-1">Panneaux<br/>Nécessaires</div>
              <div className="text-base font-black text-white leading-none">{results.summary.totalPanels}</div>
              <div className="text-[9px] text-orange-400 mt-1 font-medium">Requis</div>
            </div>
            <div className="bg-[#111] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center h-20">
              <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight text-center mb-1">Utilisation</div>
              <div className={`text-base font-black leading-none ${utilization >= 80 ? 'text-green-400' : utilization >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{utilization}%</div>
              <div className="w-full bg-white/10 h-0.5 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${utilization >= 80 ? 'bg-green-500' : utilization >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${utilization}%` }}></div>
              </div>
            </div>
            <div className="bg-[#111] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center h-20">
              <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight text-center mb-1">Chutes<br/>Perdues</div>
              <div className="text-base font-black text-red-400 leading-none">{results.summary.wastePct}%</div>
              <div className="text-[9px] text-slate-500 mt-1 font-medium">Perte</div>
            </div>
            <div className="bg-[#111] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center h-20">
              <div className="text-[10px] text-slate-400 uppercase font-bold leading-tight text-center mb-1">Coût<br/>Estimé</div>
              <div className="text-base font-black text-blue-400 leading-none">{totalCost}€</div>
              <div className="text-[9px] text-slate-500 mt-1 font-medium">Matière</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* LAYOUT 2 COLONNES sur desktop: SVG gauche, coupes droite */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* COLONNE GAUCHE: Visualisation */}
          <div className="space-y-4">
            {/* Navigation panneaux */}
            <div className="flex items-center justify-between bg-[#111] p-2 rounded-xl border border-white/5">
              <button onClick={prevPanel} disabled={currentPanel === 0} className="p-3 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="text-center">
                <div className="text-sm font-bold text-white">Panneau {currentPanel + 1} <span className="text-slate-500 font-normal">/ {results.panels.length}</span></div>
                <div className={`text-xs font-bold mt-0.5 ${utilization >= 80 ? 'text-green-400' : utilization >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {utilization}% d'efficacité
                </div>
              </div>
              <button onClick={nextPanel} disabled={currentPanel === results.panels.length - 1} className="p-3 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <PanelSVG panel={panel} panelW={panelW} panelH={panelH} colorMap={colorMap} />

            {/* Légende */}
            <div className="bg-[#111] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Légende des pièces</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(colorMap).map(([name, c]) => (
                  <div key={name} className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-white/5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: c.fill, border: `1px solid ${c.stroke}`, boxShadow: `0 0 8px ${c.glow}` }}></div>
                    <span className="text-sm text-slate-300 font-medium">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dots navigation */}
            <div className="flex justify-center gap-2">
              {results.panels.map((_, i) => (
                <button key={i} onClick={() => setCurrentPanel(i)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${i === currentPanel ? 'bg-orange-500 scale-125 shadow-[0_0_10px_rgba(249,115,22,0.6)]' : 'bg-[#333] hover:bg-slate-500'}`}
                  title={`Panneau ${i+1}`}
                />
              ))}
            </div>
          </div>

          {/* COLONNE DROITE: Séquence de coupes */}
          <div className="space-y-4">
            <div className="flex justify-center lg:justify-start">
              <div className="bg-[#111] p-1 rounded-xl border border-white/5 inline-flex">
                <button 
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'visual' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setView('visual')}
                >
                  <Maximize2 className="w-4 h-4 inline mr-2 -mt-0.5" /> Visuel
                </button>
                <button 
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'cuts' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setView('cuts')}
                >
                  <Scissors className="w-4 h-4 inline mr-2 -mt-0.5" /> Coupes
                </button>
              </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-xl p-6 min-h-[400px]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-orange-500" />
                Séquence de découpe
              </h3>
              <div className="space-y-2">
                {panel.cuts.filter(c => c.type === 'bande').map((band, bi) => {
                  const piecesInBand = panel.cuts.filter(
                    c => c.type === 'piece' && c.bandKey === band.bandKey && c.panelId === band.panelId
                  );
                  const indent = band.depth > 0 ? `pl-${band.depth * 4}` : '';
                  return (
                    <div key={bi} className={`border-l-2 border-orange-500/30 ${indent} pl-4 py-2`}>
                      <div className="flex items-center gap-2 text-slate-300 mb-2">
                        <span className="text-orange-500 font-bold">✂</span>
                        <span className="text-sm">
                          Coupe {band.orientation === 'vertical' ? 'Verticale' : 'Horizontale'} à <strong className="text-white">{band.posCm}cm</strong>
                          {band.depth > 0 && <span className="text-xs text-slate-500 ml-2">(Niveau {band.depth})</span>}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {piecesInBand.map((pc, pi) => (
                          <div key={pi} className="flex items-center justify-between bg-[#0a0a0a] p-2 rounded border border-white/5 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">→</span>
                              <span className="text-white font-medium">{pc.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-slate-400">{pc.lCm}×{pc.hCm}cm</span>
                              {pc.rotated && (
                                <span className="flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                                  <RotateCw className="w-3 h-3" /> Tourné
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {panel.cuts.filter(c => c.type === 'bande').length === 0 && (
                  <div className="text-center text-slate-500 py-10">Aucune coupe complexe requise.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}