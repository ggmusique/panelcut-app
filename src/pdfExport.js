/**
 * PanelCut Pro — Export PDF Pro
 * Page de garde + en-tête entreprise + numéro de devis
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

  // Couleurs par nom de pièce
  const colorMap = {};
  const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#6366f1','#ec4899','#84cc16'];
  let colorIdx = 0;
  const getColor = (name) => {
    if (!colorMap[name]) colorMap[name] = COLORS[colorIdx++ % COLORS.length];
    return colorMap[name];
  };
  panels.forEach(p => p.placed.forEach(pc => getColor(pc.name)));

  // Groupe les pièces par meuble pour le récap
  const furnitureGroups = {};
  panels.forEach(p => p.placed.forEach(pc => {
    const fName = pc.furnitureName || 'Sans meuble';
    if (!furnitureGroups[fName]) furnitureGroups[fName] = {};
    const key = `${pc.name} ${(pc.l/10).toFixed(1)}×${(pc.h/10).toFixed(1)}`;
    furnitureGroups[fName][key] = (furnitureGroups[fName][key] || 0) + 1;
  }));

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${devisNum ? devisNum + ' — ' : ''}${projectName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:white}
  @page{size:A4;margin:12mm 15mm}

  /* ── Page de garde ── */
  .cover{min-height:100vh;display:flex;flex-direction:column;page-break-after:always}
  .cover-header{background:#1a1a2e;color:white;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
  .cover-logo{font-size:22px;font-weight:700;color:#f59e0b;letter-spacing:-0.5px}
  .cover-logo span{color:white}
  .cover-company{font-size:13px;color:#8899b4;margin-top:3px}
  .cover-devis{text-align:right;font-size:11px;color:#8899b4}
  .cover-devis strong{display:block;font-size:14px;color:#f59e0b;font-weight:700}

  .cover-body{flex:1;padding:32px 28px;display:flex;flex-direction:column;gap:24px}
  .cover-project{border-left:4px solid #f59e0b;padding-left:16px}
  .cover-project h1{font-size:24px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
  .cover-project .date{font-size:11px;color:#888}

  .cover-client{background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:16px}
  .cover-client h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px}
  .cover-client-name{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
  .cover-client-info{font-size:11px;color:#666}

  .cover-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .cs-box{background:#1a1a2e;border-radius:8px;padding:12px;text-align:center}
  .cs-val{font-size:20px;font-weight:700;color:#f59e0b;line-height:1}
  .cs-lbl{font-size:9px;color:#8899b4;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}

  .cover-furniture{background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:14px}
  .cover-furniture h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px}
  .furn-group{margin-bottom:10px}
  .furn-group:last-child{margin-bottom:0}
  .furn-name{font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:4px;display:flex;align-items:center;gap:6px}
  .furn-dot{width:8px;height:8px;border-radius:2px;display:inline-block}
  .furn-pieces{display:flex;flex-wrap:wrap;gap:4px}
  .furn-piece{font-size:10px;background:white;border:1px solid #e5e5e5;border-radius:4px;padding:2px 8px;color:#444}

  .cover-panel-info{font-size:11px;color:#666;margin-top:auto;padding-top:16px;border-top:1px solid #e5e5e5;display:flex;gap:20px}
  .cover-panel-info span{display:flex;align-items:center;gap:4px}

  /* ── Pages découpe ── */
  .page-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:2px solid #f59e0b;margin-bottom:12px}
  .ph-left{display:flex;align-items:center;gap:10px}
  .ph-logo{font-size:14px;font-weight:700;color:#f59e0b}
  .ph-project{font-size:11px;color:#666}
  .ph-right{text-align:right;font-size:9px;color:#999}

  .legend{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:8px;background:#f9f9f9;border-radius:6px}
  .leg-item{display:flex;align-items:center;gap:4px;font-size:9px;color:#555}
  .leg-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}

  .panel-section{margin-bottom:18px;page-break-inside:avoid}
  .panel-title{font-size:11px;font-weight:700;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;background:#f9f9f9;padding:5px 8px;border-radius:4px}
  .panel-title .util{font-weight:normal;color:#888;font-size:10px}

  .panel-layout{display:flex;gap:14px;align-items:flex-start}
  .panel-svg-wrap{flex-shrink:0}
  .panel-cuts{flex:1;min-width:0}
  .panel-cuts h4{font-size:9px;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em;color:#888}
  .cut-band{font-size:10px;font-weight:700;color:#e74c3c;margin-top:5px;margin-bottom:1px}
  .cut-piece{font-size:9px;color:#333;padding-left:8px;line-height:1.7}
  .cut-piece .furn-tag{background:#f59e0b;color:#0a0f1a;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:3px}
  .cut-piece .redeligne{color:#f59e0b;font-weight:600}
  .cut-piece .rot{color:#8b5cf6;font-size:8px}

  .footer{margin-top:16px;padding-top:8px;border-top:1px solid #e5e5e5;font-size:8px;color:#bbb;display:flex;justify-content:space-between}
</style>
</head>
<body>

<!-- ═══════════════ PAGE DE GARDE ═══════════════ -->
<div class="cover">
  <div class="cover-header">
    <div>
      <div class="cover-logo">✂ PanelCut<span> Pro</span></div>
      <div class="cover-company">${company}</div>
    </div>
    ${devisNum ? `<div class="cover-devis"><span>Numéro de devis</span><strong>${devisNum}</strong><span>${date}</span></div>` : `<div class="cover-devis"><span>${date}</span></div>`}
  </div>

  <div class="cover-body">
    <div class="cover-project">
      <h1>${projectName}</h1>
      <div class="date">Plan de découpe — ${date}</div>
    </div>

    ${client ? `
    <div class="cover-client">
      <h3>Client</h3>
      <div class="cover-client-name">${client}</div>
    </div>` : ''}

    <div class="cover-summary">
      <div class="cs-box"><div class="cs-val">${summary.totalPanels}</div><div class="cs-lbl">Panneaux</div></div>
      <div class="cs-box"><div class="cs-val">${summary.totalPieces}</div><div class="cs-lbl">Pièces</div></div>
      <div class="cs-box"><div class="cs-val">${summary.utilizationPct}%</div><div class="cs-lbl">Utilisation</div></div>
      <div class="cs-box"><div class="cs-val">${totalCost}€</div><div class="cs-lbl">Coût matière</div></div>
    </div>

    ${Object.keys(furnitureGroups).length > 0 ? `
    <div class="cover-furniture">
      <h3>Récapitulatif par meuble</h3>
      ${Object.entries(furnitureGroups).map(([fname, pcs]) => `
        <div class="furn-group">
          <div class="furn-name">${fname}</div>
          <div class="furn-pieces">
            ${Object.entries(pcs).map(([k, qty]) =>
              `<span class="furn-piece">${k} ×${qty}</span>`
            ).join('')}
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="cover-panel-info">
      <span>📐 Panneau : ${panelW}×${panelH}cm</span>
      <span>✂ Trait de scie : ${project.kerf}mm</span>
      <span>🪵 Matière : ${material}</span>
      <span>💰 Prix/panneau : ${(project.pricePerPanel || 0).toFixed(2)}€</span>
    </div>
  </div>
</div>

<!-- ═══════════════ PAGES DÉCOUPE ═══════════════ -->

${panels.map((panel, pi) => {
  const SVG_W = 190;
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
    const label = pw > 22 && ph > 9
      ? `<text x="${(px+pw/2).toFixed(1)}" y="${(py+ph/2+3).toFixed(1)}" text-anchor="middle" font-size="5.5" font-weight="700" fill="#000" font-family="Arial">${(p.l/10).toFixed(1)}×${(p.h/10).toFixed(1)}</text>`
      : '';
    return `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="${c}" fill-opacity="0.35" stroke="${c}" stroke-width="0.8" rx="1"/>${label}`;
  }).join('');

  const svgCuts = bandCuts.map(c => {
    const cy = c.pos * sy;
    return `<line x1="0" y1="${cy.toFixed(1)}" x2="${SVG_W}" y2="${cy.toFixed(1)}" stroke="#e74c3c" stroke-width="0.7" stroke-dasharray="3,2"/>
    <text x="${SVG_W-1}" y="${(cy-1).toFixed(1)}" text-anchor="end" font-size="5" fill="#e74c3c" font-family="Arial">${c.posCm}cm</text>`;
  }).join('');

  const cutsHtml = bandCuts.map(band => {
    const piecesInBand = panel.cuts.filter(c => c.type === 'piece' && c.bandYCm === band.bandYCm && c.depth === band.depth);
    return `<div class="cut-band">✂ Coupe à ${band.posCm}cm${band.depth > 0 ? ` <em style="font-weight:normal;color:#999">(chute niv.${band.depth})</em>` : ''}</div>
    ${piecesInBand.map(pc => {
      const fTag = pc.furnitureName ? `<span class="furn-tag">${pc.furnitureName}</span>` : '';
      const rot  = pc.rotated ? `<span class="rot"> [90°]</span>` : '';
      const red  = pc.redeligne ? `<span class="redeligne"> → redéligner ${pc.redeligne.toCm}cm</span>` : '';
      return `<div class="cut-piece">${fTag}→ ${pc.name} ${pc.lCm}×${pc.hCm}cm${rot}${red}</div>`;
    }).join('')}`;
  }).join('');

  const isNewPage = pi > 0 && pi % 3 === 0;

  return `
  ${isNewPage ? '<div style="page-break-before:always"></div>' : ''}
  ${pi === 0 || isNewPage ? `
  <div class="page-header">
    <div class="ph-left">
      <span class="ph-logo">✂ PanelCut Pro</span>
      <span class="ph-project">${projectName}${client ? ' — ' + client : ''}</span>
    </div>
    <div class="ph-right">${devisNum || ''} · ${date}</div>
  </div>
  ${pi === 0 ? `<div class="legend">${Object.entries(colorMap).map(([name, color]) =>
    `<div class="leg-item"><div class="leg-dot" style="background:${color}"></div>${name}</div>`
  ).join('')}</div>` : ''}
  ` : ''}

  <div class="panel-section">
    <div class="panel-title">
      <span>Panneau ${panel.panelId} / ${panels.length}</span>
      <span class="util">Utilisation : ${panel.utilizationPct}% · Chute : ${panel.wastePct}%</span>
    </div>
    <div class="panel-layout">
      <div class="panel-svg-wrap">
        <svg width="${SVG_W}" height="${SVG_H}" style="border:1px solid #ddd;border-radius:3px;background:#fafafa">
          ${svgPieces}${svgCuts}
          <text x="${SVG_W/2}" y="${SVG_H-1}" text-anchor="middle" font-size="5" fill="#bbb" font-family="Arial">← ${panelW}cm →</text>
        </svg>
      </div>
      <div class="panel-cuts">
        <h4>Ordre des coupes</h4>
        ${cutsHtml}
      </div>
    </div>
  </div>`;
}).join('')}

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
