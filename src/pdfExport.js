import { jsPDF } from 'jspdf';
import { isRodPiece } from './utils/isRodPiece';

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

  // Pièces tringles — exclues de l'optimisation panneau bois
  const rodPieces = extras.rodPieces || (project.pieces || []).filter(isRodPiece);
  const hasTringlesPage = rodPieces.length > 0;

  // Cabinet data for 3D page
  const rawCab = project.cabinet || null;
  const cab = rawCab ? {
    width:   Number(rawCab.width)   || 0,
    height:  Number(rawCab.height)  || 0,
    depth:   Number(rawCab.depth)   || 60,
    modules: Array.isArray(rawCab.modules) ? rawCab.modules : [],
  } : null;
  const has3DPage = !!(cab && cab.width > 0 && cab.height > 0);

  // ── PAGE DE GARDE ──────────────────────────────────────────────────────

  // Pré-calcul du nombre total de pages (1 panneau par page de découpe)
  const cutPages   = panels.length;
  const extraPages = [extras.facadeImage].filter(Boolean).length + (has3DPage ? 1 : 0);
  const totalPages = 1 + cutPages + extraPages + (hasTringlesPage ? 1 : 0);

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

  // ── PAGE VUE 3D CLIENT ────────────────────────────────────────────────
  // Insérée après la page de garde, avant les pages de découpe.

  const SVG_W_mm   = 120;                           // largeur du visuel (mm)
  const FOOTER_Y   = 278;                           // y de la ligne de pied de page
  const CUTS_GAP   = 6;                             // espace inter-colonnes (mm)
  const CUTS_COL_X = M + SVG_W_mm + CUTS_GAP;      // x colonne des coupes
  const CUTS_COL_W = CW - SVG_W_mm - CUTS_GAP;     // largeur colonne coupes (~60 mm)

  /** Pied de page identique à la page de garde */
  const drawCutPageFooter = (pageNum) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(M, FOOTER_Y, PW - M, FOOTER_Y);
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Document g\u00e9n\u00e9r\u00e9 par PanelCut Pro \u00b7 panelcut.app', M, FOOTER_Y + 5);
    doc.text(`Page ${pageNum}/${totalPages}`, PW - M, FOOTER_Y + 5, { align: 'right' });
    doc.text(generatedAt, PW / 2, FOOTER_Y + 5, { align: 'center' });
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.text('Ce devis est valable 30 jours.', PW / 2, FOOTER_Y + 10, { align: 'center' });
  };

  if (has3DPage) {
    doc.addPage();

    const panelLabel = project.panel?.label || project.selectedPanel?.name || material;
    const cabW = cab.width;
    const cabH = cab.height;
    const cabD = cab.depth;
    const moduleCount = cab.modules.length;

    // ── En-tête ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rendu 3D \u2014 ${projectName}`, PW / 2, 22, { align: 'center' });

    doc.setTextColor(...GRAY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Vue perspective \u2014 dimensions r\u00e9elles', PW / 2, 30, { align: 'center' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(M, 35, PW - M, 35);

    // ── Zone image + bloc info ──
    const imgZoneX = M;
    const imgZoneW = 118;   // mm — laisse ~62mm pour le bloc info
    const imgZoneH = 120;   // mm
    const imgZoneY = 40;
    const infoX    = M + imgZoneW + 6;
    const infoW    = CW - imgZoneW - 6;

    if (extras.view3dImage) {
      const props = doc.getImageProperties(extras.view3dImage);
      const imgW  = props?.width  || imgZoneW;
      const imgH  = props?.height || imgZoneH;
      const scale = Math.min(imgZoneW / imgW, imgZoneH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = imgZoneX + (imgZoneW - drawW) / 2;
      const drawY = imgZoneY + (imgZoneH - drawH) / 2;

      doc.addImage(extras.view3dImage, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.roundedRect(drawX, drawY, drawW, drawH, 1, 1, 'S');
    } else {
      // Placeholder
      doc.setFillColor(235, 235, 235);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(imgZoneX, imgZoneY, imgZoneW, imgZoneH, 2, 2, 'FD');
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const phLines = doc.splitTextToSize(
        'Vue 3D non disponible \u2014 ouvrir l\u2019onglet Vue 3D avant l\u2019export',
        imgZoneW - 10
      );
      doc.text(phLines, imgZoneX + imgZoneW / 2, imgZoneY + imgZoneH / 2 - (phLines.length - 1) * 2.5, { align: 'center' });
    }

    // ── Bloc info (colonne droite) ──
    let infoY = imgZoneY;
    const infoRow = (label, value, bold = false) => {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), infoX, infoY);
      infoY += 4.5;
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(9);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(String(value), infoX, infoY);
      infoY += 7;
    };

    // Dimensions : 3 colonnes L / H / P
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DIMENSIONS', infoX, infoY);
    infoY += 4.5;

    const dimColW  = infoW / 3;
    const dimLabels = ['L', 'H', 'P'];
    const dimValues = [cabW, cabH, cabD];
    dimLabels.forEach((lbl, i) => {
      const dx = infoX + i * dimColW;
      doc.setFillColor(248, 248, 248);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.25);
      doc.roundedRect(dx, infoY - 3, dimColW - 1, 11, 1, 1, 'FD');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(lbl, dx + dimColW / 2, infoY + 0.5, { align: 'center' });
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${dimValues[i]} cm`, dx + dimColW / 2, infoY + 5.5, { align: 'center' });
    });
    infoY += 13;

    infoRow('Mat\u00e9riau', panelLabel);
    infoRow('Modules', moduleCount);
    infoRow('Prix mati\u00e8re estim\u00e9', `${totalCost} \u20ac`, true);

    // ── Note bas de page ──
    const noteY = imgZoneY + imgZoneH + 10;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(M, noteY, PW - M, noteY);

    doc.setTextColor(160, 160, 160);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Rendu indicatif \u2014 les finitions peuvent varier',
      PW / 2, noteY + 7, { align: 'center' }
    );

    // Footer
    drawCutPageFooter(2);
  }

  // ── PAGES DE DÉCOUPE ───────────────────────────────────────────────────
  // 1 panneau par page — visuel gauche 60 % / liste des coupes droite 40 %

  for (let pi = 0; pi < panels.length; pi++) {
    doc.addPage();
    const panel    = panels[pi];
    const pageNum  = 2 + (has3DPage ? 1 : 0) + pi;
    const panelWmm = panelW * 10;   // cm → mm
    const panelHmm = panelH * 10;
    const wasteRect = getLargestWasteRect(panel, panelWmm, panelHmm);
    const utilPct  = panel.utilizationPct;
    const utilColor = utilPct >= HIGH_UTIL_THRESHOLD ? GREEN
                    : utilPct >= MEDIUM_UTIL_THRESHOLD ? [...ACCENT] : [...RED];

    // ── 3. EN-TÊTE DE PAGE ──────────────────────────────────────────────
    const HEADER_H = 3;   // hauteur bande grise (mm)
    const BAR_H    = 2;   // hauteur barre de progression (mm)
    const hdrY     = M;

    // Bande gris très clair
    doc.setFillColor(242, 242, 242);
    doc.rect(M, hdrY, CW, HEADER_H, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Panneau ${pi + 1}/${panels.length} \u2014 ${panelW}\u00d7${panelH}\u00a0cm`,
      M + 2, hdrY + 2.2
    );
    doc.text(
      `Utilisation\u00a0: ${utilPct}%  \u00b7  Chute\u00a0: ${panel.wastePct}%`,
      M + CW - 2, hdrY + 2.2, { align: 'right' }
    );

    // Barre de progression colorée (même logique couleur)
    const barY = hdrY + HEADER_H + 0.5;
    doc.setFillColor(220, 220, 220);
    doc.rect(M, barY, CW, BAR_H, 'F');
    doc.setFillColor(...utilColor);
    doc.rect(M, barY, CW * Math.min(utilPct / 100, 1), BAR_H, 'F');

    const contentY = barY + BAR_H + 3;   // ~21 mm depuis le haut de la page

    // ── 1. VISUEL PANNEAU (colonne gauche) ──────────────────────────────
    const SVG_H_mm = Math.max(70, Math.round(SVG_W_mm * panelHmm / panelWmm));
    const scaleX   = SVG_W_mm / panelWmm;
    const scaleY   = SVG_H_mm / panelHmm;
    const svgX     = M;
    const svgY     = contentY;

    // Fond blanc pur
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.roundedRect(svgX, svgY, SVG_W_mm, SVG_H_mm, 1, 1, 'FD');

    // Hachuré rouge clair (zones de chute) — les pièces effaceront le hachuré
    doc.setDrawColor(255, 195, 195);
    doc.setLineWidth(0.15);
    const hatchStep = 4;
    for (let d = -SVG_H_mm; d <= SVG_W_mm; d += hatchStep) {
      const pts = [];
      // Ligne de pente +1 : y = x − d, clippée au rectangle SVG
      if (d >= 0 && d <= SVG_W_mm)                        pts.push([d, 0]);
      if (d + SVG_H_mm >= 0 && d + SVG_H_mm <= SVG_W_mm) pts.push([d + SVG_H_mm, SVG_H_mm]);
      if (-d >= 0 && -d <= SVG_H_mm)                      pts.push([0, -d]);
      const ry = SVG_W_mm - d;
      if (ry >= 0 && ry <= SVG_H_mm)                      pts.push([SVG_W_mm, ry]);
      if (pts.length >= 2) {
        doc.line(svgX + pts[0][0], svgY + pts[0][1],
                 svgX + pts[1][0], svgY + pts[1][1]);
      }
    }

    // Pièces (effacent le hachuré, couleur pastel)
    panel.placed.forEach(p => {
      const hex     = colorMap[p.name] || '#94a3b8';
      const [r,g,b] = hexToRgb(hex);
      // Pastel : mélange 55 % blanc
      const pr = Math.round(r + (255 - r) * 0.55);
      const pg = Math.round(g + (255 - g) * 0.55);
      const pb = Math.round(b + (255 - b) * 0.55);

      const px  = svgX + (p.x    || 0) * scaleX;
      const py  = svgY + (p.bandY|| 0) * scaleY;
      const pw2 = Math.max(p.l * scaleX - 0.3, 0.5);
      const ph2 = Math.max(p.h * scaleY - 0.3, 0.5);

      doc.setFillColor(pr, pg, pb);
      doc.setDrawColor(Math.max(r - 20, 0), Math.max(g - 20, 0), Math.max(b - 20, 0));
      doc.setLineWidth(0.3);
      doc.rect(px, py, pw2, ph2, 'FD');

      // Nom (max 8 car.) + dimensions en 8pt monospace — toujours visible
      if (pw2 > 3 && ph2 > 3) {
        const nameStr = (p.name || '').length > 8
          ? (p.name || '').substring(0, 8) : (p.name || '');
        const dimStr  = `${(p.l / 10).toFixed(1)}\u00d7${(p.h / 10).toFixed(1)}`;
        const midY    = py + ph2 / 2;
        doc.setTextColor(30, 30, 30);
        doc.setFont('courier', 'normal');
        if (pw2 > 8 && ph2 > 7) {
          doc.setFontSize(8);
          doc.text(nameStr, px + pw2 / 2, midY - 1,   { align: 'center' });
          doc.setFontSize(6.5);
          doc.text(dimStr,  px + pw2 / 2, midY + 2.5, { align: 'center' });
        } else {
          doc.setFontSize(6);
          doc.text(dimStr, px + pw2 / 2, midY + 1, { align: 'center' });
        }
      }
    });

    // Numérotation des coupes : cercle orange Ø5 mm + lignes en tirets
    const bandCuts = panel.cuts.filter(c => c.type === 'bande');
    bandCuts.forEach((c, idx) => {
      const cutNum = c.cutNum ?? (idx + 1);
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([1.5, 1], 0);

      let circleX, circleY;
      if (c.orientation === 'vertical') {
        const cx = svgX + c.pos * scaleX;
        if (cx > svgX && cx < svgX + SVG_W_mm) {
          doc.line(cx, svgY, cx, svgY + SVG_H_mm);
          circleX = cx;
          circleY = svgY + 2.5;
        }
      } else {
        const lineY = svgY + c.pos * scaleY;
        if (lineY > svgY && lineY < svgY + SVG_H_mm) {
          doc.line(svgX, lineY, svgX + SVG_W_mm, lineY);
          circleX = svgX + 2.5;
          circleY = lineY;
        }
      }
      doc.setLineDashPattern([], 0);

      // Cercle orange rempli (r = 2.5 mm) avec numéro blanc
      if (circleX !== undefined) {
        doc.setFillColor(...ACCENT);
        doc.circle(circleX, circleY, 2.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(String(cutNum), circleX, circleY + 1.2, { align: 'center' });
      }
    });

    // Légendes dimensions panneau
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `\u2190 ${panelW} cm \u2192`,
      svgX + SVG_W_mm / 2, svgY + SVG_H_mm + 3.5, { align: 'center' }
    );

    // Dimensions de la zone de chute principale (7pt rouge)
    if (wasteRect) {
      const wxX = svgX + wasteRect.x * scaleX;
      const wxY = svgY + wasteRect.y * scaleY;
      const wxW = wasteRect.w * scaleX;
      const wxH = wasteRect.h * scaleY;
      if (wxW > 6 && wxH > 4) {
        doc.setTextColor(200, 60, 60);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${(wasteRect.w / 10).toFixed(1)}\u00d7${(wasteRect.h / 10).toFixed(1)}`,
          wxX + wxW / 2, wxY + wxH / 2 + 1, { align: 'center' }
        );
      }
    }

    // ── 4. CHUTE RÉCUPÉRABLE (> 30×10 cm) ──────────────────────────────
    if (wasteRect && wasteRect.w >= 300 && wasteRect.h >= 100) {
      const wxX = svgX + wasteRect.x * scaleX;
      const wxY = svgY + wasteRect.y * scaleY;
      const wxW = Math.max(wasteRect.w * scaleX, 4);
      const wxH = Math.max(wasteRect.h * scaleY, 4);
      doc.setFillColor(232, 255, 246);   // vert très clair
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.8);
      doc.rect(wxX, wxY, wxW, wxH, 'FD');
      if (wxW > 16 && wxH > 5) {
        const recLabel = `CHUTE R\u00c9CUP\u00c9RABLE : ${(wasteRect.w / 10).toFixed(1)}\u00d7${(wasteRect.h / 10).toFixed(1)} cm`;
        doc.setTextColor(...GREEN);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        const recLines = doc.splitTextToSize(recLabel, wxW - 2);
        doc.text(recLines, wxX + wxW / 2, wxY + wxH / 2, { align: 'center' });
      }
    }

    // ── 2. LISTE DES COUPES (colonne droite) ────────────────────────────
    let cy2 = contentY;
    const maxCutsY = FOOTER_Y - 5;

    // Titre "ORDRE DES COUPES" en 8pt bold majuscules orange
    doc.setTextColor(...ACCENT);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDRE DES COUPES', CUTS_COL_X, cy2 + 3.5);
    cy2 += 5.5;

    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.line(CUTS_COL_X, cy2, CUTS_COL_X + CUTS_COL_W, cy2);
    cy2 += 3.5;

    for (const band of bandCuts) {
      if (cy2 > maxCutsY) break;
      const cutNum = band.cutNum ?? (bandCuts.indexOf(band) + 1);
      const isVert = band.orientation === 'vertical';
      const arrow  = isVert ? '\u2193 V' : '\u2192 H';
      // "→ H  à X cm" avec tiret long (em-space)
      const cutLine = `${arrow}\u2003\u00e0 ${band.posCm} cm`;

      // Cercle numéro Ø3 mm (r = 1.5)
      const circCx = CUTS_COL_X + 1.8;
      const circCy = cy2 - 0.8;
      doc.setFillColor(...ACCENT);
      doc.circle(circCx, circCy, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(String(cutNum), circCx, circCy + 0.9, { align: 'center' });

      // Libellé de coupe
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(cutLine, CUTS_COL_X + 4.5, cy2);
      cy2 += 4.5;

      // Pièces résultantes — indentées, nom + L×H monospace 8pt gris
      const piecesInBand = panel.cuts.filter(c =>
        c.type === 'piece' && c.bandKey === band.bandKey
      );
      for (const pc of piecesInBand) {
        if (cy2 > maxCutsY) break;
        const pName = (pc.name || '').substring(0, 12);
        const pDims = `${pc.lCm}\u00d7${pc.hCm}`;

        doc.setTextColor(110, 110, 110);
        doc.setFontSize(7.5);
        doc.setFont('courier', 'normal');
        doc.text(pName, CUTS_COL_X + 5, cy2);
        doc.text(pDims, CUTS_COL_X + CUTS_COL_W, cy2, { align: 'right' });
        cy2 += 4;

        // Badge redélignage : fond orange pâle
        if (pc.redeligne) {
          if (cy2 > maxCutsY) break;
          const badgeText = `RED\u00c9L. \u2192 ${pc.redeligne.toCm}\u00a0cm`;
          const bw = doc.getTextWidth(badgeText) + 4;
          doc.setFillColor(255, 235, 200);
          doc.roundedRect(CUTS_COL_X + 5, cy2 - 3, bw, 4, 0.5, 0.5, 'F');
          doc.setTextColor(160, 70, 0);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(badgeText, CUTS_COL_X + 7, cy2);
          cy2 += 4.5;
        }
      }
      cy2 += 1.5;
    }

    // ── 5. PIED DE PAGE ─────────────────────────────────────────────────
    drawCutPageFooter(pageNum);
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
    const imgW  = props?.width  || maxW;
    const imgH  = props?.height || maxH;
    const scale = Math.min(maxW / imgW, maxH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = M + (maxW - drawW) / 2;
    const drawY = 28 + (maxH - drawH) / 2;
    doc.addImage(imageData, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');
  };

  addVisualPage('Fa\u00e7ade / Plan fa\u00e7ade', extras.facadeImage);

  // ── PAGE TRINGLES ────────────────────────────────────────────────────
  if (hasTringlesPage) {
    doc.addPage();

    // En-tête
    doc.setFillColor(...DARK);
    doc.rect(M, M, CW, 8, 'F');
    doc.setFillColor(...DARK);
    doc.rect(M, M + 5, CW, 3, 'F');   // aplat pour coins bas
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TRINGLES \u2014 hors optimisation bois', M + 4, M + 5.5);

    // Tableau nom / longueur / quantité
    const tblY0  = M + 16;
    const COL_W  = [CW - 80, 50, 30];   // Nom | Longueur | Qté
    const ROW_H  = 7;
    const headers = ['Nom', 'Longueur', 'Qt\u00e9'];

    // En-tête tableau
    doc.setFillColor(240, 240, 240);
    doc.rect(M, tblY0, CW, ROW_H, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      const cx = M + COL_W.slice(0, i).reduce((s, v) => s + v, 0);
      doc.text(h, cx + 3, tblY0 + 4.8);
    });

    // Regrouper par nom + longueur ; p.qty peut être > 1 si la pièce a déjà
    // une quantité dans le projet, sinon on compte chaque occurrence comme 1.
    const rodMap = {};
    rodPieces.forEach(p => {
      const len = p.length || p.l || 0;
      const key = `${p.name}|${len}`;
      if (!rodMap[key]) rodMap[key] = { name: p.name, length: len, qty: 0 };
      rodMap[key].qty += (p.qty || 1);
    });
    const rodRows = Object.values(rodMap);

    rodRows.forEach((row, ri) => {
      const ry = tblY0 + ROW_H + ri * ROW_H;
      if (ri % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(M, ry, CW, ROW_H, 'F');
      }
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(M, ry + ROW_H, M + CW, ry + ROW_H);

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      const vals = [
        row.name,
        `${row.length} cm`,
        String(row.qty),
      ];
      vals.forEach((v, i) => {
        const cx = M + COL_W.slice(0, i).reduce((s, w2) => s + w2, 0);
        doc.text(v, cx + 3, ry + 4.8);
      });
    });

    drawCutPageFooter(totalPages);
  }

  // Télécharge le PDF
  const filename = `${projectName.replace(/\s+/g,'-')}${devisNum ? '-'+devisNum : ''}.pdf`;
  doc.save(filename);
}
