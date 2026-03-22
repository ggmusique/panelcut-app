import { useState } from 'react';
import { exportPDF } from '../pdfExport';

const PIECE_COLORS = [
  { fill: 'rgba(245,158,11,0.3)',  stroke: '#d97706' },
  { fill: 'rgba(59,130,246,0.3)',  stroke: '#2563eb' },
  { fill: 'rgba(16,185,129,0.3)', stroke: '#059669' },
  { fill: 'rgba(168,85,247,0.3)', stroke: '#7c3aed' },
  { fill: 'rgba(239,68,68,0.3)',  stroke: '#dc2626' },
  { fill: 'rgba(20,184,166,0.3)', stroke: '#0f766e' },
  { fill: 'rgba(249,115,22,0.3)', stroke: '#ea580c' },
  { fill: 'rgba(99,102,241,0.3)', stroke: '#4f46e5' },
];

function getColor(name, colorMap) {
  if (!colorMap[name]) {
    const idx = Object.keys(colorMap).length % PIECE_COLORS.length;
    colorMap[name] = PIECE_COLORS[idx];
  }
  return colorMap[name];
}

function PanelSVG({ panel, panelW, panelH, colorMap }) {
  const SVG_W = 300;
  const SVG_H = Math.round(SVG_W * panelH / panelW);
  // panelW et panelH sont en mm, les coordonnées des pièces aussi
  const sx = SVG_W / panelW;
  const sy = SVG_H / panelH;

  // Coupe horizontales (bandes)
  const bandCuts = panel.cuts.filter(c => c.type === 'bande');
  // Pièces placées
  const pieces   = panel.placed;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: '100%', display: 'block', background: '#f8fafc', borderRadius: 6, border: '0.5px solid #e2e8f0' }}
    >
      {/* Fond panneau */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#f8fafc" />

      {/* Pièces */}
      {pieces.map((p, i) => {
        const c  = getColor(p.name, colorMap);
        const px = (p.x  || 0) * sx;
        const py = (p.bandY || 0) * sy;
        const pw = p.l * sx - 0.5;
        const ph = p.h * sy - 0.5;
        return (
          <g key={i}>
            <rect
              x={px.toFixed(1)} y={py.toFixed(1)}
              width={Math.max(pw, 1).toFixed(1)} height={Math.max(ph, 1).toFixed(1)}
              fill={c.fill} stroke={c.stroke} strokeWidth="0.8" rx="1"
            />
            {pw > 28 && ph > 14 && (
              <text
                x={(px + pw / 2).toFixed(1)}
                y={(py + ph / 2 + 4).toFixed(1)}
                textAnchor="middle" fontSize="9"
                fontWeight="700"
                fill="#000000" fontFamily="monospace"
              >
                {(p.l/10).toFixed(1)}×{(p.h/10).toFixed(1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Lignes de coupe horizontales */}
      {bandCuts.map((c, i) => {
        const cy = c.pos * sy;
        return (
          <g key={i}>
            <line
              x1={0} y1={cy.toFixed(1)} x2={SVG_W} y2={cy.toFixed(1)}
              stroke="#e74c3c" strokeWidth="0.8" strokeDasharray="4,2"
            />
            <text x={SVG_W - 2} y={(cy - 1).toFixed(1)}
              textAnchor="end" fontSize="6" fill="#e74c3c">
              {c.posCm}cm
            </text>
          </g>
        );
      })}

      {/* Dims */}
      <text x={SVG_W/2} y={SVG_H - 1} textAnchor="middle" fontSize="6" fill="#94a3b8">
        ← {panelW/10}cm →
      </text>
    </svg>
  );
}

export default function Results({ t, results, project }) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const [view, setView]   = useState('visual'); // 'visual' | 'cuts'
  const colorMap = {};

  const panel    = results.panels[currentPanel];
  const panelW   = Math.round(project.panel.w * 10);
  const panelH   = Math.round(project.panel.h * 10);
  const totalCost = (results.summary.totalPanels * (project.pricePerPanel || 0)).toFixed(2);

  // Légend couleurs
  const allNames = [...new Set(results.panels.flatMap(p => p.placed.map(pc => pc.name)))];
  allNames.forEach(n => getColor(n, colorMap));

  return (
    <div className="results-screen">

      {/* Résumé */}
      <div className="summary-grid">
        <div className="sum-card">
          <div className="sum-val">{results.summary.totalPanels}</div>
          <div className="sum-lbl">{t.totalPanels}</div>
        </div>
        <div className="sum-card">
          <div className="sum-val">{results.summary.utilizationPct}%</div>
          <div className="sum-lbl">{t.utilization}</div>
        </div>
        <div className="sum-card">
          <div className="sum-val">{results.summary.wastePct}%</div>
          <div className="sum-lbl">{t.waste}</div>
        </div>
        <div className="sum-card">
          <div className="sum-val">{totalCost}€</div>
          <div className="sum-lbl">{t.totalCost}</div>
        </div>
      </div>

      {/* Bouton export PDF */}
      <button
        className="btn btn--primary btn--large"
        onClick={() => exportPDF(results, project)}
        style={{ background: '#e74c3c', marginBottom: 4 }}
      >
        📄 Exporter en PDF
      </button>

      {/* Légende */}
      <div className="legend">
        {Object.entries(colorMap).map(([name, c]) => (
          <div key={name} className="legend-item">
            <div className="legend-dot" style={{ background: c.fill, border: `1px solid ${c.stroke}` }} />
            <span>{name}</span>
          </div>
        ))}
      </div>

      {/* Navigation panneau */}
      <div className="panel-nav">
        <button
          className="btn btn--ghost"
          onClick={() => setCurrentPanel(p => Math.max(0, p - 1))}
          disabled={currentPanel === 0}
        >{t.prev}</button>
        <div className="panel-nav-info">
          <div className="panel-nav-title">{t.panel_n} {currentPanel + 1} {t.of} {results.panels.length}</div>
          <div className="panel-nav-util" style={{ color: panel.utilizationPct >= 80 ? '#10b981' : panel.utilizationPct >= 60 ? '#f59e0b' : '#e74c3c' }}>
            {panel.utilizationPct}% {t.utilization}
          </div>
        </div>
        <button
          className="btn btn--ghost"
          onClick={() => setCurrentPanel(p => Math.min(results.panels.length - 1, p + 1))}
          disabled={currentPanel === results.panels.length - 1}
        >{t.next}</button>
      </div>

      {/* Toggle vue */}
      <div className="view-toggle">
        <button className={`toggle-btn ${view === 'visual' ? 'toggle-btn--active' : ''}`} onClick={() => setView('visual')}>
          📐 Visuel
        </button>
        <button className={`toggle-btn ${view === 'cuts' ? 'toggle-btn--active' : ''}`} onClick={() => setView('cuts')}>
          ✂ {t.cuts}
        </button>
      </div>

      {/* Vue visuelle */}
      {view === 'visual' && (
        <div className="panel-visual">
          <PanelSVG
            panel={panel}
            panelW={panelW}
            panelH={panelH}
            colorMap={colorMap}
          />
        </div>
      )}

      {/* Vue coupes */}
      {view === 'cuts' && (
        <div className="cuts-list">
          {panel.cuts.filter(c => c.type === 'bande').map((band, bi) => {
            const piecesInBand = panel.cuts.filter(
              c => c.type === 'piece' && c.bandYCm === band.bandYCm && c.panelId === band.panelId
            );
            const indent = band.depth > 0 ? `${band.depth * 12}px` : '0';
            return (
              <div key={bi} className="cut-group" style={{ marginLeft: indent }}>
                <div className="cut-band-row">
                  <span className="cut-band-icon">✂</span>
                  <span className="cut-band-text">
                    {t.bandCut} <strong>{band.posCm}cm</strong>
                    {band.depth > 0 && <span className="cut-depth"> (chute niveau {band.depth})</span>}
                  </span>
                </div>
                {piecesInBand.map((pc, pi) => (
                  <div key={pi} className="cut-piece-row">
                    <span className="cut-piece-bullet">→</span>
                    <span className="cut-piece-name">{pc.name}</span>
                    <span className="cut-piece-dims">{pc.lCm}×{pc.hCm}cm</span>
                    {pc.rotated && <span className="cut-badge cut-badge--rotate">{t.rotated}</span>}
                    {pc.redeligne && (
                      <span className="cut-badge cut-badge--redeligne">
                        {t.redeligne} {pc.redeligne.toCm}cm
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Dots navigation */}
      <div className="panel-dots">
        {results.panels.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === currentPanel ? 'dot--active' : ''}`}
            onClick={() => setCurrentPanel(i)}
            style={{
              background: i === currentPanel
                ? '#f59e0b'
                : results.panels[i].utilizationPct >= 80 ? '#10b981'
                : results.panels[i].utilizationPct >= 60 ? '#f59e0b'
                : '#e74c3c'
            }}
          />
        ))}
      </div>

    </div>
  );
}
