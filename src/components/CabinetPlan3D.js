/**
 * CabinetPlan3D.js — Moteur isométrique SVG multi-corps v2
 *
 * Architecture : on reconstruit le meuble depuis les pièces + cabinet.
 * Un "corps" = une colonne du meuble (côté gauche, intérieur, côté droit).
 * Chaque corps contient indépendamment : tablettes, tringle, tiroirs, dos.
 *
 * Rendu : SVG pur, projection isométrique JS, painter's algorithm.
 * Zéro WebGL, zéro canvas, zéro bug de zoom.
 */
import { useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const PAL = {
  panel:    { f: '#1a3352', t: '#2a4d78', s: '#3b82f6', sw: 0.6 },
  side:     { f: '#142840', t: '#1e3a5f', s: '#38bdf8', sw: 0.7 },
  shelf:    { f: '#0f2a42', t: '#38bdf8', s: '#38bdf8', sw: 0.5 },
  top:      { f: '#1a4060', t: '#7dd3fc', s: '#7dd3fc', sw: 0.6 },
  bottom:   { f: '#0d2035', t: '#2a4d78', s: '#38bdf8', sw: 0.5 },
  back:     { f: '#060d14', t: '#0d1f33', s: '#1e3a5f', sw: 0.4, a: 0.85 },
  door:     { f: '#f9731612', t: '#f9731640', s: '#f97316', sw: 0.9, a: 0.35 },
  drawer:   { f: '#a855f712', t: '#a855f740', s: '#a855f7', sw: 0.9, a: 0.38 },
  rod:      { f: '#94a3b8', t: '#cbd5e1', s: '#e2e8f0', sw: 0.5 },
  divider:  { f: '#1a3352', t: '#4a90c4', s: '#93c5fd', sw: 0.5 },
  handle:   { f: '#64748b', t: '#94a3b8', s: '#cbd5e1', sw: 0.4 },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION ISOMÉTRIQUE
// ─────────────────────────────────────────────────────────────────────────────
function iso(x, y, z, theta, phi, scale, ox, oy) {
  const rx = x * Math.cos(theta) + z * Math.sin(theta);
  const rz = -x * Math.sin(theta) + z * Math.cos(theta);
  const ry2 = y * Math.cos(phi) - rz * Math.sin(phi);
  const rz2 = y * Math.sin(phi) + rz * Math.cos(phi);
  return { sx: ox + rx * scale, sy: oy - ry2 * scale, depth: rz2 };
}

function svgPt(x, y, z, th, ph, sc, ox, oy) {
  const p = iso(x, y, z, th, ph, sc, ox, oy);
  return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
}
function depth(x, y, z, th, ph, sc, ox, oy) {
  return iso(x, y, z, th, ph, sc, ox, oy).depth;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACE HELPER : génère les 3 faces visibles d'une boîte 3D
// box = { x0,y0,z0, x1,y1,z1 }  pal = PAL.*
// ─────────────────────────────────────────────────────────────────────────────
function boxFaces(box, pal, th, ph, sc, ox, oy) {
  const { x0, y0, z0, x1, y1, z1 } = box;
  const P = (x, y, z) => svgPt(x, y, z, th, ph, sc, ox, oy);
  const D = (x, y, z) => depth(x, y, z, th, ph, sc, ox, oy);
  const d = D((x0+x1)/2, (y0+y1)/2, (z0+z1)/2);
  const a = pal.a ?? 1;
  return [
    // Avant
    { depth: d - 0.002, a,
      path: `M${P(x0,y0,z0)} L${P(x1,y0,z0)} L${P(x1,y1,z0)} L${P(x0,y1,z0)} Z`,
      fill: pal.f, stroke: pal.s, sw: pal.sw },
    // Dessus
    { depth: d + 0.002, a,
      path: `M${P(x0,y1,z0)} L${P(x1,y1,z0)} L${P(x1,y1,z1)} L${P(x0,y1,z1)} Z`,
      fill: pal.t, stroke: pal.s, sw: pal.sw },
    // Droite
    { depth: d, a,
      path: `M${P(x1,y0,z0)} L${P(x1,y0,z1)} L${P(x1,y1,z1)} L${P(x1,y1,z0)} Z`,
      fill: pal.f, stroke: pal.s, sw: pal.sw },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CYLINDRE ISO (tringle) — approximé par un prisme plat
// ─────────────────────────────────────────────────────────────────────────────
function rodFaces(x0, xW, y, z0, zD, r, th, ph, sc, ox, oy) {
  const pal = PAL.rod;
  const x1 = x0 + xW;
  const box = { x0, y0: y - r, z0: z0 + zD * 0.35,
                x1, y1: y + r, z1: z0 + zD * 0.65 };
  return boxFaces(box, pal, th, ph, sc, ox, oy);
}

// ─────────────────────────────────────────────────────────────────────────────
// RECONSTRUIT LE MEUBLE EN CORPS
// Cabinet = { width, height, depth, thickness, nb_shelves, nb_doors,
//             nb_drawers, nb_dividers, panels[] }
// Pieces  = [{ role, length, height, thickness, qty, name }]
//
// STRATÉGIE :
//   1. Compter les corps = nb_dividers + 1  (ou déduire depuis les pièces)
//   2. Chaque corps = 1 tranche x du meuble
//   3. Pour chaque corps, placer : côtés, tablettes, tringle, tiroirs, dos
// ─────────────────────────────────────────────────────────────────────────────
function buildScene(cabinet, pieces) {
  if (!cabinet?.width || !cabinet?.height) return [];

  const T   = (cabinet.thickness || 1.8) / 100;  // épaisseur en m
  const W   = cabinet.width  / 100;
  const H   = cabinet.height / 100;
  const DEP = (cabinet.depth || 60) / 100;

  // Compter les corps depuis les pièces ou cabinet
  const piecesFlat = [];
  for (const p of (pieces || [])) {
    for (let q = 0; q < (p.qty || 1); q++) piecesFlat.push(p);
  }

  // Nombre de corps depuis nb_dividers ou depuis les sides scannées
  const nbDividers = cabinet.nb_dividers ||
    piecesFlat.filter(p => p.role === 'divider').length ||
    0;
  const nbBodies = nbDividers + 1;

  // Dimensions d'un corps
  const innerW = W - 2 * T;            // largeur intérieure totale
  const bodyW  = innerW / nbBodies;    // largeur d'un corps

  // Nombre de tablettes par corps
  const totalShelves = cabinet.nb_shelves ||
    piecesFlat.filter(p => p.role === 'shelf').length ||
    0;
  const shelvesPerBody = Math.max(0, Math.round(totalShelves / nbBodies));

  // Nombre de tiroirs par corps (on cherche les corps qui ont des tiroirs)
  const totalDrawers = cabinet.nb_drawers ||
    piecesFlat.filter(p => ['drawer_front','drawer_box'].includes(p.role)).length ||
    0;
  const drawersPerBody = Math.max(0, Math.round(totalDrawers / nbBodies));

  // Y'a-t-il une tringle ? (detect via role=rod ou notes contenant "tringle")
  const hasRod = piecesFlat.some(p =>
    p.role === 'rod' ||
    (p.notes || '').toLowerCase().includes('tringle') ||
    (p.name  || '').toLowerCase().includes('tringle')
  ) || (cabinet.nb_rods > 0);

  // Détecter les corps avec tringles vs tiroirs
  // Si notes ou nom contient "tringle" → corps avec tringle
  // Sinon si tiroirs existent → alternance ou déduction
  // Simplification : on divise les corps en 2 types selon la position
  // Corps avec tiroirs = ceux qui ont drawer pieces assignés
  // Pour l'instant : tiroirs dans les corps des extrémités, tringles au centre

  // Collecter infos par corps (depuis panels serveur si dispos)
  const serverPanels = cabinet.panels || [];

  const allFaces = [];

  // ─ Centres de chaque corps en X ─
  for (let b = 0; b < nbBodies; b++) {
    const bx0 = T + b * (bodyW + T);     // X gauche de ce corps (intérieur)
    const bx1 = bx0 + bodyW;             // X droite

    // Déterminer le type de ce corps
    // Heuristique : si nb_drawers > 0 et c'est le 1er ou dernier corps → tiroirs
    const isEdgeBody = (b === 0 || b === nbBodies - 1);
    const hasDrawers = drawersPerBody > 0 && isEdgeBody;
    const hasShelvesHere = !hasDrawers && shelvesPerBody > 0;
    const hasRodHere = hasRod && !hasDrawers;

    // ── CÔTÉ GAUCHE (seulement pour b=0, sinon c'est le divider du corps précédent)
    if (b === 0) {
      allFaces.push(...boxFaces(
        { x0: 0, y0: 0, z0: 0, x1: T, y1: H, z1: DEP },
        PAL.side, ...args(allFaces)
      ));
    }

    // ── SÉPARATEUR / CÔTÉ DROIT de ce corps
    const isLast = b === nbBodies - 1;
    allFaces.push(...boxFaces(
      { x0: bx1, y0: 0, z0: 0, x1: bx1 + T, y1: H, z1: DEP },
      isLast ? PAL.side : PAL.divider, ...args(allFaces)
    ));

    // ── FOND BAS
    const floorH = T;   // épaisseur du fond bas
    allFaces.push(...boxFaces(
      { x0: bx0, y0: 0, z0: 0, x1: bx1, y1: floorH, z1: DEP },
      PAL.bottom, ...args(allFaces)
    ));

    // ── DESSUS
    allFaces.push(...boxFaces(
      { x0: bx0, y0: H - T, z0: 0, x1: bx1, y1: H, z1: DEP },
      PAL.top, ...args(allFaces)
    ));

    // ── DOS ARRIÈRE
    allFaces.push(...boxFaces(
      { x0: bx0, y0: T, z0: DEP - T, x1: bx1, y1: H - T, z1: DEP },
      PAL.back, ...args(allFaces)
    ));

    const innerH = H - 2 * T;

    if (hasDrawers) {
      // ── TIROIRS (empilés en bas, hauteur = 1/nb chacun)
      const dH = (innerH * 0.45) / drawersPerBody;  // tiroirs occupent 45% du bas
      for (let d = 0; d < drawersPerBody; d++) {
        const dy0 = T + d * dH;
        // Façade
        allFaces.push(...boxFaces(
          { x0: bx0 + 0.01, y0: dy0 + 0.005, z0: -T, x1: bx1 - 0.01, y1: dy0 + dH - 0.01, z1: 0 },
          PAL.drawer, ...args(allFaces)
        ));
        // Poignée tiroir
        const hcx = (bx0 + bx1) / 2;
        const hcy = dy0 + dH * 0.5;
        allFaces.push(...boxFaces(
          { x0: hcx - 0.04, y0: hcy - 0.008, z0: -T - 0.015,
            x1: hcx + 0.04, y1: hcy + 0.008, z1: -T },
          PAL.handle, ...args(allFaces)
        ));
      }
      // Tablette au-dessus des tiroirs
      const topDrawerY = T + (innerH * 0.45);
      allFaces.push(...boxFaces(
        { x0: bx0, y0: topDrawerY, z0: 0, x1: bx1, y1: topDrawerY + T, z1: DEP },
        PAL.shelf, ...args(allFaces)
      ));
      // Espace au-dessus de la tablette : tringle
      const rodY = topDrawerY + T + (H - topDrawerY - T) * 0.7;
      allFaces.push(...rodFaces(bx0 + 0.02, bodyW - 0.04, rodY, 0, DEP, T * 0.6,
        ...args(allFaces)));
    } else {
      // ── TABLETTES
      if (shelvesPerBody > 0) {
        const gap = innerH / (shelvesPerBody + 1);
        for (let s = 0; s < shelvesPerBody; s++) {
          const sy = T + gap * (s + 1);
          allFaces.push(...boxFaces(
            { x0: bx0, y0: sy, z0: 0, x1: bx1, y1: sy + T, z1: DEP },
            PAL.shelf, ...args(allFaces)
          ));
        }
      }

      // ── TRINGLE
      if (hasRodHere) {
        const rodY = T + innerH * 0.75;  // tringle à 75% de la hauteur
        allFaces.push(...rodFaces(
          bx0 + 0.02, bodyW - 0.04, rodY, 0, DEP, T * 0.6,
          ...args(allFaces)
        ));
        // Supports de tringle (2 petits cubes)
        for (const sx of [bx0 + 0.01, bx1 - 0.03]) {
          allFaces.push(...boxFaces(
            { x0: sx, y0: rodY - T * 0.5, z0: DEP * 0.35, x1: sx + 0.02, y1: rodY + T, z1: DEP * 0.65 },
            PAL.handle, ...args(allFaces)
          ));
        }
      }

      // ── PORTE (si nb_doors > 0)
      if (cabinet.nb_doors > 0) {
        const hasDoorsHere = Math.round(cabinet.nb_doors / nbBodies) > 0 ||
          (b < cabinet.nb_doors);
        if (hasDoorsHere) {
          allFaces.push(...boxFaces(
            { x0: bx0 + 0.005, y0: T + 0.005, z0: -T,
              x1: bx1 - 0.005, y1: H - T - 0.005, z1: 0 },
            PAL.door, ...args(allFaces)
          ));
          // Poignée porte
          const hx = bx1 - 0.05;
          const hcy = H / 2;
          allFaces.push(...boxFaces(
            { x0: hx, y0: hcy - 0.03, z0: -T - 0.015,
              x1: hx + 0.015, y1: hcy + 0.03, z1: -T },
            PAL.handle, ...args(allFaces)
          ));
        }
      }
    }
  }

  return allFaces;
}

// helper : capture les args constants (theta,phi,scale,ox,oy)
// NB : on passe les args au moment du build
function args() { return []; } // placeholder — remplacé par closure dans build

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE DE SOL
// ─────────────────────────────────────────────────────────────────────────────
function buildGrid(W, D, th, ph, sc, ox, oy) {
  const step = Math.max(0.1, W / 8);
  const lines = [];
  const P = (x, z) => svgPt(x - W/2, 0, z - D/2, th, ph, sc, ox, oy);
  for (let x = 0; x <= W; x += step) lines.push(`M${P(x,0)} L${P(x,D)}`);
  for (let z = 0; z <= D; z += step) lines.push(`M${P(0,z)} L${P(W,z)}`);
  return lines.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// COTES FRONTALES (annotations dimensions)
// ─────────────────────────────────────────────────────────────────────────────
function buildDimFace(W, H, th, ph, sc, ox, oy) {
  // Ligne largeur (bas)
  const yBase = -0.02;
  const p0w = iso(0,     yBase, 0, th, ph, sc, ox, oy);
  const p1w = iso(W,     yBase, 0, th, ph, sc, ox, oy);
  const midW = iso(W/2,  yBase - 0.04, 0, th, ph, sc, ox, oy);
  // Ligne hauteur (gauche)
  const xBase = -0.04;
  const p0h = iso(xBase, 0, 0, th, ph, sc, ox, oy);
  const p1h = iso(xBase, H, 0, th, ph, sc, ox, oy);
  const midH = iso(xBase - 0.04, H/2, 0, th, ph, sc, ox, oy);
  return { p0w, p1w, midW, p0h, p1h, midH };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────────────────────
export default function CabinetPlan3D({ cabinet, pieces = [], name = 'Meuble' }) {
  const SVG_W = 620, SVG_H = 460;
  const OX = SVG_W * 0.48, OY = SVG_H * 0.65;

  const [theta, setTheta] = useState(0.52);
  const [phi,   setPhi]   = useState(0.32);
  const [zoom,  setZoom]  = useState(1);
  const drag = useRef({ on: false, lx: 0, ly: 0, ld: null });

  if (!cabinet?.width || !cabinet?.height) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="text-5xl">📦</div>
        <p className="text-white font-bold text-lg">Vue 3D non disponible</p>
        <p className="text-sm text-slate-400 max-w-xs">
          Dimensions manquantes — relancez un scan IA ou entrez les dimensions manuellement.
        </p>
      </div>
    );
  }

  const W   = cabinet.width  / 100;
  const H   = cabinet.height / 100;
  const DEP = (cabinet.depth || 60) / 100;
  const maxDim = Math.max(W, H, DEP);
  const BASE_SC = 155 / maxDim;
  const sc = BASE_SC * zoom;

  // ── Centrage : décale toutes les coords de -W/2 en X et -D/2 en Z
  const th = theta, ph = phi;
  const P  = (x, y, z) => svgPt(x - W/2, y, z - DEP/2, th, ph, sc, OX, OY);
  const D  = (x, y, z) => depth(x - W/2, y, z - DEP/2, th, ph, sc, OX, OY);

  // ── Build scène
  // On reconstruit buildScene avec les bons args (closure)
  const T   = (cabinet.thickness || 1.8) / 100;
  const nbDividers = cabinet.nb_dividers ||
    (pieces || []).reduce((a, p) => a + (p.role === 'divider' ? (p.qty||1) : 0), 0) || 0;
  const nbBodies = nbDividers + 1;
  const innerW = W - 2 * T;
  const bodyW  = innerW / nbBodies;

  const totalShelves = cabinet.nb_shelves ||
    (pieces || []).reduce((a, p) => a + (['shelf'].includes(p.role) ? (p.qty||1) : 0), 0) || 0;
  const shelvesPerBody = Math.max(0, Math.round(totalShelves / nbBodies));

  const totalDrawers = cabinet.nb_drawers ||
    (pieces || []).reduce((a, p) => a + (['drawer_front','drawer_box'].includes(p.role) ? (p.qty||1) : 0), 0) || 0;
  const drawersPerBody = Math.max(0, Math.round(totalDrawers / nbBodies));

  const hasRod = (pieces || []).some(p =>
    p.role === 'rod' ||
    (p.notes||'').toLowerCase().includes('tringle') ||
    (p.name ||'').toLowerCase().includes('tringle')
  );

  let allFaces = [];

  // Helper boîte
  const BF = (box, pal) => {
    const { x0,y0,z0,x1,y1,z1 } = box;
    const Pf = (x,y,z) => svgPt(x - W/2, y, z - DEP/2, th, ph, sc, OX, OY);
    const Df = (x,y,z) => depth(x - W/2, y, z - DEP/2, th, ph, sc, OX, OY);
    const d = Df((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
    const a = pal.a ?? 1;
    return [
      { depth: d-0.002, a,
        path: `M${Pf(x0,y0,z0)} L${Pf(x1,y0,z0)} L${Pf(x1,y1,z0)} L${Pf(x0,y1,z0)} Z`,
        fill: pal.f, stroke: pal.s, sw: pal.sw },
      { depth: d+0.002, a,
        path: `M${Pf(x0,y1,z0)} L${Pf(x1,y1,z0)} L${Pf(x1,y1,z1)} L${Pf(x0,y1,z1)} Z`,
        fill: pal.t, stroke: pal.s, sw: pal.sw },
      { depth: d, a,
        path: `M${Pf(x1,y0,z0)} L${Pf(x1,y0,z1)} L${Pf(x1,y1,z1)} L${Pf(x1,y1,z0)} Z`,
        fill: pal.f, stroke: pal.s, sw: pal.sw },
    ];
  };

  // ── Côté gauche global
  allFaces.push(...BF({ x0:0, y0:0, z0:0, x1:T, y1:H, z1:DEP }, PAL.side));

  // ── Dessus global
  allFaces.push(...BF({ x0:0, y0:H-T, z0:0, x1:W, y1:H, z1:DEP }, PAL.top));

  // ── Chaque corps
  for (let b = 0; b < nbBodies; b++) {
    const bx0 = T + b * (bodyW + T);
    const bx1 = bx0 + bodyW;
    const isLast   = b === nbBodies - 1;
    const isEdge   = b === 0 || isLast;
    const hasDrawersHere = drawersPerBody > 0 && isEdge;
    const innerH = H - 2 * T;

    // Séparateur droit
    allFaces.push(...BF(
      { x0: bx1, y0: 0, z0: 0, x1: bx1+T, y1: H, z1: DEP },
      isLast ? PAL.side : PAL.divider
    ));

    // Fond bas
    allFaces.push(...BF({ x0:bx0, y0:0, z0:0, x1:bx1, y1:T, z1:DEP }, PAL.bottom));

    // Dos
    allFaces.push(...BF(
      { x0:bx0, y0:T, z0:DEP-T*0.5, x1:bx1, y1:H-T, z1:DEP },
      PAL.back
    ));

    if (hasDrawersHere) {
      // ── Mode TIROIRS (corps d'extrémité)
      const nD = Math.max(2, drawersPerBody);
      const dH = (innerH * 0.50) / nD;

      for (let d = 0; d < nD; d++) {
        const dy0 = T + d * dH;
        const dy1 = dy0 + dH;
        // Façade tiroir
        allFaces.push(...BF(
          { x0:bx0+0.012, y0:dy0+0.006, z0:-T*0.8,
            x1:bx1-0.012, y1:dy1-0.008, z1:0 },
          PAL.drawer
        ));
        // Poignée
        const hcx = (bx0+bx1)/2;
        allFaces.push(...BF(
          { x0:hcx-0.035, y0:(dy0+dy1)/2-0.007, z0:-T*0.8-0.018,
            x1:hcx+0.035, y1:(dy0+dy1)/2+0.007, z1:-T*0.8 },
          PAL.handle
        ));
      }

      // Tablette séparatrice au-dessus des tiroirs
      const sepY = T + innerH * 0.50;
      allFaces.push(...BF(
        { x0:bx0, y0:sepY, z0:0, x1:bx1, y1:sepY+T, z1:DEP },
        PAL.shelf
      ));

      // Tringle au-dessus
      const rodY = sepY + T + (H - T - sepY - T) * 0.65;
      // Tringle = boîte fine horizontale
      allFaces.push(...BF(
        { x0:bx0+0.02, y0:rodY-T*0.4, z0:DEP*0.38,
          x1:bx1-0.02, y1:rodY+T*0.4, z1:DEP*0.62 },
        PAL.rod
      ));

    } else {
      // ── Mode TABLETTES + TRINGLE
      const nS = Math.max(0, shelvesPerBody);

      if (nS > 0) {
        const gap = innerH / (nS + 1);
        for (let s = 0; s < nS; s++) {
          const sy = T + gap * (s + 1);
          allFaces.push(...BF(
            { x0:bx0, y0:sy, z0:0, x1:bx1, y1:sy+T, z1:DEP },
            PAL.shelf
          ));
        }
      }

      if (hasRod) {
        const rodY = T + innerH * (nS > 0 ? 0.78 : 0.65);
        // Tringle
        allFaces.push(...BF(
          { x0:bx0+0.015, y0:rodY-T*0.45, z0:DEP*0.36,
            x1:bx1-0.015, y1:rodY+T*0.45, z1:DEP*0.64 },
          PAL.rod
        ));
        // Supports
        for (const sx of [bx0+0.005, bx1-0.025]) {
          allFaces.push(...BF(
            { x0:sx, y0:rodY-T, z0:DEP*0.36, x1:sx+0.02, y1:rodY+T, z1:DEP*0.64 },
            PAL.handle
          ));
        }
      }

      // Porte si nb_doors
      if ((cabinet.nb_doors || 0) > 0) {
        allFaces.push(...BF(
          { x0:bx0+0.006, y0:T+0.006, z0:-T,
            x1:bx1-0.006, y1:H-T-0.006, z1:0 },
          PAL.door
        ));
        // Poignée porte
        const hx = bx1 - 0.055;
        allFaces.push(...BF(
          { x0:hx, y0:H/2-0.04, z0:-T-0.018,
            x1:hx+0.016, y1:H/2+0.04, z1:-T },
          PAL.handle
        ));
      }
    }
  }

  // Painter's algorithm
  allFaces.sort((a, b) => a.depth - b.depth);

  // Grille
  const gridPath = buildGrid(W * 2.2, DEP * 2.2, th, ph, sc, OX, OY);

  // Cotes
  const dims = buildDimFace(W, H, th, ph, sc, OX, OY);

  // ── Handlers
  const down = (lx, ly) => { drag.current.on = true; drag.current.lx = lx; drag.current.ly = ly; };
  const up   = ()       => { drag.current.on = false; drag.current.ld = null; };
  const move = (cx, cy) => {
    if (!drag.current.on) return;
    const dx = cx - drag.current.lx, dy = cy - drag.current.ly;
    setTheta(t => t - dx * 0.007);
    setPhi(p => Math.max(0.02, Math.min(1.45, p + dy * 0.005)));
    drag.current.lx = cx; drag.current.ly = cy;
  };
  const wheel = e => {
    e.preventDefault();
    const d = e.deltaMode === 0 ? e.deltaY / 16 : e.deltaMode === 1 ? e.deltaY : e.deltaY * 10;
    setZoom(z => Math.max(0.25, Math.min(6, z * (1 + d * 0.025))));
  };
  const tStart = e => {
    if (e.touches.length === 1) { down(e.touches[0].clientX, e.touches[0].clientY); drag.current.on = true; }
    if (e.touches.length === 2) {
      drag.current.on = false;
      drag.current.ld = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };
  const tMove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current.on)
      move(e.touches[0].clientX, e.touches[0].clientY);
    if (e.touches.length === 2 && drag.current.ld) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setZoom(z => Math.max(0.25, Math.min(6, z * (drag.current.ld / d))));
      drag.current.ld = d;
    }
  };

  const snap = (t, p, z = 1) => { setTheta(t); setPhi(p); setZoom(z); };

  return (
    <div className="flex flex-col gap-3">

      <div
        className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: '#030811', userSelect: 'none', cursor: drag.current.on ? 'grabbing' : 'grab' }}
        onMouseDown={e => down(e.clientX, e.clientY)}
        onMouseUp={up} onMouseLeave={up}
        onMouseMove={e => move(e.clientX, e.clientY)}
        onWheel={wheel}
        onTouchStart={tStart} onTouchEnd={up} onTouchMove={tMove}
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
          style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">

          {/* Fond dégradé */}
          <defs>
            <radialGradient id="bg3d" cx="50%" cy="40%" r="60%">
              <stop offset="0%"  stopColor="#0a1628" />
              <stop offset="100%" stopColor="#030811" />
            </radialGradient>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#bg3d)" />

          {/* Grille sol */}
          <path d={gridPath} stroke="#0a1830" strokeWidth="0.6" fill="none" opacity="0.7" />

          {/* Faces triées */}
          {allFaces.map((f, i) => (
            <path key={i} d={f.path} fill={f.fill} stroke={f.stroke}
              strokeWidth={f.sw} opacity={f.a ?? 1} />
          ))}

          {/* ── Cotes dimensions ── */}
          {/* Largeur */}
          <line x1={dims.p0w.sx} y1={dims.p0w.sy} x2={dims.p1w.sx} y2={dims.p1w.sy}
            stroke="#f97316" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.7" />
          <text x={dims.midW.sx} y={dims.midW.sy} textAnchor="middle"
            fontSize="9" fill="#f97316" fontFamily="monospace" opacity="0.9">
            {cabinet.width} cm
          </text>
          {/* Hauteur */}
          <line x1={dims.p0h.sx} y1={dims.p0h.sy} x2={dims.p1h.sx} y2={dims.p1h.sy}
            stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 2" opacity="0.7" />
          <text x={dims.midH.sx} y={dims.midH.sy} textAnchor="middle"
            fontSize="9" fill="#22c55e" fontFamily="monospace" opacity="0.9">
            {cabinet.height} cm
          </text>

          {/* ── Axes XYZ ── */}
          {(() => {
            const O = { x: 46, y: SVG_H - 42 };
            const AS = 20;
            const AP = (ax, ay, az) => {
              const p = iso(ax, ay, az, th, ph, AS, O.x, O.y);
              return [p.sx.toFixed(1), p.sy.toFixed(1)];
            };
            return (
              <g opacity="0.75">
                <circle cx={O.x} cy={O.y} r="2" fill="#fff" />
                {[['X',[1,0,0],'#ef4444'],['Y',[0,1,0],'#22c55e'],['Z',[0,0,1],'#3b82f6']].map(([l,v,c]) => {
                  const [x2,y2] = AP(...v);
                  const [xt,yt] = AP(v[0]*1.4, v[1]*1.4, v[2]*1.4);
                  return (
                    <g key={l}>
                      <line x1={O.x} y1={O.y} x2={x2} y2={y2} stroke={c} strokeWidth="1.5"/>
                      <text x={xt} y={yt} fontSize="8" fill={c} textAnchor="middle" fontWeight="bold">{l}</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Étiquette */}
          <text x={SVG_W-8} y={SVG_H-8} textAnchor="end"
            fontSize="9" fontFamily="monospace" fill="#f97316" opacity="0.7">
            {(name||'MEUBLE').toUpperCase()} • {nbBodies} CORPS
          </text>
        </svg>

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-bold text-orange-400 tracking-widest">3D ISO</span>
        </div>
        <div className="absolute top-3 right-3 flex gap-2">
          <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-mono text-sky-400">
              {nbBodies}×{bodyW > 0 ? Math.round(bodyW*100) : '?'}cm
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-mono text-slate-300">{Math.round(zoom*100)}%</span>
          </div>
        </div>
      </div>

      {/* Vues rapides */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: '↗ Iso',      t: 0.52,         p: 0.32, z: 1 },
          { label: '🔄 Face',    t: Math.PI,      p: 0.5,  z: 1 },
          { label: '⬆ Dessus',  t: 0.52,         p: 0.02, z: 0.9 },
          { label: '➡ Côté',    t: Math.PI/2,    p: 0.45, z: 1 },
          { label: '↙ Arrière', t: Math.PI*2,    p: 0.35, z: 1 },
        ].map(v => (
          <button key={v.label} onClick={() => snap(v.t, v.p, v.z)}
            className="py-2 text-[10px] font-bold text-slate-400 hover:text-white
              bg-[#070e1a] hover:bg-[#0f1c30] border border-white/5 rounded-lg transition-all">
            {v.label}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="bg-[#030811] border border-white/5 rounded-xl p-3">
        <div className="flex flex-wrap gap-3 mb-2">
          {[
            { c: PAL.side.s,    l: 'Montant/Côté' },
            { c: PAL.shelf.s,   l: 'Tablette' },
            { c: PAL.divider.s, l: 'Séparateur' },
            { c: PAL.rod.s,     l: 'Tringle' },
            { c: PAL.drawer.s,  l: 'Tiroir' },
            { c: PAL.door.s,    l: 'Porte' },
            { c: PAL.back.s,    l: 'Dos arrière' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[10px] text-slate-400">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-slate-500">🖱️ <b className="text-slate-400">Glisser</b> = rotation</span>
          <span className="text-[10px] text-slate-500">⚙️ <b className="text-slate-400">Molette</b> = zoom</span>
          <span className="text-[10px] text-slate-500">👆 <b className="text-slate-400">1 doigt</b> = rotation</span>
          <span className="text-[10px] text-slate-500">🤏 <b className="text-slate-400">Pincer</b> = zoom</span>
        </div>
      </div>
    </div>
  );
}
