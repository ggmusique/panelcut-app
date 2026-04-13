import { jsPDF } from 'jspdf';

/**
 * PanelCut Pro — Export PDF avec jsPDF
 * 3 panneaux par page A4, visuel SVG canvas + coupes texte
 */

const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#14b8a6','#f97316','#6366f1','#ec4899','#84cc16'];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}


function getLargestWasteRect(panel, panelWmm, panelHmm) {
  const xs = new Set([0, panelWmm]);
  const ys = new Set([0, panelHmm]);
  const pieces = panel.placed.map(p => ({
    x: p.x || 0,
    y: p.bandY || 0,
    w: p.l,
    h: p.h,
  }));

  pieces.forEach(p => {
    xs.add(p.x);
    xs.add(p.x + p.w);
    ys.add(p.y);
    ys.add(p.y + p.h);
  });

  const xList = [...xs].sort((a, b) => a - b);
  const yList = [...ys].sort((a, b) => a - b);
  let best = null;

  const overlaps = (rect, piece) => !(
    piece.x + piece.w <= rect.x ||
    piece.x >= rect.x + rect.w ||
    piece.y + piece.h <= rect.y ||
    piece.y >= rect.y + rect.h
  );

  for (let xi = 0; xi < xList.length - 1; xi++) {
    for (let xj = xi + 1; xj < xList.length; xj++) {
      const w = xList[xj] - xList[xi];
      if (w <= 0) continue;

      for (let yi = 0; yi < yList.length - 1; yi++) {
        for (let yj = yi + 1; yj < yList.length; yj++) {
          const h = yList[yj] - yList[yi];
          if (h <= 0) continue;

          const rect = { x: xList[xi], y: yList[yi], w, h };
          const area = w * h;
          if (best && area <= best.area) continue;
          if (pieces.some(piece => overlaps(rect, piece))) continue;
          best = { ...rect, area };
        }
      }
    }
  }

  return best;
}

export function exportPDF(results, project, extras = {}) {
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

  // Palette couleurs par nom de pièce
  const colorMap = {};
  let colorIdx = 0;
  const getColor = (name) => {
    if (!colorMap[name]) colorMap[name] = COLORS[colorIdx++ % COLORS.length];
    return colorMap[name];
  };
  panels.forEach(p => p.placed.forEach(pc => getColor(pc.name)));

  // A4 en mm
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210; // page width
  const PH = 297; // page height
  const M  = 12;  // marge
  const CW = PW - 2*M; // contenu width

  // ── Couleurs de base ──
  const ACCENT = [245, 158, 11];
  const DARK   = [26, 26, 46];
  const GRAY   = [100, 100, 100];
  const LIGHT  = [245, 245, 245];
  const RED    = [231, 76, 60];

  // ── PAGE DE GARDE ──────────────────────────────────────────────────────

  // Header fond sombre
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PW, 32, 'F');

  // Logo
  doc.setTextColor(...ACCENT);
  doc.setFontSize(18);
  doc.setFont('helvetica','bold');
  doc.text('✂ PanelCut Pro', M, 14);

  doc.setTextColor(136, 153, 180);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(company, M, 21);

  // Numéro devis
  if (devisNum) {
    doc.setTextColor(...ACCENT);
    doc.setFontSize(12);
    doc.setFont('helvetica','bold');
    doc.text(devisNum, PW - M, 14, { align: 'right' });
    doc.setTextColor(136,153,180);
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    doc.text(date, PW - M, 21, { align: 'right' });
  } else {
    doc.setTextColor(136,153,180);
    doc.setFontSize(9);
    doc.text(date, PW - M, 14, { align: 'right' });
  }

  let y = 42;

  // Trait accent
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y-4, M+4, y-4);
  doc.setLineWidth(0.1);

  // Titre projet
  doc.setTextColor(...DARK);
  doc.setFontSize(20);
  doc.setFont('helvetica','bold');
  doc.text(projectName, M, y+2);
  y += 8;

  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text(`Plan de découpe — ${date}`, M, y);
  y += 10;

  // Bloc client
  if (client) {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y, CW, 16, 2, 2, 'F');
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica','bold');
    doc.text('CLIENT', M+5, y+6);
    doc.setTextColor(...DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica','bold');
    doc.text(client, M+5, y+13);
    y += 22;
  }

  // Résumé 4 cases
  const boxW = (CW - 9) / 4;
  [[summary.totalPanels,'Panneaux'],[summary.totalPieces,'Pièces'],[summary.utilizationPct+'%','Utilisation'],[totalCost+'€','Coût matière']].forEach(([val,lbl],i) => {
    const bx = M + i*(boxW+3);
    doc.setFillColor(...DARK);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
    doc.setTextColor(...ACCENT);
    doc.setFontSize(14);
    doc.setFont('helvetica','bold');
    doc.text(String(val), bx+boxW/2, y+10, { align:'center' });
    doc.setTextColor(136,153,180);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text(lbl.toUpperCase(), bx+boxW/2, y+15, { align:'center' });
  });
  y += 24;

  // Récap meubles
  const furnitureGroups = {};
  panels.forEach(p => p.placed.forEach(pc => {
    const fName = pc.furnitureName || null;
    if (!fName) return;
    if (!furnitureGroups[fName]) furnitureGroups[fName] = {};
    const key = `${pc.name} ${(pc.l/10).toFixed(1)}×${(pc.h/10).toFixed(1)}cm`;
    furnitureGroups[fName][key] = (furnitureGroups[fName][key] || 0) + 1;
  }));
  if (Object.keys(furnitureGroups).length > 0) {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y, CW, 8, 2, 2, 'F');
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica','bold');
    doc.text('RÉCAPITULATIF PAR MEUBLE', M+5, y+5.5);
    y += 12;
    Object.entries(furnitureGroups).forEach(([fname, pcs]) => {
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont('helvetica','bold');
      doc.text(fname, M+3, y);
      y += 5;
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      const items = Object.entries(pcs).map(([k,qty]) => `${k} ×${qty}`).join('   ');
      const lines = doc.splitTextToSize(items, CW-6);
      lines.forEach(line => { doc.text(line, M+5, y); y += 4.5; });
      y += 2;
    });
  }

  // Légende couleurs
  y += 4;
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text('LÉGENDE', M, y);
  y += 5;
  let lx = M;
  Object.entries(colorMap).forEach(([name, hex]) => {
    const [r,g,b] = hexToRgb(hex);
    doc.setFillColor(r,g,b);
    doc.roundedRect(lx, y-3, 4, 4, 0.5, 0.5, 'F');
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    const tw = doc.getTextWidth(name) + 8;
    doc.text(name, lx+5.5, y);
    lx += tw + 4;
    if (lx > PW - M - 20) { lx = M; y += 6; }
  });

  // Infos panneau en bas
  y = PH - 20;
  doc.setDrawColor(220,220,220);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW-M, y);
  y += 5;
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica','normal');
  doc.text(`Panneau : ${panelW}×${panelH}cm   Trait de scie : ${project.kerf}mm   Matière : ${material}   Prix/panneau : ${(project.pricePerPanel||0).toFixed(2)}€`, M, y);

  // ── PAGES DE DÉCOUPE ───────────────────────────────────────────────────

  // 3 panneaux par page
  const PANELS_PER_PAGE = 3;
  const panelAreaH = (PH - 2*M - 14) / PANELS_PER_PAGE; // hauteur dispo par panneau
  const SVG_W_mm = 80;  // largeur du visuel en mm
  const SVG_H_mm = Math.round(SVG_W_mm * panelH / panelW);
  const CUTS_W   = CW - SVG_W_mm - 5; // largeur colonne coupes

  for (let pi = 0; pi < panels.length; pi++) {
    if (pi % PANELS_PER_PAGE === 0) {
      doc.addPage();

      // En-tête page
      doc.setFillColor(...ACCENT);
      doc.rect(M, M, CW, 0.8, 'F');
      doc.setTextColor(...ACCENT);
      doc.setFontSize(11);
      doc.setFont('helvetica','bold');
      doc.text('✂ PanelCut Pro', M, M+7);
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      doc.text(`${projectName}${client ? ' — ' + client : ''}`, M+35, M+7);
      doc.text(`${devisNum ? devisNum + ' · ' : ''}${date}`, PW-M, M+7, {align:'right'});
    }

    const panel = panels[pi];
    const wasteRect = getLargestWasteRect(panel, panelW * 10, panelH * 10);
    const rowIdx = pi % PANELS_PER_PAGE;
    const baseY = M + 14 + rowIdx * panelAreaH;

    // Fond de carte
    doc.setFillColor(248,248,248);
    doc.roundedRect(M, baseY, CW, panelAreaH-3, 2, 2, 'F');
    doc.setDrawColor(220,220,220);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, baseY, CW, panelAreaH-3, 2, 2, 'S');

    // Titre panneau
    doc.setFillColor(...DARK);
    doc.roundedRect(M, baseY, CW, 7, 2, 2, 'F');
    doc.setFillColor(...DARK);
    doc.rect(M, baseY+3, CW, 4, 'F'); // carré pour aplatir le bas
    doc.setTextColor(255,255,255);
    doc.setFontSize(9);
    doc.setFont('helvetica','bold');
    doc.text(`Panneau ${panel.panelId} / ${panels.length}`, M+4, baseY+5);
    const utilColor = panel.utilizationPct >= 80 ? [16,185,129] : panel.utilizationPct >= 60 ? [...ACCENT] : [...RED];
    doc.setTextColor(...utilColor);
    doc.text(`${panel.utilizationPct}% utilisé · chute ${panel.wastePct}%`, PW-M-4, baseY+5, {align:'right'});

    const contentY = baseY + 10;
    const contentH = panelAreaH - 13;

    // ── VISUEL SVG (droite) ──
    const svgX = M + CUTS_W + 5;
    const svgY = contentY + 2;
    const scaleX = SVG_W_mm / (panelW * 10);
    const scaleY = SVG_H_mm / (panelH * 10);

    // Fond blanc SVG
    doc.setFillColor(255,255,255);
    doc.setDrawColor(180,180,180);
    doc.setLineWidth(0.4);
    doc.roundedRect(svgX, svgY, SVG_W_mm, SVG_H_mm, 1, 1, 'FD');

    // Pièces
    panel.placed.forEach(p => {
      const hex = colorMap[p.name] || '#94a3b8';
      const [r,g,b] = hexToRgb(hex);
      const px = svgX + (p.x||0)*scaleX;
      const py = svgY + (p.bandY||0)*scaleY;
      const pw2 = Math.max(p.l*scaleX - 0.3, 0.5);
      const ph2 = Math.max(p.h*scaleY - 0.3, 0.5);
      doc.setFillColor(r,g,b,0.35);
      doc.setFillColor(Math.min(255,r+80), Math.min(255,g+80), Math.min(255,b+80));
      doc.setDrawColor(r,g,b);
      doc.setLineWidth(0.3);
      doc.rect(px, py, pw2, ph2, 'FD');
      // Label si assez grand
      if (pw2 > 8 && ph2 > 4) {
        doc.setTextColor(0,0,0);
        doc.setFontSize(5.5);
        doc.setFont('helvetica','bold');
        const lbl = `${(p.l/10).toFixed(1)}×${(p.h/10).toFixed(1)}`;
        doc.text(lbl, px+pw2/2, py+ph2/2+1, {align:'center'});
      }
    });

    // Lignes de coupe
    panel.cuts.filter(c=>c.type==='bande').forEach(c => {
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1,1], 0);
      doc.setTextColor(...RED);
      doc.setFontSize(5);
      doc.setFont('helvetica','bold');

      if (c.orientation === 'vertical') {
        const cx = svgX + c.pos*scaleX;
        if (cx > svgX && cx < svgX+SVG_W_mm) {
          doc.line(cx, svgY, cx, svgY+SVG_H_mm);
          doc.text(`${c.posCm}`, cx+0.5, svgY+2.5);
        }
      } else {
        const cy = svgY + c.pos*scaleY;
        if (cy > svgY && cy < svgY+SVG_H_mm) {
          doc.line(svgX, cy, svgX+SVG_W_mm, cy);
          doc.text(`${c.posCm}`, svgX+SVG_W_mm-0.5, cy-0.5, {align:'right'});
        }
      }

      doc.setLineDashPattern([], 0);
    });

    // Dimension bas SVG
    doc.setTextColor(160,160,160);
    doc.setFontSize(5);
    doc.setFont('helvetica','normal');
    doc.text(`← ${panelW}cm →`, svgX+SVG_W_mm/2, svgY+SVG_H_mm-0.5, {align:'center'});

    // ── COUPES (gauche) ──
    let cy2 = contentY + 3;
    doc.setTextColor(160,160,160);
    doc.setFontSize(7);
    doc.setFont('helvetica','bold');
    doc.text('ORDRE DES COUPES', M+3, cy2);
    cy2 += 4;

    if (wasteRect) {
      doc.setTextColor(...GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica','normal');
      doc.text(`Plus grande chute : ${(wasteRect.w/10).toFixed(1)}×${(wasteRect.h/10).toFixed(1)} cm`, M+3, cy2);
      cy2 += 4;
    }

    const bandCuts = panel.cuts.filter(c=>c.type==='bande');
    for (const band of bandCuts) {
      if (cy2 > contentY + contentH - 2) break;
      const bandLabel = band.orientation === 'vertical'
        ? `✂ Bande verticale à ${band.posCm} cm`
        : `✂ Coupe à ${band.posCm} cm`;
      doc.setTextColor(...RED);
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.text(bandLabel, M+3, cy2);
      cy2 += 4.5;

      const piecesInBand = panel.cuts.filter(c =>
        c.type==='piece' && c.bandKey===band.bandKey && c.depth===band.depth
      );
      for (const pc of piecesInBand) {
        if (cy2 > contentY + contentH - 1) break;
        // Tag meuble
        if (pc.furnitureName) {
          doc.setFillColor(...ACCENT);
          const tw = doc.getTextWidth(pc.furnitureName) + 3;
          doc.roundedRect(M+5, cy2-2.8, tw, 3.5, 0.5, 0.5, 'F');
          doc.setTextColor(10,15,26);
          doc.setFontSize(7);
          doc.setFont('helvetica','bold');
          doc.text(pc.furnitureName, M+5+tw/2, cy2, {align:'center'});
          doc.setTextColor(...DARK);
          doc.setFontSize(9);
          doc.setFont('helvetica','normal');
          doc.text(`→ ${pc.name}`, M+6+tw, cy2);
        } else {
          doc.setTextColor(...DARK);
          doc.setFontSize(9);
          doc.setFont('helvetica','normal');
          doc.text(`→ ${pc.name}`, M+5, cy2);
        }
        // Dimensions
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica','normal');
        doc.text(`${pc.lCm}×${pc.hCm} cm`, M+CUTS_W-2, cy2, {align:'right'});
        // Redélignage
        if (pc.redeligne) {
          cy2 += 3.5;
          doc.setTextColor(245,158,11);
          doc.setFontSize(7.5);
          doc.text(`  ⟹ Redéligner à ${pc.redeligne.toCm}cm`, M+5, cy2);
        }
        cy2 += 4.5;
      }
      cy2 += 1;
    }
  }

  const addVisualPage = (title, imageData) => {
    if (!imageData) return;
    doc.addPage();
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PW, 24, 'F');
    doc.setTextColor(...ACCENT);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, M, 14);
    const maxW = PW - 2 * M;
    const maxH = PH - 42;
    doc.addImage(imageData, 'PNG', M, 28, maxW, maxH, undefined, 'FAST');
  };

  addVisualPage('Façade / Plan façade', extras.facadeImage);
  addVisualPage('Vue 3D client', extras.view3dImage);

  // Pied de page dernière page
  const lastPageY = PH - 8;
  doc.setDrawColor(220,220,220);
  doc.setLineWidth(0.3);
  doc.line(M, lastPageY, PW-M, lastPageY);
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica','normal');
  doc.text(`✂ PanelCut Pro — ${company}`, M, lastPageY+4);
  doc.text(`${devisNum ? devisNum + ' · ' : ''}${date}`, PW-M, lastPageY+4, {align:'right'});

  // Télécharge le PDF
  const filename = `${projectName.replace(/\s+/g,'-')}${devisNum ? '-'+devisNum : ''}.pdf`;
  doc.save(filename);
}
