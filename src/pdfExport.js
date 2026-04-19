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
  const GREEN  = [16, 185, 129];
  const RED    = [231, 76, 60];

  const HIGH_UTIL_THRESHOLD   = 80;
  const MEDIUM_UTIL_THRESHOLD = 60;

  // 3 panneaux par page (utilisé aussi pour le total pages)
  const PANELS_PER_PAGE = 3;

  // ── PAGE DE GARDE ──────────────────────────────────────────────────────

  // Pré-calcul du nombre total de pages
  const cutPages = Math.ceil(panels.length / PANELS_PER_PAGE);
  const extraPages = [extras.facadeImage, extras.view3dImage].filter(Boolean).length;
  const totalPages = 1 + cutPages + extraPages;

  const generatedAt = new Date().toLocaleString('fr-BE');

  // Coordonnées entreprise (champs optionnels sur le projet)
  const companyAddress = project.companyAddress || '';
  const companyPhone   = project.companyPhone   || '';
  const companyEmail   = project.companyEmail   || '';
  const companyWebsite = project.companyWebsite || '';

  // 1. HEADER ENTREPRISE (0 à 45mm) ─────────────────────────────────────
  // Fond blanc (par défaut A4)

  // Colonne gauche : nom entreprise
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(company, M, 14);

  doc.setTextColor(136, 136, 136);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Menuiserie sur mesure', M, 21);

  // Coordonnées entreprise
  doc.setTextColor(170, 170, 170);
  doc.setFontSize(9);
  let yHeader = 27;
  if (companyAddress) { doc.text(companyAddress, M, yHeader); yHeader += 4; }
  if (companyPhone)   { doc.text(companyPhone,   M, yHeader); yHeader += 4; }
  if (companyEmail)   { doc.text(companyEmail,   M, yHeader); yHeader += 4; }
  if (companyWebsite) { doc.text(companyWebsite, M, yHeader); yHeader += 4; }

  // Colonne droite : numéro de devis encadré
  const rightX = PW - M;
  if (devisNum) {
    const devisBoxW = 52;
    const devisBoxH = 9;
    const devisBoxX = rightX - devisBoxW;
    const devisBoxY = 7;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(devisBoxX, devisBoxY, devisBoxW, devisBoxH, 1, 1, 'S');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`N\u00b0 ${devisNum}`, rightX - 3, devisBoxY + 5.8, { align: 'right' });
  }

  // Date
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(date, rightX, 22, { align: 'right' });

  // Statut DEVIS avec lettres espacées
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const devisLabel = 'D E V I S';
  doc.text(devisLabel, rightX, 31, { align: 'right' });

  // Ligne orange sous DEVIS
  const devisLabelW = doc.getTextWidth(devisLabel);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(rightX - devisLabelW, 32.8, rightX, 32.8);

  // Séparateur horizontal à y=45
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(M, 45, PW - M, 45);

  // 2. BLOC CLIENT (50mm à 75mm) ─────────────────────────────────────────
  if (client) {
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATAIRE', M, 56);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(client, M, 67);
  }

  // 3. VISUEL FAÇADE (80mm à 170mm) ──────────────────────────────────────
  const facadeY    = 80;
  const maxImgW    = 160;
  const maxImgH    = 80;
  const facadeImgX = M + (CW - maxImgW) / 2;

  if (extras.facadeImage) {
    const props  = doc.getImageProperties(extras.facadeImage);
    const imgW   = props?.width  || maxImgW;
    const imgH   = props?.height || maxImgH;
    const scale  = Math.min(maxImgW / imgW, maxImgH / imgH);
    const drawW  = imgW * scale;
    const drawH  = imgH * scale;
    const drawX  = M + (CW - drawW) / 2;
    const drawY  = facadeY + (maxImgH - drawH) / 2;

    doc.addImage(extras.facadeImage, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');

    // Bordure fine grise avec coins arrondis
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.roundedRect(drawX, drawY, drawW, drawH, 2, 2, 'S');

    // Légende sous l'image
    doc.setTextColor(136, 136, 136);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vue de fa\u00e7ade \u2014 ${projectName}`, PW / 2, facadeY + maxImgH + 8, { align: 'center' });
  } else {
    // Placeholder
    doc.setFillColor(240, 240, 240);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(facadeImgX, facadeY, maxImgW, maxImgH, 2, 2, 'FD');
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Fa\u00e7ade non disponible', PW / 2, facadeY + maxImgH / 2, { align: 'center' });
  }

  // 4. GRILLE DE RÉSUMÉ (180mm à 210mm) ──────────────────────────────────
  const gridY   = 180;
  const gridH   = 28;
  const boxW    = (CW - 9) / 4;
  const utilizationPct = summary.utilizationPct;
  const utilBarColor   = utilizationPct >= HIGH_UTIL_THRESHOLD ? GREEN : utilizationPct >= MEDIUM_UTIL_THRESHOLD ? [...ACCENT] : [...RED];

  const summaryBoxes = [
    { val: String(summary.totalPanels), lbl: 'Panneaux',        color: ACCENT,       isUtil: false },
    { val: String(summary.totalPieces), lbl: 'Pi\u00e8ces',     color: DARK,         isUtil: false },
    { val: utilizationPct + '%',        lbl: 'Utilisation',     color: utilBarColor, isUtil: true  },
    { val: totalCost + '\u20ac',        lbl: 'Mati\u00e8re estim\u00e9e', color: DARK, isUtil: false },
  ];

  summaryBoxes.forEach(({ val, lbl, color, isUtil }, i) => {
    const bx = M + i * (boxW + 3);

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, gridY, boxW, gridH, 2, 2, 'FD');

    // Valeur principale
    doc.setTextColor(...color);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(val, bx + boxW / 2, gridY + (isUtil ? 11 : 13), { align: 'center' });

    if (isUtil) {
      // Barre de progression (3mm de haut)
      const barX = bx + 4;
      const barY = gridY + 14;
      const barW = boxW - 8;
      const barH = 3;
      doc.setFillColor(220, 220, 220);
      doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
      doc.setFillColor(...utilBarColor);
      doc.roundedRect(barX, barY, barW * Math.min(utilizationPct / 100, 1), barH, 1, 1, 'F');
    }

    // Label
    doc.setTextColor(136, 136, 136);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(lbl.toUpperCase(), bx + boxW / 2, gridY + gridH - 4, { align: 'center' });
  });

  // 5. PIED DE PAGE (y=285mm) ─────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(M, 285, PW - M, 285);

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Document g\u00e9n\u00e9r\u00e9 par PanelCut Pro \u00b7 panelcut.app', M, 290);
  doc.text(`Page 1/${totalPages}`, PW - M, 290, { align: 'right' });
  doc.text(generatedAt, PW / 2, 290, { align: 'center' });

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7);
  doc.text('Ce devis est valable 30 jours.', PW / 2, 295, { align: 'center' });

  // ── PAGES DE DÉCOUPE ───────────────────────────────────────────────────

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
    const utilColor = panel.utilizationPct >= HIGH_UTIL_THRESHOLD ? GREEN : panel.utilizationPct >= MEDIUM_UTIL_THRESHOLD ? [...ACCENT] : [...RED];
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
    const props = doc.getImageProperties(imageData);
    const imgW = props?.width || maxW;
    const imgH = props?.height || maxH;
    const scale = Math.min(maxW / imgW, maxH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = M + (maxW - drawW) / 2;
    const drawY = 28 + (maxH - drawH) / 2;
    doc.addImage(imageData, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');
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
