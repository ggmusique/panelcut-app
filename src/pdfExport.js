/**
 * PanelCut Pro — Export PDF Pro v4
 * 4 panneaux par page A4, 2 colonnes × 2 rangées
 * Chaque panneau : coupes à gauche + SVG à droite, bien lisible
 */

export function exportPDF(results, project) {
  const { panels, summary } = results;
  const panelW = project.panel.w;
  const panelH = project.panel.h;
  const totalCost = (summary.totalPanels * (project.pricePerPanel || 0)).toFixed(2);
  const projectName = project.name || 'Sans titre';
  const client = project.client || '';
  const company = project.company || 'PanelCut Pro';
  const devisNum = project.devisNum || '';
  const date = new Date().toLocaleDateString('fr-BE');
  const material = project.selectedPanel?.name || 'MDF 18mm';

  const colorMap = {};
  const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#6366f1','#ec4899','#84cc16'];
  let colorIdx = 0;
  const getColor = (name) => {
    if (!colorMap[name]) colorMap[name] = COLORS[colorIdx++ % COLORS.length];
    return colorMap[name];
  };
  panels.forEach(p => p.placed.forEach(pc => getColor(pc.name)));

  const furnitureGroups = {};
  panels.forEach(p => p.placed.forEach(pc => {
    const fName = pc.furnitureName || 'Sans meuble';
    if (!furnitureGroups[fName]) furnitureGroups[fName] = {};
    const key = `${pc.name} ${(pc.l/10).toFixed(1)}×${(pc.h/10).toFixed(1)}`;
    furnitureGroups[fName][key] = (furnitureGroups[fName][key] || 0) + 1;
  }));

  function renderPanel(panel) {
    // SVG proportionnel — largeur 230px
    const SVG_W = 230;
    const SVG_H = Math.round(SVG_W * panelH / panelW);
    const sx = SVG_W / (panelW * 10);
    const sy = SVG_H / (panelH * 10);
    const bandCuts = panel.cuts.filter(c => c.type === 'bande');

    const svgPieces = panel.placed.map(p => {
      const c = colorMap[p.name] || '#ccc';
      const px = (p.x || 0) * sx;
      const py = (p.bandY || 0) * sy;
      const pw = Math.max(p.l * sx - 0.5, 1);
      const ph = Math.max(p.h * sy - 0.5, 1);
      const label = pw > 30 && ph > 13
        ? `<text x="${(px+pw/2).toFixed(1)}" y="${(py+ph/2+4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#000" font-family="Arial">${(p.l/10).toFixed(1)}×${(p.h/10).toFixed(1)}</text>`
        : '';
      return `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="${c}" fill-opacity="0.4" stroke="${c}" stroke-width="1" rx="1"/>${label}`;
    }).join('');

    const svgLines = bandCuts.map(c => {
      const cy = c.pos * sy;
      return `<line x1="0" y1="${cy.toFixed(1)}" x2="${SVG_W}" y2="${cy.toFixed(1)}" stroke="#e74c3c" stroke-width="1" stroke-dasharray="4,2"/>
      <text x="${SVG_W-2}" y="${(cy-2).toFixed(1)}" text-anchor="end" font-size="7" fill="#e74c3c" font-family="Arial" font-weight="700">${c.posCm}cm</text>`;
    }).join('');

    const svg = `<svg width="${SVG_W}" height="${SVG_H}" style="display:block;border:1.5px solid #bbb;border-radius:4px;background:#fafafa">
      ${svgPieces}${svgLines}
      <text x="${SVG_W/2}" y="${SVG_H-2}" text-anchor="middle" font-size="7" fill="#aaa" font-family="Arial">← ${panelW} cm →</text>
    </svg>`;

    const cutsHtml = bandCuts.map(band => {
      const piecesInBand = panel.cuts.filter(c =>
        c.type === 'piece' && c.bandYCm === band.bandYCm && c.depth === band.depth
      );
      return `
      <div class="cut-band">✂ Coupe à <strong>${band.posCm} cm</strong>${band.depth > 0 ? ' <em>(chute)</em>' : ''}</div>
      ${piecesInBand.map(pc => {
        const fTag = pc.furnitureName ? `<span class="ftag">${pc.furnitureName}</span> ` : '';
        const rot  = pc.rotated ? ` <span class="rot">[90°]</span>` : '';
        const red  = pc.redeligne ? ` <span class="red">→ redéligner ${pc.redeligne.toCm}cm</span>` : '';
        return `<div class="cut-piece">→ ${fTag}<b>${pc.name}</b> <span class="dims">${pc.lCm}×${pc.hCm} cm</span>${rot}${red}</div>`;
      }).join('')}`;
    }).join('');

    return `
    <div class="panel-card">
      <div class="panel-head">
        <span class="pnum">Panneau ${panel.panelId} / ${panels.length}</span>
        <span class="putil">${panel.utilizationPct}% utilisé · ${panel.wastePct}% chute</span>
      </div>
      <div class="panel-body">
        <div class="cuts-col">
          <div class="cuts-label">ORDRE DES COUPES</div>
          ${cutsHtml}
        </div>
        <div class="svg-col">${svg}</div>
      </div>
    </div>`;
  }

  // 4 panneaux par page
  const pages = [];
  for (let i = 0; i < panels.length; i += 4) pages.push(panels.slice(i, i + 4));

  const pagesHtml = pages.map((pagePanels, pi) => `
    ${pi > 0 ? '<div style="page-break-before:always"></div>' : ''}
    <div class="page-header">
      <div class="ph-l">
        <span class="ph-logo">✂ PanelCut Pro</span>
        <span class="ph-proj">${projectName}${client ? ' — ' + client : ''}</span>
      </div>
      <div class="ph-r">${devisNum || ''} · ${date}</div>
    </div>
    ${pi === 0 ? `<div class="legend">${Object.entries(colorMap).map(([n,c]) =>
      `<span class="leg"><span class="leg-dot" style="background:${c}"></span>${n}</span>`
    ).join('')}</div>` : ''}
    <div class="panels-grid">
      ${pagePanels.map(p => renderPanel(p)).join('')}
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${devisNum ? devisNum + ' — ' : ''}${projectName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:white}
  @page{size:A4;margin:10mm 12mm}

  /* ── PAGE DE GARDE ── */
  .cover{min-height:100vh;display:flex;flex-direction:column;page-break-after:always}
  .cover-header{background:#1a1a2e;padding:22px 26px;display:flex;justify-content:space-between;align-items:center}
  .cover-logo{font-size:22px;font-weight:700;color:#f59e0b}
  .cover-logo span{color:white}
  .cover-company{font-size:12px;color:#8899b4;margin-top:3px}
  .cover-devis{text-align:right;font-size:11px;color:#8899b4}
  .cover-devis strong{display:block;font-size:15px;color:#f59e0b;font-weight:700}
  .cover-body{flex:1;padding:28px 26px;display:flex;flex-direction:column;gap:20px}
  .cover-project{border-left:4px solid #f59e0b;padding-left:14px}
  .cover-project h1{font-size:22px;font-weight:700;color:#1a1a2e;margin-bottom:5px}
  .cover-project .dt{font-size:10px;color:#888}
  .cover-client{background:#f9f9f9;border:1px solid #e5e5e5;border-radius:7px;padding:14px}
  .cover-client h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:8px}
  .cover-client-name{font-size:16px;font-weight:700;color:#1a1a2e}
  .cover-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .cs-box{background:#1a1a2e;border-radius:7px;padding:12px;text-align:center}
  .cs-val{font-size:20px;font-weight:700;color:#f59e0b;line-height:1}
  .cs-lbl{font-size:8px;color:#8899b4;text-transform:uppercase;letter-spacing:.05em;margin-top:3px}
  .cover-furn{background:#f9f9f9;border:1px solid #e5e5e5;border-radius:7px;padding:14px}
  .cover-furn h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:8px}
  .furn-group{margin-bottom:8px}
  .furn-name{font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:3px}
  .furn-pieces{display:flex;flex-wrap:wrap;gap:3px}
  .furn-piece{font-size:9px;background:white;border:1px solid #e5e5e5;border-radius:3px;padding:1px 7px;color:#444}
  .cover-info{margin-top:auto;padding-top:12px;border-top:1px solid #e5e5e5;font-size:10px;color:#666;display:flex;gap:16px;flex-wrap:wrap}

  /* ── EN-TÊTE PAGE ── */
  .page-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:2px solid #f59e0b;margin-bottom:8px}
  .ph-l{display:flex;align-items:center;gap:8px}
  .ph-logo{font-size:13px;font-weight:700;color:#f59e0b}
  .ph-proj{font-size:10px;color:#666}
  .ph-r{font-size:8px;color:#999}
  .legend{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;padding:5px 8px;background:#f9f9f9;border-radius:4px}
  .leg{display:flex;align-items:center;gap:3px;font-size:9px;color:#444}
  .leg-dot{width:10px;height:10px;border-radius:2px;display:inline-block;flex-shrink:0}

  /* ── GRILLE 2×2 ── */
  .panels-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;height:calc(100vh - 80px)}

  /* ── CARTE PANNEAU ── */
  .panel-card{border:1.5px solid #ddd;border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
  .panel-head{display:flex;justify-content:space-between;align-items:center;background:#f0f0f0;padding:4px 10px;border-bottom:1px solid #ddd;flex-shrink:0}
  .pnum{font-size:11px;font-weight:700;color:#1a1a2e}
  .putil{font-size:9px;color:#888}
  .panel-body{display:flex;flex:1;overflow:hidden}

  /* ── COUPES (gauche) ── */
  .cuts-col{flex:1;padding:7px 8px;border-right:1px solid #eee;overflow:auto;min-width:0}
  .cuts-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:5px}
  .cut-band{font-size:10px;font-weight:700;color:#e74c3c;margin-top:6px;margin-bottom:2px}
  .cut-band em{font-style:normal;font-weight:400;color:#bbb;font-size:8px}
  .cut-piece{font-size:10px;color:#333;padding-left:8px;line-height:1.6;margin-bottom:1px}
  .ftag{background:#f59e0b;color:#0a0f1a;font-size:8px;font-weight:700;padding:0 4px;border-radius:2px;margin-right:2px}
  .dims{font-family:'Courier New',monospace;color:#555;font-size:9px}
  .rot{color:#8b5cf6;font-size:8px}
  .red{color:#f59e0b;font-weight:600;font-size:8px}

  /* ── SVG (droite) ── */
  .svg-col{flex-shrink:0;padding:6px;display:flex;align-items:center;justify-content:center;background:#fafafa}

  /* ── PIED DE PAGE ── */
  .footer{margin-top:10px;padding-top:6px;border-top:1px solid #e5e5e5;font-size:8px;color:#bbb;display:flex;justify-content:space-between}
</style>
</head>
<body>

<!-- PAGE DE GARDE -->
<div class="cover">
  <div class="cover-header">
    <div>
      <div class="cover-logo">✂ PanelCut<span> Pro</span></div>
      <div class="cover-company">${company}</div>
    </div>
    ${devisNum
      ? `<div class="cover-devis"><span>N° Devis</span><strong>${devisNum}</strong><span>${date}</span></div>`
      : `<div class="cover-devis"><span>${date}</span></div>`}
  </div>
  <div class="cover-body">
    <div class="cover-project">
      <h1>${projectName}</h1>
      <div class="dt">Plan de découpe — ${date}</div>
    </div>
    ${client ? `<div class="cover-client"><h3>Client</h3><div class="cover-client-name">${client}</div></div>` : ''}
    <div class="cover-summary">
      <div class="cs-box"><div class="cs-val">${summary.totalPanels}</div><div class="cs-lbl">Panneaux</div></div>
      <div class="cs-box"><div class="cs-val">${summary.totalPieces}</div><div class="cs-lbl">Pièces</div></div>
      <div class="cs-box"><div class="cs-val">${summary.utilizationPct}%</div><div class="cs-lbl">Utilisation</div></div>
      <div class="cs-box"><div class="cs-val">${totalCost}€</div><div class="cs-lbl">Coût matière</div></div>
    </div>
    ${Object.keys(furnitureGroups).length > 0 ? `
    <div class="cover-furn">
      <h3>Récapitulatif par meuble</h3>
      ${Object.entries(furnitureGroups).map(([fname, pcs]) => `
        <div class="furn-group">
          <div class="furn-name">${fname}</div>
          <div class="furn-pieces">${Object.entries(pcs).map(([k,qty]) =>
            `<span class="furn-piece">${k} ×${qty}</span>`).join('')}</div>
        </div>`).join('')}
    </div>` : ''}
    <div class="cover-info">
      <span>📐 Panneau : ${panelW}×${panelH} cm</span>
      <span>✂ Trait de scie : ${project.kerf} mm</span>
      <span>🪵 Matière : ${material}</span>
      <span>💰 ${(project.pricePerPanel || 0).toFixed(2)} €/panneau</span>
    </div>
  </div>
</div>

<!-- PAGES DÉCOUPE -->
${pagesHtml}

<div class="footer">
  <span>✂ PanelCut Pro — ${company}</span>
  <span>${devisNum ? devisNum + ' · ' : ''}${date}</span>
</div>

</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 600);
}
